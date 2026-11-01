# CALL-POPUP-NETWORK-1101

Root cause: production worker uses Docker network_mode service:api. API-only replacement recreated API but retained Worker bound to removed API container namespace. Worker requests failed EAI_AGAIN; durable outbox dispatch stopped, preventing live projections/offers for incoming/outgoing popups. Prior API-only deployment validation checked unchanged Worker ID rather than dependency validity; this was insufficient.

Recovery under global avina-deploy.lock: force-recreate worker only with existing Compose. Exact worker image and environment preserved; API/Web/Postgres/Redis container IDs unchanged. Worker namespace now equals current API ID. Authenticated internal pending request returns200 and zero backlog. User confirms popup opens after real-call test. No synthetic calls, business-data rewrite, schema, grants, PBX or Web changes.

Prevention: root-owned /usr/local/sbin/rubi-worker-network-guard.py with rubi-worker-network-guard.service/timer checks every60s under same nonblocking deployment lock. Independent networking is not modified; running API/worker and healthy API required. Recreate only on stale container namespace and verify same Worker image/environment plus unchanged API. Three targeted namespace tests and systemd unit verification pass; healthy-state run changes nothing. Timer active. Future API deployments must recreate service:api dependents before asserting readiness; unchanged Worker ID is not an acceptance condition.

Receipt: /opt/rubi/CALL-POPUP-NETWORK-1101.json. Timer rollback: systemctl disable --now rubi-worker-network-guard.timer; script/unit files remain for review. No credential or call data in source.
