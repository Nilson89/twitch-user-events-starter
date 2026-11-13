# Prompts zum Kopieren

Alle Prompts sind für Claude Code im Ordner deines Repos gedacht.

## App bauen

```
/hub-bauen
```

Ohne Slash-Befehl geht es auch so:

```
Lies SPEC.md und SECURITY.md und bau die komplette App. Fertig bist du, wenn npm run hackertest komplett grün ist.
```

## Hackertest

```
/hackertest
```

## Online stellen mit dem Hostinger MCP

Plugin installieren (einmalig):

```
/plugin install hostinger@claude-plugins-official
```

Datenbank anlegen:

```
Leg über das Hostinger MCP für meine Node.js-App auf DEINE-DOMAIN eine neue MySQL-Datenbank an.
```

Umgebungsvariablen setzen:

```
Setz über das Hostinger MCP die Umgebungsvariablen für meine App auf DEINE-DOMAIN laut SPEC.md:
NODE_ENV=production, BASE_URL=https://DEINE-DOMAIN, TWITCH_CLIENT_ID=DEINE-CLIENT-ID, TWITCH_CHANNEL=DEIN-KANAL,
DATABASE_URL aus der eben angelegten Datenbank, und erzeuge neue zufällige Werte für EVENTSUB_SECRET und OVERLAY_KEY.
TWITCH_CLIENT_SECRET setzt du nicht, das trage ich selbst im hPanel ein.
```

Neu starten und prüfen:

```
Starte meine App auf DEINE-DOMAIN über das Hostinger MCP neu und lies die Runtime-Logs. Läuft alles?
```

## Sicherheit

```
/sicherheitscheck
```

## Eigene Ideen

Beispiele zum Weiterbauen. `SECURITY.md` gilt dabei automatisch weiter.

```
Füg eine neue Aktion "Konfetti" für 30 Bananen mit 45 Sekunden Cooldown hinzu, inklusive Animation im Overlay.
```

```
Pass das Design der Startseite an meine Kanalfarben an: Hauptfarbe #ff4f9a, Akzent #00e0ff.
```

```
Zeig auf der Startseite zusätzlich die letzten 5 eingelösten Aktionen an.
```
