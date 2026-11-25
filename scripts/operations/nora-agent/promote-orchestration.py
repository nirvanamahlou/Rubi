"""Promote or roll back a built, approved Nora release, one unit at a time.

On the ERP host: python3 promote-orchestration.py STAGE check|up|down api|read|assistant|ingress|web
Each operation holds the shared release lock and refuses unexpected service or image identities.
"""

import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
from urllib import request, error, parse


COMPOSE = Path("/opt/rubi/compose.yaml")
NGINX = Path("/etc/nginx/sites-enabled/rubi").resolve()
WEB_OPTIONS = {
    "NORA_ERP_API_BASE_URL": "http://api:4000/api/v1",
    "NORA_COMPOSITION_ENABLED": "true",
    "NORA_MODEL_PLANNER_ENABLED": "true",
}


def run(*args):
    p = subprocess.run(
        args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180
    )
    if p.returncode:
        raise RuntimeError(f"{args[0]} {args[1]} failed ({p.returncode})")
    return p.stdout.decode()


def inspect(ref):
    return json.loads(run("docker", "inspect", ref))[0]


def atomic(path, data):
    tmp = path.with_name(path.name + ".nora-new")
    with tmp.open("xb") as out:
        out.write(data)
        out.flush()
        os.fsync(out.fileno())
    shutil.copystat(path, tmp)
    existing = path.stat()
    os.chown(tmp, existing.st_uid, existing.st_gid)
    tmp.replace(path)


def compose(*args):
    return run("docker", "compose", "-p", "rubi-production", "-f", str(COMPOSE), *args)


def public_status(url, wanted):
    for _ in range(45):
        try:
            with request.urlopen(url, timeout=3) as r:
                if r.status == wanted:
                    return
        except error.HTTPError as e:
            if e.code == wanted:
                return
        except OSError:
            pass
        time.sleep(2)
    raise RuntimeError(f"Health check failed for {parse.urlsplit(url).path}")


def service_block(content, unit):
    match = re.search(
        rb"(?ms)^  "
        + unit.encode()
        + rb":\n.*?(?=^  [\w-]+:\s*(?:\n|$)|^\w[\w-]*:|\Z)",
        content,
    )
    if not match:
        raise RuntimeError("Missing Compose unit " + unit)
    return match[0]


def modify_compose(content, unit, current, tag, forward):
    old = service_block(content, unit)
    image, n = re.subn(
        rb"(?m)^    image: " + re.escape(current.encode()) + rb"\s*$",
        lambda m: b"    image: " + tag.encode(),
        old,
    )
    if n != 1:
        raise RuntimeError("Concurrent Compose image change")
    if unit == "web":
        added = b"".join(
            b"      " + k.encode() + b": '" + v.encode() + b"'\n"
            for k, v in WEB_OPTIONS.items()
        )
        marker = b"    environment:\n"
        if forward:
            if image.count(marker) != 1 or any(
                re.search(rb"(?m)^      " + k.encode() + rb":", image)
                for k in WEB_OPTIONS
            ):
                raise RuntimeError("Review concurrent Web runtime options")
            image = image.replace(marker, marker + added, 1)
        else:
            if image.count(marker + added) != 1:
                raise RuntimeError("Web flags changed since release")
            image = image.replace(marker + added, marker, 1)
    return content.replace(old, image, 1)


def core(stage, manifest, built, unit, action):
    base = manifest["units"][unit]
    target = built["images"][unit]
    info = inspect(base["name"])
    state = stage / (unit + ".promotion.json")
    if action in ("check", "up"):
        if info["Id"] != base["container"] or info["Image"] != base["image"]:
            raise RuntimeError("Changed live " + unit)
        if inspect(target["tag"])["Id"] != target["id"]:
            raise RuntimeError("Mismatched candidate image")
        orig = info["Config"]["Image"]
        forward = True
    else:
        orig = json.loads(state.read_text())["tag"]
        if info["Image"] != target["id"] or inspect(orig)["Id"] != base["image"]:
            raise RuntimeError("Concurrent image change")
        forward = False
    before = COMPOSE.read_bytes()
    after = modify_compose(
        before,
        unit,
        orig if forward else target["tag"],
        target["tag"] if forward else orig,
        forward,
    )
    if action == "check":
        return
    if forward:
        if state.exists():
            raise RuntimeError("Unit already has a promotion receipt")
        state.write_text(json.dumps({"tag": orig}) + "\n")
    atomic(COMPOSE, after)
    try:
        compose("config", "--quiet")
        compose("up", "-d", "--no-deps", "--no-build", unit)
        public_status(
            "http://127.0.0.1:"
            + ("4000/api/v1/health" if unit == "api" else "3000/login"),
            200,
        )
        if inspect(base["name"])["Image"] != (
            target["id"] if forward else base["image"]
        ):
            raise RuntimeError("Wrong image running")
    except Exception:
        if COMPOSE.read_bytes() != after:
            raise RuntimeError("Concurrent config change; manual recovery required")
        atomic(COMPOSE, before)
        compose("config", "--quiet")
        compose("up", "-d", "--no-deps", "--no-build", unit)
        public_status(
            "http://127.0.0.1:"
            + ("4000/api/v1/health" if unit == "api" else "3000/login"),
            200,
        )
        raise


def create_container(name, payload):
    class UnixDocker(http.client.HTTPConnection):
        def connect(self):
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.sock.settimeout(45)
            self.sock.connect("/var/run/docker.sock")

    c = UnixDocker("localhost")
    try:
        c.request(
            "POST",
            "/containers/create?" + parse.urlencode({"name": name}),
            json.dumps(payload).encode(),
            {"Content-Type": "application/json"},
        )
        r = c.getresponse()
        if r.status != 201:
            raise RuntimeError(
                "Docker create rejected candidate config: " + str(r.status)
            )
        return json.loads(r.read())["Id"]
    finally:
        c.close()


def sidecar(stage, manifest, built, unit, action):
    base = manifest["units"][unit]
    name = base["name"]
    old = inspect(base["container"])
    current = inspect(name)
    parked = name + "-before-" + manifest["head"][:12]
    disabled = name + "-disabled-" + manifest["head"][:12]
    receipt = stage / (unit + ".promotion.json")
    if action == "down":
        if (
            current["Id"] != json.loads(receipt.read_text())["id"]
            or inspect(parked)["Id"] != base["container"]
        ):
            raise RuntimeError("Concurrent sidecar update")
        run("docker", "stop", current["Id"])
        run("docker", "rename", current["Id"], disabled)
        run("docker", "rename", old["Id"], name)
        run("docker", "start", old["Id"])
    else:
        if current["Id"] != base["container"] or current["Image"] != base["image"]:
            raise RuntimeError("Changed live " + unit)
        config = old["Config"].copy()
        host = old["HostConfig"].copy()
        if unit == "read":
            candidate = built["images"]["read"]
            if inspect(candidate["tag"])["Id"] != candidate["id"]:
                raise RuntimeError("Unexpected read image")
            config["Image"] = candidate["id"]
        else:
            mounts = {m["Destination"]: m["Source"] for m in old["Mounts"]}
            if (
                hashlib.sha256(
                    Path(mounts["/nora-runtime.mjs"]).read_bytes()
                ).hexdigest()
                != base["runtimeSha"]
            ):
                raise RuntimeError("Assistant launcher changed")
            new_path = stage / "assistant" / "source"
            if not new_path.is_dir():
                raise RuntimeError("Candidate source missing")
            # Bind strings originate in Docker; only replace the exact app-source mount.
            replaces = [
                b
                for b in host["Binds"]
                if b.startswith(mounts["/nora-source"] + ":/nora-source:")
            ]
            if len(replaces) != 1:
                raise RuntimeError("Unexpected source mount")
            host["Binds"] = [
                (
                    b.replace(mounts["/nora-source"] + ":", str(new_path) + ":", 1)
                    if b == replaces[0]
                    else b
                )
                for b in host["Binds"]
            ]
            config["Env"] = [
                v
                for v in config["Env"]
                if not v.startswith("NORA_MODEL_PLANNER_ENABLED=")
            ] + ["NORA_MODEL_PLANNER_ENABLED=true"]
            config["Image"] = base["image"]
        config["HostConfig"] = host
        config["Labels"] = {
            **(config.get("Labels") or {}),
            "com.rubi.nora.patch": manifest["head"],
        }
        if host["NetworkMode"] != "host":
            config["NetworkingConfig"] = {
                "EndpointsConfig": {
                    k: {"Aliases": v.get("Aliases") or []}
                    for k, v in old["NetworkSettings"]["Networks"].items()
                }
            }
        if action == "check":
            return
        if receipt.exists():
            raise RuntimeError("Existing candidate receipt")
        candidate_id = None
        run("docker", "stop", old["Id"])
        try:
            run("docker", "rename", old["Id"], parked)
            candidate_id = create_container(name, config)
            run("docker", "start", candidate_id)
            public_status(
                "http://127.0.0.1:"
                + ("4301/api/v1/iam/auth/access" if unit == "read" else "4300/health"),
                401 if unit == "read" else 200,
            )
            receipt.write_text(json.dumps({"id": candidate_id}) + "\n")
        except Exception:
            if candidate_id:
                run("docker", "stop", candidate_id)
                run("docker", "rename", candidate_id, disabled)
            if inspect(old["Id"])["Name"] != "/" + name:
                run("docker", "rename", old["Id"], name)
            run("docker", "start", old["Id"])
            raise
    public_status(
        "http://127.0.0.1:"
        + ("4301/api/v1/iam/auth/access" if unit == "read" else "4300/health"),
        401 if unit == "read" else 200,
    )


def ingress(stage, action):
    before = NGINX.read_bytes()
    named = b"location = /v3/assistant/conversation {"
    plan = b"location = /v3/assistant/plan {"
    if before.count(named) != 1:
        raise RuntimeError("Expected unique v3 ingress")
    a = before.index(named)
    opening = before.index(b"{", a)
    level = 1
    for i in range(opening + 1, len(before)):
        level += (before[i] == 123) - (before[i] == 125)
        if level == 0:
            break
    if level:
        raise RuntimeError("Invalid v3 ingress block")
    existing = before[a : i + 1]
    block = b"\n" + existing.replace(named, plan, 1) + b"\n"
    if action in ("check", "up") and plan in before:
        raise RuntimeError("Plan ingress exists; compare peer change")
    if action == "down" and before.count(block) != 1:
        raise RuntimeError("Plan ingress drifted")
    if action == "check":
        return
    after = (
        before[: i + 1] + block + before[i + 1 :]
        if action == "up"
        else before.replace(block, b"", 1)
    )
    atomic(NGINX, after)
    try:
        run("nginx", "-t")
        run("systemctl", "reload", "nginx")
    except Exception:
        if NGINX.read_bytes() == after:
            atomic(NGINX, before)
            run("nginx", "-t")
            run("systemctl", "reload", "nginx")
        raise


if __name__ == "__main__":
    os.umask(0o077)
    if (
        len(sys.argv) != 4
        or sys.argv[2] not in ("up", "down", "check")
        or sys.argv[3] not in ("api", "read", "assistant", "ingress", "web")
    ):
        sys.exit(__doc__)
    stage = Path(sys.argv[1]).resolve()
    action, unit = sys.argv[2:]
    manifest = json.loads((stage / "manifest.json").read_text())
    built = json.loads((stage / "built.json").read_text())
    if (
        not re.fullmatch("[a-f0-9]{40}", manifest["head"])
        or built["revision"] != manifest["head"]
    ):
        raise RuntimeError("Candidate revision mismatch")
    with open("/opt/rubi/avina-deploy.lock", "a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if unit in ("api", "web"):
            core(stage, manifest, built, unit, action)
        elif unit in ("read", "assistant"):
            sidecar(stage, manifest, built, unit, action)
        else:
            ingress(stage, action)
    print(action, unit, "OK")
