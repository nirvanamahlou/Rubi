"""Read-only simulations of the host-only cutover script. No Docker or ERP connection."""

from contextlib import ExitStack
import importlib.util
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import MagicMock, patch

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
spec = importlib.util.spec_from_file_location(
    "promotion", here / "promote-orchestration.py"
)
promotion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promotion)
spec = importlib.util.spec_from_file_location(
    "builder", here / "build-orchestration-candidate.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PromotionTests(TestCase):
    def test_private_read_canary_checks_real_uid_and_removes_its_container_on_failure(self):
        active = {"Config": {"User": "1000:1000", "Entrypoint": ["node"],
                  "Cmd": ["apps/api/dist/assistant-read/main.js"],
                  "Env": ["DATABASE_URL=fixture-db", "ASSISTANT_AGENT_DATABASE_URL=fixture-read",
                          "UNRELATED_APP_KEY=do-not-forward"]}, "HostConfig": {"NetworkMode": "host"}}
        for reject in (False, True):
            with self.subTest(reject=reject), ExitStack() as ctx:
                daemon = ctx.enter_context(patch.object(builder, "docker", return_value=json.dumps([active])))
                create = ctx.enter_context(patch.object(builder.subprocess, "check_output", return_value="a" * 64))
                probe = ctx.enter_context(patch.object(builder, "probe_read_route"))
                def response(_port, _method, route, _status):
                    if reject and route.endswith("standard-sales-summary"):
                        raise RuntimeError("bad route")
                    return {"service": "erp-assistant-read", "readOnly": True}
                probe.side_effect = response
                if reject:
                    with self.assertRaisesRegex(RuntimeError, "bad route"):
                        builder.check_read_canary("owner", "fixture-image")
                else:
                    builder.check_read_canary("owner", "fixture-image")
                    self.assertEqual([c.args[-1] for c in probe.call_args_list], [200, 401, 401, 405, 404])
                command = create.call_args.args[0]
                self.assertEqual(command[command.index("--user") + 1], "1000:1000")
                self.assertNotIn("UNRELATED_APP_KEY", command)
                self.assertNotIn("fixture-db", command)
                self.assertIn("--read-only", command)
                self.assertEqual(daemon.call_args.args, ("rm", "--force", "a" * 64))

    def test_incremental_build_selects_all_changed_runtime_units(self):
        units = {
            unit: {"overlayFiles": {}} for unit in ("api", "read", "web", "assistant")
        }
        with self.assertRaisesRegex(ValueError, "No runtime updates"):
            builder.affected_units("build-updates", units)
        units["web"]["overlayFiles"]["apps/web/src/example.ts"] = "digest"
        self.assertEqual(builder.affected_units("build-updates", units), ("web",))
        units["api"]["overlayFiles"]["apps/api/src/example.ts"] = "digest"
        self.assertEqual(builder.affected_units("build-updates", units), ("api", "web"))
        self.assertEqual(
            builder.affected_units("build", units), ("api", "read", "web", "assistant")
        )
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            builder.affected_units("build-updates", {"web": units["web"]})

    def test_web_patch_keeps_existing_runtime_options_during_promotion_and_rollback(
        self,
    ):
        initial = b"services:\n  web:\n    image: web:v0\n    environment:\n      EXISTING: enabled\n"
        previous = promotion.modify_compose(initial, "web", "web:v0", "web:v1", True)
        enabled = b"      NORA_COMPOSITION_TELEMETRY: 'true'\n"
        for original_line in (enabled, enabled.replace(b"true", b"false"), b""):
            before = previous.replace(enabled, original_line)
            saved = promotion.web_option_lines(promotion.service_block(before, "web"))
            patched = promotion.modify_compose(
                before, "web", "web:v1", "web:v2", True, saved
            )
            self.assertIn(enabled, patched)
            self.assertEqual(
                promotion.modify_compose(
                    patched, "web", "web:v2", "web:v1", False, saved
                ),
                before,
            )
            with self.assertRaisesRegex(RuntimeError, "changed since release"):
                promotion.modify_compose(
                    patched.replace(enabled, b""),
                    "web",
                    "web:v2",
                    "web:v1",
                    False,
                    saved,
                )
        with self.assertRaisesRegex(RuntimeError, "Review concurrent Web option"):
            promotion.web_option_lines(previous.replace(enabled, enabled + enabled))

    def test_compose_failure_restores_immutable_image_and_allows_retry(self):
        with TemporaryDirectory() as d, ExitStack() as ctx:
            stage = Path(d)
            compose = stage / "compose.yaml"
            peer = b"  peer:\n    image: unrelated:release\n    ports: ['3100:3000']\n"
            compose.write_bytes(b"services:\n  api:\n    image: rubi:old\n" + peer)
            current = {
                "Id": "old-unit",
                "Image": "sha256:1234",
                "Config": {"Image": "rubi:old"},
            }
            base = {
                "name": "active-api",
                "container": "old-unit",
                "image": current["Image"],
            }
            candidate = {"id": "sha256:5678", "tag": "candidate:new"}
            manifest = {"units": {"api": base}, "head": "a" * 40}
            built = {"images": {"api": candidate}}
            tags = {
                "rubi:old": "sha256:new-peer-image",
                candidate["tag"]: candidate["id"],
            }
            ctx.enter_context(patch.object(promotion, "COMPOSE", compose))
            ctx.enter_context(
                patch.object(
                    promotion, "image_id", side_effect=lambda tag: tags.get(tag, "")
                )
            )
            ctx.enter_context(
                patch.object(
                    promotion,
                    "inspect",
                    side_effect=lambda name: (
                        dict(current) if name == base["name"] else {"Id": tags[name]}
                    ),
                )
            )

            def run(*args):
                self.assertEqual(args[:2], ("docker", "tag"))
                tags[args[3]] = args[2]

            ctx.enter_context(patch.object(promotion, "run", side_effect=run))
            ctx.enter_context(patch.object(promotion, "check_artifact_drift"))
            failures = [True, False]

            def configure(unit, image, name, forward):
                ref = (
                    promotion.service_block(compose.read_bytes(), unit)
                    .decode()
                    .split("image: ")[1]
                    .splitlines()[0]
                )
                self.assertEqual(tags[ref], image)
                self.assertIn(peer, compose.read_bytes())
                current.update(
                    Id="container-" + image, Image=image, Config={"Image": ref}
                )
                if forward and failures.pop(0):
                    raise RuntimeError("expected feature probe failed")
                return current["Id"]

            ctx.enter_context(
                patch.object(promotion, "configure_core", side_effect=configure)
            )
            with self.assertRaisesRegex(RuntimeError, "feature probe"):
                promotion.core(stage, manifest, built, "api", "up")
            self.assertEqual(current["Image"], base["image"])
            self.assertNotEqual(current["Config"]["Image"], "rubi:old")
            promotion.core(stage, manifest, built, "api", "up")
            self.assertEqual(current["Image"], candidate["id"])
            promotion.core(stage, manifest, built, "api", "down")
            self.assertEqual(current["Image"], base["image"])
            self.assertEqual(tags["rubi:old"], "sha256:new-peer-image")

    def test_failed_rollback_restores_serving_sidecar_and_checks_its_health(self):
        active = {
            "old": {"Name": "/parked", "State": {"Running": False}},
            "new": {"Name": "/live", "State": {"Running": True}},
        }

        def inspect(k):
            if k == "live":
                k = next(i for i, d in active.items() if d["Name"] == "/live")
            return {**active[k], "Id": k}

        def run(tool, operation, key, *args):
            self.assertEqual(tool, "docker")
            if operation == "rename":
                active[key]["Name"] = "/" + args[0]
            else:
                active[key]["State"]["Running"] = operation == "start"

        def health(unit, forward):
            if not forward:
                raise RuntimeError("old instance unhealthy")

        with patch.object(promotion, "inspect", side_effect=inspect), patch.object(
            promotion, "run", side_effect=run
        ), patch.object(promotion, "health", side_effect=health) as check:
            with self.assertRaisesRegex(RuntimeError, "old instance unhealthy"):
                promotion.swap_sidecar(
                    "live", "new", "old", "candidate", "assistant", False
                )
            self.assertEqual(inspect("live")["Id"], "new")
            self.assertTrue(active["new"]["State"]["Running"])
            self.assertFalse(active["old"]["State"]["Running"])
            self.assertEqual(active["old"]["Name"], "/parked")
            self.assertEqual(check.call_args.args, ("assistant", True))

    def test_ingress_rejects_drift_and_preserves_other_locations(self):
        live = b'location = /v3/assistant/conversation {\n  if ($http_origin != "") { return 403; }\n  proxy_pass http://127.0.0.1:4300;\n}\n'
        extra = b"location /peer { return 200; }\n"
        with TemporaryDirectory() as d, ExitStack() as ctx:
            stage = Path(d)
            conf = stage / "nginx"
            ctx.enter_context(patch.object(promotion, "NGINX", conf))
            ctx.enter_context(patch.object(promotion, "run"))
            ctx.enter_context(patch.object(promotion, "health"))
            conf.write_bytes(live.replace(b"4300", b"4301") + extra)
            with self.assertRaisesRegex(RuntimeError, "upstream"):
                promotion.ingress(stage, "up")
            conf.write_bytes(live + extra)
            promotion.ingress(stage, "up")
            conf.write_bytes(conf.read_bytes() + b"# another team\n")
            promotion.ingress(stage, "down")
            self.assertEqual(conf.read_bytes(), live + extra + b"# another team\n")
            self.assertFalse((stage / "ingress.promotion.json").exists())

    def test_health_rejects_redirects_and_html_with_expected_status(self):
        connection = MagicMock()
        reply = connection.return_value.getresponse.return_value
        with patch.object(
            promotion.http.client, "HTTPConnection", connection
        ), patch.object(promotion.time, "sleep"):
            for status, content_type in [(302, "application/json"), (401, "text/html")]:
                reply.status = status
                reply.getheader.return_value = content_type
                with self.assertRaisesRegex(RuntimeError, "Health check failed"):
                    promotion.probe(
                        "http://127.0.0.1:4300/v3/assistant/plan", 401, "POST"
                    )
            reply.status = 401
            reply.getheader.return_value = "application/json; charset=utf-8"
            promotion.probe("http://127.0.0.1:4300/v3/assistant/plan", 401, "POST")


if __name__ == "__main__":
    main()
