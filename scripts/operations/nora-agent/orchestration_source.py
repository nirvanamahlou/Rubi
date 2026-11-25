"""Read-only integrity checks used to build and promote live-aware candidates."""

from pathlib import Path
import hashlib
import os
import stat
import subprocess


def source_tree(root, allowed, destination=None):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Unexpected mounted source directory")
    digest = hashlib.sha256()
    if destination is not None:
        destination.mkdir(mode=0o700, exist_ok=False)
    for entry in sorted(root.iterdir()):
        if entry.name not in allowed or entry.is_symlink() or not entry.is_file():
            raise ValueError(
                "Unreviewed entry in Nora source; coordinate with release owner"
            )
        fd = os.open(entry, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as reader:
            info = os.fstat(reader.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > 8 * 1024 * 1024:
                raise ValueError("Unexpected Nora source file")
            contents = reader.read()
        digest.update(entry.name.encode() + b"\0" + hashlib.sha256(contents).digest())
        if destination is not None:
            (destination / entry.name).write_bytes(contents)
    return digest.hexdigest()


def check_artifact_drift(inspected):
    """Writable runtime files and source mounts can shadow bytes in Docker's base image."""
    public = "/workspace/apps/web/public"
    for mount in inspected["Mounts"]:
        path = mount["Destination"].rstrip("/")
        if (
            not path or path == "/workspace" or path.startswith("/workspace/")
        ) and path != public:
            raise RuntimeError("Review mount shadowing the base image")
    result = subprocess.run(
        ["docker", "diff", inspected["Id"]], capture_output=True, text=True, check=True
    )
    for line in result.stdout.splitlines():
        action, path = line.split(" ", 1)
        if (
            not path.startswith("/workspace/")
            or path.startswith(public + "/")
            or "/.next/cache/" in path
        ):
            continue
        if action in ("A", "D") or Path(path).suffix in (
            ".js",
            ".mjs",
            ".cjs",
            ".ts",
            ".tsx",
            ".json",
            ".node",
            ".prisma",
            ".css",
            ".wasm",
        ):
            raise RuntimeError(
                "Review writable-layer changes before replacing the base image"
            )


def verify_assistant_source(inspected, state, candidate=None, expected_candidate=None):
    mounts = {m["Destination"]: Path(m["Source"]) for m in inspected["Mounts"]}
    allowed = set(state["allowedSource"])
    if source_tree(mounts["/nora-source"], allowed) != state["sourceSha"]:
        raise RuntimeError("Active Nora source changed")
    launcher = mounts["/nora-runtime.mjs"]
    if (
        launcher.is_symlink()
        or not launcher.is_file()
        or hashlib.sha256(launcher.read_bytes()).hexdigest() != state["runtimeSha"]
    ):
        raise RuntimeError("Active Nora entrypoint changed")
    if candidate is not None and source_tree(candidate, allowed) != expected_candidate:
        raise RuntimeError("Staged Nora source changed")
