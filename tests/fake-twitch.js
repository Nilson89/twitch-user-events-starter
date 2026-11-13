// Ein nachgebautes Mini-Twitch für den Hackertest.
// So kann der Test den kompletten Login-Ablauf prüfen, ohne echte Twitch-Accounts.
import http from 'node:http';
import crypto from 'node:crypto';

const rand = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

export async function startFakeTwitch({ clientId, clientSecret, channel }) {
  const state = {
    clientId,
    clientSecret,
    channelUser: { id: '1000', login: channel, display_name: channel },
    users: new Map(), // twitch id -> user
    codes: new Map(), // code -> { user, scope, redirectUri }
    userTokens: new Map(), // access token -> user
    tokenScopes: new Map(), // access token -> scope string
    refreshTokens: new Map(), // refresh token -> { user, scope }
    chatters: [], // Nutzer, die gerade im Chat sind
    chattersCalls: 0,
    issued: [], // alle ausgegebenen Tokens (für Leak-Prüfungen)
    issuedCodes: [],
    revoked: new Set(),
    live: false,
    requests: [],
    subscriptions: [],
  };
  state.users.set('1000', state.channelUser);

  const readBody = (req) =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => resolve(data));
    });

  const parseParams = (url, body, contentType = '') => {
    const params = new URLSearchParams(url.search);
    if (body) {
      if (contentType.includes('application/json')) {
        try {
          for (const [k, v] of Object.entries(JSON.parse(body))) params.set(k, String(v));
        } catch {
          /* ignorieren */
        }
      } else {
        for (const [k, v] of new URLSearchParams(body)) params.set(k, v);
      }
    }
    return params;
  };

  const send = (res, status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  const bearer = (req) => {
    const h = req.headers.authorization || '';
    const m = h.match(/^(?:Bearer|OAuth)\s+(.+)$/i);
    return m ? m[1].trim() : null;
  };

  const isAppToken = (t) => t && t.startsWith('fakeapp_') && state.issued.includes(t);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const body = await readBody(req);
    state.requests.push({ method: req.method, path: url.pathname, query: url.search });
    const params = parseParams(url, body, req.headers['content-type']);

    // ---------- OAuth ----------
    if (url.pathname === '/oauth2/token' && req.method === 'POST') {
      if (params.get('client_id') !== state.clientId || params.get('client_secret') !== state.clientSecret) {
        return send(res, 403, { status: 403, message: 'invalid client secret' });
      }
      const grant = params.get('grant_type');
      if (grant === 'client_credentials') {
        const token = rand('fakeapp');
        state.issued.push(token);
        return send(res, 200, { access_token: token, expires_in: 5000000, token_type: 'bearer' });
      }
      if (grant === 'authorization_code') {
        const entry = state.codes.get(params.get('code'));
        if (!entry) return send(res, 400, { status: 400, message: 'Invalid authorization code' });
        state.codes.delete(params.get('code'));
        if (entry.redirectUri && params.get('redirect_uri') !== entry.redirectUri) {
          return send(res, 400, { status: 400, message: 'Parameter redirect_uri does not match registered URI' });
        }
        const access = rand('fakeuser');
        const refresh = rand('fakerefresh');
        state.issued.push(access, refresh);
        state.userTokens.set(access, entry.user);
        state.tokenScopes.set(access, entry.scope || '');
        state.refreshTokens.set(refresh, { user: entry.user, scope: entry.scope || '' });
        return send(res, 200, {
          access_token: access,
          refresh_token: refresh,
          expires_in: 14000,
          scope: entry.scope ? entry.scope.split(' ') : [],
          token_type: 'bearer',
        });
      }
      if (grant === 'refresh_token') {
        const old = params.get('refresh_token');
        const entry = state.refreshTokens.get(old);
        if (!entry || state.revoked.has(old)) return send(res, 400, { status: 400, message: 'Invalid refresh token' });
        state.refreshTokens.delete(old); // Twitch kann Refresh-Tokens erneuern
        const access = rand('fakeuser');
        const refresh = rand('fakerefresh');
        state.issued.push(access, refresh);
        state.userTokens.set(access, entry.user);
        state.tokenScopes.set(access, entry.scope);
        state.refreshTokens.set(refresh, entry);
        return send(res, 200, {
          access_token: access,
          refresh_token: refresh,
          expires_in: 14000,
          scope: entry.scope ? entry.scope.split(' ') : [],
          token_type: 'bearer',
        });
      }
      return send(res, 400, { status: 400, message: 'unsupported grant type' });
    }

    if (url.pathname === '/oauth2/validate') {
      const t = bearer(req);
      if (isAppToken(t) && !state.revoked.has(t)) {
        return send(res, 200, { client_id: state.clientId, scopes: [], expires_in: 5000000 });
      }
      const user = t && !state.revoked.has(t) ? state.userTokens.get(t) : null;
      if (!user) return send(res, 401, { status: 401, message: 'invalid access token' });
      return send(res, 200, { client_id: state.clientId, login: user.login, user_id: user.id, scopes: [], expires_in: 14000 });
    }

    if (url.pathname === '/oauth2/revoke' && req.method === 'POST') {
      const t = params.get('token');
      if (params.get('client_id') !== state.clientId) return send(res, 400, { status: 400, message: 'Invalid client' });
      if (t) {
        state.revoked.add(t);
        const user = state.userTokens.get(t);
        // Widerruf eines Access-Tokens macht auch die zugehörigen Refresh-Tokens ungültig.
        if (user) for (const [r, e] of state.refreshTokens) if (e.user.id === user.id) state.revoked.add(r);
      }
      res.writeHead(200);
      return res.end();
    }

    if (url.pathname === '/oauth2/authorize') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('fake authorize page');
    }

    // ---------- Helix ----------
    if (url.pathname.startsWith('/helix/')) {
      if (req.headers['client-id'] !== state.clientId) {
        return send(res, 401, { error: 'Unauthorized', status: 401, message: 'Client ID and OAuth token do not match' });
      }
      const t = bearer(req);
      const tokenUser = t && !state.revoked.has(t) ? state.userTokens.get(t) : null;
      const appOk = isAppToken(t);
      if (!tokenUser && !appOk) return send(res, 401, { error: 'Unauthorized', status: 401, message: 'Invalid OAuth token' });

      const toHelixUser = (u) => ({
        id: u.id,
        login: u.login,
        display_name: u.display_name,
        type: '',
        broadcaster_type: '',
        description: '',
        profile_image_url: 'https://static-cdn.jtvnw.net/fake.png',
        offline_image_url: '',
        view_count: 0,
        created_at: '2020-01-01T00:00:00Z',
      });

      if (url.pathname === '/helix/users') {
        const logins = url.searchParams.getAll('login');
        const ids = url.searchParams.getAll('id');
        if (logins.length || ids.length) {
          const found = [...state.users.values()].filter(
            (u) => logins.map((l) => l.toLowerCase()).includes(u.login.toLowerCase()) || ids.includes(u.id),
          );
          return send(res, 200, { data: found.map(toHelixUser) });
        }
        if (!tokenUser) return send(res, 401, { error: 'Unauthorized', status: 401, message: 'Missing User OAUTH Token' });
        return send(res, 200, { data: [toHelixUser(tokenUser)] });
      }

      if (url.pathname === '/helix/chat/chatters') {
        state.chattersCalls += 1;
        if (!tokenUser) return send(res, 401, { error: 'Unauthorized', status: 401, message: 'Missing User OAUTH Token' });
        const scopes = (state.tokenScopes.get(t) || '').split(' ');
        if (!scopes.includes('moderator:read:chatters')) return send(res, 401, { error: 'Unauthorized', status: 401, message: 'Missing scope: moderator:read:chatters' });
        if (url.searchParams.get('broadcaster_id') !== state.channelUser.id || url.searchParams.get('moderator_id') !== tokenUser.id || tokenUser.id !== state.channelUser.id) {
          return send(res, 403, { error: 'Forbidden', status: 403, message: 'The user in moderator_id must be the broadcaster or a moderator' });
        }
        const data = state.chatters.map((u) => ({ user_id: u.id, user_login: u.login, user_name: u.display_name }));
        return send(res, 200, { data, pagination: {}, total: data.length });
      }

      if (url.pathname === '/helix/streams') {
        const ids = url.searchParams.getAll('user_id');
        const logins = url.searchParams.getAll('user_login');
        const wantsChannel = ids.includes(state.channelUser.id) || logins.includes(state.channelUser.login);
        const data =
          state.live && wantsChannel
            ? [
                {
                  id: '42',
                  user_id: state.channelUser.id,
                  user_login: state.channelUser.login,
                  user_name: state.channelUser.display_name,
                  type: 'live',
                  title: 'Test',
                  started_at: new Date().toISOString(),
                },
              ]
            : [];
        return send(res, 200, { data, pagination: {} });
      }

      if (url.pathname === '/helix/eventsub/subscriptions') {
        if (req.method === 'GET') {
          return send(res, 200, { data: state.subscriptions, total: state.subscriptions.length, pagination: {} });
        }
        if (req.method === 'POST') {
          let payload = {};
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            /* ignorieren */
          }
          const sub = { id: rand('sub'), status: 'webhook_callback_verification_pending', ...payload, transport: { ...(payload.transport || {}), secret: undefined } };
          state.subscriptions.push(sub);
          return send(res, 202, { data: [sub], total: state.subscriptions.length });
        }
        if (req.method === 'DELETE') {
          state.subscriptions = state.subscriptions.filter((s) => s.id !== url.searchParams.get('id'));
          res.writeHead(204);
          return res.end();
        }
      }
      return send(res, 404, { error: 'Not Found', status: 404, message: 'unknown fake endpoint' });
    }

    return send(res, 404, { error: 'Not Found', status: 404 });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    state,
    addUser(user) {
      state.users.set(user.id, user);
      return user;
    },
    createCode(user, { scope = '', redirectUri = null } = {}) {
      state.users.set(user.id, user);
      const code = rand('fakecode');
      state.issuedCodes.push(code);
      state.codes.set(code, { user, scope, redirectUri });
      return code;
    },
    setLive(v) {
      state.live = v;
    },
    secrets() {
      return [...state.issued, state.clientSecret];
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
