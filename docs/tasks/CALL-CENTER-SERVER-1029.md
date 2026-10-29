# CALL-CENTER-SERVER-1029

PC-C. User authorizes permanent Call Center setup on the existing company ERP server, preserving data and installation. Reservation covers only the bounded Worker/API helper, synthetic configuration tests and handoff records. No migration, dependency, IAM grant or PBX write.

## Preflight

SSH identity matched known_hosts. User unlocked their encrypted key in SSH Agent. Deployment account sudo is restricted to four fixed commands; root/Docker access is not bypassed. User will execute the reviewed helper in root console.

Production image5314830983e47a81c1ea1927d63b8b5c716b1cf8 already includes Call Center PR1151. No whole-ERP rollout is needed. API/Worker are running with unless-stopped restart policy. Daily encrypted backup timer is active and its last run succeeded. Audit reports196 completed migrations, none incomplete. API/Worker have no telephony settings. Backup configuration was inspected in memory; only selected setting names, image and restart policy were printed.

## Reviewed helper

scripts/call-center/setup-production-worker.py requires root/no arguments, exact image, Docker boot enablement and existing restart policies. It takes an encrypted backup, acquires deployment lock, rechecks container/Compose identity and refuses active telephony work. A new independent root-only credential and transport env_file are added only to API/Worker. Provider and automatic notification are not enabled.

Resolved Compose must match only expected additions. Only API/Worker are recreated. Images, mounts, unrelated environment and restart policies are verified afterwards; authenticated Worker pending transport and HTTPS health must pass. Failure restores Compose and previous configuration. A retained secret file after rollback requires explicit inspection before retry. Success writes a non-secret receipt at /opt/rubi/CALL-CENTER-WORKER-1029.json and appends the deployment record. Original Compose is retained in a protected rollback directory.

Five synthetic tests pass on server Python: env_file preservation, ambiguous layout rejection, both resolved Compose representations, unrelated image/mount/environment change rejection and changed-release rejection before commands. No live service or database is modified by tests. Delivered helper SHA256: df1da3c269b397598dd084b4d70bcbaa51cf558163175af4761be1443ca41b8b. Root-console command verifies the same bytes before executing in isolated Python mode.

## Activation gates

Root execution requested; success not yet claimed. After receipt verification, create another encrypted export and synchronize to the existing off-server backup destination. Images/data/Web remain preserved.

VPN/SSH information was supplied separately; secrets are excluded from source, arguments and reports. VPN protocol, PBX destination/port and host identity remain unconfirmed; user is obtaining them from IT. Configure the secure path/provider only after verification. Review production staff mappings/access instead of copying localhost. Real-call, recovery and recording acceptance remain required; Worker transport readiness alone is not full telephony readiness.
