---
name: sicherheitscheck
description: Sicherheits-Review des aktuellen Codes anhand von SECURITY.md, mit verständlichem Bericht für Nicht-Programmierer.
---

# Sicherheitscheck

Prüfe den gesamten App-Code (`src/`, `public/`, `views/`) gegen jede Regel aus `SECURITY.md`. Die `.env` liest du nicht.

1. Geh `SECURITY.md` Abschnitt für Abschnitt durch und suche im Code gezielt nach Verstößen.
2. Achte besonders auf:
   - Secrets oder Tokens im Code, in Logs oder in Antworten an den Browser
   - Routen ohne Login- oder Rechteprüfung
   - Eingaben ohne Schema-Prüfung, SQL ohne Parameter
   - Kontostände oder Kosten, die aus dem Browser übernommen werden
   - Webhooks ohne Signatur-, Zeit- oder Wiederholungsprüfung
   - Unsichere DOM-Funktionen (`innerHTML` usw.) und Inline-Skripte
   - Fehlende Origin-Prüfung bei verändernden Anfragen
3. Führe `npm audit --omit=dev` und `npm run hackertest` aus.
4. **Bericht** für den Nutzer, kurz und auf Deutsch:
   - Gesamturteil in einem Satz
   - Eine Tabelle: Bereich, Ergebnis (✅ / ⚠️ / ❌), Erklärung in einfachen Worten
   - Für jeden Fund: Was könnte ein Angreifer tun? Wie schlimm ist es?
5. Frag, ob du die Funde beheben sollst. Nach dem Beheben: Hackertest erneut ausführen.
