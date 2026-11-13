// Hilfsfunktionen für den Hackertest: App starten, einloggen, Webhooks signieren.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Der Test nutzt eine eigene, feste Konfiguration. So bleibt er grün, auch wenn du hub.config.json anpasst.
export const TEST_CONFIG_FILE = 'tests/test.hub.config.json';
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, TEST_CONFIG_FILE), 'utf8'));

export const SECRETS = {
  clientId: 'testclientid_' + crypto.randomBytes(6).toString('hex'),
  clientSecret: 'testclientsecret_' + crypto.randomBytes(16).toString('hex'),
  eventsubSecret: 'testeventsub_' + crypto.randomBytes(16).toString('hex'),
  overlayKey: 'testoverlay_' + crypto.randomBytes(24).toString('hex'),
  tokenKey: crypto.randomBytes(32).toString('hex'),
  channel: 'teststreamer',
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Startet die App als eigenen Prozess mit Test-Umgebung. */
export async function startApp({ fake, env = {}, full = true } = {}) {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-hackertest-'));
  const dbFile = path.join(dataDir, 'hub.sqlite').replace(/\\/g, '/');

  const baseEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    NODE_ENV: 'test',
    PORT: String(port),
    BASE_URL: baseUrl,
    DATABASE_URL: `file:${dbFile}`,
    HUB_CONFIG_FILE: TEST_CONFIG_FILE,
  };
  const fullEnv = full
    ? {
        TWITCH_CLIENT_ID: SECRETS.clientId,
        TWITCH_CLIENT_SECRET: SECRETS.clientSecret,
        TWITCH_CHANNEL: SECRETS.channel,
        EVENTSUB_SECRET: SECRETS.eventsubSecret,
        OVERLAY_KEY: SECRETS.overlayKey,
        TOKEN_ENCRYPTION_KEY: SECRETS.tokenKey,
        TWITCH_ID_URL: fake?.url,
        TWITCH_API_URL: fake?.url,
      }
    : {};
  const childEnv = Object.fromEntries(
    Object.entries({ ...baseEnv, ...fullEnv, ...env }).filter(([, v]) => v !== undefined),
  );

  let logs = '';
  const child = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => (logs += d.toString()));
  child.stderr.on('data', (d) => (logs += d.toString()));
  let exited = false;
  child.on('exit', () => (exited = true));

  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && !exited) {
    try {
      const r = await fetch(`${baseUrl}/healthz`);
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* noch nicht bereit */
    }
    await sleep(200);
  }
  if (!ready) {
    child.kill();
    throw new Error(
      `Die App ist nicht gestartet (GET /healthz kam nicht mit 200 zurück).\nLetzte Log-Zeilen:\n${logs.split('\n').slice(-15).join('\n')}`,
    );
  }
  // Der App kurz Zeit geben, Kanal-ID und Live-Status zu laden.
  await sleep(500);

  return {
    baseUrl,
    dataDir,
    logs: () => logs,
    async stop() {
      child.kill();
      await sleep(300);
      try {
        fs.rmSync(dataDir, { recursive: true, force: true });
      } catch {
        /* Windows hält Dateien manchmal kurz fest */
      }
    },
    dbContent() {
      let out = '';
      for (const f of fs.readdirSync(dataDir)) {
        out += fs.readFileSync(path.join(dataDir, f)).toString('latin1');
      }
      return out;
    },
  };
}

/** Liest Set-Cookie-Header in ein einfaches Objekt. */
export function readSetCookies(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return list.map((raw) => {
    const [pair, ...attrs] = raw.split(';');
    const idx = pair.indexOf('=');
    return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim(), attrs: attrs.map((a) => a.trim()), raw };
  });
}

let userCounter = 2000;
export function newUser(overrides = {}) {
  userCounter += 1;
  const id = String(userCounter);
  return { id, login: `zuschauer${id}`, display_name: `Zuschauer${id}`, ...overrides };
}

/** Kompletter Login über Fake-Twitch. Gibt Cookie-Header und Rohwerte zurück. */
export async function login(app, fake, user, { extraCookie = '', path: startPath = '/auth/login', allowFail = false } = {}) {
  const r1 = await fetch(`${app.baseUrl}${startPath}`, { redirect: 'manual' });
  if (r1.status !== 302 && r1.status !== 303) throw new Error(`${startPath} antwortet mit ${r1.status} statt Weiterleitung`);
  const loc = new URL(r1.headers.get('location'));
  const state = loc.searchParams.get('state');
  const stateCookies = readSetCookies(r1).filter((c) => c.name === 'hub_oauth_state');
  if (!state || !stateCookies.length) throw new Error('Kein state oder kein hub_oauth_state-Cookie');
  const code = fake.createCode(user, { redirectUri: `${app.baseUrl}/auth/callback`, scope: loc.searchParams.get('scope') || '' });
  const cookieHeader = [`hub_oauth_state=${stateCookies[0].value}`, extraCookie].filter(Boolean).join('; ');
  const r2 = await fetch(`${app.baseUrl}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
    headers: { cookie: cookieHeader },
  });
  const session = readSetCookies(r2).find((c) => c.name === 'hub_session' && c.value);
  if (allowFail && !session) return { response: r2, scope: loc.searchParams.get('scope') || '' };
  if (!session) throw new Error(`Login fehlgeschlagen: /auth/callback antwortet mit ${r2.status} und ohne hub_session-Cookie`);
  return { cookie: `hub_session=${session.value}`, sessionValue: session.value, sessionCookie: session, code, response: r2, scope: loc.searchParams.get('scope') || '' };
}

export async function api(app, method, pathname, { cookie, body, origin = app.baseUrl, contentType = 'application/json', raw } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  if (method !== 'GET' && contentType) headers['content-type'] = contentType;
  const res = await fetch(`${app.baseUrl}${pathname}`, {
    method,
    headers,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : method === 'GET' ? undefined : '{}',
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* kein JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}

export async function me(app, cookie) {
  return api(app, 'GET', '/api/me', { cookie });
}

/** Schickt eine (standardmäßig korrekt signierte) Twitch-EventSub-Nachricht. */
export async function sendWebhook(app, { type = 'notification', subscriptionType, event, challenge, messageId, timestamp, secret = SECRETS.eventsubSecret, signature, omitSignature = false } = {}) {
  const id = messageId || crypto.randomUUID();
  const ts = timestamp || new Date().toISOString();
  const payload = {
    subscription: {
      id: crypto.randomUUID(),
      status: type === 'webhook_callback_verification' ? 'webhook_callback_verification_pending' : 'enabled',
      type: subscriptionType,
      version: subscriptionType === 'channel.follow' ? '2' : '1',
      condition: { broadcaster_user_id: '1000' },
      transport: { method: 'webhook', callback: `${app.baseUrl}/webhooks/twitch` },
      created_at: new Date().toISOString(),
    },
  };
  if (event) payload.event = event;
  if (challenge) payload.challenge = challenge;
  const body = JSON.stringify(payload);
  const sig = signature || 'sha256=' + crypto.createHmac('sha256', secret).update(id + ts + body).digest('hex');
  const headers = {
    'content-type': 'application/json',
    'twitch-eventsub-message-id': id,
    'twitch-eventsub-message-timestamp': ts,
    'twitch-eventsub-message-type': type,
    'twitch-eventsub-message-retry': '0',
    'twitch-eventsub-subscription-type': subscriptionType,
    'twitch-eventsub-subscription-version': payload.subscription.version,
  };
  if (!omitSignature) headers['twitch-eventsub-message-signature'] = sig;
  const res = await fetch(`${app.baseUrl}/webhooks/twitch`, { method: 'POST', headers, body });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers, messageId: id, timestamp: ts };
}

export const followEvent = (user, broadcasterId = '1000') => ({
  user_id: user.id,
  user_login: user.login,
  user_name: user.display_name,
  broadcaster_user_id: broadcasterId,
  broadcaster_user_login: SECRETS.channel,
  broadcaster_user_name: SECRETS.channel,
  followed_at: new Date().toISOString(),
});

export const streamOnlineEvent = () => ({
  id: '42',
  broadcaster_user_id: '1000',
  broadcaster_user_login: SECRETS.channel,
  broadcaster_user_name: SECRETS.channel,
  type: 'live',
  started_at: new Date().toISOString(),
});

export const streamOfflineEvent = () => ({
  broadcaster_user_id: '1000',
  broadcaster_user_login: SECRETS.channel,
  broadcaster_user_name: SECRETS.channel,
});

/** Öffnet den Overlay-Event-Stream und wartet auf ein passendes Event. */
export function waitForOverlayEvent(app, predicate, { key = SECRETS.overlayKey, timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  let ready;
  const readyPromise = new Promise((r) => (ready = r));
  const result = (async () => {
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${app.baseUrl}/overlay/events?key=${encodeURIComponent(key)}`, { signal: controller.signal });
      ready(res.status);
      if (res.status !== 200) return { status: res.status, event: null };
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line.startsWith('data:')) {
            try {
              const ev = JSON.parse(line.slice(5).trim());
              if (predicate(ev)) {
                controller.abort();
                return { status: 200, event: ev };
              }
            } catch {
              /* keine JSON-Zeile */
            }
          }
        }
      }
      return { status: 200, event: null };
    } catch {
      ready(0);
      return { status: 200, event: null };
    } finally {
      clearTimeout(timer);
    }
  })();
  return { ready: readyPromise, result };
}

/** Alle Dateien eines Ordners rekursiv (für statische Prüfungen). */
export function listFiles(dir, exts) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel, exts));
    else if (!exts || exts.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

export const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wartet, bis eine Bedingung erfüllt ist (für zeitgesteuerte Abläufe wie Zuschau-Bananen). */
export async function waitUntil(check, { timeoutMs = 6000, everyMs = 150 } = {}) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    last = await check();
    if (last) return last;
    await sleep2(everyMs);
  }
  return last;
}
