// DER HACKERTEST
// Startet deine App, prüft ob sie funktioniert, und greift sie dann gezielt an.
// Diese Datei NICHT verändern: Wenn ein Test rot ist, muss der App-Code repariert werden.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { startFakeTwitch } from './fake-twitch.js';
import {
  ROOT,
  CONFIG,
  SECRETS,
  startApp,
  login,
  api,
  me,
  newUser,
  readSetCookies,
  sendWebhook,
  followEvent,
  streamOnlineEvent,
  waitForOverlayEvent,
  listFiles,
} from './harness.js';

const T = { timeout: 30000 };
const actions = CONFIG.actions;
const byType = (t) => actions.find((a) => a.type === t);
const SOUND = byType('sound');
const RAIN = byType('rain');
const VOTE = byType('vote');

let fake;
let app;

const U = {
  main: newUser({ display_name: 'TestZuschauerin' }),
  fixation: newUser(),
  early: newUser({ display_name: 'FruehAufsteher' }),
  sqli: newUser({ login: "robert');droptable", display_name: "Robert'); DROP TABLE users;--" }),
  victim: newUser(),
  racer: newUser(),
  xss: newUser({ login: 'xssuser', display_name: '<img src=x onerror=alert(1)>' }),
  deleteme: newUser({ display_name: 'BitteLoeschen' }),
};
const S = {}; // Sessions der Testnutzer
const sessionValues = [];

const bananas = async (cookie) => {
  const r = await me(app, cookie);
  assert.equal(r.status, 200, `GET /api/me sollte 200 liefern, kam aber ${r.status}`);
  return r.json.bananas;
};
const doLogin = async (key, opts) => {
  const s = await login(app, fake, U[key], opts);
  S[key] = s;
  sessionValues.push(s.sessionValue);
  return s;
};
const redeem = (cookie, body, opts = {}) => api(app, 'POST', '/api/redeem', { cookie, body, ...opts });
const noStack = (text) => !/\n\s+at\s/.test(text) && !text.includes('node_modules') && !/SyntaxError|TypeError|ReferenceError/.test(text);

before(async () => {
  assert.ok(SOUND && RAIN && VOTE, 'hub.config.json braucht je eine Aktion vom Typ sound, rain und vote');
  fake = await startFakeTwitch({ clientId: SECRETS.clientId, clientSecret: SECRETS.clientSecret, channel: SECRETS.channel });
  app = await startApp({ fake });
});

after(async () => {
  await app?.stop();
  await fake?.close();
});

// ------------------------------------------------------------------
// Grundfunktionen
// ------------------------------------------------------------------

test('Funktion: Startseite lädt', T, async () => {
  const r = await fetch(`${app.baseUrl}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/html/);
});

test('Funktion: Login mit Twitch klappt', T, async () => {
  const s = await doLogin('main');
  const r = await me(app, s.cookie);
  assert.equal(r.status, 200, `GET /api/me nach dem Login: ${r.status}`);
  assert.equal(r.json.displayName, U.main.display_name);
  assert.equal(r.json.bananas, 0);
});

test('Angriff: Login fragt keine unnötigen Twitch-Rechte an', T, async () => {
  const r = await fetch(`${app.baseUrl}/auth/login`, { redirect: 'manual' });
  assert.ok([302, 303].includes(r.status), `/auth/login sollte weiterleiten, kam ${r.status}`);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.origin, fake.url, 'Weiterleitung muss zu Twitch gehen');
  assert.equal(loc.pathname, '/oauth2/authorize');
  assert.equal(loc.searchParams.get('client_id'), SECRETS.clientId);
  assert.equal(loc.searchParams.get('response_type'), 'code');
  assert.equal(loc.searchParams.get('redirect_uri'), `${app.baseUrl}/auth/callback`);
  assert.ok(loc.searchParams.get('state')?.length >= 32, 'state muss lang und zufällig sein');
  const scope = loc.searchParams.get('scope') || '';
  assert.equal(scope.trim(), '', `Zuschauer-Login darf keine Rechte anfragen, angefragt: "${scope}"`);
});

test('Angriff: Login ohne state wird abgewehrt', T, async () => {
  const code = fake.createCode(newUser());
  const r = await fetch(`${app.baseUrl}/auth/callback?code=${code}`, { redirect: 'manual' });
  assert.ok([400, 403].includes(r.status), `Erwartet 400 oder 403, kam ${r.status}`);
  assert.ok(!readSetCookies(r).some((c) => c.name === 'hub_session' && c.value), 'Es darf keine Session entstehen');
});

test('Angriff: Login mit gefälschtem state wird abgewehrt', T, async () => {
  const r1 = await fetch(`${app.baseUrl}/auth/login`, { redirect: 'manual' });
  const cookie = readSetCookies(r1).find((c) => c.name === 'hub_oauth_state');
  assert.ok(cookie, 'hub_oauth_state-Cookie fehlt');
  const code = fake.createCode(newUser());
  const forged = crypto.randomBytes(32).toString('base64url');
  const r2 = await fetch(`${app.baseUrl}/auth/callback?code=${code}&state=${forged}`, {
    redirect: 'manual',
    headers: { cookie: `hub_oauth_state=${cookie.value}` },
  });
  assert.equal(r2.status, 403);
  assert.ok(!readSetCookies(r2).some((c) => c.name === 'hub_session' && c.value), 'Es darf keine Session entstehen');
});

test('Angriff: Session-Fixation (untergeschobene Session-ID)', T, async () => {
  const planted = 'angreifer_' + crypto.randomBytes(16).toString('hex');
  const s = await doLogin('fixation', { extraCookie: `hub_session=${planted}` });
  assert.notEqual(s.sessionValue, planted, 'Nach dem Login muss eine neue Session-ID vergeben werden');
  const r = await me(app, `hub_session=${planted}`);
  assert.equal(r.status, 401, 'Die untergeschobene Session-ID darf nicht funktionieren');
  assert.equal((await me(app, s.cookie)).status, 200);
});

test('Angriff: Session-Cookie ist vor JavaScript und fremden Seiten geschützt', T, async () => {
  const attrs = S.main.sessionCookie.attrs.map((a) => a.toLowerCase());
  assert.ok(attrs.includes('httponly'), 'Cookie braucht HttpOnly');
  assert.ok(attrs.some((a) => a === 'samesite=lax' || a === 'samesite=strict'), 'Cookie braucht SameSite=Lax oder Strict');
  assert.ok(attrs.includes('path=/'), 'Cookie braucht Path=/');
});

test('Angriff: Twitch-Token wird nach dem Login sofort vernichtet', T, async () => {
  const tokens = [...fake.state.userTokens.entries()].filter(([, u]) => u.id === U.main.id).map(([t]) => t);
  assert.ok(tokens.length > 0, 'Die App hat kein Token bei Twitch geholt');
  for (const t of tokens) assert.ok(fake.state.revoked.has(t), 'Das Twitch-Token wurde nicht widerrufen (POST /oauth2/revoke)');
});

test('Angriff: Check-in ist nur möglich, wenn der Stream live ist', T, async () => {
  const r = await api(app, 'POST', '/api/checkin', { cookie: S.main.cookie });
  assert.equal(r.status, 409, `Offline-Check-in muss 409 liefern, kam ${r.status}`);
  assert.equal(await bananas(S.main.cookie), 0);
});

test('Funktion: Stream geht live (Twitch-Webhook)', T, async () => {
  fake.setLive(true);
  const r = await sendWebhook(app, { subscriptionType: 'stream.online', event: streamOnlineEvent() });
  assert.ok(r.status >= 200 && r.status < 300, `Webhook sollte 2xx liefern, kam ${r.status}`);
  const m = await me(app, S.main.cookie);
  assert.equal(m.json.isLive, true, 'isLive sollte true sein');
});

test('Funktion: Check-in bringt Bananen', T, async () => {
  const r = await api(app, 'POST', '/api/checkin', { cookie: S.main.cookie });
  assert.equal(r.status, 200, `Check-in: ${r.status} ${r.text}`);
  assert.equal(await bananas(S.main.cookie), CONFIG.checkinBananas);
});

test('Angriff: Doppelter Check-in am selben Tag', T, async () => {
  const r = await api(app, 'POST', '/api/checkin', { cookie: S.main.cookie });
  assert.equal(r.status, 409);
  assert.equal(await bananas(S.main.cookie), CONFIG.checkinBananas);
});

test('Funktion: Follow bringt einmalig Bonus-Bananen', T, async () => {
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.main) });
  assert.ok(r.status >= 200 && r.status < 300, `Webhook: ${r.status}`);
  assert.equal(await bananas(S.main.cookie), CONFIG.checkinBananas + CONFIG.followBonus);
});

test('Angriff: Wiederholte Follow-Nachrichten bringen keinen doppelten Bonus', T, async () => {
  const before = await bananas(S.main.cookie);
  const first = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.main) });
  const replay = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.main), messageId: first.messageId, timestamp: first.timestamp });
  assert.ok(replay.status >= 200 && replay.status < 300, `Doppelte Nachricht sollte mit 2xx quittiert werden, kam ${replay.status}`);
  assert.equal(await bananas(S.main.cookie), before, 'Follow-Bonus darf es nur einmal geben');
});

test('Funktion: Follow vor dem ersten Login wird nachgereicht', T, async () => {
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.early) });
  assert.ok(r.status >= 200 && r.status < 300, `Webhook: ${r.status}`);
  const s = await doLogin('early');
  assert.equal(await bananas(s.cookie), CONFIG.followBonus);
});

test('Funktion: Aktion einlösen zieht Bananen ab', T, async () => {
  const before = await bananas(S.main.cookie);
  const r = await redeem(S.main.cookie, { actionId: RAIN.id });
  assert.equal(r.status, 200, `Einlösen: ${r.status} ${r.text}`);
  assert.equal(await bananas(S.main.cookie), before - RAIN.cost);
});

test('Funktion: Overlay zeigt eingelöste Aktionen live an', T, async () => {
  const waiter = waitForOverlayEvent(app, (ev) => ev.type === 'redeem' && ev.actionId === SOUND.id);
  const status = await waiter.ready;
  assert.equal(status, 200, `/overlay/events mit richtigem Schlüssel: ${status}`);
  const r = await redeem(S.main.cookie, { actionId: SOUND.id });
  assert.equal(r.status, 200, `Einlösen: ${r.status} ${r.text}`);
  const { event } = await waiter.result;
  assert.ok(event, 'Kein Overlay-Event angekommen');
  assert.equal(event.displayName, U.main.display_name);
});

test('Angriff: Cooldown lässt sich nicht umgehen', T, async () => {
  const before = await bananas(S.main.cookie);
  const r = await redeem(S.main.cookie, { actionId: SOUND.id });
  assert.equal(r.status, 429, `Zweites Einlösen im Cooldown muss 429 liefern, kam ${r.status}`);
  assert.equal(await bananas(S.main.cookie), before);
});

test('Funktion: Abstimmung zählt Stimmen', T, async () => {
  const option = VOTE.options[0];
  const r = await redeem(S.main.cookie, { actionId: VOTE.id, option });
  assert.equal(r.status, 200, `Abstimmen: ${r.status} ${r.text}`);
  const v = await api(app, 'GET', '/api/vote');
  assert.equal(v.status, 200);
  const entry = v.json.options.find((o) => o.option === option);
  assert.ok(entry && entry.votes >= 1, 'Die Stimme wurde nicht gezählt');
});

test('Funktion: Rangliste zeigt die Zuschauer', T, async () => {
  const r = await api(app, 'GET', '/api/leaderboard');
  assert.equal(r.status, 200);
  const entries = r.json.entries;
  assert.ok(Array.isArray(entries) && entries.length <= CONFIG.leaderboardSize);
  const mine = entries.find((e) => e.displayName === U.main.display_name);
  assert.ok(mine, 'Zuschauerin fehlt in der Rangliste');
  assert.equal(mine.bananas, await bananas(S.main.cookie));
  for (let i = 1; i < entries.length; i++) assert.ok(entries[i - 1].bananas >= entries[i].bananas, 'Rangliste ist nicht sortiert');
  assert.ok(!/twitch_id|session|token/i.test(r.text), 'Rangliste gibt zu viele Daten heraus');
});

test('Angriff: Kontostand von außen auf 99999 setzen', T, async () => {
  const before = await bananas(S.main.cookie);
  const attempts = [
    ['POST', '/api/me'],
    ['PUT', '/api/me'],
    ['PATCH', '/api/me'],
    ['POST', '/api/bananas'],
    ['PUT', '/api/bananas'],
  ];
  for (const [method, p] of attempts) {
    const r = await api(app, method, p, { cookie: S.main.cookie, body: { bananas: 99999 } });
    assert.ok(r.status >= 400, `${method} ${p} darf nicht erfolgreich sein (kam ${r.status})`);
  }
  assert.equal(await bananas(S.main.cookie), before);
});

test('Angriff: Manipulierte Kosten werden ignoriert', T, async () => {
  const before = await bananas(S.early.cookie);
  const r = await redeem(S.early.cookie, { actionId: VOTE.id, option: VOTE.options[0], cost: 0 });
  assert.ok([200, 400].includes(r.status), `Erwartet 400 (unbekanntes Feld) oder 200 mit echten Kosten, kam ${r.status}`);
  const after = await bananas(S.early.cookie);
  if (r.status === 200) assert.equal(after, before - VOTE.cost, 'Es wurden nicht die echten Kosten abgezogen');
  else assert.equal(after, before);
});

test('Angriff: Unbekannte Aktionen und ungültige Optionen', T, async () => {
  const before = await bananas(S.early.cookie);
  const cases = [
    { actionId: 'gratis-bananen' },
    { actionId: VOTE.id, option: 'Nicht in der Liste' },
    { actionId: VOTE.id },
  ];
  for (const body of cases) {
    const r = await redeem(S.early.cookie, body);
    assert.equal(r.status, 400, `${JSON.stringify(body)} muss 400 liefern, kam ${r.status}`);
  }
  assert.equal(await bananas(S.early.cookie), before);
});

test('Angriff: Einlösen ohne Login', T, async () => {
  const r = await redeem(undefined, { actionId: SOUND.id });
  assert.equal(r.status, 401);
});

test('Angriff: SQL-Injection über den Twitch-Namen', T, async () => {
  const s = await doLogin('sqli');
  const m = await me(app, s.cookie);
  assert.equal(m.status, 200);
  assert.equal(m.json.displayName, U.sqli.display_name, 'Der Name muss unverändert gespeichert werden');
  assert.equal((await api(app, 'GET', '/api/leaderboard')).status, 200, 'Rangliste kaputt nach Injection-Versuch');
  assert.equal((await me(app, S.main.cookie)).status, 200, 'Andere Nutzer kaputt nach Injection-Versuch');
});

test('Angriff: Einlösen ohne genug Bananen', T, async () => {
  assert.equal(await bananas(S.sqli.cookie), 0);
  const r = await redeem(S.sqli.cookie, { actionId: VOTE.id, option: VOTE.options[0] });
  assert.equal(r.status, 402, `Erwartet 402, kam ${r.status}`);
  assert.equal(await bananas(S.sqli.cookie), 0);
});

test('Angriff: Fremde Website löst Aktion aus (CSRF)', T, async () => {
  const before = await bananas(S.early.cookie);
  const r = await redeem(S.early.cookie, { actionId: VOTE.id, option: VOTE.options[0] }, { origin: 'https://boese-seite.example' });
  assert.equal(r.status, 403, `Erwartet 403, kam ${r.status}`);
  assert.equal(await bananas(S.early.cookie), before);
});

test('Angriff: Anfrage ohne Origin-Header (CSRF)', T, async () => {
  const before = await bananas(S.early.cookie);
  const r = await redeem(S.early.cookie, { actionId: VOTE.id, option: VOTE.options[0] }, { origin: null });
  assert.equal(r.status, 403, `Erwartet 403, kam ${r.status}`);
  assert.equal(await bananas(S.early.cookie), before);
});

test('Angriff: Overlay ohne Schlüssel öffnen', T, async () => {
  const ok = await fetch(`${app.baseUrl}/overlay?key=${SECRETS.overlayKey}`);
  assert.equal(ok.status, 200, 'Overlay mit richtigem Schlüssel muss funktionieren');
  await ok.text();
  for (const p of ['/overlay', '/overlay/events']) {
    const r = await fetch(`${app.baseUrl}${p}`);
    assert.equal(r.status, 403, `${p} ohne Schlüssel: ${r.status}`);
    await r.text();
  }
});

test('Angriff: Overlay mit geratenem Schlüssel öffnen', T, async () => {
  const wrong = [SECRETS.overlayKey.slice(0, -1) + (SECRETS.overlayKey.endsWith('a') ? 'b' : 'a'), SECRETS.overlayKey.slice(0, 10), 'x'.repeat(200)];
  for (const key of wrong) {
    for (const p of ['/overlay', '/overlay/events']) {
      const r = await fetch(`${app.baseUrl}${p}?key=${encodeURIComponent(key)}`);
      assert.equal(r.status, 403, `${p} mit falschem Schlüssel: ${r.status}`);
      await r.text();
    }
  }
});

test('Angriff: Gefälschter Follow-Webhook ohne Signatur', T, async () => {
  await doLogin('victim');
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.victim), omitSignature: true });
  assert.equal(r.status, 403, `Erwartet 403, kam ${r.status}`);
  assert.equal(await bananas(S.victim.cookie), 0);
});

test('Angriff: Follow-Webhook mit falscher Signatur', T, async () => {
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.victim), secret: 'falsches_geheimnis_123' });
  assert.equal(r.status, 403, `Erwartet 403, kam ${r.status}`);
  assert.equal(await bananas(S.victim.cookie), 0);
});

test('Angriff: Alte Webhook-Nachricht erneut abgespielt', T, async () => {
  const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.victim), timestamp: old });
  assert.equal(r.status, 403, `Erwartet 403, kam ${r.status}`);
  assert.equal(await bananas(S.victim.cookie), 0);
});

test('Angriff: Follow für einen fremden Kanal', T, async () => {
  const r = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.victim, '9999') });
  assert.ok(r.status >= 200 && r.status < 300, `Webhook: ${r.status}`);
  assert.equal(await bananas(S.victim.cookie), 0, 'Follows für andere Kanäle dürfen nichts bringen');
  const ok = await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.victim) });
  assert.ok(ok.status >= 200 && ok.status < 300);
  assert.equal(await bananas(S.victim.cookie), CONFIG.followBonus, 'Echter Follow muss weiterhin funktionieren');
});

test('Funktion: Twitch-Webhook-Bestätigung (Challenge)', T, async () => {
  const challenge = 'challenge_' + crypto.randomBytes(8).toString('hex');
  const r = await sendWebhook(app, { type: 'webhook_callback_verification', subscriptionType: 'stream.online', challenge });
  assert.equal(r.status, 200);
  assert.equal(r.text, challenge);
  assert.match(r.headers.get('content-type') || '', /text\/plain/);
});

test('Angriff: 20 gleichzeitige Einlösungen (Race Condition)', T, async () => {
  const s = await doLogin('racer');
  assert.equal((await api(app, 'POST', '/api/checkin', { cookie: s.cookie })).status, 200);
  await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.racer) });
  const start = await bananas(s.cookie);
  assert.equal(start, CONFIG.checkinBananas + CONFIG.followBonus);
  const results = await Promise.all(Array.from({ length: 20 }, () => redeem(s.cookie, { actionId: VOTE.id, option: VOTE.options[1] })));
  const ok = results.filter((r) => r.status === 200).length;
  for (const r of results) assert.ok([200, 402, 429].includes(r.status), `Unerwarteter Status ${r.status}`);
  const end = await bananas(s.cookie);
  assert.ok(ok >= 1, 'Keine einzige Einlösung hat geklappt');
  assert.ok(end >= 0, `Kontostand ist negativ: ${end}`);
  assert.equal(end, start - ok * VOTE.cost, `Kontostand passt nicht: ${ok} Einlösungen, aber ${start - end} Bananen weg`);
});

test('Angriff: Schadcode im Twitch-Namen (XSS)', T, async () => {
  const s = await doLogin('xss');
  const m = await me(app, s.cookie);
  assert.equal(m.json.displayName, U.xss.display_name, 'Name muss als reiner Text gespeichert werden');
  const page = await (await fetch(`${app.baseUrl}/`, { headers: { cookie: s.cookie } })).text();
  assert.ok(!page.includes('<img src=x onerror'), 'Startseite enthält den Schadcode ungefiltert');
  const overlay = await (await fetch(`${app.baseUrl}/overlay?key=${SECRETS.overlayKey}`)).text();
  assert.ok(!overlay.includes('<img src=x onerror'), 'Overlay enthält den Schadcode ungefiltert');

  const forbidden = /\b(innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\s*\(|new\s+Function)\b/;
  for (const f of [...listFiles('public', ['.js', '.html']), ...listFiles('views', ['.js', '.html'])]) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!forbidden.test(src), `${f} nutzt eine unsichere Funktion (${src.match(forbidden)?.[0]}). Bitte textContent verwenden.`);
    if (f.endsWith('.html')) {
      assert.ok(!/\son[a-z]+\s*=/i.test(src), `${f} enthält Inline-Eventhandler (on…=)`);
      assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(src), `${f} enthält Inline-JavaScript`);
    }
  }
});

test('Angriff: Fehlermeldungen verraten Interna', T, async () => {
  const bad = await api(app, 'POST', '/api/redeem', { cookie: S.early.cookie, raw: '{"actionId":' });
  assert.equal(bad.status, 400, `Kaputtes JSON muss 400 liefern, kam ${bad.status}`);
  assert.ok(noStack(bad.text), 'Fehlerantwort enthält Stacktrace oder interne Details');
  const nf = await fetch(`${app.baseUrl}/gibt-es-nicht-${Date.now()}`);
  assert.equal(nf.status, 404);
  assert.ok(noStack(await nf.text()), '404-Seite enthält interne Details');
  const nfApi = await api(app, 'GET', '/api/gibt-es-nicht');
  assert.ok([401, 404].includes(nfApi.status), `Unbekannte API-Route: ${nfApi.status}`);
  assert.ok(noStack(nfApi.text));
});

test('Angriff: Sicherheits-Header fehlen', T, async () => {
  const r = await fetch(`${app.baseUrl}/`);
  await r.text();
  const csp = r.headers.get('content-security-policy') || '';
  assert.ok(csp, 'Content-Security-Policy fehlt');
  const scriptSrc = (csp.match(/script-src([^;]*)/) || csp.match(/default-src([^;]*)/) || [])[1] || '';
  assert.ok(scriptSrc && !/unsafe-inline|unsafe-eval|\*/.test(scriptSrc), `script-src ist zu offen: "${scriptSrc.trim()}"`);
  assert.ok(/frame-ancestors/.test(csp) || r.headers.get('x-frame-options'), 'Schutz gegen Einbetten fehlt');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null, 'X-Powered-By verrät die Technik');
});

test('Angriff: Tokens und Secrets in der Datenbank', T, async () => {
  const db = app.dbContent();
  assert.ok(db.length > 0, 'Keine Datenbankdatei gefunden');
  const secrets = [...fake.secrets(), SECRETS.eventsubSecret, SECRETS.overlayKey];
  for (const s of secrets) assert.ok(!db.includes(s), 'In der Datenbank steht ein Token oder Secret im Klartext');
  for (const v of sessionValues) assert.ok(!db.includes(v), 'Session-IDs stehen im Klartext in der Datenbank (nur Hash speichern)');
  const m = await me(app, S.main.cookie);
  for (const s of secrets) assert.ok(!m.text.includes(s), '/api/me gibt ein Token oder Secret heraus');
});

test('Angriff: Tokens und Secrets in den Logs', T, async () => {
  const logs = app.logs();
  const secrets = [...fake.secrets(), ...fake.state.issuedCodes, SECRETS.eventsubSecret, SECRETS.overlayKey, ...sessionValues];
  for (const s of secrets) assert.ok(!logs.includes(s), 'Die Logs enthalten ein Token, Secret, Code oder den Overlay-Schlüssel');
});

test('Angriff: Logout beendet die Session wirklich', T, async () => {
  const r = await api(app, 'POST', '/auth/logout', { cookie: S.fixation.cookie });
  assert.equal(r.status, 200, `Logout: ${r.status}`);
  assert.equal((await me(app, S.fixation.cookie)).status, 401, 'Alte Session funktioniert nach Logout noch');
});

test('Funktion: Zuschauer können ihre Daten löschen', T, async () => {
  const s = await doLogin('deleteme');
  await sendWebhook(app, { subscriptionType: 'channel.follow', event: followEvent(U.deleteme) });
  const r = await api(app, 'POST', '/api/me/delete', { cookie: s.cookie });
  assert.equal(r.status, 200, `Löschen: ${r.status}`);
  assert.equal((await me(app, s.cookie)).status, 401, 'Session lebt nach dem Löschen weiter');
  const lb = await api(app, 'GET', '/api/leaderboard');
  assert.ok(!lb.json.entries.some((e) => e.displayName === U.deleteme.display_name), 'Gelöschter Nutzer steht noch in der Rangliste');
});

test('Angriff: Setup-Modus verrät keine Geheimnisse', T, async () => {
  const secret = 'supergeheim_' + crypto.randomBytes(12).toString('hex');
  const setupApp = await startApp({ full: false, env: { TWITCH_CLIENT_SECRET: secret } });
  try {
    const r = await fetch(`${setupApp.baseUrl}/`);
    const html = await r.text();
    assert.equal(r.status, 200, 'Setup-Seite sollte erreichbar sein');
    assert.ok(!html.includes(secret), 'Die Setup-Seite zeigt den Wert eines Secrets');
    assert.ok(html.includes('TWITCH_CLIENT_ID'), 'Die Setup-Seite sollte fehlende Variablen beim Namen nennen');
    const m = await fetch(`${setupApp.baseUrl}/api/me`);
    assert.equal(m.status, 503, `Im Setup-Modus muss die API 503 liefern, kam ${m.status}`);
    assert.ok(!setupApp.logs().includes(secret), 'Das Secret steht in den Logs');
  } finally {
    await setupApp.stop();
  }
});

test('Angriff: Massenanfragen (Rate-Limit)', T, async () => {
  const fresh = await startApp({ fake });
  try {
    let limited = 0;
    for (let batch = 0; batch < 8 && !limited; batch++) {
      const rs = await Promise.all(Array.from({ length: 50 }, () => fetch(`${fresh.baseUrl}/api/leaderboard`).then(async (r) => (await r.text(), r.status))));
      limited += rs.filter((s) => s === 429).length;
    }
    assert.ok(limited > 0, 'Auch nach 400 Anfragen pro Minute auf /api gab es kein 429');
    let authLimited = 0;
    for (let i = 0; i < 40 && !authLimited; i++) {
      const r = await fetch(`${fresh.baseUrl}/auth/login`, { redirect: 'manual' });
      if (r.status === 429) authLimited++;
    }
    assert.ok(authLimited > 0, 'Auch nach 40 Login-Versuchen gab es kein 429');
  } finally {
    await fresh.stop();
  }
});

test('Angriff: Geheimnisse im Code oder auf GitHub', T, async () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim());
  assert.ok(gi.includes('.env'), '.env fehlt in .gitignore');
  try {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
    assert.ok(!tracked.some((f) => /(^|\/)\.env$/.test(f.trim())), '.env ist in Git eingecheckt');
  } catch (e) {
    if (e?.code === 'ERR_ASSERTION') throw e;
  }
  const pattern = /(secret|password|passwort|token|overlay_key|api_key)["'\s]*[:=]\s*["'`][A-Za-z0-9_\-]{16,}["'`]/i;
  for (const f of [...listFiles('src'), ...listFiles('public'), ...listFiles('views')]) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!pattern.test(src), `${f} enthält vermutlich ein fest eingetragenes Secret`);
  }
});
