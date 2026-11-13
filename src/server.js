// Starter-Server: bringt deine Seite sofort online, noch ohne Twitch-Funktionen.
// Den eigentlichen Zuschauer-Hub baut Claude Code nach SPEC.md (Befehl: /hub-bauen).
import express from 'express';
import { fileURLToPath } from 'node:url';

const app = express();
app.disable('x-powered-by');

app.get('/healthz', (req, res) => {
  res.type('text/plain').send('ok');
});

app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Starter-Seite läuft auf Port ${port}`);
});
