# 🍌 Twitch User Events Starter

Bau dir deinen eigenen **Twitch-Zuschauer-Hub**, ohne selbst Code zu schreiben.

Deine Zuschauer melden sich mit Twitch an, sammeln während deines Streams Bananen (fürs Zuschauen, per täglichem Check-in und für den Follow) und lösen damit Aktionen in deinem Stream aus: Sounds, einen Bananenregen oder eine Abstimmung über das nächste Spiel. Dazu gibt es eine Rangliste, ein Overlay für OBS und eine Admin-Seite, auf der du alle Werte und Aktionen einstellst.

Den Code schreibt [Claude Code](https://claude.com/claude-code). Dieses Repo enthält alles, was Claude dafür braucht: einen genauen Bauplan, Sicherheitsregeln und einen Hackertest, der die fertige App angreift.

> **Bananen sind nur das Beispiel.** Du kannst deine eigene Währung mit eigenem Namen, Emoji und Bild verwenden, zum Beispiel Kekse 🍪, Coins oder dein Kanal-Maskottchen. Wie das geht, steht in der [CHECKLISTE.md](CHECKLISTE.md) unter „Eigene Währung“.

> Die Währung ist rein virtuell und hat keinen Geldwert. Es gibt keine Kauf-, Verkaufs- oder Auszahlungsfunktion.

## So funktioniert's

```
1. Use this template      → dein eigenes Repo
2. Hostinger + GitHub     → Seite ist live
3. Twitch-App anlegen     → Client-ID + Secret
4. npm run setup          → lokale Einstellungen
5. claude → /hub-bauen    → Claude baut die App
6. git push               → Hostinger deployt automatisch
```

Die ausführliche Schritt-für-Schritt-Anleitung steht in **[CHECKLISTE.md](CHECKLISTE.md)**.

## Was drin ist

| Datei | Wozu |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Der Bauplan: was die App kann und wie sie gebaut wird |
| [`SECURITY.md`](SECURITY.md) | Sicherheitsregeln, an die sich Claude bei jeder Änderung hält |
| [`CLAUDE.md`](CLAUDE.md) | Wird von Claude Code automatisch gelesen und bindet `SECURITY.md` ein |
| [`hub.config.json`](hub.config.json) | Startwerte für Aktionen und Bananen. Danach stellst du alles auf der Admin-Seite `/admin` ein |
| [`PROMPTS.md`](PROMPTS.md) | Alle Prompts aus dem Video zum Kopieren |
| [`CHECKLISTE.md`](CHECKLISTE.md) | Schritt für Schritt vom Starter zum Live-Hub |
| `tests/` | Der Hackertest |
| `.claude/` | Die Befehle `/hub-bauen`, `/hackertest` und `/sicherheitscheck` |

## 🛡️ Sicherheit von Anfang an

Vibe Coding liefert schnell Code, der funktioniert. Ob er auch sicher ist, prüft dieses Repo gleich mit:

- **Keine Zuschauer-Tokens gespeichert:** Nach dem Login wird das Token sofort bei Twitch widerrufen.
- **Dein Streamer-Token nur verschlüsselt:** Für Zuschau-Bananen und Follows speichert die App genau ein Token, deins, mit AES-256 verschlüsselt. Du kannst es jederzeit auf der Admin-Seite entfernen.
- **Keine unnötigen Rechte:** Zuschauer geben beim Login keine zusätzlichen Rechte an ihrem Account frei.
- **Geprüfte Webhooks:** Jede Nachricht von Twitch wird über ihre Signatur geprüft. Gefälschte, alte und doppelte Nachrichten fliegen raus.
- **Der Server entscheidet:** Kontostand, Kosten und Cooldowns liegen nur auf dem Server.
- **Secrets bleiben geheim:** Claude Code darf die `.env` nicht lesen, und das Client-Secret landet nie im Chat.

### Der Hackertest

```
npm run hackertest
```

Startet deine App mit einem nachgebauten Twitch und greift sie an: gefälschte Follows, manipulierte Kontostände, Schadcode im Twitch-Namen, Angriffe von fremden Websites, Massenanfragen und mehr. Erst wenn alles grün ist, ist die App fertig.

### SECURITY.md für deine eigenen Projekte

Die Datei [`SECURITY.md`](SECURITY.md) ist allgemein geschrieben. Du kannst sie in jedes eigene Projekt kopieren:

1. `SECURITY.md` in den Hauptordner deines Projekts legen
2. In `CLAUDE.md` die Zeile `@SECURITY.md` einfügen (Datei anlegen, falls es sie noch nicht gibt)

Ab dann hält sich Claude Code dort automatisch an dieselben Regeln.

## Hosting

Der Hub läuft auf jedem Node.js-Hosting mit MySQL-Datenbank. Im Video nutze ich [Hostinger](https://hostinger.com/nilson89) (Werbelink): Node.js-Web-Apps mit GitHub-Anbindung und automatischem Deploy bei jedem Push. Mit dem Code **NILSON89** gibt es zusätzlich Rabatt.

## Rechtliches

Wenn du den Hub öffentlich betreibst, verarbeitest du personenbezogene Daten deiner Zuschauer. In Deutschland brauchst du dafür ein Impressum und eine Datenschutzerklärung. Die App bringt Platzhalterseiten mit. Das ist keine Rechtsberatung.

## Lizenz

[MIT](LICENSE). Nutzen, verändern und teilen ausdrücklich erwünscht.
