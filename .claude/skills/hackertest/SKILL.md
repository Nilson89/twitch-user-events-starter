---
name: hackertest
description: Führt den Hackertest aus (echte Angriffe gegen die lokale App), erklärt das Ergebnis verständlich und behebt offene Lücken im App-Code.
---

# Hackertest

1. Führe `npm run hackertest` aus und zeig dem Nutzer die Ausgabe.
2. **Alles grün:** Erkläre in 2 bis 3 Sätzen, was gerade geprüft wurde (z. B. gefälschte Twitch-Nachrichten, manipulierte Kontostände, Schadcode im Namen, fremde Websites) und dass alles abgewehrt wurde. Fertig.
3. **Etwas ist rot:** Erkläre für jeden roten Punkt in einem Satz, was ein Angreifer damit tun könnte. Behebe dann die Ursache im **App-Code** und führe den Test erneut aus, bis alles grün ist.

Regeln:
- Verändere niemals Dateien in `tests/`, um einen Test grün zu bekommen.
- Schalte keine Sicherheitsfunktion ab und baue keine Sonderwege für Tests ein, außer den in `SPEC.md` erlaubten (`NODE_ENV=test`).
- Halte dich an `SECURITY.md`.
