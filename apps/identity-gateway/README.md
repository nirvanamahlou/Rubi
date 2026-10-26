# Nora personal site identity gateway

This app is an OIDC protocol adapter to the existing Nora IAM. It has no users,
passwords, roles, registration endpoint or independent authorization directory.
One confidential first-party client is configured server-side. Nora session and
current IAM permissions are checked before issuing identity and on every UserInfo
request. Managed site access fails closed if Nora or Redis is unavailable.

Run `pnpm --filter @nora/identity-gateway build` and
`NORA_TEST_REDIS_URL=redis://127.0.0.1:6379 pnpm --filter @nora/identity-gateway test`.
The test writes only short-lived namespaced protocol artifacts to the specified
Redis. Use a local/disposable Redis. The dedicated CI workflow supplies one.

Start with `NORA_IDENTITY_CONFIG_FILE=/run/secrets/identity.json node src/server.mjs`.
The private JSON is not committed and must be readable only by the service user.
Required fields:

| Field                   | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| issuer                  | Canonical HTTPS issuer, no path/query                              |
| apiOrigin               | Trusted Nora API origin                                            |
| browserLoginUrl         | Canonical Nora login route                                         |
| clientId / clientSecret | Single Niyayesh confidential client identity                       |
| redirectUri             | Exact registered site callback                                     |
| serviceSecret           | Separate credential for the private Nora current-session port      |
| redisUrl                | Existing Redis connection, protected server-side                   |
| encryptionKey           | Base64 encoded32-byte AES-GCM key for protocol records             |
| jwks                    | Private RSA signing JWK set; public keys exposed through JWKS only |
| cookieKeys              | Nonempty array of high-entropy cookie signing keys                 |
| localDevelopment        | Explicit development exception; requires NODE_ENV=development      |

Use different secrets for client authentication, Nora introspection, encryption
and cookie signing. Rotate using an operator plan that accounts for short-lived
sessions and key overlap; replacing encryption keys invalidates outstanding flows.
Local profile binds browser hosts to nora.localhost and niyayesh.localhost. It must
never be enabled for public operation. Production requires HTTPS, secure host-only
cookies, an exact trusted reverse-proxy configuration, restricted service/Redis
networking and end-to-end certificate verification. Test that topology separately.

No request body, credential, authorization header or callback query should be
logged by a proxy. Client registration, implicit/password grants and development
interaction UI are disabled. Access tokens stay between servers; the browser
receives only short-lived single-use authorization codes and HttpOnly local cookies.
The site must call UserInfo for each protected request and enforce the intersection
of site policy and current Nora resource grants.
