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
Actual root execution and authenticated network acceptance remain pending.
Sanitized result: /opt/rubi/CALL-CENTER-VPN-1029.json.
Do not print private inputs, ipsec secrets, PPP options or prepared AMI client credentials.

Even a successful network receipt does not establish production contact ingestion or recording
delivery. Those require the separately controlled provider configuration and application release.
