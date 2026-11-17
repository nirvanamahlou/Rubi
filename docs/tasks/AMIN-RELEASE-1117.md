# Amin publication — 2026-11-17

COMPUTER_ID=PC-C. Branch codex/pc-c-amin-release-1117 from979d435ef. Owner authorizes publication of all merged Amin-tech11 changes absent from production. Complete175-PR inventory:172 covered by prior baseline/tooling publications,1759 already active;1761/1764 now published. Both final PR heads have every hosted check successful.

Published exact merged979d435ef services/assistant and operational acceptance source under /opt/rubi/amin-release-1117/source. Runtime changed only four mounted assistant modules: agent-provider, data-agent, native-count-route and token-efficiency. Existing runtime wrapper, account quota exceptions, API/Web/Worker/read-boundary images and all tracked container identities/environments/mounts preserved. No migration, business data write, actual model prompt or human communication.

All136 service tests passed in network-isolated Docker. Configuration/source backup encrypted and decryption/archive check passed. Existing mount-list comparison required normalization by destination; values remain fully compared. An activation failed because new files inherited restrictive0600 mode, producing EACCES; rollback restored old source, read permissions fixed to0644 for code only and release retried successfully. Final loopback health, unauthenticated401/403 and public HTTPS login succeeded; every runtime target hash matches the manifest. No persistent outage remains.

Root-only receipts: /opt/rubi/amin-release-1117/verified.json, manifest.json, ci-approved.json, tests.log and encrypted configuration.enc; deployment record appended. Exact receipt reports service identities/env/mounts unchanged and databaseChanged=false. Backup/rollback retained. No credential or operational personal record is committed.
