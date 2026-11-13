# SPEC: Twitch-Zuschauer-Hub

Dies ist der Bauplan für Claude Code. Baue die App exakt nach dieser Spezifikation.
Alle Sicherheitsregeln aus `SECURITY.md` gelten zusätzlich und haben Vorrang.
Fertig ist die App erst, wenn `npm run hackertest` komplett grün ist.

## 1. Ziel

Eine kleine Website für die Community eines Twitch-Streamers:

1. **Twitch-Login:** Zuschauer melden sich mit ihrem Twitch-Account an.
2. **Bananen sammeln:** Während der Stream live ist, holen sie sich einmal am Tag Bananen ab (Check-in). Für einen Follow gibt es einmalig einen Bonus.
3. **Aktionen einlösen:** Mit Bananen lösen sie Aktionen im Stream aus: Sound, Bananenregen, Abstimmung über das nächste Spiel.
4. **Rangliste und OBS-Overlay:** Eine öffentliche Rangliste und ein Overlay, das der Streamer als Browserquelle in OBS einbindet.

Bananen sind rein virtuell und haben **keinen Geldwert**. Man kann sie nicht kaufen, verkaufen, übertragen oder auszahlen. Es gibt **keine** Zahlungsfunktion und keine Funktion zum Verschenken von Bananen. Baue so etwas auch nicht ein, wenn es naheliegt.

## 2. Technik (fest vorgegeben)

- Node.js ab 22.13, ES-Module (`"type": "module"`)
- Nur die Pakete, die schon in `package.json` stehen:
  - `express` (v5): Webserver
  - `helmet`: Sicherheits-Header
  - `express-rate-limit`: Rate-Limits
  - `knex`: Datenbankzugriff und Migrationen
  - `mysql2`: MySQL online (Hostinger)
  - `better-sqlite3`: SQLite lokal
  - `zod`: Eingabeprüfung
- **Keine weiteren Pakete installieren.** Keine Frontend-Frameworks, keine CDNs, keine externen Schriftarten.
- Frontend: HTML, CSS und Vanilla-JavaScript-Module in `public/`. Alles wird vom eigenen Server ausgeliefert.
- Twitch-Aufrufe mit dem eingebauten `fetch` von Node.

### Ordnerstruktur

```
src/
  server.js          Einstiegspunkt: Konfig laden, DB migrieren, App starten
  app.js             Express-App zusammenbauen
  config.js          Umgebungsvariablen + hub.config.json laden und prüfen
  db.js              Knex-Verbindung + Migrationen
  twitch.js          Alle Aufrufe an Twitch (OAuth, Helix, EventSub)
  routes/            auth.js, api.js, webhooks.js, overlay.js
  security/          sessions.js, csrf.js, ratelimits.js
  services/          bananas.js, redeem.js, live.js, events.js (Overlay-Events)
views/
  overlay.html       Overlay-Seite (nur mit Schlüssel erreichbar, NICHT in public/)
public/
  index.html, app.js, style.css, impressum.html, datenschutz.html
  overlay.js, overlay.css
```

Die Starter-Dateien `src/server.js`, `public/index.html` und `public/style.css` darfst du ersetzen. Das Design der Startseite (dunkel, Bananen-Gelb `#ffd43b` als Akzent, Twitch-Lila `#9146ff` für den Login-Button) soll erhalten bleiben.

**Nicht verändern:** `tests/`, `hub.config.json` (nur lesen), `SECURITY.md`, `SPEC.md`, `.claude/`.

Der Hackertest nutzt seine eigene Konfiguration `tests/test.hub.config.json` (über `HUB_CONFIG_FILE`). So bleibt er grün, auch wenn der Streamer `hub.config.json` anpasst.

## 3. Konfiguration

### Umgebungsvariablen

| Variable | Pflicht | Bedeutung |
| --- | --- | --- |
| `PORT` | nein | Port, Standard `3000` |
| `NODE_ENV` | nein | `development`, `production` oder `test` |
| `BASE_URL` | online ja | Öffentliche Adresse, z. B. `https://hub.example.de`. Ein `/` am Ende wird entfernt. Außerhalb von `production` Standard `http://localhost:{PORT}` |
| `TWITCH_CLIENT_ID` | ja | Client-ID der Twitch-App |
| `TWITCH_CLIENT_SECRET` | ja | Client-Secret der Twitch-App |
| `TWITCH_CHANNEL` | ja | Login-Name des Streamers (Kanal) |
| `EVENTSUB_SECRET` | ja | 10 bis 100 Zeichen, Geheimnis für Twitch-Webhooks |
| `OVERLAY_KEY` | ja | mindestens 32 Zeichen, Schlüssel für die Overlay-URL |
| `DATABASE_URL` | online ja | `mysql://user:pass@host:3306/db` oder `file:pfad/zur/datei.sqlite` |
| `DEV_ALWAYS_LIVE` | nein | `true` = Stream gilt immer als live. Nur wirksam, wenn `BASE_URL` mit `http://localhost` oder `http://127.0.0.1` beginnt |
| `TWITCH_ID_URL` | nein | Standard `https://id.twitch.tv`. **Nur bei `NODE_ENV=test` auswerten**, sonst ignorieren |
| `TWITCH_API_URL` | nein | Standard `https://api.twitch.tv`. **Nur bei `NODE_ENV=test` auswerten**, sonst ignorieren |
| `HUB_CONFIG_FILE` | nein | Pfad zu einer anderen Konfigurationsdatei (relativ zum Projektordner). **Nur bei `NODE_ENV=test` auswerten**, sonst immer `hub.config.json` |

- Die App lädt **keine** `.env`-Datei selbst. Lokal macht das `npm run dev` (`--env-file-if-exists=.env`), online setzt Hostinger die Variablen.
- `DATABASE_URL` leer: außerhalb von `production` wird `file:./data/hub.sqlite` benutzt (Ordner automatisch anlegen). In `production` ist `DATABASE_URL` Pflicht.
- `DATABASE_URL` mit `file:` am Anfang: der Rest ist der Dateipfad für SQLite. Den Rest per String abschneiden, **nicht** mit `new URL()` parsen (Windows-Pfade wie `file:C:/…`).
- Client-ID und Client-Secret nur auf „nicht leer“ prüfen, nicht auf ein bestimmtes Format.
- `DEV_ALWAYS_LIVE`: Den Hostnamen von `BASE_URL` mit `new URL()` auslesen. Nur `localhost` und `127.0.0.1` zählen (nicht `localhost.irgendwas.de`).

### Setup-Modus

Fehlt eine Pflichtvariable oder ist sie ungültig, stürzt die App **nicht** ab. Sie startet im Setup-Modus:

- `GET /healthz` antwortet `200` mit `ok`.
- `GET /` zeigt eine freundliche Setup-Seite: welche Variablen fehlen oder ungültig sind (**nur die Namen, niemals Werte**) und ein Hinweis auf `CHECKLISTE.md`.
- Statische Dateien aus `public/` (z. B. `style.css`) bleiben erreichbar.
- Alle anderen Routen antworten `503` mit `{ "error": "setup_required" }`.
- Im Setup-Modus wird keine Verbindung zu Twitch aufgebaut.

### hub.config.json

Enthält Name, Währung, Bananen-Werte und die Aktionen. Beim Start einlesen und mit zod prüfen. Aktionstypen: `sound`, `rain`, `vote`. Eine `vote`-Aktion hat eine Liste `options`.

## 4. Datenbank

Knex mit Migrationen, die beim Start automatisch laufen. Dasselbe Schema für SQLite und MySQL.
Beim SQLite-Client `useNullAsDefault: true` setzen. Alle Zeitstempel (`created_at`, `expires_at`, `received_at` usw.) als `bigInteger` mit Millisekunden seit 1970 (`Date.now()`), damit SQLite und MySQL gleich funktionieren.

**Datensparsamkeit:** Speichere nur, was unten steht. Keine E-Mail-Adressen, keine Profilbilder, **keine Twitch-Tokens**, keine IP-Adressen.

| Tabelle | Spalten |
| --- | --- |
| `users` | `id` (auto), `twitch_id` (string, unique), `login`, `display_name`, `bananas` (int, nie negativ), `follow_bonus_granted` (bool), `last_checkin_date` (string `YYYY-MM-DD`, nullable), `created_at`, `updated_at` |
| `sessions` | `id_hash` (string, Primärschlüssel, SHA-256 hex der Session-ID), `user_id` (FK → users, on delete cascade), `created_at`, `expires_at` |
| `follows` | `twitch_id` (string, Primärschlüssel), `bonus_granted` (bool), `created_at` |
| `eventsub_messages` | `message_id` (string, Primärschlüssel), `received_at` |
| `redemptions` | `id` (auto), `user_id` (FK, on delete cascade), `action_id`, `option` (nullable), `cost`, `created_at` |
| `app_state` | `key` (Primärschlüssel), `value` |

- `app_state` speichert z. B. `stream_live`, `stream_started_at`, `vote_reset_at` und `streamer_authorized` (nur `true`/`false`, kein Token).
- Einträge in `eventsub_messages`, die älter als 1 Stunde sind, regelmäßig löschen.
- Alle Datenbankzugriffe über Knex mit Parametern. **Niemals** Werte in SQL-Strings zusammenbauen, auch nicht in `knex.raw`.

## 5. Login mit Twitch

### Zuschauer-Login

1. `GET /auth/login`
   - Erzeuge `state` (32 zufällige Bytes, base64url).
   - Setze Cookie `hub_oauth_state` = `viewer.<state>`: `HttpOnly`, `SameSite=Lax`, `Path=/auth`, `Max-Age=600`, `Secure` wenn `BASE_URL` mit `https` beginnt.
   - Weiterleitung (`302`) zu `{TWITCH_ID_URL}/oauth2/authorize` mit `response_type=code`, `client_id`, `redirect_uri={BASE_URL}/auth/callback`, `scope=` (**leer**, Zuschauer geben keine zusätzlichen Rechte) und `state`.
2. `GET /auth/callback?code=…&state=…`
   - `state` aus der URL muss mit dem Cookie übereinstimmen (Vergleich mit `crypto.timingSafeEqual`). Sonst `403`, keine Session.
   - Fehlt `code` oder `state`: `400`, keine Session. Hat Twitch `error` zurückgegeben: `400` mit freundlicher Seite, keine Session. Werte aus der URL (`error`, `error_description`) **niemals** in die Seite übernehmen.
   - State-Cookie sofort löschen (einmal verwendbar).
   - `code` per `POST {TWITCH_ID_URL}/oauth2/token` eintauschen (`application/x-www-form-urlencoded`: `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`).
   - Mit dem Token `GET {TWITCH_API_URL}/helix/users` abrufen (Header `Authorization: Bearer …` und `Client-Id`). Daraus `id`, `login`, `display_name`.
   - **Token sofort widerrufen:** `POST {TWITCH_ID_URL}/oauth2/revoke` mit `client_id` und `token`. Access- und Refresh-Token werden **nirgends gespeichert und nie geloggt**.
   - Benutzer anlegen oder aktualisieren (`login`, `display_name`). Gibt es in `follows` einen Eintrag ohne Bonus, Bonus jetzt gutschreiben (siehe 7).
   - **Neue Session erzeugen** (alte Session aus dem Request vorher löschen, Schutz vor Session-Fixation) und zu `/` weiterleiten.

### Sessions

- Session-ID: 32 zufällige Bytes, base64url. In der Datenbank steht nur der SHA-256-Hash.
- Cookie `hub_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 14 Tage, `Secure` wenn `BASE_URL` mit `https` beginnt.
- Abgelaufene Sessions zählen nicht und werden regelmäßig gelöscht.
- `POST /auth/logout`: Session in der DB löschen, Cookie löschen, `200` mit `{ "ok": true }`.

### Streamer-Freigabe (einmalig, für Follow-Meldungen)

Twitch schickt Follow-Meldungen nur, wenn der Streamer der App einmal das Recht `moderator:read:followers` gegeben hat.

- `GET /auth/streamer`: wie `/auth/login`, aber Cookie-Wert `streamer.<state>` und `scope=moderator:read:followers`.
- Im Callback bei Flow `streamer`: Die Twitch-ID des eingeloggten Accounts muss die ID von `TWITCH_CHANNEL` sein, sonst `403`. Danach Token widerrufen, `app_state.streamer_authorized=true` setzen, EventSub-Abo für `channel.follow` anlegen (siehe 6) und eine Erfolgsseite zeigen. Keine Zuschauer-Session anlegen.

## 6. Twitch-Anbindung

- **App-Token:** per `client_credentials` (`POST {TWITCH_ID_URL}/oauth2/token`). Nur im Arbeitsspeicher halten, nie in der DB. Bei Ablauf oder `401` neu holen.
- **Kanal-ID:** beim Start per `GET {TWITCH_API_URL}/helix/users?login={TWITCH_CHANNEL}` mit App-Token auflösen und im Speicher halten.
- **Startreihenfolge:** Konfiguration prüfen, Datenbank migrieren, Kanal-ID und Live-Status laden (höchstens 10 Sekunden warten, danach im Hintergrund weiter versuchen) und **erst dann** den Port öffnen.
- **Live-Status:**
  - Beim Start und danach alle 5 Minuten `GET {TWITCH_API_URL}/helix/streams?user_id={Kanal-ID}` abfragen: Ist `data` nicht leer, ist der Stream live.
  - Webhooks `stream.online` und `stream.offline` aktualisieren den Status sofort.
  - `DEV_ALWAYS_LIVE=true` (nur lokal, siehe 3) überschreibt den Status auf live.
  - Geht der Stream offline, wird die laufende Abstimmung zurückgesetzt.
- **EventSub-Abos:** Nur wenn `BASE_URL` mit `https://` beginnt (Twitch erreicht `localhost` nicht). Beim Start bestehende Abos abfragen und fehlende anlegen, mit Transport `webhook`, `callback={BASE_URL}/webhooks/twitch` und `secret=EVENTSUB_SECRET`:
  - `stream.online` (Version 1) und `stream.offline` (Version 1), Bedingung `broadcaster_user_id`
  - `channel.follow` (Version 2), Bedingung `broadcaster_user_id` und `moderator_user_id` (beide = Kanal-ID), nur wenn `streamer_authorized=true`
- Fehler bei Twitch-Aufrufen dürfen die App nicht abstürzen lassen. Logge sie ohne Tokens oder Secrets.

### Webhook `POST /webhooks/twitch`

- Den **rohen Body** lesen (`express.raw({ type: 'application/json', limit: '64kb' })`), nicht vorher als JSON parsen.
- Signatur prüfen: `sha256=` + HMAC-SHA256 mit `EVENTSUB_SECRET` über `message_id + timestamp + roher Body` (Header `Twitch-Eventsub-Message-Id`, `Twitch-Eventsub-Message-Timestamp`, `Twitch-Eventsub-Message-Signature`). Vergleich mit `crypto.timingSafeEqual`. Fehlt etwas oder passt es nicht: `403`.
- Ist der Zeitstempel mehr als 10 Minuten alt oder mehr als 10 Minuten in der Zukunft: `403`.
- Wurde die `message_id` schon verarbeitet: `204`, nichts weiter tun.
- Typ `webhook_callback_verification`: `200`, Body = `challenge`, `Content-Type: text/plain`.
- Typ `revocation`: loggen, `204`.
- Typ `notification`: Ereignis verarbeiten, dann `204`. Schlägt die Verarbeitung fehl, die `message_id` wieder löschen und `500` antworten, damit Twitch es erneut versucht. Ereignisse, deren `broadcaster_user_id` nicht die Kanal-ID ist, ignorieren (trotzdem `204`).
  - `stream.online` / `stream.offline`: Live-Status setzen.
  - `channel.follow`: siehe 7.
- Diese Route ist von der Origin-Prüfung (CSRF) ausgenommen. Ihr Schutz ist die Signatur.

## 7. Bananen-Regeln

Alle Werte aus `hub.config.json`. Der Server ist die einzige Quelle der Wahrheit. Der Browser zeigt nur an.

- **Check-in:** einmal pro Kalendertag (Zeitzone `Europe/Berlin`) und nur, wenn der Stream live ist. Bringt `checkinBananas`.
- **Follow-Bonus:** einmal pro Twitch-Account für immer, auch nach Ent- und Wieder-Folgen. Kommt ein Follow für jemanden, der sich noch nie eingeloggt hat, wird er in `follows` vorgemerkt und beim ersten Login gutgeschrieben.
- **Abstimmung:** Es zählt die erste Aktion vom Typ `vote` in `hub.config.json`. Der Stand ergibt sich aus ihren Einlösungen seit `app_state.vote_reset_at`. Geht der Stream offline, wird `vote_reset_at` auf jetzt gesetzt.
- **Daten löschen:** löscht den Benutzer mit Sessions, Einlösungen **und** seinem Eintrag in `follows`. Danach ist keine Twitch-ID dieser Person mehr gespeichert.
- **Einlösen:** In **einer Transaktion** den Benutzer sperren (`forUpdate`), Cooldown prüfen (letzte Einlösung derselben Aktion durch denselben Benutzer), dann `UPDATE users SET bananas = bananas - cost WHERE id = ? AND bananas >= cost`. Nur wenn genau eine Zeile geändert wurde, die Einlösung speichern. So kann der Kontostand auch bei gleichzeitigen Anfragen nie negativ werden.
- Die Kosten kommen **immer** aus `hub.config.json`, nie aus der Anfrage.

## 8. API

Alle Antworten sind JSON. Fehler haben die Form `{ "error": "<code>" }`, ohne Details aus dem Server.

Alle `POST`-, `PUT`-, `PATCH`- und `DELETE`-Anfragen (außer `/webhooks/twitch`) brauchen einen `Origin`-Header, der exakt dem Origin von `BASE_URL` entspricht. Sonst `403` mit `{ "error": "forbidden_origin" }`. Unter `/api` müssen sie außerdem `Content-Type: application/json` haben, sonst `415`.

| Methode und Pfad | Login | Antwort |
| --- | --- | --- |
| `GET /healthz` | nein | `200` `ok` (text/plain) |
| `GET /api/config` | nein | `200` `{ hubName, currencyName, currencyEmoji, checkinBananas, followBonus, actions: [{ id, type, name, description, cost, cooldownSeconds, options? }] }` |
| `GET /api/me` | ja | `200` `{ displayName, login, bananas, isLive, checkedInToday }` |
| `POST /api/checkin` | ja | `200` `{ bananas }`. Nicht live: `409` `not_live`. Schon eingecheckt: `409` `already_checked_in` |
| `POST /api/redeem` | ja | Body `{ actionId, option? }`. `200` `{ bananas, actionId }`. Unbekannte Aktion, fehlende oder ungültige Option, falsche Felder: `400`. Zu wenig Bananen: `402` `not_enough_bananas`. Cooldown: `429` `cooldown` mit Header `Retry-After` (Sekunden) |
| `GET /api/leaderboard` | nein | `200` `{ entries: [{ displayName, bananas }] }`, nur Nutzer mit mehr als 0 Bananen, absteigend nach Bananen, bei Gleichstand nach Name, höchstens `leaderboardSize` Einträge |
| `GET /api/vote` | nein | `200` `{ actionId, options: [{ option, votes }] }` für die laufende Abstimmung |
| `POST /api/me/delete` | ja | Benutzer mit allen Daten löschen, Cookie löschen, `200` `{ "ok": true }` |

- Ohne gültige Session: `401` `{ "error": "unauthorized" }`.
- Eingaben mit zod prüfen, **strikt** (unbekannte Felder → `400`). `actionId` höchstens 50 Zeichen, `option` höchstens 100 Zeichen und muss in `options` der Aktion stehen.
- `express.json({ limit: '10kb' })`. Fehlercodes: kaputtes JSON `400` `bad_request`, ungültige Felder `400` `invalid_input`, zu groß `413` `payload_too_large`, falscher Content-Type `415` `unsupported_media_type`.
- Es gibt **keine** Route, mit der man Bananen direkt setzen oder übertragen kann.

## 9. OBS-Overlay

- `GET /overlay?key=OVERLAY_KEY`: liefert `views/overlay.html`. Falscher oder fehlender Schlüssel: `403`.
- `GET /overlay/events?key=OVERLAY_KEY`: Server-Sent Events (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`). Falscher oder fehlender Schlüssel: `403`. Alle 25 Sekunden ein Kommentar `: ping` gegen Timeouts.
- Schlüssel vergleichen: SHA-256 beider Werte, dann `crypto.timingSafeEqual`.
- Events (eine Zeile `data: <JSON>` pro Event):
  - nach jeder Einlösung: `{ "type": "redeem", "actionId", "actionType", "actionName", "displayName", "option"? }`
  - nach jedem gutgeschriebenen Follow-Bonus: `{ "type": "follow", "displayName" }`
  - nach jeder Stimme zusätzlich: `{ "type": "vote", "actionId", "options": [{ "option", "votes" }] }`
- Overlay-Seite: transparenter Hintergrund (für OBS), lädt `/overlay.js` und `/overlay.css`, liest den Schlüssel aus `location.search` und verbindet sich per `EventSource`.
  - `sound`: kurzer „Plopp“-Sound, erzeugt mit der Web Audio API (keine Audiodatei nötig), plus Einblendung „<Name> hat einen Sound ausgelöst“.
  - `rain`: Bananenregen über das ganze Bild (ca. 4 Sekunden, CSS-Animation) plus Einblendung.
  - `vote`: Balken mit dem aktuellen Stand, verschwindet nach 15 Sekunden ohne neue Stimme.
  - `follow`: Einblendung „<Name> folgt jetzt, +<followBonus> 🍌“.
- Namen nur per `textContent` einsetzen.

## 10. Frontend

- Eine Seite (`public/index.html` + `public/app.js`), die über die API arbeitet.
- **Ausgeloggt:** Kurze Erklärung, großer Button „Mit Twitch anmelden“ (Link auf `/auth/login`), Rangliste.
- **Eingeloggt:** Begrüßung mit Namen, großer Bananen-Zähler mit kleiner Animation bei Änderung, Live-Status, Check-in-Button (deaktiviert mit Hinweis, wenn offline oder schon erledigt), Karten für alle Aktionen mit Kosten und Cooldown, Abstimmung mit Auswahl, Rangliste, Logout und „Meine Daten löschen“ (mit Bestätigung in der Seite, nicht per `confirm()`).
- Hinweis sichtbar auf der Seite: „Bananen sind virtuell und haben keinen Geldwert.“
- Fehler freundlich anzeigen (z. B. „Noch 12 Sekunden Cooldown“, „Dafür fehlen dir 15 Bananen“).
- Footer mit Links zu `/impressum.html` und `/datenschutz.html`.
- Dunkles, modernes Design, gut auf dem Handy bedienbar.
- **Kein** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` oder `new Function` in `public/` und `views/`. Elemente mit `document.createElement` bauen und Texte per `textContent` setzen.
- Kein Inline-JavaScript und keine `on…=`-Attribute in HTML (die Content-Security-Policy verbietet das).

## 11. Sicherheit (zusätzlich zu SECURITY.md)

- `helmet` mit Content-Security-Policy:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- `app.disable('x-powered-by')`. Wenn `BASE_URL` mit `https://` beginnt: `app.set('trust proxy', 1)` (Hostinger läuft hinter einem Proxy, sonst teilen sich alle Zuschauer ein Rate-Limit).
- **Rate-Limits** pro IP (`express-rate-limit`, Antwort `429` mit `{ "error": "rate_limited" }`):
  - `/auth/*`: 30 Anfragen pro 15 Minuten
  - `/api/*`: 300 Anfragen pro Minute
  - `POST /api/redeem`: zusätzlich 10 pro Minute **pro Benutzer**
- **Logging:** Keine Tokens, Secrets, Cookies, Autorisierungs-Codes, `OVERLAY_KEY` oder vollständigen URLs mit Query-String loggen. Logge Pfade ohne Query.
- **Fehlerbehandlung:** Ein zentraler Error-Handler antwortet mit `500` `{ "error": "internal_error" }`. Niemals Stacktraces oder Fehlermeldungen an den Browser schicken. Unbekannte Routen: `404` `{ "error": "not_found" }` (bzw. eine einfache 404-Seite für Browser).

## 12. Impressum und Datenschutz

Lege `public/impressum.html` und `public/datenschutz.html` als Platzhalter an: gleiches Design, deutlich markierte Felder „BITTE AUSFÜLLEN“. Die Datenschutzseite listet ehrlich, welche Daten die App speichert (Twitch-ID, Login-Name, Anzeigename, Bananenstand, Einlösungen, Session) und dass Zuschauer ihre Daten selbst löschen können. Hinweis: Das ist keine Rechtsberatung.

## 13. Fertig, wenn …

1. `npm run hackertest` ist komplett grün. Die Tests in `tests/` werden **nicht** verändert.
2. `npm audit --omit=dev` meldet keine Lücken der Stufe `high` oder `critical`.
3. Die Selbstprüfung aus `SECURITY.md` (Abschnitt „Vor jedem Abschluss“) ist durchgegangen.
4. `npm run dev` startet lokal ohne Fehler und die Startseite funktioniert.
