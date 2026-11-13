# SPEC: Twitch-Zuschauer-Hub

Dies ist der Bauplan für Claude Code. Baue die App exakt nach dieser Spezifikation.
Alle Sicherheitsregeln aus `SECURITY.md` gelten zusätzlich und haben Vorrang.
Fertig ist die App erst, wenn `npm run hackertest` komplett grün ist.

## 1. Ziel

Eine kleine Website für die Community eines Twitch-Streamers:

1. **Twitch-Login:** Zuschauer melden sich mit ihrem Twitch-Account an.
2. **Bananen sammeln:** Während der Stream live ist, bekommen sie alle X Minuten Bananen fürs Zuschauen und holen sich einmal am Tag einen Check-in-Bonus ab. Für einen Follow gibt es einmalig einen Bonus.
3. **Aktionen einlösen:** Mit Bananen lösen sie Aktionen im Stream aus: Sound, Bananenregen, Abstimmung über das nächste Spiel.
4. **Rangliste und OBS-Overlay:** Eine öffentliche Rangliste und ein Overlay, das der Streamer als Browserquelle in OBS einbindet.
5. **Admin-Seite:** Der Streamer stellt alle Bananen-Werte, das Zuschau-Intervall und die Aktionen direkt im Hub ein.

**Eigene Währung:** „Bananen“ sind nur das Beispiel. Jeder Streamer kann Name, Emoji und ein eigenes Bild seiner Währung festlegen (z. B. „Kekse 🍪“). Deshalb steht „Banane“ oder 🍌 **nirgends fest im Code oder in den Seiten**. Alle Texte, Zähler und Animationen nutzen die Werte aus den Einstellungen. In dieser SPEC steht „Bananen“ stellvertretend für die eingestellte Währung.

Die Währung ist rein virtuell und hat **keinen Geldwert**. Man kann sie nicht kaufen, verkaufen, übertragen oder auszahlen. Es gibt **keine** Zahlungsfunktion und keine Funktion zum Verschenken von Bananen. Baue so etwas auch nicht ein, wenn es naheliegt.

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
  config.js          Umgebungsvariablen + hub.config.json (Startwerte) laden und prüfen
  db.js              Knex-Verbindung + Migrationen
  twitch.js          Alle Aufrufe an Twitch (OAuth, Helix, EventSub)
  routes/            auth.js, api.js, admin.js, webhooks.js, overlay.js
  security/          sessions.js, csrf.js, ratelimits.js, crypto.js (Token-Verschlüsselung)
  services/          settings.js, bananas.js, redeem.js, live.js, watch.js, streamer.js, events.js (Overlay-Events)
views/
  overlay.html       Overlay-Seite (nur mit Schlüssel erreichbar, NICHT in public/)
  admin.html         Admin-Seite (nur für den Streamer, NICHT in public/)
public/
  index.html, app.js, style.css, impressum.html, datenschutz.html
  overlay.js, overlay.css, admin.js, admin.css
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
| `TWITCH_CHANNEL` | ja | Login-Name des Streamers (Kanal), wird kleingeschrieben, `^[a-z0-9_]{1,25}$` |
| `EVENTSUB_SECRET` | ja | 10 bis 100 Zeichen, Geheimnis für Twitch-Webhooks |
| `OVERLAY_KEY` | ja | mindestens 32 Zeichen, Schlüssel für die Overlay-URL |
| `TOKEN_ENCRYPTION_KEY` | ja | genau 64 Hex-Zeichen (32 Bytes), Schlüssel zum Verschlüsseln des Streamer-Tokens |
| `DATABASE_URL` | online ja | `mysql://user:pass@host:3306/db` oder `file:pfad/zur/datei.sqlite` |
| `DEV_ALWAYS_LIVE` | nein | `true` = Stream gilt immer als live. Nur wirksam, wenn `BASE_URL` mit `http://localhost` oder `http://127.0.0.1` beginnt |
| `TWITCH_ID_URL` | nein | Standard `https://id.twitch.tv`. **Nur bei `NODE_ENV=test` auswerten**, sonst ignorieren |
| `TWITCH_API_URL` | nein | Standard `https://api.twitch.tv`. **Nur bei `NODE_ENV=test` auswerten**, sonst ignorieren |
| `HUB_MINUTE_MS` | nein | Länge einer „Minute“ für die Zuschau-Bananen in Millisekunden, Standard `60000`. **Nur bei `NODE_ENV=test` auswerten**, sonst ignorieren |
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
- Auch ungültige Startwerte in `hub.config.json`, eine nicht erreichbare Datenbank oder eine `http://`-`BASE_URL` in `production` führen in den Setup-Modus (Name als „ungültig“ markiert), nicht zum Absturz.
- Statische Dateien aus `public/` (z. B. `style.css`) bleiben erreichbar.
- Alle anderen Routen antworten `503` mit `{ "error": "setup_required" }`.
- Im Setup-Modus wird keine Verbindung zu Twitch aufgebaut.

### hub.config.json und Einstellungen

`hub.config.json` enthält die **Startwerte**: Name, Währung, Bananen-Werte, Zuschau-Intervall und Aktionen. Aktionstypen: `sound`, `rain`, `vote`. Eine `vote`-Aktion hat eine Liste `options`.

- Beim ersten Start (Tabelle `settings` leer) werden die Startwerte geprüft und in die Datenbank übernommen. Später wird `hub.config.json` nicht mehr gelesen.
- Ab dann gelten **nur noch die Einstellungen aus der Datenbank**. Der Streamer ändert sie auf der Admin-Seite. Änderungen wirken sofort, ohne Neustart.
- Dasselbe zod-Schema prüft die Startwerte und jede Änderung über die Admin-Seite. Es ist **strikt** (unbekannte Felder → Fehler):

| Feld | Regel |
| --- | --- |
| `hubName` | Text, 1 bis 40 Zeichen |
| `currencyName` | Text, 1 bis 20 Zeichen |
| `currencyEmoji` | Text, 1 bis 8 Zeichen |
| `currencyImage` | `null` oder Dateiname eines Bildes im Ordner `public/waehrung/`: `^[A-Za-z0-9_-]{1,60}\.(png\|jpg\|jpeg\|webp\|gif)$` (kein SVG). Die Datei muss beim Speichern existieren, sonst Fehler |
| `checkinBananas` | Ganzzahl 0 bis 10000 |
| `followBonus` | Ganzzahl 0 bis 100000 |
| `watchBananas` | Ganzzahl 0 bis 10000 (0 = Zuschau-Bananen aus) |
| `watchIntervalMinutes` | Ganzzahl 1 bis 120 |
| `leaderboardSize` | Ganzzahl 3 bis 50 |
| `actions` | 1 bis 20 Aktionen, `id` eindeutig |
| `actions[].id` | `^[a-z0-9-]{2,30}$` |
| `actions[].type` | `sound`, `rain` oder `vote` |
| `actions[].name` | Text, 1 bis 40 Zeichen |
| `actions[].description` | Text, 0 bis 120 Zeichen |
| `actions[].cost` | Ganzzahl 1 bis 100000 |
| `actions[].cooldownSeconds` | Ganzzahl 0 bis 86400 |
| `actions[].options` | nur bei `vote` und dort Pflicht: 2 bis 6 eindeutige Texte mit je 1 bis 40 Zeichen |

## 4. Datenbank

Knex mit Migrationen, die beim Start automatisch laufen. Dasselbe Schema für SQLite und MySQL.
Beim SQLite-Client `useNullAsDefault: true` setzen. Bei MySQL Verbindung und Tabellen mit `utf8mb4` anlegen (sonst gehen Emojis in Namen und Währung kaputt). `forUpdate` wirkt nur bei MySQL. Bei SQLite laufen Transaktionen ohnehin nacheinander, das ist in Ordnung. Alle Zeitstempel (`created_at`, `expires_at`, `received_at` usw.) als `bigInteger` mit Millisekunden seit 1970 (`Date.now()`), damit SQLite und MySQL gleich funktionieren.

**Datensparsamkeit:** Speichere nur, was unten steht. Keine E-Mail-Adressen, keine Profilbilder, keine IP-Adressen. **Keine Tokens von Zuschauern.** Das einzige gespeicherte Token ist das Refresh-Token des Streamers, und zwar nur verschlüsselt (siehe 5).

| Tabelle | Spalten |
| --- | --- |
| `users` | `id` (auto), `twitch_id` (string, unique), `login`, `display_name`, `bananas` (int, nie negativ), `watch_minutes` (int, Standard 0), `follow_bonus_granted` (bool), `last_checkin_date` (string `YYYY-MM-DD`, nullable), `created_at`, `updated_at` |
| `sessions` | `id_hash` (string, Primärschlüssel, SHA-256 hex der Session-ID), `user_id` (FK → users, on delete cascade), `created_at`, `expires_at` |
| `follows` | `twitch_id` (string, Primärschlüssel), `bonus_granted` (bool), `created_at` |
| `eventsub_messages` | `message_id` (string, Primärschlüssel), `received_at` |
| `redemptions` | `id` (auto), `user_id` (FK, on delete cascade), `action_id`, `option` (nullable), `cost`, `created_at` |
| `app_state` | `key` (Primärschlüssel), `value` |
| `settings` | `key` (Primärschlüssel, immer `hub`), `value` (Text, JSON der Einstellungen), `updated_at` |
| `streamer_auth` | `id` (Primärschlüssel, immer `1`), `refresh_token_enc` (Text, **verschlüsselt**), `scopes` (Text), `updated_at` |

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

### Streamer-Freigabe und Admin-Login

Der Streamer verbindet seinen Kanal einmal mit der App. Damit bekommt die App zwei Rechte: Follow-Meldungen empfangen (`moderator:read:followers`) und sehen, wer gerade im Chat ist (`moderator:read:chatters`). Gleichzeitig ist das der Login für die Admin-Seite.

- `GET /auth/streamer`: wie `/auth/login`, aber Cookie-Wert `streamer.<state>` und `scope=moderator:read:followers moderator:read:chatters` (genau diese zwei, keine weiteren).
- Im Callback bei Flow `streamer`:
  - Die Twitch-ID des eingeloggten Accounts muss die ID von `TWITCH_CHANNEL` sein. Sonst Token sofort widerrufen, nichts speichern, `403`.
  - Das **Refresh-Token** verschlüsselt in `streamer_auth` speichern (siehe unten). Das Access-Token nur im Arbeitsspeicher halten.
  - `app_state.streamer_authorized=true` setzen, EventSub-Abo für `channel.follow` anlegen (siehe 6).
  - Eine **neue Session** für den Streamer erzeugen (wie beim Zuschauer-Login) und zu `/admin` weiterleiten.
- Der Streamer kann sich auch ganz normal über `/auth/login` einloggen. Admin ist, wessen Twitch-ID die Kanal-ID ist, unabhängig vom Login-Weg.
- **Wichtig:** Loggt sich der Streamer über `/auth/login` ein, wird sein Token dort **nicht** widerrufen, sondern nur verworfen (es läuft von selbst ab). Ein Widerruf könnte sonst auch die gespeicherte Kanal-Verbindung ungültig machen. Für alle anderen Zuschauer bleibt es beim sofortigen Widerruf.

### Verschlüsselung des Streamer-Tokens

- AES-256-GCM mit `TOKEN_ENCRYPTION_KEY` (Hex → 32 Bytes), für jeden Speichervorgang ein neuer zufälliger IV (12 Bytes).
- Gespeichertes Format: `v1:<iv>:<authTag>:<ciphertext>` (jeweils base64url).
- Kann nicht entschlüsselt werden (z. B. Schlüssel geändert): Eintrag löschen, `streamer_authorized=false`, im Log einen Hinweis ohne Details ausgeben.
- **Erneuern:** Ist das Access-Token abgelaufen oder antwortet Twitch mit `401`, per `POST {TWITCH_ID_URL}/oauth2/token` mit `grant_type=refresh_token` ein neues holen. Twitch kann dabei ein **neues Refresh-Token** zurückgeben: dann sofort verschlüsselt speichern. Schlägt das Erneuern fehl (`400`/`401`), Eintrag löschen, `streamer_authorized=false` und `streamer_needs_reconnect=true` setzen (bei erfolgreicher neuer Verbindung wieder `false`). Die Admin-Seite zeigt dann „Bitte Kanal neu verbinden“.
- Token und Schlüssel erscheinen nie in Logs, Fehlermeldungen oder API-Antworten.

### Freigabe entfernen

`POST /api/admin/streamer/revoke` (nur Admin): Access-Token beschaffen (ggf. erneuern), bei Twitch widerrufen (`POST {TWITCH_ID_URL}/oauth2/revoke`), Eintrag in `streamer_auth` löschen, `streamer_authorized=false`. Antwort `200` `{ "ok": true }`. Danach gibt es keine Zuschau-Bananen und keine Follow-Meldungen mehr, bis der Streamer neu verbindet.

## 6. Twitch-Anbindung

- **App-Token:** per `client_credentials` (`POST {TWITCH_ID_URL}/oauth2/token`). Nur im Arbeitsspeicher halten, nie in der DB. Bei Ablauf oder `401` neu holen.
- **Kanal-ID:** beim Start per `GET {TWITCH_API_URL}/helix/users?login={TWITCH_CHANNEL}` mit App-Token auflösen und im Speicher halten.
- **Startreihenfolge:** Konfiguration prüfen, Datenbank migrieren, Kanal-ID und Live-Status laden (höchstens 10 Sekunden warten, danach im Hintergrund weiter versuchen) und **erst dann** den Port öffnen.
- **Live-Status:**
  - Beim Start und danach alle 5 Minuten `GET {TWITCH_API_URL}/helix/streams?user_id={Kanal-ID}` abfragen: Ist `data` nicht leer, ist der Stream live.
  - Webhooks `stream.online` und `stream.offline` aktualisieren den Status sofort.
  - `DEV_ALWAYS_LIVE=true` (nur lokal, siehe 3) überschreibt den Status auf live.
  - Geht der Stream offline, wird die laufende Abstimmung zurückgesetzt.
- **Chatter-Liste:** `GET {TWITCH_API_URL}/helix/chat/chatters?broadcaster_id={Kanal-ID}&moderator_id={Kanal-ID}&first=1000` mit dem **Streamer**-Access-Token, Seiten über `pagination.cursor` (`after`) abarbeiten.
- **EventSub-Abos:** Nur wenn `BASE_URL` mit `https://` beginnt (Twitch erreicht `localhost` nicht). Beim Start bestehende Abos abfragen und fehlende anlegen, mit Transport `webhook`, `callback={BASE_URL}/webhooks/twitch` und `secret=EVENTSUB_SECRET`:
  - `stream.online` (Version 1) und `stream.offline` (Version 1), Bedingung `broadcaster_user_id`
  - `channel.follow` (Version 2), Bedingung `broadcaster_user_id` und `moderator_user_id` (beide = Kanal-ID), nur wenn `streamer_authorized=true`
- Fehler bei Twitch-Aufrufen dürfen die App nicht abstürzen lassen. Logge sie ohne Tokens oder Secrets.

### Webhook `POST /webhooks/twitch`

- Reihenfolge: Signatur und Zeitstempel prüfen, dann JSON parsen (kaputt: `400`, nicht speichern), dann Doppelt-Prüfung über die `message_id`.
- Den **rohen Body** lesen (`express.raw({ type: 'application/json', limit: '64kb' })`), nicht vorher als JSON parsen.
- Signatur prüfen: `sha256=` + HMAC-SHA256 mit `EVENTSUB_SECRET` über `message_id + timestamp + roher Body` (Header `Twitch-Eventsub-Message-Id`, `Twitch-Eventsub-Message-Timestamp`, `Twitch-Eventsub-Message-Signature`). Vergleich mit `crypto.timingSafeEqual`. Fehlt etwas oder passt es nicht: `403`.
- Ist der Zeitstempel mehr als 10 Minuten alt oder mehr als 10 Minuten in der Zukunft: `403`.
- Wurde die `message_id` schon verarbeitet: `204`, nichts weiter tun.
- Typ `webhook_callback_verification`: `200`, Body = `challenge`, `Content-Type: text/plain`.
- Typ `revocation`: loggen, `204`.
- Gültige Signatur, aber kaputtes JSON: `400`. Auch Bestätigungs- und Widerrufsnachrichten werden für die Doppelt-Prüfung gespeichert.
- Typ `notification`: Ereignis verarbeiten, dann `204`. Schlägt die Verarbeitung fehl, die `message_id` wieder löschen und `500` antworten, damit Twitch es erneut versucht. Ereignisse, deren `broadcaster_user_id` nicht die Kanal-ID ist, ignorieren (trotzdem `204`).
  - `stream.online` / `stream.offline`: Live-Status setzen.
  - `channel.follow`: siehe 7.
- Diese Route ist von der Origin-Prüfung (CSRF) ausgenommen. Ihr Schutz ist die Signatur.

## 7. Bananen-Regeln

Alle Werte kommen aus den aktuellen Einstellungen (Datenbank, siehe 3). Der Server ist die einzige Quelle der Wahrheit. Der Browser zeigt nur an.

- **Zuschau-Bananen:** Ein Hintergrund-Job läuft einmal pro Minute (`HUB_MINUTE_MS`, siehe 3). Läuft ein Durchgang noch, wird der nächste übersprungen.
  - Nur wenn der Stream live ist, `streamer_authorized=true` ist und `watchBananas > 0`.
  - Chatter-Liste holen (siehe 6). Davon nur Twitch-IDs nehmen, die **bereits in `users` stehen**, ohne den Streamer selbst. Wer sich nie im Hub angemeldet hat, wird **nicht** gespeichert.
  - `UPDATE users SET watch_minutes = watch_minutes + 1 WHERE twitch_id IN (…)` (in Blöcken von höchstens 500 IDs).
  - Vor dem Gutschreiben den Live-Status erneut prüfen. Ist der Stream inzwischen offline, nichts gutschreiben.
  - Dann atomar gutschreiben, **nur für die gerade anwesenden Chatter**: `UPDATE users SET bananas = bananas + watchBananas, watch_minutes = watch_minutes - watchIntervalMinutes WHERE watch_minutes >= watchIntervalMinutes AND twitch_id IN (…)`. Danach `watch_minutes` aller Nutzer auf höchstens `watchIntervalMinutes` begrenzen (falls der Admin das Intervall verkleinert hat).
  - Fehler (z. B. Twitch nicht erreichbar) loggen und beim nächsten Durchgang weitermachen. Niemals abstürzen.
- **Check-in:** einmal pro Kalendertag (Zeitzone `Europe/Berlin`) und nur, wenn der Stream live ist. Bringt `checkinBananas`.
- **Follow-Bonus:** einmal pro Twitch-Account für immer, auch nach Ent- und Wieder-Folgen. Kommt ein Follow für jemanden, der sich noch nie eingeloggt hat, wird er in `follows` vorgemerkt und beim ersten Login gutgeschrieben.
- **Abstimmung:** Es zählt die erste Aktion vom Typ `vote` in den Einstellungen. Der Stand ergibt sich aus ihren Einlösungen seit `app_state.vote_reset_at`. Wechselt der Stream von live auf offline, wird `vote_reset_at` auf jetzt gesetzt. Gibt es keine `vote`-Aktion, antwortet `GET /api/vote` mit `{ actionId: null, options: [] }`.
- **Einstellungen ändern:** Wurden die Optionen einer Abstimmung geändert, `vote_reset_at` auf jetzt setzen. Gelöschte Aktionen kann man sofort nicht mehr einlösen.
- **Daten löschen:** löscht den Benutzer mit Sessions, Einlösungen **und** seinem Eintrag in `follows`. Danach ist keine Twitch-ID dieser Person mehr gespeichert. Folgt die Person später erneut, gibt es den Follow-Bonus noch einmal. Das ist bewusst so: Datenschutz geht vor.
- **Einlösen:** In **einer Transaktion** den Benutzer sperren (`forUpdate`), Cooldown prüfen (letzte Einlösung derselben Aktion durch denselben Benutzer), dann `UPDATE users SET bananas = bananas - cost WHERE id = ? AND bananas >= cost`. Nur wenn genau eine Zeile geändert wurde, die Einlösung speichern. So kann der Kontostand auch bei gleichzeitigen Anfragen nie negativ werden.
- Die Kosten kommen **immer** aus den Einstellungen auf dem Server, nie aus der Anfrage.

## 8. API

Alle Antworten sind JSON. Fehler haben die Form `{ "error": "<code>" }`, ohne Details aus dem Server.

Alle `POST`-, `PUT`-, `PATCH`- und `DELETE`-Anfragen (außer `/webhooks/twitch`) brauchen einen `Origin`-Header, der exakt dem Origin von `BASE_URL` entspricht. Sonst `403` mit `{ "error": "forbidden_origin" }`. Unter `/api` müssen sie außerdem `Content-Type: application/json` haben, sonst `415`.

| Methode und Pfad | Login | Antwort |
| --- | --- | --- |
| `GET /healthz` | nein | `200` `ok` (text/plain) |
| `GET /api/config` | nein | `200` `{ hubName, currencyName, currencyEmoji, currencyImage, checkinBananas, followBonus, watchBananas, watchIntervalMinutes, actions: [{ id, type, name, description, cost, cooldownSeconds, options? }] }` (aktuelle Einstellungen aus der DB) plus `isLive`, damit auch ausgeloggte Besucher den Live-Status sehen |
| `GET /api/me` | ja | `200` `{ displayName, login, bananas, isLive, checkedInToday, isAdmin, watchMinutes }` |
| `POST /api/checkin` | ja | `200` `{ bananas }`. Nicht live: `409` `not_live`. Schon eingecheckt: `409` `already_checked_in` |
| `POST /api/redeem` | ja | Body `{ actionId, option? }`. `200` `{ bananas, actionId }`. Unbekannte Aktion: `400` `unknown_action`. Fehlende oder ungültige Option: `400` `invalid_option`. Falsche Felder: `400` `invalid_input`. Zu wenig Bananen: `402` `not_enough_bananas`. Cooldown: `429` `cooldown` mit Header `Retry-After` (Sekunden) |
| `GET /api/leaderboard` | nein | `200` `{ entries: [{ displayName, bananas }] }`, nur Nutzer mit mehr als 0 Bananen, absteigend nach Bananen, bei Gleichstand nach Name, höchstens `leaderboardSize` Einträge |
| `GET /api/vote` | nein | `200` `{ actionId, options: [{ option, votes }] }` für die laufende Abstimmung |
| `POST /api/me/delete` | ja | Benutzer mit allen Daten löschen, Cookie löschen, `200` `{ "ok": true }` |

### Admin-API (nur für den Streamer)

Ohne Session `401` `unauthorized`, eingeloggt aber nicht Admin `403` `forbidden`. Origin-Prüfung wie oben.

| Methode und Pfad | Antwort |
| --- | --- |
| `GET /admin` | Admin-Seite `views/admin.html`. Nicht eingeloggt: Weiterleitung zu `/auth/streamer`. Kein Admin: `403`-Seite |
| `GET /api/admin/settings` | `200` `{ settings, streamerAuthorized, streamerNeedsReconnect, streamerScopes }` (`streamerScopes` ist ein Array von Texten). `settings` hat exakt die Form aus Abschnitt 3. `streamerNeedsReconnect` ist `true`, wenn eine bestehende Verbindung ungültig geworden ist (siehe 5, `app_state.streamer_needs_reconnect`) |
| `PUT /api/admin/settings` | Body = komplettes `settings`-Objekt. Prüfung mit dem strikten Schema, sonst `400` `invalid_input` mit `{ error, issues: [{ path, message }] }` (verständliche Meldungen, keine Interna). Erfolg: speichern, `200` `{ settings }` |
| `GET /api/admin/overlay-url` | `200` `{ url, width: 1920, height: 1080 }`, `url` = `{BASE_URL}/overlay?key={OVERLAY_KEY}` |
| `POST /api/admin/overlay/test` | Schickt ans Overlay das Event `{ "type": "test" }`. `200` `{ "ok": true }` |
| `GET /api/admin/currency-images` | `200` `{ images: ["muenze.png", …] }`: alle Dateien in `public/waehrung/`, die dem Muster von `currencyImage` entsprechen |
| `POST /api/admin/streamer/revoke` | siehe 5 |

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
  - nach jedem gutgeschriebenen Follow-Bonus: `{ "type": "follow", "displayName", "amount" }`
  - nach jeder Stimme zusätzlich: `{ "type": "vote", "actionId", "options": [{ "option", "votes" }] }`
- Overlay-Seite: transparenter Hintergrund (für OBS), lädt `/overlay.js` und `/overlay.css`, liest den Schlüssel aus `location.search` und verbindet sich per `EventSource`.
  - `sound`: kurzer „Plopp“-Sound, erzeugt mit der Web Audio API (keine Audiodatei nötig), plus Einblendung „<Name> hat einen Sound ausgelöst“.
  - `rain`: Bananenregen über das ganze Bild (ca. 4 Sekunden, CSS-Animation) plus Einblendung.
  - `vote`: Balken mit dem aktuellen Stand, verschwindet nach 15 Sekunden ohne neue Stimme.
  - `follow`: Einblendung „<Name> folgt jetzt, +<followBonus> 🍌“.
  - `test`: kurzer Regen mit der Währung plus Einblendung „✅ Overlay funktioniert!“.
- Das Overlay ist für **1920 × 1080** gebaut: Einblendungen unten mittig, gut lesbar auf diese Größe, Abstimmung oben rechts.
- Namen nur per `textContent` einsetzen.
- Der Regen (`rain`) und alle Einblendungen nutzen das Währungsbild, falls gesetzt, sonst das Emoji. Die Overlay-Seite holt sich die Einstellungen über `GET /overlay/config?key=OVERLAY_KEY` (`{ currencyName, currencyEmoji, currencyImage, followBonus }`, gleicher Schlüsselschutz wie oben).

## 10. Frontend

- Eine Seite (`public/index.html` + `public/app.js`), die über die API arbeitet.
- **Ausgeloggt:** Kurze Erklärung, großer Button „Mit Twitch anmelden“ (Link auf `/auth/login`), Rangliste.
- **Eingeloggt:** Begrüßung mit Namen, großer Bananen-Zähler mit kleiner Animation bei Änderung, Live-Status, Fortschrittsbalken für die Zuschau-Bananen („Noch 4 Minuten Zuschauen bis +10 🍌“, nur wenn `watchBananas > 0`), Hinweis „Zuschau-Bananen gibt es, wenn du während des Streams im Twitch-Chat bist“, Check-in-Button (deaktiviert mit Hinweis, wenn offline oder schon erledigt), Karten für alle Aktionen mit Kosten und Cooldown, Abstimmung mit Auswahl, Rangliste, Logout und „Meine Daten löschen“ (mit Bestätigung in der Seite, nicht per `confirm()`).
- Ist der Nutzer Admin, gibt es einen gut sichtbaren Link „⚙️ Admin“ zu `/admin`.
- Die Seite lädt `/api/me` alle 15 Sekunden neu (nicht, solange der Tab versteckt ist) und sofort, wenn der Tab wieder sichtbar wird (`visibilitychange`), damit Zuschau-Bananen ohne Neuladen erscheinen.
- Ist der eingeloggte Nutzer der Streamer, steht beim Zuschau-Fortschritt der Hinweis: „Als Streamer bekommst du in deinem eigenen Kanal keine Zuschau-<Währungsname>.“
- Hinweis sichtbar auf der Seite: „<Währungsname> sind virtuell und haben keinen Geldwert.“

### Layout-Regeln (Startseite und Admin-Seite)

Damit die Seiten auf großen Bildschirmen nicht schmal wirken und Formulare sauber aussehen:

- **Startseite:** Inhalt bis **1180 px** breit. Ab 1000 px Fensterbreite zwei Spalten: links Konto, Aktionen und Abstimmung, rechts die Rangliste (360 px, `position: sticky`). Kopfzeile und Footer gehen über beide Spalten. Darunter eine Spalte.
- **Aktionskarten:** Raster mit `repeat(auto-fit, minmax(220px, 1fr))`, damit sie die Breite ausfüllen. Karten sind gleich hoch, der „Einlösen“-Button sitzt immer unten (`display: flex; flex-direction: column` + `margin-top: auto`).
- **Admin-Seite:** Inhalt bis **1000 px** breit, alle Karten untereinander.
- **Formulare:** Felder in einem festen **2-Spalten-Raster** (`repeat(2, minmax(0, 1fr))`, unter 640 px eine Spalte). Kein `auto-fill` mit vielen schmalen Spalten. Jedes Feld: Label (einzeilig, `white-space: nowrap`, zu lange Labels mit `…`), darunter das Eingabefeld, darunter optional Hinweis und Fehlertext **ohne** Außenabstand. Felder einer Zeile beginnen damit auf derselben Höhe.
- **Alle Eingabefelder** (`input`, `select`) sind gleich hoch (44 px) und füllen ihre Spalte (`width: 100%`). Zahlenfelder ohne Pfeil-Buttons (`appearance: textfield`). Schrift wie der Rest der Seite (`font: inherit`).
- Grid- und Flex-Kinder bekommen `min-width: 0`, damit lange Texte (z. B. die Overlay-URL) nichts aus dem Bild schieben. Keine waagerechte Scrollleiste, auch nicht auf dem Handy.

### Admin-Seite (`views/admin.html`, `public/admin.js`, `public/admin.css`)

Gleiches Design wie die Startseite, übersichtlich in Karten:

2. **Twitch-Verbindung:** Status (verbunden / nicht verbunden / „Bitte neu verbinden“), Button „Kanal verbinden“ bzw. „Neu verbinden“ (Link auf `/auth/streamer`), Button „Verbindung entfernen“ (mit Bestätigung in der Seite). Kurze Erklärung, wofür die Rechte gebraucht werden.
1. **Deine Währung:** ganz oben, gut sichtbar. Felder für Name der Währung, Emoji und eine Auswahl „Bild“ mit allen Bildern aus `public/waehrung/` (aus `/api/admin/currency-images`) plus „Kein Bild, Emoji verwenden“. Große Live-Vorschau, wie die Währung aussieht (z. B. „120 🍪 Kekse“). Kurzer Hinweis: „Eigenes Bild? PNG in den Ordner `public/waehrung/` legen, mit `git push` hochladen und hier auswählen.“ Dazu der Name des Hubs.
3. **Bananen-Werte:** Zahlenfelder für Zuschau-Bananen, Intervall in Minuten, Check-in, Follow-Bonus, Ranglistengröße. Beispieltext darunter mit der eingestellten Währung: „Zuschauer bekommen 10 🍪 alle 10 Minuten.“
4. **Aktionen:** Liste aller Aktionen als bearbeitbare Karten (Name, Beschreibung, Typ, Kosten, Cooldown, bei Abstimmungen die Optionen). Buttons „Aktion hinzufügen“, „Entfernen“, „Option hinzufügen“. Die `id` wird beim ersten Speichern einer neuen Aktion aus ihrem Namen erzeugt (Kleinbuchstaben, Bindestriche, bei Bedarf mit Zahl eindeutig gemacht) und danach nicht mehr geändert.
5. **OBS einrichten:** eigene, gut sichtbare Karte.
   - Overlay-URL verdeckt anzeigen („••••“), Buttons „Anzeigen“ und „Kopieren“, mit Warnung: „Nicht im Stream zeigen, wie ein Passwort behandeln.“
   - Auflösung groß und deutlich: **Breite 1920 · Höhe 1080** (Werte aus `/api/admin/overlay-url`), mit eigenem Kopieren-Button für jede Zahl.
   - Kurzanleitung als nummerierte Liste: 1. In OBS bei „Quellen“ auf **+** → **Browser**. 2. URL einfügen. 3. Breite 1920, Höhe 1080 eintragen. 4. Haken bei „Audio über OBS steuern“ setzen, wenn du den Sound in OBS regeln willst.
   - Button **„Overlay testen“** (`POST /api/admin/overlay/test`) mit Hinweis „Du solltest jetzt in OBS eine Test-Animation sehen“.
6. **Speichern:** ein Button für alles. Fehler aus `issues` direkt am jeweiligen Feld anzeigen, Erfolg als kurze Meldung.
- Fehler freundlich anzeigen (z. B. „Noch 12 Sekunden Cooldown“, „Dafür fehlen dir 15 Kekse“, immer mit dem eingestellten Währungsnamen).
- **Währung anzeigen:** Überall, wo eine Menge steht (Zähler, Kosten, Rangliste, Fortschritt), kommt dahinter das Währungsbild als `<img src="/waehrung/<datei>" alt="<currencyName>">` (Höhe wie die Schrift, per CSS-Klasse) oder, ohne Bild, das Emoji. Seitentitel, Überschrift und Texte nutzen `hubName` und `currencyName`.
- **Kein fester Text „Banane“ / „Bananen“ und kein 🍌** in `public/` (außer im Ordner `public/waehrung/`) und `views/`, auch nicht in Kommentaren, CSS-Klassen oder der Datenschutzseite. Neutrale Begriffe verwenden (z. B. `currency`, „Kontostand“). Der Hackertest prüft das.
- Footer mit Links zu `/impressum.html` und `/datenschutz.html`.
- Dunkles, modernes Design, gut auf dem Handy bedienbar.
- **Kein** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` oder `new Function` in `public/` und `views/`. Elemente mit `document.createElement` bauen und Texte per `textContent` setzen.
- Kein Inline-JavaScript und keine `on…=`-Attribute in HTML (die Content-Security-Policy verbietet das). Styles per JavaScript setzen (`element.style.width = …`) ist erlaubt, z. B. für Fortschrittsbalken und Animationen. Verboten sind nur `style="…"`-Attribute im HTML.

## 11. Sicherheit (zusätzlich zu SECURITY.md)

- `helmet` mit Content-Security-Policy:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
- `app.disable('x-powered-by')`. Wenn `BASE_URL` mit `https://` beginnt: `app.set('trust proxy', 1)` (Hostinger läuft hinter einem Proxy, sonst teilen sich alle Zuschauer ein Rate-Limit).
- **Rate-Limits** pro IP (`express-rate-limit`, Antwort `429` mit `{ "error": "rate_limited" }`):
  - `/auth/*`: 60 Anfragen pro 15 Minuten
  - `/api/*`: 300 Anfragen pro Minute
  - `POST /api/redeem`: zusätzlich 10 pro Minute **pro Benutzer**
- **Logging:** Keine Tokens, Secrets, Cookies, Autorisierungs-Codes, `OVERLAY_KEY` oder vollständigen URLs mit Query-String loggen. Logge Pfade ohne Query.
- **Fehlerbehandlung:** Ein zentraler Error-Handler antwortet mit `500` `{ "error": "internal_error" }`. Niemals Stacktraces oder Fehlermeldungen an den Browser schicken. Unbekannte Routen: `404` `{ "error": "not_found" }` (bzw. eine einfache 404-Seite für Browser).

## 12. Impressum und Datenschutz

Lege `public/impressum.html` und `public/datenschutz.html` als Platzhalter an: gleiches Design, deutlich markierte Felder „BITTE AUSFÜLLEN“. Die Datenschutzseite listet ehrlich, welche Daten die App speichert (Twitch-ID, Login-Name, Anzeigename, Kontostand der virtuellen Währung, Zuschau-Minuten, Einlösungen, Session), dass für die Zuschau-Bananen geprüft wird, wer im Twitch-Chat ist (nur für bereits angemeldete Nutzer, sonst wird nichts gespeichert), und dass Zuschauer ihre Daten selbst löschen können. Hinweis: Das ist keine Rechtsberatung.

## 13. Fertig, wenn …

1. `npm run hackertest` ist komplett grün. Die Tests in `tests/` werden **nicht** verändert.
2. `npm audit --omit=dev` meldet keine Lücken der Stufe `high` oder `critical`.
3. Die Selbstprüfung aus `SECURITY.md` (Abschnitt „Vor jedem Abschluss“) ist durchgegangen.
4. `npm run dev` startet lokal ohne Fehler und die Startseite funktioniert.
