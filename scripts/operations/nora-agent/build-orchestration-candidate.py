"""On the ERP host, verify the prepared manifest, then build offline candidates.

python3 build-orchestration-candidate.py /opt/rubi/RELEASE check|build|build-updates [previous-private-stage]
No live service is started, stopped, recreated, reloaded or reconfigured here.
"""

from pathlib import Path
import base64
import hashlib
import http.client
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
from orchestration_source import (
    check_artifact_drift,
    source_tree,
    verify_assistant_source,
)


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def probe_read_route(port, method, route, status):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
    try:
        connection.request(method, "/api/v1/" + route)
        response = connection.getresponse()
        content_type = response.getheader("Content-Type", "")
        if response.status != status or not content_type.startswith("application/json"):
            raise RuntimeError(
                f"Unexpected private read canary response: {method} {route} {response.status}"
            )
        return json.loads(response.read(8192))
    finally:
        connection.close()


def check_read_canary(active, image_id):
    """Boot only the owner read process on private loopback, as its real non-root UID."""
    info = json.loads(docker("inspect", active))[0]
    if (
        info["Config"]["User"] != "1000:1000"
        or info["HostConfig"]["NetworkMode"] != "host"
        or info["Config"]["Entrypoint"] != ["node"]
        or info["Config"]["Cmd"] != ["apps/api/dist/assistant-read/main.js"]
    ):
        raise RuntimeError("Review changed assistant-read launcher")
    source_env = dict(item.split("=", 1) for item in info["Config"]["Env"])
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    # Forward the two private database settings only between host and daemon.
    # Auth and contact keys are disposable and cannot accept a real ERP session.
    settings = {
        key: source_env[key]
        for key in ("DATABASE_URL", "ASSISTANT_AGENT_DATABASE_URL")
    }
    settings.update(
        ASSISTANT_AGENT_ENABLED="true",
        ERP_ASSISTANT_READ_PORT=str(port),
        IAM_ACCESS_TOKEN_SECRET=secrets.token_hex(48),
        MASTER_DATA_IMPORT_TOKEN_KEY_BASE64=base64.b64encode(os.urandom(32)).decode(),
    )
    name = "nora-private-read-" + secrets.token_hex(8)
    flags = [token for key in settings for token in ("--env", key)]
    container = subprocess.check_output(
        [
            "docker", "create", "--name", name, "--read-only", "--network", "host",
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--memory", "512m", "--pids-limit", "100", "--user", "1000:1000",
            "--workdir", "/workspace", "--entrypoint", "node",
            *flags, image_id, *info["Config"]["Cmd"],
        ],
        env={**os.environ, **settings},
        text=True,
    ).strip()
    if not re.fullmatch(r"[0-9a-f]{64}", container):
        raise RuntimeError("Private read canary identity missing")
    try:
        docker("start", container)
        deadline = time.monotonic() + 60
        while True:
            try:
                health = probe_read_route(port, "GET", "health", 200)
                if (
                    health.get("service") != "erp-assistant-read"
                    or health.get("readOnly") is not True
                ):
                    raise RuntimeError("Private read canary health identity mismatch")
                break
            except OSError:
                running = docker("inspect", "--format", "{{.State.Running}}", container)
                if time.monotonic() >= deadline or running != "true":
                    raise RuntimeError(
                        "Private read canary could not start as its runtime user"
                    ) from None
                time.sleep(0.5)
        for method, route, expected in (
            ("GET", "my-contract-count", 401),
            ("GET", "standard-sales-summary", 401),
            ("POST", "my-contract-count", 405),
            ("GET", "unregistered-canary-route", 404),
        ):
            probe_read_route(port, method, "sales/assistant-agent/" + route, expected)
            print("PRIVATE_READ_CANARY", method, route, expected, flush=True)
    finally:
        docker("rm", "--force", container)


def verify(stage, manifest):
    if not re.fullmatch(r"[a-f0-9]{40}", manifest["head"]):
        raise ValueError("A committed release is required")
    for unit, state in manifest["units"].items():
        info = json.loads(docker("inspect", state["name"]))[0]
        if (info["Id"], info["Image"]) != (state["container"], state["image"]):
            raise RuntimeError(f"Concurrent service change: {unit}")
        check_artifact_drift(info)
        if unit == "assistant":
            verify_assistant_source(info, state)
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


def reuse_verified_component(previous, stage, unit, state, tag, revision):
    """A new Git SHA may change only Web. Reuse a previously certified component's bytes."""
    if previous is None:
        return False
    receipt = previous / "built.json"
    if not receipt.is_file():
        return False
    old_manifest = json.loads((previous / "manifest.json").read_text())
    old = old_manifest["units"][unit]
    built = json.loads(receipt.read_text())
    if (
        built["revision"] != old_manifest["head"]
        or old["image"] != state["image"]
        or old["overlayFiles"] != state["overlayFiles"]
        or (previous / unit / "Dockerfile").read_bytes()
        != (stage / unit / "Dockerfile").read_bytes()
    ):
        return False
    image = built["images"][unit]
    if docker("image", "inspect", "--format", "{{.Id}}", image["id"]) != image["id"]:
        raise RuntimeError("Prior immutable component unavailable")
    pinned = "rubi-nora-certified:" + image["id"][7:]
    docker("tag", image["id"], pinned)
    recipe = f"FROM {pinned}\nLABEL com.rubi.nora.patch={revision}\n"
    with (stage / f"{unit}.log").open("w") as log:
        subprocess.run(
            ["docker", "build", "--network", "none", "-t", tag, "-"],
            input=recipe,
            text=True,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=True,
        )
    print("REUSED_VERIFIED_CONTENT", unit, built["revision"], flush=True)
    return True


def affected_units(mode, units):
    order = ("api", "read", "web", "assistant")
    if mode == "build":
        return order
    if mode != "build-updates":
        raise ValueError("Expected check, build or build-updates")
    if set(units) != set(order):
        raise ValueError("Incomplete service inventory")
    selected = tuple(unit for unit in order if units[unit]["overlayFiles"])
    if not selected:
        raise ValueError("No runtime updates in candidate")
    return selected


def build(stage, previous=None):
    manifest = json.loads((stage / "manifest.json").read_text())
    verify(stage, manifest)
    if sys.argv[2] == "check":
        print("CANDIDATE_BASELINES_MATCH")
        return
    selected = affected_units(sys.argv[2], manifest["units"])
    sha = manifest["head"]
    receipt = {"revision": sha, "images": {}}
    for unit in ("api", "read", "web"):
        if unit not in selected:
            continue
        state = manifest["units"][unit]
        base = f'rubi-nora-prebuild:{sha[:12]}-{unit}-{state["image"][7:19]}'
        tag = f"rubi-nora-candidate:{sha[:12]}-{unit}"
        docker("tag", state["image"], base)
        print("BUILDING", unit, flush=True)
        reused = reuse_verified_component(previous, stage, unit, state, tag, sha)
        if not reused:
            build_component(stage, unit, sha, base, tag)
        receipt["images"][unit] = {
            "tag": tag,
            "id": docker("image", "inspect", "--format", "{{.Id}}", tag),
        }
        if unit == "read":
            check_read_canary(state["name"], receipt["images"][unit]["id"])
        elif unit == "web":
            check_web_guides(state, receipt["images"][unit]["id"])
        print("BUILT", unit, receipt["images"][unit]["id"][:19], flush=True)
    if "assistant" in selected:
        stage_source(stage, manifest, receipt)
    verify(stage, manifest)
    (stage / "built.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("CANDIDATES_READY", sha, flush=True)


def build_component(stage, unit, sha, base, tag):
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


def check_web_guides(state, image_id):
    for path in (
        "services/assistant/call-center-guides.json",
        "services/assistant/workbench-guides.json",
    ):
        expected = state["overlayFiles"].get(path)
        if (
            expected
            and docker(
                "run",
                "--rm",
                "--read-only",
                "--network",
                "none",
                "--entrypoint",
                "sha256sum",
                image_id,
                "/workspace/" + path,
            ).split()[0]
            != expected
        ):
            raise RuntimeError("Web candidate uses stale guide data")


def stage_source(stage, manifest, receipt):
    state = manifest["units"]["assistant"]
    mounts = {
        m["Destination"]: Path(m["Source"])
        for m in json.loads(docker("inspect", state["name"]))[0]["Mounts"]
    }
    source = stage / "assistant" / "source"
    if source.exists():
        raise RuntimeError("Candidate source already exists; use a fresh stage")
    allowed = set(state["allowedSource"])
    if source_tree(mounts["/nora-source"], allowed, source) != state["sourceSha"]:
        raise RuntimeError("Assistant tree changed during copy")
    overlay = stage / "assistant" / "overlay"
    source_tree(overlay, allowed)
    for f in overlay.iterdir():
        shutil.copyfile(f, source / f.name, follow_symlinks=False)
    for f in source.iterdir():
        f.chmod(0o644)
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
    receipt["assistantSourceSha"] = source_tree(source, allowed)


if __name__ == "__main__":
    os.umask(0o077)
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    build(
        Path(sys.argv[1]).resolve(),
        Path(sys.argv[3]).resolve() if len(sys.argv) == 4 else None,
    )
