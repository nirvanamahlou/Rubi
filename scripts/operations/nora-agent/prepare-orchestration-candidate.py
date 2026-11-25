"""Prepare a local three-way overlay from reviewed sources. SSH access is read-only.

Usage: python prepare-orchestration-candidate.py BASE_SHA HEAD_SHA|WORKTREE NEW_DIRECTORY
Run at repository root. WORKTREE is a planning preview and cannot be released.
"""

import base64
import hashlib
import inspect
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
import orchestration_source


def command(*args, stdin=None, required=True):
    p = subprocess.run(
        args, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if required and p.returncode:
        raise RuntimeError(
            f"{args[0]} {args[1]} failed ({p.returncode}); candidate incomplete"
        )
    return p


def normalize(data):
    return data.replace(b"\r\n", b"\n") if data is not None else None


def read_git(rev, path):
    p = command("git", "show", f"{rev}:{path}", required=False)
    if (
        p.returncode
        and b"does not exist" not in p.stderr
        and b"exists on disk, but not in" not in p.stderr
    ):
        raise RuntimeError(f"Unable to read {path} at {rev}")
    return normalize(p.stdout) if not p.returncode else None


def merge_source(path, base, live, target):
    if target is None:
        raise ValueError(f"Source deletion needs explicit review: {path}")
    if live == base or live == target:
        return target
    if base is None or live is None:
        raise ValueError(f"Concurrent file creation or removal: {path}")
    if path.endswith(("/en-overrides.json", "/en-catalog.json")):
        absent = object()
        old, current, new = map(json.loads, (base, live, target))
        for key in old.keys() | new.keys():
            before, after, existing = (
                old.get(key, absent),
                new.get(key, absent),
                current.get(key, absent),
            )
            if before == after:
                continue
            if existing != before and existing != after:
                raise ValueError(f"Conflicting translated value in {path}")
            if after is absent:
                current.pop(key, None)
            else:
                current[key] = after
        return (json.dumps(current, ensure_ascii=False, indent=2) + "\n").encode()
    with TemporaryDirectory() as directory:
        files = [Path(directory) / key for key in ("live", "base", "target")]
        for f, content in zip(files, (live, base, target)):
            f.write_bytes(content)
        p = command("git", "merge-file", "-p", *map(str, files), required=False)
        if p.returncode:
            raise ValueError(f"Overlapping live changes: {path}")
        return p.stdout


def paths(*args):
    return [s.decode() for s in command("git", *args).stdout.split(b"\0") if s]


def candidate_dockerfile(unit):
    common = [
        "ARG BASE_IMAGE",
        "FROM ${BASE_IMAGE}",
        "ARG RELEASE_SHA",
        "LABEL com.rubi.nora.patch=${RELEASE_SHA}",
        "WORKDIR /workspace",
        "COPY overlay/ /workspace/",
    ]
    if unit in ("api", "web"):
        common.append(
            "RUN node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.build.json"
        )
    if unit == "read":
        common += [
            # Isolated 4301 uses an older full API base. Compile its actual entrypoint
            # and all transitive dependencies without rebuilding unshipped mail integrations.
            "USER 0:0",
            """RUN echo '{"extends":"./tsconfig.build.json","include":[],"files":["src/assistant-read/main.ts"]}' > apps/api/tsconfig.nora-read.json && NODE_OPTIONS=--max-old-space-size=4608 node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.nora-read.json""",
            "USER 1000:1000",
        ]
    elif unit == "api":
        common.append(
            "RUN NODE_OPTIONS=--max-old-space-size=4608 node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.build.json"
        )
    else:
        common += [
            "WORKDIR /workspace/apps/web",
            "ENV NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED=true NEXT_PUBLIC_NORA_MODEL_PLANNER_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1",
            # Keep old hashed chunks for tabs already open; verify the fresh client first.
            'RUN previous=$(mktemp -d /tmp/nora-static.XXXXXX) && cp -a .next/static/. "$previous/" && node node_modules/next/dist/bin/next build --webpack && node /workspace/scripts/operations/nora-agent/verify-web-build.mjs .next/static && cp -an "$previous/." .next/static/ && rm -rf "$previous"',
        ]
    return "\n".join(common) + "\n"


UNITS = {
    "api": ("rubi-production-api-1", ("apps/api/src/", "packages/contracts/src/")),
    "web": (
        "rubi-production-web-1",
        (
            "apps/web/src/",
            "packages/contracts/src/",
            "services/assistant/call-center-guides.json",
            "services/assistant/workbench-guides.json",
        ),
    ),
    # 4301 has its own older image and a narrow module. The authenticated rolling-sales
    # route needs only these readers. Panels, voucher owner and contracts export use 4000.
    "read": (
        "rubi-nora-assistant-read",
        ("apps/api/src/assistant-read/", "apps/api/src/sales/assistant-agent/"),
    ),
    "assistant": ("rubi-nora-assistant", ("services/assistant/",)),
}

REMOTE_READ = r"""
import json, subprocess, hashlib, pathlib
unit, files, is_assistant, allowed = PARAMETERS
def inspect(): return json.loads(subprocess.check_output(["docker","inspect",unit]))[0]
before = inspect()
script = '''const fs=require("node:fs");
const input=JSON.parse(fs.readFileSync(0,"utf8"));
const result={};
for(const [key,path] of Object.entries(input)){
  try{
    if(fs.realpathSync(path)!==path) throw new Error("Unexpected source symlink");
    const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    try{
      const stat=fs.fstatSync(fd);
      if(!stat.isFile()||stat.size>8*1024*1024) throw new Error("Unexpected source type or size");
      result[key]=fs.readFileSync(fd).toString("base64");
    }finally{fs.closeSync(fd)}
  }catch(e){if(e.code!=="ENOENT")throw e;result[key]=null}
}
process.stdout.write(JSON.stringify(result));'''
sources = {f: ("/nora-source/"+f.removeprefix("services/assistant/") if is_assistant else "/workspace/"+f) for f in files}
# Prior read-service images compile root-owned source overlays and run only dist as node.
# Read the named Git source files for the three-way comparison without changing their modes.
data = subprocess.check_output(["docker","exec","-i","--user","0:0",unit,"node","-e",script],input=json.dumps(sources).encode())
after = inspect()
assert before["Id"] == after["Id"] and before["Image"] == after["Image"]
mounts = {}
if is_assistant:
 for mount in before["Mounts"]:
  dst = mount["Destination"]
  if dst not in ["/nora-source", "/nora-runtime.mjs"]: continue
  path=pathlib.Path(mount["Source"])
  if dst=="/nora-runtime.mjs": mounts["runtimeSha"]=hashlib.sha256(path.read_bytes()).hexdigest()
  else:
   mounts["sourceSha"]=source_tree(path, allowed)
   mounts["allowedSource"]=allowed
print(json.dumps({"containerId":before["Id"],"imageId":before["Image"],"files":json.loads(data),"mounts":mounts}))
"""


def prepare(base, head, dest):
    if not re.fullmatch("[a-f0-9]{40}", base) or not (
        head == "WORKTREE" or re.fullmatch("[a-f0-9]{40}", head)
    ):
        raise ValueError("Pass full commit hashes or WORKTREE for a preview")
    if head != "WORKTREE":
        command("git", "merge-base", "--is-ancestor", base, head)
    else:
        command("git", "merge-base", "--is-ancestor", base, "HEAD")
    os.umask(0o077)
    dest.mkdir(parents=True, exist_ok=False)
    selected = set(
        paths(
            "diff",
            "--name-only",
            "--no-renames",
            "-z",
            base,
            *([] if head == "WORKTREE" else [head]),
            "--",
        )
    )
    if head == "WORKTREE":
        selected.update(
            paths(
                "ls-files",
                "-z",
                "--others",
                "--exclude-standard",
                "--",
                "apps/api/src",
                "apps/web/src",
                "packages/contracts/src",
                "services/assistant",
            )
        )
    # Dependency, schema, runtime asset or other module changes require a different build recipe.
    for path in selected:
        if (
            path.startswith(("apps/api/", "apps/web/", "packages/", "services/"))
            or path in ("package.json", "pnpm-lock.yaml")
        ) and not (
            any(path.startswith(prefixes) for _, prefixes in UNITS.values())
            or path == "services/assistant/README.md"
        ):
            raise ValueError(f"Review uncovered release input: {path}")
    allowed = {
        p.removeprefix("services/assistant/")
        for ref in (base, "HEAD" if head == "WORKTREE" else head)
        for p in paths(
            "ls-tree", "-r", "--name-only", "-z", ref, "--", "services/assistant"
        )
        if re.fullmatch(r"services/assistant/(?:[\w.-]+\.(?:mjs|json)|README\.md)", p)
    }
    if head == "WORKTREE":
        allowed.update(
            p.removeprefix("services/assistant/")
            for p in selected
            if re.fullmatch(r"services/assistant/[\w.-]+\.(?:mjs|json)", p)
        )
    manifest = {"base": base, "head": head, "units": {}}
    for label, (unit, prefixes) in UNITS.items():
        files = sorted(
            p
            for p in selected
            if p.startswith(prefixes)
            and re.search(r"\.(?:[cm]?[jt]sx?|css|json)$", p)
            and not re.search(r"\.(?:test|spec|e2e-spec)\.[cm]?[jt]sx?$", p)
        )
        if any(
            ".." in Path(p).parts or not re.fullmatch(r"[\w/\-.()\[\]]+", p)
            for p in files
        ):
            raise ValueError("Unexpected source path")
        program = (
            inspect.getsource(orchestration_source)
            + "\n"
            + REMOTE_READ.replace(
                "PARAMETERS",
                repr(
                    [
                        unit,
                        files,
                        label == "assistant",
                        sorted(allowed) if label == "assistant" else [],
                    ]
                ),
            )
        )
        reply = json.loads(
            command(
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=8",
                "rubi-erp",
                "python3",
                "-",
                stdin=program.encode(),
            ).stdout
        )
        effective, overlays = {}, {}
        for path in files:
            encoded = reply["files"][path]
            live = (
                normalize(base64.b64decode(encoded, validate=True))
                if encoded is not None
                else None
            )
            target = (
                (normalize(Path(path).read_bytes()) if Path(path).is_file() else None)
                if head == "WORKTREE"
                else read_git(head, path)
            )
            git_base = read_git(base, path)
            if (
                label == "web"
                and path.startswith("services/assistant/")
                and live is not None
            ):
                # Some Web images carry an older generated catalogue. A blob reachable
                # from the recorded base at this exact path is safe to fast-forward.
                oid = (
                    hashlib.sha1(b"blob " + str(len(live)).encode() + b"\x00" + live)
                    .hexdigest()
                    .encode()
                )
                history = command(
                    "git", "rev-list", "--objects", base, "--", path
                ).stdout.splitlines()
                if oid + b" " + path.encode() in history:
                    git_base = live
            merged = merge_source(path, git_base, live, target)
            effective[path] = (
                hashlib.sha256(live).hexdigest() if live is not None else None
            )
            overlays[path] = hashlib.sha256(merged).hexdigest()
            name = (
                path.removeprefix("services/assistant/")
                if label == "assistant"
                else path
            )
            out = dest / label / "overlay" / name
            out.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            out.write_bytes(merged)
        manifest["units"][label] = {
            "name": unit,
            "container": reply["containerId"],
            "image": reply["imageId"],
            "baseFiles": effective,
            "overlayFiles": overlays,
            **reply["mounts"],
        }
        if label != "assistant":
            folder = dest / label
            folder.mkdir(exist_ok=True)
            (folder / "Dockerfile").write_text(
                candidate_dockerfile(label), encoding="utf8"
            )
        print(f"{label}: {len(files)} reviewed source overlays", flush=True)
    # The manifest is the completion marker. A directory from a failed run cannot be activated.
    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf8"
    )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    prepare(sys.argv[1], sys.argv[2], Path(sys.argv[3]))
