import Provider, { errors } from 'oidc-provider';
import { encryptedAdapter } from './storage.mjs';

const uuid = /^[0-9a-f-]{36}$/i;
const siteClaims = [
  'nora_session',
  'nora_branch',
  'nora_actor',
  'nora_system',
  'nora_organization',
  'nora_permissions',
  'nora_grants',
  'nora_provision',
];

export function checkedConfig(config) {
  const issuer = new URL(config.issuer);
  const api = new URL(config.apiOrigin);
  const local =
    config.localDevelopment === true && process.env.NODE_ENV === 'development';
  const browser = new URL(config.browserLoginUrl);
  const callback = new URL(config.redirectUri);
  if (local) {
    if (
      issuer.protocol !== 'http:' ||
      issuer.hostname !== 'nora.localhost' ||
      browser.hostname !== 'nora.localhost' ||
      callback.hostname !== 'niyayesh.localhost' ||
      !['rubi-api-1', '127.0.0.1', 'localhost'].includes(api.hostname)
    )
      throw Error('Invalid local configuration');
  } else if (
    [issuer, api, browser, callback].some((u) => u.protocol !== 'https:')
  )
    throw Error('HTTPS required');
  if (
    [issuer, api, browser, callback].some(
      (u) => u.username || u.password || u.hash,
    ) ||
    issuer.search ||
    api.search ||
    issuer.pathname !== '/' ||
    api.pathname !== '/' ||
    typeof config.serviceSecret !== 'string' ||
    config.serviceSecret.length < 32 ||
    typeof config.clientSecret !== 'string' ||
    config.clientSecret.length < 32 ||
    !config.jwks?.keys?.length ||
    !Array.isArray(config.cookieKeys) ||
    config.cookieKeys.length === 0 ||
    config.cookieKeys.some((k) => typeof k !== 'string' || k.length < 32)
  )
    throw Error('Incomplete identity configuration');
  return { issuer, api, local };
}

export function createGateway(config, redis, fetcher = fetch) {
  const { local } = checkedConfig(config);
  const Adapter = encryptedAdapter(redis, config.encryptionKey);
  const bindings = new Adapter('GrantBinding');
  async function json(path, headers, body) {
    const response = await fetcher(config.apiOrigin + path, {
      method: body ? 'POST' : 'GET',
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error('Nora authorization rejected');
    const text = await response.text();
    if (text.length > 131072) throw Error('Nora response too large');
    const result = JSON.parse(text);
    return result.data ?? result;
  }
  async function current(ref, intent) {
    const claims = await json(
      '/api/v1/integrations/v1/niyayesh/sso/session',
      {
        authorization: `Bearer ${config.serviceSecret}`,
        'content-type': 'application/json',
      },
      { ...ref, ...(intent ? { intent } : {}) },
    );
    if (
      !claims.active ||
      claims.sub !== ref.userId ||
      claims.nora_session !== ref.sessionId ||
      claims.nora_branch !== ref.branchId ||
      !claims.nora_grants?.includes('panel.login')
    )
      throw new errors.InvalidToken('Current Nora access revoked');
    return claims;
  }
  const provider = new Provider(config.issuer, {
    adapter: Adapter,
    jwks: config.jwks,
    clients: [
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [config.redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_basic',
        id_token_signed_response_alg: 'RS256',
      },
    ],
    scopes: ['openid', 'nora_site'],
    claims: { openid: ['sub'], nora_site: siteClaims },
    responseTypes: ['code'],
    extraParams: ['nora_branch'],
    features: {
      devInteractions: { enabled: false },
      claimsParameter: { enabled: true },
      registration: { enabled: false },
      rpInitiatedLogout: { enabled: false },
      introspection: { enabled: false },
    },
    pkce: { required: () => true },
    ttl: {
      AccessToken: 900,
      AuthorizationCode: 60,
      IdToken: 120,
      Interaction: 300,
      Session: 900,
      Grant: 900,
    },
    cookies: {
      keys: config.cookieKeys,
      names: {
        session: 'nora_oidc_session',
        interaction: 'nora_oidc_interaction',
        resume: 'nora_oidc_resume',
      },
      short: { secure: !local, httpOnly: true, sameSite: 'lax' },
      long: { secure: !local, httpOnly: true, sameSite: 'lax' },
    },
    interactions: {
      url: (_ctx, interaction) => `/interaction/${interaction.uid}`,
    },
    loadExistingGrant: async (ctx) => {
      const id = ctx.oidc.result?.consent?.grantId;
      return id ? provider.Grant.find(id) : undefined;
    },
    findAccount: async (ctx, sub, token) => ({
      accountId: sub,
      claims: async () => {
        const grantId =
          token?.grantId ??
          ctx.oidc.entities.Grant?.jti ??
          ctx.oidc.result?.consent?.grantId;
        const ref = grantId ? await bindings.find(grantId) : undefined;
        if (!ref || ref.userId !== sub)
          throw new errors.InvalidToken('Unbound Nora identity');
        return current(ref);
      },
    }),
    renderError: async (ctx) => {
      ctx.type = 'text';
      ctx.body = 'درخواست ورود معتبر نیست؛ از نورا دوباره شروع کنید.';
    },
  });
  async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.url === '/health') {
        await redis.ping();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ok"}');
        return;
      }
      if (
        local &&
        req.headers.host === 'identity-gateway:19130' &&
        ['/token', '/jwks', '/me'].includes(req.url ?? '')
      ) {
        req.headers.host = new URL(config.issuer).host;
      }
      if (req.headers.host !== new URL(config.issuer).host)
        throw Error('Wrong issuer host');
      if (
        /^\/interaction\/[A-Za-z0-9_-]{10,200}$/.test(req.url ?? '') &&
        req.method === 'GET'
      ) {
        const details = await provider.interactionDetails(req, res);
        if (
          details.params.client_id !== config.clientId ||
          !uuid.test(details.params.nora_branch ?? '')
        )
          throw Error('Invalid client scope');
        const access = req.headers.cookie
          ?.split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith('nora_access='));
        if (!access) {
          res.writeHead(303, { location: config.browserLoginUrl });
          res.end();
          return;
        }
        const actor = await json('/api/v1/iam/auth/access', { cookie: access });
        if (!uuid.test(actor.userId) || !uuid.test(actor.sessionId))
          throw Error('Invalid Nora session');
        const ref = {
          userId: actor.userId,
          sessionId: actor.sessionId,
          branchId: details.params.nora_branch,
        };
        await current(ref, 'LOGIN');
        const grant = new provider.Grant({
          accountId: actor.userId,
          clientId: config.clientId,
        });
        grant.addOIDCScope('openid nora_site');
        grant.addOIDCClaims(siteClaims);
        const grantId = await grant.save();
        await bindings.upsert(grantId, ref, 900);
        await provider.interactionFinished(
          req,
          res,
          { login: { accountId: actor.userId }, consent: { grantId } },
          { mergeWithLastSubmission: false },
        );
        return;
      }
      await provider.callback()(req, res);
    } catch {
      if (!res.headersSent)
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(
        'ورود انجام نشد. مجوز و نشست خود را در نورا بررسی کنید و دوباره شروع کنید.',
      );
    }
  }
  return { provider, handler };
}
