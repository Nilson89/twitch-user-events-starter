# Twitch-Zuschauer-Hub

Eine Website für eine Twitch-Community: Login mit Twitch, Bananen sammeln (Check-in, Follow, Zuschauen), Aktionen im Stream auslösen, Rangliste, OBS-Overlay und eine Admin-Seite für den Streamer.
Der Bauplan steht in `SPEC.md`. Die Sicherheitsregeln stehen in `SECURITY.md` und gelten immer:

@SECURITY.md

## Wer du hier bist

Der Nutzer ist meist Streamer und kein Programmierer. Erkläre in einfachem Deutsch, was du tust und was er als Nächstes machen muss. Keine Fachbegriffe ohne kurze Erklärung.

## Feste Regeln für dieses Projekt

- Lies und bearbeite **nie** die Datei `.env`. Wenn eine Variable fehlt, nenne ihren Namen und verweise auf `npm run setup` oder `CHECKLISTE.md`.
- Verändere **nie** etwas in `tests/`. Wenn der Hackertest rot ist, ist der App-Code falsch.
- `hub.config.json` enthält nur die Startwerte und gehört dem Streamer. Lies sie, aber ändere sie nur, wenn er es ausdrücklich möchte. Im laufenden Betrieb stellt er alles auf der Admin-Seite `/admin` ein.
- Installiere keine Pakete, die nicht schon in `package.json` stehen, ohne vorher zu fragen.
- Nach jeder Änderung am Code: `npm run hackertest` ausführen.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run setup` | Legt die lokale `.env` an (fragt nach Twitch-Daten, erzeugt Zufallsschlüssel) |
| `npm run dev` | Startet die App lokal auf http://localhost:3000 |
| `npm run hackertest` | Greift die eigene App an und prüft, ob alles abgewehrt wird |
| `/hub-bauen` | Baut die komplette App nach `SPEC.md` |
| `/hackertest` | Führt den Hackertest aus und erklärt das Ergebnis |
| `/sicherheitscheck` | Sicherheits-Review des aktuellen Codes |

## Deployment (Hostinger)

Die App läuft auf Hostinger als Node.js-Web-App, verbunden mit GitHub. Jeder `git push` auf den verbundenen Branch deployt automatisch neu.
Online braucht sie die Umgebungsvariablen aus `SPEC.md` Abschnitt 3, mit `NODE_ENV=production`, `BASE_URL=https://…` und einer MySQL-`DATABASE_URL`.

Wenn du die Variablen über das Hostinger MCP setzt:
- Erzeuge `EVENTSUB_SECRET`, `OVERLAY_KEY` und `TOKEN_ENCRYPTION_KEY` (64 Hex-Zeichen) neu mit `crypto.randomBytes` (nicht die lokalen Werte verwenden).
- `TOKEN_ENCRYPTION_KEY` später nicht mehr ändern. Sonst kann die App das gespeicherte Streamer-Token nicht mehr lesen und der Streamer muss seinen Kanal unter `/admin` neu verbinden.
- `TWITCH_CLIENT_SECRET` setzt du **nicht**. Der Nutzer trägt es danach selbst im hPanel ein, damit es nie im Chat landet. Sag ihm das am Ende ausdrücklich.
- Sag dem Nutzer am Ende, dass er die Overlay-URL für OBS auf der Admin-Seite `/admin` findet, nachdem er dort seinen Kanal verbunden hat.
- Das Setzen der Variablen per MCP ersetzt alle bestehenden Variablen. Wenn du sie später noch einmal setzt, erinnere den Nutzer daran, `TWITCH_CLIENT_SECRET` danach erneut im hPanel einzutragen.
