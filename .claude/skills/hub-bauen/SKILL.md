---
name: hub-bauen
description: Baut den kompletten Twitch-Zuschauer-Hub nach SPEC.md und SECURITY.md und arbeitet so lange, bis der Hackertest komplett grün ist.
disable-model-invocation: true
---

# Zuschauer-Hub bauen

Du baust jetzt die komplette App. Der Nutzer ist Streamer und kein Programmierer. Arbeite selbstständig und frag nur, wenn du wirklich nicht weiterkommst.

## Ablauf

1. **Lesen:** `SPEC.md`, `SECURITY.md`, `hub.config.json` und die Tests in `tests/` (damit du weißt, was geprüft wird). Die `.env` liest du nicht.
2. **Kurz ankündigen:** Erkläre dem Nutzer in 3 bis 5 Sätzen, was du gleich baust.
3. **Bauen**, in dieser Reihenfolge:
   1. `src/config.js` mit Setup-Modus
   2. `src/db.js` mit Migrationen (SQLite lokal, MySQL online)
   3. Sessions, Origin-Prüfung, Rate-Limits, Sicherheits-Header
   4. Twitch: Login, Token-Widerruf, App-Token, Kanal-ID, Live-Status, EventSub
   5. Webhook-Route mit Signaturprüfung
   6. API-Routen und Bananen-Regeln (atomar!)
   7. Overlay (Route, Server-Sent Events, `views/overlay.html`, `public/overlay.js`, `public/overlay.css`)
   8. Frontend (`public/index.html`, `public/app.js`, `public/style.css`)
   9. Impressum- und Datenschutz-Platzhalter
4. **Testen:** `npm run hackertest`. Ist etwas rot, reparierst du den **App-Code** und testest erneut, bis alles grün ist. Die Dateien in `tests/` veränderst du nie.
5. **Abhängigkeiten prüfen:** `npm audit --omit=dev`.
6. **Selbstprüfung:** Geh die Checkliste „Vor jedem Abschluss“ aus `SECURITY.md` durch.
7. **Abschluss für den Nutzer**, kurz und auf Deutsch:
   - Was jetzt funktioniert (Login, Bananen, Aktionen, Rangliste, Overlay).
   - Das Hackertest-Ergebnis in einem Satz.
   - Nächster Schritt: Falls noch keine `.env` existiert, `npm run setup` ausführen. Dann `npm run dev` und http://localhost:3000 im Browser öffnen.
   - Die lokale Overlay-Adresse lautet `http://localhost:3000/overlay?key=` plus der `OVERLAY_KEY` aus der `.env`. Den Schlüssel selbst nennst du nicht, du hast die `.env` ja nicht gelesen.

## Wichtig

- Halte dich exakt an die Routen, Statuscodes und Cookie-Namen aus `SPEC.md`. Der Hackertest prüft genau diese.
- Keine neuen Pakete. Alles Nötige steht schon in `package.json`.
- Bananen haben keinen Geldwert: keine Bezahl-, Kauf- oder Schenkfunktion.
