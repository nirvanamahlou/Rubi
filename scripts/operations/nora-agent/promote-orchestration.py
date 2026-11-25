"""Promote or roll back a built, approved Nora release, one unit at a time.

On the ERP host: python3 promote-orchestration.py STAGE check|up|down api|read|assistant|ingress|web
Each operation holds the shared release lock and refuses unexpected service or image identities.
"""

import http.client
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import ssl
from tempfile import NamedTemporaryFile
from uuid import uuid4
from urllib import parse
from orchestration_source import check_artifact_drift, verify_assistant_source


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
    original = path.stat() if path.exists() else None
    with NamedTemporaryFile(dir=path.parent, prefix=".nora-", delete=False) as stream:
        tmp = Path(stream.name)
        try:
            stream.write(data)
            stream.flush()
            if original:
                if hasattr(os, "fchown"):
                    os.fchown(stream.fileno(), original.st_uid, original.st_gid)
                os.chmod(tmp, original.st_mode & 0o7777)
            os.fsync(stream.fileno())
        except Exception:
            stream.close()
            tmp.unlink(missing_ok=True)
            raise
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def save_receipt(path, value):
    atomic(path, (json.dumps(value) + "\n").encode())


def compose(*args):
    return run("docker", "compose", "-p", "rubi-production", "-f", str(COMPOSE), *args)


def probe(url, wanted, method="GET", response_type="application/json", origin=None):
    # Never follow redirects. Public TLS probes use the local ingress with its real SNI.
    target = parse.urlsplit(url)
    for _ in range(30):
        conn = None
        try:
            headers = {"Host": target.netloc}
            if origin:
                headers["Origin"] = origin
            body = b"{}" if method == "POST" else None
            if body:
                headers["Content-Type"] = "application/json"
            if target.scheme == "https":
                conn = http.client.HTTPSConnection(
                    target.hostname, target.port or 443, timeout=3
                )
                local = socket.create_connection(("127.0.0.1", target.port or 443), 3)
                try:
                    conn.sock = ssl.create_default_context().wrap_socket(
                        local, server_hostname=target.hostname
                    )
                except Exception:
                    local.close()
                    raise
            else:
                conn = http.client.HTTPConnection(
                    target.hostname, target.port, timeout=3
                )
            path = target.path + ("?" + target.query if target.query else "")
            conn.request(method, path, body=body, headers=headers)
            reply = conn.getresponse()
            actual_type = (
                (reply.getheader("Content-Type") or "").split(";")[0].strip().lower()
            )
            if reply.status == wanted and (
                not response_type or actual_type == response_type
            ):
                return
        except (OSError, http.client.HTTPException):
            pass
        finally:
            if conn:
                conn.close()
        time.sleep(1)
    raise RuntimeError(f"Health check failed: {method} {target.path} expected {wanted}")


def health(unit, candidate):
    if unit == "api":
        probe("http://127.0.0.1:4000/api/v1/health", 200)
        probe("http://127.0.0.1:4000/api/v1/iam/auth/access", 401)
        if candidate:
            probe(
                "http://127.0.0.1:4000/api/v1/reports/nora/settled-vouchers?pageSize=1",
                401,
            )
    elif unit == "read":
        probe("http://127.0.0.1:4301/api/v1/iam/auth/access", 401)
        if candidate:
            probe(
                "http://127.0.0.1:4301/api/v1/sales/assistant-agent/rolling-sales",
                401,
                "POST",
            )
    elif unit == "assistant":
        probe("http://127.0.0.1:4300/health", 200)
        probe("http://127.0.0.1:4300/v3/assistant/conversation", 401, "POST")
        if candidate:
            probe("http://127.0.0.1:4300/v3/assistant/plan", 401, "POST")
    elif unit == "ingress":
        public = "https://avinaofficial.ir"
        for path in ["/v3/assistant/conversation"] + (
            ["/v3/assistant/plan"] if candidate else []
        ):
            probe(public + path, 401, "POST")
            probe(public + path, 403, "POST", response_type=None, origin=public)
    else:
        probe("http://127.0.0.1:3000/login", 200, response_type="text/html")
        # The existing nginx validates public Origin and translates it to the Next origin.
        public = "https://avinaofficial.ir"
        probe(
            public + "/api/assistant/v3/conversation", 403, "POST", response_type=None
        )
        probe(public + "/api/assistant/v3/conversation", 401, "POST", origin=public)


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


def modify_compose(content, unit, current, tag, forward, retain_web_options=False):
    old = service_block(content, unit)
    image, n = re.subn(
        rb"(?m)^    image: " + re.escape(current.encode()) + rb"[ \t]*$",
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
        if retain_web_options:
            if image.count(marker + added) != 1 or any(
                len(re.findall(rb"(?m)^      " + k.encode() + rb":", image)) != 1
                for k in WEB_OPTIONS
            ):
                raise RuntimeError("Existing Web options changed since release")
        elif forward:
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


def image_id(tag):
    return run(
        "docker", "image", "ls", "--quiet", "--no-trunc", "--filter", "reference=" + tag
    ).strip()


def previous_ref(receipt, base):
    if image_id(receipt["pin"]) != base["image"]:
        raise RuntimeError("Pinned rollback image changed")
    return (
        receipt["original"]
        if image_id(receipt["original"]) == base["image"]
        else receipt["pin"]
    )


def configure_core(unit, image, name, candidate):
    compose("config", "--quiet")
    compose("up", "-d", "--no-deps", "--no-build", "--pull", "never", unit)
    info = inspect(name)
    if info["Image"] != image:
        raise RuntimeError("Unexpected image after Compose activation")
    health(unit, candidate)
    return info["Id"]


def core(stage, manifest, built, unit, action):
    base = manifest["units"][unit]
    target = built["images"][unit]
    name = base["name"]
    info = inspect(name)
    path = stage / (unit + ".promotion.json")
    receipt = json.loads(path.read_text()) if path.exists() else {}
    forward = action != "down"
    active = (
        receipt.get("activeId")
        and receipt["activeId"] == info["Id"]
        and info["Image"] == target["id"]
    )
    restored = (
        info["Id"] == receipt.get("restoredId", base["container"])
        and info["Image"] == base["image"]
    )
    if not (active or restored):
        raise RuntimeError("Concurrent container change: " + unit)
    if inspect(target["tag"])["Id"] != target["id"]:
        raise RuntimeError("Changed candidate image: " + unit)
    before = COMPOSE.read_bytes()
    if (active and forward) or (restored and not forward):
        if not receipt:
            raise RuntimeError("No active release or rollback receipt")
        health(unit, bool(active))
        return
    if forward:
        check_artifact_drift(info)
        current = info["Config"]["Image"]
        pin = f'rubi-nora-rollback:{manifest["head"][:12]}-{unit}-{base["image"][7:19]}'
        if image_id(pin) not in ("", base["image"]):
            raise RuntimeError("Rollback tag belongs to a different image")
        retain = unit == "web" and all(
            f"{key}={value}" in info["Config"].get("Env", [])
            for key, value in WEB_OPTIONS.items()
        )
        after = modify_compose(before, unit, current, target["tag"], True, retain)
        if action == "check":
            return
        run("docker", "tag", base["image"], pin)
        receipt.update(original=current, pin=pin, retainWebOptions=retain)
        previous_ref(receipt, base)
        save_receipt(path, receipt)
    else:
        after = modify_compose(
            before, unit, target["tag"], previous_ref(receipt, base), False,
            receipt.get("retainWebOptions", False),
        )

    atomic(COMPOSE, after)
    try:
        new_id = configure_core(
            unit, target["id"] if forward else base["image"], name, forward
        )
        receipt["activeId" if forward else "restoredId"] = new_id
        save_receipt(path, receipt)
    except Exception:
        if COMPOSE.read_bytes() != after:
            raise RuntimeError(
                "Concurrent configuration change; refusing to overwrite it"
            )
        recovery = (
            modify_compose(
                after, unit, target["tag"], previous_ref(receipt, base), False,
                receipt.get("retainWebOptions", False),
            )
            if forward
            else before
        )
        atomic(COMPOSE, recovery)
        prior_id = configure_core(
            unit, base["image"] if forward else target["id"], name, not forward
        )
        receipt["restoredId" if forward else "activeId"] = prior_id
        save_receipt(path, receipt)
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


def swap_sidecar(name, outgoing, incoming, parked, unit, forward):
    if inspect(name)["Id"] != outgoing:
        raise RuntimeError("Active sidecar identity changed")
    previous_name = inspect(incoming)["Name"].lstrip("/")
    try:
        run("docker", "stop", outgoing)
        run("docker", "rename", outgoing, parked)
        run("docker", "rename", incoming, name)
        run("docker", "start", incoming)
        if inspect(name)["Id"] != incoming:
            raise RuntimeError("Active sidecar changed")
        health(unit, forward)
    except Exception:
        candidate = inspect(incoming)
        if candidate["Name"] == "/" + name:
            if candidate["State"]["Running"]:
                run("docker", "stop", incoming)
            run("docker", "rename", incoming, previous_name)
        prior = inspect(outgoing)
        if prior["Name"] != "/" + name:
            run("docker", "rename", outgoing, name)
        if not prior["State"]["Running"]:
            run("docker", "start", outgoing)
        if inspect(name)["Id"] != outgoing:
            raise RuntimeError("Sidecar recovery requires operator attention")
        health(unit, not forward)
        raise


def sidecar(stage, manifest, built, unit, action):
    base = manifest["units"][unit]
    name = base["name"]
    old = inspect(base["container"])
    current = inspect(name)
    path = stage / (unit + ".promotion.json")
    receipt = json.loads(path.read_text()) if path.exists() else {}
    if current["Id"] not in (base["container"], receipt.get("id")):
        raise RuntimeError("Concurrent sidecar update")
    if old["Image"] != base["image"]:
        raise RuntimeError("Changed baseline image")
    if action == "down":
        if not receipt:
            raise RuntimeError("Missing sidecar promotion receipt")
        if current["Id"] == base["container"]:
            health(unit, False)
            return
        if unit == "assistant":
            verify_assistant_source(old,base)
        else:
            check_artifact_drift(old)
        swap_sidecar(
            name, current["Id"], base["container"], receipt["standby"], unit, False
        )
        return
    if unit == "assistant":
        verify_assistant_source(
            old, base, stage / "assistant" / "source", built["assistantSourceSha"]
        )
    else:
        check_artifact_drift(old)
        if (
            inspect(built["images"]["read"]["tag"])["Id"]
            != built["images"]["read"]["id"]
        ):
            raise RuntimeError("Mismatched read candidate")
    if current["Id"] == receipt.get("id"):
        health(unit, True)
        return
    if not receipt:
        config = old["Config"].copy()
        host = old["HostConfig"].copy()
        if unit == "read":
            config["Image"] = built["images"]["read"]["id"]
        else:
            mounts = {m["Destination"]: m["Source"] for m in old["Mounts"]}
            prefix = mounts["/nora-source"] + ":/nora-source:"
            bindings = [
                b
                for b in host["Binds"]
                if b.startswith(prefix) and "ro" in b.split(":")[-1].split(",")
            ]
            if len(bindings) != 1:
                raise RuntimeError("Expected one read-only Nora source mount")
            new_bind = (
                str(stage / "assistant" / "source")
                + ":/nora-source:"
                + bindings[0][len(prefix) :]
            )
            host["Binds"] = [new_bind if b == bindings[0] else b for b in host["Binds"]]
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
        standby = name + "-candidate-" + manifest["head"][:12] + "-" + uuid4().hex[:8]
        candidate = create_container(standby, config)
        receipt = {"id": candidate, "standby": standby}
        save_receipt(path, receipt)
    if action != "check":
        swap_sidecar(
            name,
            base["container"],
            receipt["id"],
            name + "-before-" + manifest["head"][:12],
            unit,
            True,
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
    # Clone only the known same-origin server-to-server forwarding contract.
    if not re.search(
        rb"(?m)^\s*proxy_pass\s+http://127\.0\.0\.1:4300;\s*$", existing
    ) or not re.search(
        rb'if\s*\(\s*\$http_origin\s*!=\s*""\s*\)\s*\{\s*return 403;\s*\}', existing
    ):
        raise RuntimeError(
            "Review the effective assistant ingress upstream and Origin policy"
        )
    block = b"\n" + existing.replace(named, plan, 1) + b"\n"
    receipt = stage / "ingress.promotion.json"
    digest = hashlib.sha256(block).hexdigest()
    released = (
        receipt.exists() and json.loads(receipt.read_text()).get("blockSha") == digest
    )
    if released and (
        (action != "down" and before.count(block) == 1)
        or (action == "down" and plan not in before)
    ):
        health("ingress", action != "down")
        return
    if action == "down" and plan not in before and not receipt.exists():
        health("ingress", False)
        return
    if action == "down" and not released:
        raise RuntimeError("Missing ingress release ownership")
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
    if action == "up":
        save_receipt(receipt, {"blockSha": digest})
    atomic(NGINX, after)
    try:
        run("nginx", "-t")
        run("systemctl", "reload", "nginx")
        health("ingress", action == "up")
        if action == "down":
            receipt.unlink()
    except Exception:
        if NGINX.read_bytes() == after:
            atomic(NGINX, before)
            run("nginx", "-t")
            run("systemctl", "reload", "nginx")
            health("ingress", action == "down")
            if action == "up":
                receipt.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    import fcntl

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
