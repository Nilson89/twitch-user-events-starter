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

### Twitch-Kanalpunkte anbinden (nur für Affiliates und Partner)

Wenn jemand auf Twitch eine Kanalpunkte-Belohnung einlöst, startet die passende Aktion im Overlay.
Die Belohnungen legst du selbst im Twitch-Dashboard an. Die App liest Einlösungen nur mit und speichert dafür kein Token.

```
Erweitere den Hub um Twitch-Kanalpunkte, Stufe 1 (nur mitlesen):
- Die Streamer-Freigabe unter /auth/streamer fragt zusätzlich das Recht channel:read:redemptions an.
- Leg ein EventSub-Abo für channel.channel_points_custom_reward_redemption.add (Version 1) an,
  genauso abgesichert wie die bestehenden Webhooks (Signatur, Zeitfenster, doppelte Nachrichten, richtiger Kanal).
- In hub.config.json kommt ein neuer Bereich "channelPoints": eine Zuordnung von Belohnungstitel zu Aktions-ID,
  z. B. "Bananenregen" -> "bananenregen". Löst jemand eine zugeordnete Belohnung ein, schickt der Server
  das passende Event ans Overlay. Bananen werden dabei nicht abgezogen.
- Unbekannte Belohnungen ignorieren. Die Nutzereingabe aus der Belohnung (user_input) nie im Overlay anzeigen.
- Kein Twitch-Token speichern. Halte dich an SECURITY.md, erweitere die Datenschutz-Seite falls nötig
  und führe danach npm run hackertest aus.
- Erklär mir am Ende, wie ich die Freigabe unter /auth/streamer erneut bestätige und die Belohnungen auf Twitch anlege.
```

> Stufe 2 wäre: Belohnungen direkt von der App anlegen und Einlösungen automatisch erstatten oder abhaken.
> Dafür muss die App dauerhaft ein Streamer-Token speichern (Recht `channel:manage:redemptions`).
> Das ist machbar, aber nur verschlüsselt und gemäß `SECURITY.md`. Lass dir das von Claude vorher erklären.
