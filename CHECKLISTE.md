# Checkliste: Vom Starter zum Live-Hub

Hake die Schritte der Reihe nach ab. Geschätzte Zeit: unter einer Stunde.

## Was du brauchst

- [ ] Ein Claude-Abo mit [Claude Code](https://claude.com/claude-code)
- [ ] Ein Hostinger-Paket mit Node.js-Hosting (z. B. Business), siehe README
- [ ] Einen GitHub-Account
- [ ] Einen Twitch-Account mit aktivierter Zwei-Faktor-Authentifizierung
- [ ] [Node.js](https://nodejs.org) ab Version 22.13 (für den lokalen Test)

## 1. Seite online bringen (ohne Code)

- [ ] Auf GitHub oben rechts auf **Use this template** → **Create a new repository** klicken. Name frei wählbar, Sichtbarkeit egal.
- [ ] Im Hostinger hPanel: **Websites → Website hinzufügen → Node.js Web App**
- [ ] Domain auswählen oder eintragen
- [ ] **Import Git Repository** → **Connect with GitHub** → dein neues Repo auswählen
- [ ] Build- und Startbefehl werden automatisch erkannt → **Deploy**
- [ ] Domain im Browser öffnen: Die Bananen-Startseite ist live 🎉

Ab jetzt deployt Hostinger bei jedem `git push` automatisch neu.

## 2. Twitch-App anlegen

- [ ] https://dev.twitch.tv/console öffnen und mit Twitch einloggen
- [ ] **Register Your Application**
  - Name: frei wählbar (muss bei Twitch einmalig sein)
  - OAuth Redirect URLs (beide eintragen):
    - `https://DEINE-DOMAIN/auth/callback`
    - `http://localhost:3000/auth/callback`
  - Kategorie: **Website Integration**
  - Client-Typ: **Vertraulich (Confidential)**
- [ ] **Client-ID** kopieren
- [ ] **Neues Secret** erzeugen und kopieren

> ⚠️ Das Client-Secret ist das Passwort deiner App. Nirgends posten, nicht in den Chat mit Claude kopieren, nicht in den Code schreiben.

## 3. App bauen lassen

- [ ] Dein Repo auf den PC klonen (z. B. mit GitHub Desktop oder `git clone`)
- [ ] Im Ordner ein Terminal öffnen: `npm install`
- [ ] `npm run setup` ausführen. Fragt nach Kanalname, Client-ID und Secret und legt die `.env` an.
- [ ] Claude Code im Ordner starten: `claude`
- [ ] Eintippen: **`/hub-bauen`**
- [ ] Warten, bis Claude fertig ist und der Hackertest grün ist

## 4. Lokal testen

- [ ] `npm run dev`
- [ ] http://localhost:3000 öffnen → **Mit Twitch anmelden**
- [ ] Check-in machen, eine Aktion einlösen
- [ ] Overlay testen: `http://localhost:3000/overlay?key=DEIN_OVERLAY_KEY` (Wert steht in der `.env`)

## 5. Online stellen

- [ ] Änderungen committen und pushen (`git add . && git commit -m "Zuschauer-Hub" && git push`) → Hostinger deployt automatisch
- [ ] Hostinger-Plugin in Claude Code installieren: `/plugin install hostinger@claude-plugins-official`, dann im Browser einloggen
- [ ] Claude bitten (Vorlage in `PROMPTS.md`):
  - [ ] MySQL-Datenbank anlegen
  - [ ] Umgebungsvariablen setzen (**ohne** `TWITCH_CLIENT_SECRET`)
- [ ] **Selbst** im hPanel bei der App unter Umgebungsvariablen `TWITCH_CLIENT_SECRET` eintragen
- [ ] App neu starten (Claude per MCP oder im hPanel), Logs prüfen lassen
- [ ] Deine Domain öffnen → Login mit Twitch testen

> Hinweis: Wenn Claude die Umgebungsvariablen später noch einmal per MCP setzt, werden alle Variablen ersetzt. Trag `TWITCH_CLIENT_SECRET` danach erneut im hPanel ein.

## 6. Follow-Bonus freischalten (einmalig)

- [ ] Als Streamer eingeloggt bei Twitch `https://DEINE-DOMAIN/auth/streamer` öffnen und bestätigen
- [ ] Damit darf die App Follow-Meldungen empfangen. Es wird kein Token gespeichert.

## 7. Ab in den Stream

- [ ] In OBS: **Quelle hinzufügen → Browser**, URL: `https://DEINE-DOMAIN/overlay?key=DEIN_OVERLAY_KEY`, Größe 1920 × 1080
- [ ] Overlay-URL wie ein Passwort behandeln: nicht zeigen, nicht teilen
- [ ] Link zum Hub in Chat-Befehl, Panel oder Beschreibung packen

## 8. Rechtliches (Deutschland)

- [ ] `public/impressum.html` ausfüllen
- [ ] `public/datenschutz.html` prüfen und ausfüllen
- [ ] Im Zweifel rechtlich beraten lassen (das hier ist keine Rechtsberatung)
