# Company-network AMI observation — PC-C

The owner reports Issabel4/Asterisk16, a company-LAN AMI account and pending
extension-to-ERP-user mapping. This task prepares actual protocol reception for a
controlled LAN test. It does not claim successful connection to that PBX.

## Scope and popup isolation

Run `scripts/call-center/ami-observe.ps1` with PowerShell7 and Node24, or the
corresponding mjs CLI. It imports the existing AMI transport directly using Node24
type stripping; no install, database migration or full ERP build is needed.
The only outbound AMI action is Login. Native events are observed without requiring
the earlier custom NoraCall dialplan hook. This is protocol discovery/acceptance,
not automatic normalization into operational call records.

No ERP API, Inbox projection, mapping, recipient service or browser feed is called.
Consequently this receiver cannot cause a popup even if mappings exist elsewhere.
Keep the operational ISSABEL_ENABLED, TELEPHONY_RELAY_ENABLED and
TELEPHONY_SYNTHETIC_ENABLED flags disabled during this test. No UI change, account
grant, call origination or PBX configuration change is included.

## Run on the company network

From this source checkout, replace placeholders with the privately supplied host
and username. Do not put the password on the command line or in a committed file:

```powershell
pwsh -NoProfile -File scripts/call-center/ami-observe.ps1 -AmiHost <PRIVATE_PBX_IP> -Username <AMI_USER> -Port 5038 -CompanyNetwork -Seconds 120
```

The launcher asks for the password with hidden input, passes it only in the child
process environment, and does not save it. Do not enable PowerShell tracing or
dump the process environment. The supplied port5038 uses plaintext AMI: use only
the trusted company LAN; a VPN alone does not encrypt its final LAN segment. The
observer requires explicit company-network opt-in and a literal private IPv4
address. Production transport retains its stricter TLS/loopback policy unchanged.
If IT supplies TLS later, use `-Tls` and its verified port/certificate trust.

CLI equivalents use AMI_OBSERVE_HOST, PORT, USERNAME, SECRET, SECONDS,
COMPANY_NETWORK=true and optional TLS=true/CA_PEM (all with AMI_OBSERVE_ prefix).
Without `--connect` the CLI validates configuration without network access.

## Test and interpret

1. Start on the company LAN and wait for AUTHENTICATED.
2. Coordinate one incoming test call; let the selected internal phone ring,
   answer and end it. Optionally transfer it to another test extension.
3. Observe AgentCalled/DialBegin/Newstate/AgentConnect/Hangup and related counters;
   exact event coverage depends on the installed queue/dialplan and permissions.
4. Share only the redacted summary for analysis. No customer number, extension,
   raw channel identifier, account or secret is printed. Per-run random HMAC
   aliases correlate channel IDs; the key is discarded on exit. Source timestamp
   presence is explicit; receivedAt is local reception time, not PBX occurrence.
5. Exit0 means authenticated and some recognized call events received during an
   uninterrupted run; it is not whole-call or real-time-popup acceptance. Exit1
   means configuration/connection/authentication failure; exit2 means no recognized
   call events, a gap or an event limit. Review the scenario-specific counters.

Runs default120seconds, maximum600, at most3 connections with bounded delay,
10000 received events and100 printed call-event summaries. No historical replay
is claimed after disconnect. The inherited parser caps frames at64KiB. Raw events
are discarded, not stored on disk. Missing permissions can produce no events even
when login succeeds; IT must verify its AMI account filters/classes.

## Later integration gate

Before operational activation, approve actual extension/user mapping and branch,
verify root/leg/transfer/end semantics on Asterisk16, and choose verified native
normalization or IT-provided canonical hooks. The existing adapter only consumes
NoraCall custom facts; this observer does not silently change it. Audio/history
database access remains pending; metadata may still require separate file access.
No popup delivery is enabled by completing this observation test.

## Verification

Seven Node loopback/configuration/privacy tests pass, including fragmented frames,
coalesced Login+first event, denied authentication, no-call inconclusive result and
connection loss. Seven existing AMI/security tests pass. PowerShell7 parser and
Node syntax checks pass. Scoped AMI ESLint and API typecheck pass. The source
transport now marks successful Login ready before processing later frames in the
same TCP chunk, preserving the first event. No actual PBX connection was attempted
outside the company network; provided credentials were not saved or committed.
Existing Web3000 and API4000 health return200, with real/relay/synthetic activation
flags all false. No migration, DB write, role/mapping change or Web edit.
Final API build passed. Task publication is commit/push only; no PR/merge or production activation performed.
