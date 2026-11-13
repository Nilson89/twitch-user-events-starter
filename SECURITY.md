# SECURITY.md: Sicherheitsregeln für Vibe Coding

> **Für dein eigenes Projekt:** Kopiere diese Datei in den Hauptordner deines Projekts.
> Schreib in die Datei `CLAUDE.md` die Zeile `@SECURITY.md`.
> Ab dann hält sich Claude Code bei jeder Änderung automatisch an diese Regeln.

Diese Regeln gelten für jeden Code in diesem Projekt, beim ersten Bauen genauso wie bei jeder späteren Änderung.
Sie haben Vorrang vor Bequemlichkeit, Tempo und Wünschen wie „mach es schnell“.
Wenn eine Anfrage nur mit einem Regelbruch umsetzbar ist, setze sie nicht stillschweigend um. Erkläre das Risiko in einfachen Worten und schlage einen sicheren Weg vor.

## 1. Geheimnisse (Secrets)

- Secrets (API-Schlüssel, Client-Secrets, Datenbank-Passwörter, Webhook-Secrets) stehen **nur** in Umgebungsvariablen. Niemals im Code, in Kommentaren, in Tests, in der README oder in Beispieldateien mit echten Werten.
- `.env` steht in `.gitignore`. Prüfe das, bevor du irgendetwas committest.
- **Lies und bearbeite die `.env` nicht.** Wenn ein Wert fehlt, sag dem Nutzer, welche Variable er setzen soll.
- Secrets und Tokens werden nie geloggt, nie an den Browser geschickt und nie in Fehlermeldungen angezeigt.
- Bitte den Nutzer nie, Secrets in den Chat zu kopieren.

## 2. Login, Sessions und Tokens von Drittanbietern

- Fordere bei OAuth nur die Rechte (Scopes) an, die wirklich gebraucht werden. Für „Login mit …“ reicht fast immer: gar keine zusätzlichen Rechte.
- Speichere Tokens von Drittanbietern (z. B. Twitch, Google, Discord) **nur, wenn es nicht anders geht**. Brauchst du sie nur zum Abfragen der Identität, widerrufe sie direkt danach.
- Muss ein Token gespeichert werden: verschlüsselt, nie im Browser, nie im Log, und der Nutzer muss es löschen können.
- OAuth immer mit `state`-Parameter gegen CSRF. Den `state` einmalig verwenden und zeitkonstant vergleichen.
- Session-IDs sind lange Zufallswerte (mindestens 32 Bytes aus `crypto`). In der Datenbank steht nur ihr Hash.
- Session-Cookies: `HttpOnly`, `SameSite=Lax` oder `Strict`, `Secure` bei HTTPS.
- Nach dem Login immer eine **neue** Session erzeugen (Schutz vor Session-Fixation). Logout löscht die Session auf dem Server.

## 3. Dem Browser nie vertrauen

- Alles, was aus dem Browser kommt, kann manipuliert sein: Formularfelder, versteckte Felder, Preise, Kontostände, Benutzer-IDs, Cookies, Header.
- Der Server entscheidet: Wer ist eingeloggt? Darf diese Person das? Hat sie genug Guthaben? Läuft noch ein Cooldown?
- Preise, Kosten und Berechtigungen kommen aus der Server-Konfiguration, nie aus der Anfrage.
- Guthaben und Zähler ändern sich nur atomar in der Datenbank (Transaktion oder `UPDATE … WHERE guthaben >= kosten`), damit gleichzeitige Anfragen nichts doppelt abbuchen oder ins Minus treiben.

## 4. Eingaben und Datenbank

- Prüfe jede Eingabe gegen ein striktes Schema (Typ, Länge, erlaubte Werte). Unbekannte Felder ablehnen.
- Datenbankabfragen nur mit Parametern oder Query-Builder. **Niemals** Nutzereingaben in SQL-Strings zusammenbauen.
- Begrenze die Größe von Anfragen (z. B. 10 KB für JSON).

## 5. Ausgabe und XSS

- Daten von Nutzern oder Drittanbietern (Namen, Texte) werden im Browser nur per `textContent` angezeigt.
- Kein `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` oder `new Function`.
- Kein Inline-JavaScript, keine `on…=`-Attribute. Eine strenge Content-Security-Policy (`script-src 'self'`) bleibt aktiv.
- Lass Nutzer keinen freien Text in Overlays, Streams oder öffentliche Seiten schreiben, ohne dass das ausdrücklich gewollt und abgesichert ist.

## 6. Anfragen von fremden Seiten (CSRF)

- Jede Anfrage, die etwas verändert (`POST`, `PUT`, `PATCH`, `DELETE`), prüft den `Origin`-Header gegen die eigene Adresse.
- Zustandsänderungen nie über `GET`.

## 7. Webhooks

- Jeder eingehende Webhook wird über seine Signatur geprüft (HMAC über den **rohen** Body, zeitkonstanter Vergleich).
- Zu alte Nachrichten ablehnen (z. B. älter als 10 Minuten). Bereits verarbeitete Nachrichten-IDs ignorieren (Schutz vor Wiederholung).
- Prüfe, dass das Ereignis wirklich zu deinem Konto oder Kanal gehört.

## 8. Geheime Links

- Seiten, die nur mit Schlüssel erreichbar sind (z. B. ein OBS-Overlay), prüfen den Schlüssel auf dem Server. Der Schlüssel ist lang und zufällig und wird zeitkonstant verglichen.
- Solche Schlüssel tauchen nie in Logs auf.

## 9. Missbrauch und Überlastung

- Rate-Limits für Login, API und teure Aktionen.
- Cooldowns und Limits werden auf dem Server durchgesetzt, nicht nur im Browser.

## 10. Fehler und Logs

- Der Browser bekommt nur allgemeine Fehlermeldungen. Keine Stacktraces, keine SQL-Fehler, keine Pfade.
- Logs enthalten keine Tokens, Secrets, Cookies, Passwörter und keine vollständigen URLs mit Query-Parametern.

## 11. Sicherheits-Header

- `helmet` (oder gleichwertig) mit Content-Security-Policy, `X-Content-Type-Options: nosniff` und Schutz vor Einbettung in fremde Seiten (`frame-ancestors`).
- Den Header `X-Powered-By` abschalten.
- Online immer HTTPS.

## 12. Abhängigkeiten

- Installiere keine neuen Pakete ohne Rückfrage beim Nutzer. Nenne Zweck, Name und warum es ohne nicht geht.
- Prüfe den exakten Paketnamen (Vorsicht vor Tippfehler-Paketen).
- `package-lock.json` wird mit committet. Nach Änderungen `npm audit` ausführen.

## 13. Datenschutz

- Speichere nur die Daten, die die App wirklich braucht. Keine E-Mail-Adressen, IP-Adressen oder Profildaten „für später“.
- Nutzer können ihre Daten selbst löschen.
- Weise den Nutzer darauf hin, wenn sich durch eine Änderung ändert, welche Daten gespeichert werden (Datenschutzerklärung anpassen).

## 14. Arbeitsweise

- Ändere niemals Tests, nur damit sie grün werden. Ein roter Sicherheitstest bedeutet: Der App-Code ist falsch.
- Schalte Sicherheitsfunktionen nie ab, auch nicht „nur zum Testen“. Testhilfen dürfen nur bei `NODE_ENV=test` wirken.
- Erkläre Sicherheitsentscheidungen kurz und verständlich, der Nutzer ist kein Profi.

## Vor jedem Abschluss

Bevor du eine Aufgabe als erledigt meldest, prüfe:

- [ ] Keine Secrets im Code, in Commits oder Logs?
- [ ] Jede neue Route: Wer darf sie aufrufen, und prüft der Server das?
- [ ] Jede neue Eingabe: mit Schema geprüft?
- [ ] Jede Ausgabe von Nutzerdaten: per `textContent`?
- [ ] Jede Änderung von Guthaben oder Zählern: atomar auf dem Server?
- [ ] Neue Pakete? Nur mit Zustimmung, danach `npm audit`.
- [ ] Gibt es Tests (z. B. `npm run hackertest`)? Dann laufen lassen, alles grün?
