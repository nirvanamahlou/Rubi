# CALL-CENTER-VPN-LINK-1029

Owner: PC-C. Branch: codex/pc-c-call-center-vpn-link-1029.

## Objective and current evidence

Establish an independent ERP-server path to Issabel; workstation relays are explicitly excluded.
The production server received a matching IKEv1 Main Mode SA selection from the designated
gateway: AES128, HMAC-SHA1, MODP2048, PSK authentication, lifetime28800. This discovery
does not prove PSK authentication or L2TP/PPP support. The bounded installer tests that candidate
and rolls back its configuration on failure, rather than claiming that VPN type is confirmed.

Password-authenticated Issabel SSH and local AMI authentication succeeded in the preceding
read-only investigation. No PBX settings changed. Credentials are staged outside Git in a
mode0600 file on ERP and are never command arguments. Root console execution is still required;
the deploy account's restricted sudo is unchanged.

## Bounded implementation

- Require no existing VPN tooling, target route, own service or firewall chains.
- Create encrypted backup, acquire existing deployment lock, preserve Compose, default route,
  DNS and application container IDs. Install named VPN/PPP/TLS packages only through root.
- Route only the PBX /32 through authenticated PPP. A persistent unreachable fallback prevents
  PBX traffic falling through the public default route. Require IPsec for L2TP UDP1701.
- Keep existing public SSH and Internet routes. PPP does not request peer DNS/default route.
- Verify SSH/AMI banners and link restart, then authenticate the dedicated AMI identity from
  the API container through a certificate-verified, private Docker-gateway TLS bridge.
- Enable own boot services only after successful checks. No application rollout, provider
  activation, IAM mapping, schema or business data changes are performed by this helper.
- On failure stop own services, restore original IPsec files, remove own firewall/routes and
  verify ERP preservation. Installed packages and private diagnostic files remain for inspection;
  automatic rerun/overwrite is deliberately refused. Read sanitized receipt before any retry.

## Execution and validation

Source: scripts/call-center/setup-production-vpn.py.
Short launcher: scripts/call-center/run-vpn-1029.py verifies the exact payload SHA256 and
executes those same bytes. Root command works from any directory:

```bash
python3 -I /home/rubi-deploy/run-vpn-1029.py
```

Python compilation and five offline safety checks passed on the production host as the
unprivileged deployment account. These checks did not install or start the VPN.
Network installer: no application lint/typecheck/build or migration is applicable.
First root execution did not establish the connection: receipt reports
authenticated_l2tp_probe RuntimeError, L2TP_TIMEOUT, and preserved=true. ERP health
is independently confirmed healthy. The receipt does not establish successful IPsec
authentication. Normal deploy-user journal access returns no entries.

Inspection found iproute2 renders protocol186 as bgp; rollback originally compared only
the numeric representation and left its unreachable /32 fallback. The cleanup now accepts
both representations. A separate root-only, hash-pinned diagnostic extracts only VPN daemon
logs with supplied credentials redacted, and removes that exact owned fallback only when
own services are inactive. It does not retry a connection or alter PBX/application settings.
Run from any directory: python3 -I /home/rubi-deploy/check-vpn-1029.py.
Inspect /opt/rubi/CALL-CENTER-VPN-DIAG-1029.json before preparing any retry.
Diagnostic compilation and installer safety checks pass; root diagnostic execution is pending.
The first diagnostic attempt correctly stopped at the deployment lock before changes.
ERP inspection confirms a separate approved deployment is active and API health is healthy.
The diagnostic now waits up to600 seconds for that lock without cancelling the deployment
or modifying anything during the wait; timeout exits cleanly. The launcher hash is refreshed.
Authenticated network acceptance remains pending.

## Inspected retry1

Root diagnostic completed and removed the exact leftover fallback; target route list and
XFRM policies are empty. Logs show a successful IKE proposal/KE exchange followed by
"no shared key found", then firewall rejection of unprotected L2TP as intended. Thus the
initial L2TP timeout was secondary, not evidence that the remote server rejected PPP.
The installed AppArmor charon profile allows /etc/ipsec.d/** and does not allow /opt/rubi.
The original included PSK file was under /opt/rubi/private; this is an installer defect.
Move the key include into an exclusive root-private /etc/ipsec.d/rubi-issabel-1029.secrets
without changing AppArmor. The profile status/audit denial is not independently captured;
key-loading success must be established by the next actual negotiation.

Add a hard gate requiring both ESTABLISHED IKE and INSTALLED CHILD status before L2TP
starts. Failure receipts now contain bounded credential-redacted daemon messages to avoid
another separate root diagnostic round trip. No credential is in Git or process arguments.
The inspected retry launcher verifies the installer hash, requires the previous preserved
rollback, compares current IPsec configuration to original backups and refuses active VPN
services. It uses already installed packages and a fresh private attempt directory; it does
not overwrite failed-attempt evidence. New PSK file is removed on failed rollback.

Root command: python3 -I /home/rubi-deploy/retry-vpn-1029.py.
Six offline safety checks and both Python compilations passed; non-root launcher correctly
refuses execution. Root retry has not run, so connection is not yet established.
Sanitized result: /opt/rubi/CALL-CENTER-VPN-1029.json.
Do not print private inputs, ipsec secrets, PPP options or prepared AMI client credentials.

Even a successful network receipt does not establish production contact ingestion or recording
delivery. Those require the separately controlled provider configuration and application release.
