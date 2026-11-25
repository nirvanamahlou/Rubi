"""On the ERP host, verify the prepared manifest, then build offline candidates.

python3 build-orchestration-candidate.py /opt/rubi/RELEASE check|build
No live service is started, stopped, recreated, reloaded or reconfigured here.
"""

from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def tree_digest(source):
    digest = hashlib.sha256()
    for f in sorted(source.rglob("*")):
        if f.is_file() and f.suffix in (".mjs", ".json"):
            digest.update(
                f.relative_to(source).as_posix().encode()
                + b"\0"
                + hashlib.sha256(f.read_bytes()).digest()
            )
    return digest.hexdigest()


def verify(stage, manifest):
    if not re.fullmatch(r"[a-f0-9]{40}", manifest["head"]):
        raise ValueError("A committed release is required")
    for unit, state in manifest["units"].items():
        info = json.loads(docker("inspect", state["name"]))[0]
        if (info["Id"], info["Image"]) != (state["container"], state["image"]):
            raise RuntimeError(f"Concurrent service change: {unit}")
        if unit == "assistant":
            mounts = {m["Destination"]: Path(m["Source"]) for m in info["Mounts"]}
            if (
                tree_digest(mounts["/nora-source"]) != state["sourceSha"]
                or hashlib.sha256(mounts["/nora-runtime.mjs"].read_bytes()).hexdigest()
                != state["runtimeSha"]
            ):
                raise RuntimeError("Concurrent assistant source or launcher change")
        for path, sha in state["overlayFiles"].items():
            relative = (
                path.removeprefix("services/assistant/")
                if unit == "assistant"
                else path
            )
            if (
                hashlib.sha256(
                    (stage / unit / "overlay" / relative).read_bytes()
                ).hexdigest()
                != sha
            ):
                raise RuntimeError("Invalid overlay for " + path)


def build(stage):
    manifest = json.loads((stage / "manifest.json").read_text())
    verify(stage, manifest)
    if sys.argv[2] == "check":
        print("CANDIDATE_BASELINES_MATCH")
        return
    if sys.argv[2] != "build":
        raise ValueError("Expected check or build")
    sha = manifest["head"]
    receipt = {"revision": sha, "images": {}}
    for unit in ("api", "read", "web"):
        state = manifest["units"][unit]
        base = f'rubi-nora-prebuild:{sha[:12]}-{unit}-{state["image"][7:19]}'
        tag = f"rubi-nora-candidate:{sha[:12]}-{unit}"
        docker("tag", state["image"], base)
        print("BUILDING", unit, flush=True)
        with (stage / f"{unit}.log").open("w") as log:
            p = subprocess.run(
                [
                    "docker",
                    "build",
                    "--network",
                    "none",
                    "--build-arg",
                    "BASE_IMAGE=" + base,
                    "--build-arg",
                    "RELEASE_SHA=" + sha,
                    "-t",
                    tag,
                    str(stage / unit),
                ],
                stdout=log,
                stderr=subprocess.STDOUT,
            )
        if p.returncode:
            raise RuntimeError(
                f"{unit} candidate build failed; inspect its private build log"
            )
        receipt["images"][unit] = {
            "tag": tag,
            "id": docker("image", "inspect", "--format", "{{.Id}}", tag),
        }
        print("BUILT", unit, receipt["images"][unit]["id"][:19], flush=True)
    state = manifest["units"]["assistant"]
    mounts = {
        m["Destination"]: Path(m["Source"])
        for m in json.loads(docker("inspect", state["name"]))[0]["Mounts"]
    }
    source = stage / "assistant" / "source"
    if source.exists():
        raise RuntimeError("Candidate source already exists; use a fresh stage")
    shutil.copytree(mounts["/nora-source"], source)
    shutil.copytree(stage / "assistant" / "overlay", source, dirs_exist_ok=True)
    # Match source permissions of the current unprivileged service inside the mount.
    for f in source.rglob("*"):
        if f.is_symlink():
            raise ValueError("Review assistant symlink before staging")
        f.chmod(0o755 if f.is_dir() else 0o644)
    source.chmod(0o755)
    docker(
        "run",
        "--rm",
        "--read-only",
        "--network",
        "none",
        "--user",
        "1000:1000",
        "--entrypoint",
        "node",
        "-v",
        str(source) + ":/nora-source:ro",
        state["image"],
        "--input-type=module",
        "-e",
        "await import('/nora-source/server.mjs')",
    )
    receipt["assistantSourceSha"] = tree_digest(source)
    verify(stage, manifest)
    (stage / "built.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("CANDIDATES_READY", sha, flush=True)


if __name__ == "__main__":
    os.umask(0o077)
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    build(Path(sys.argv[1]).resolve())
