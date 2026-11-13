// Legt die lokale .env an: fragt nach den Twitch-Daten und erzeugt sichere Zufallsschlüssel.
// Aufruf: npm run setup
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Du brauchst Node.js 22.13 oder neuer (installiert: ${process.versions.node}). Download: https://nodejs.org`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\n🍌  Einrichtung deines Zuschauer-Hubs (lokal)\n');
console.log('Du brauchst die Client-ID und das Client-Secret deiner Twitch-App.');
console.log('Die findest du unter https://dev.twitch.tv/console (Schritt-für-Schritt: CHECKLISTE.md).\n');

if (fs.existsSync(envPath)) {
  const answer = (await rl.question('Es gibt schon eine .env. Überschreiben? (j/N) ')).trim().toLowerCase();
  if (answer !== 'j' && answer !== 'ja') {
    console.log('Abgebrochen, deine .env bleibt unverändert.');
    rl.close();
    process.exit(0);
  }
}

const ask = async (question, check, hint) => {
  for (;;) {
    const value = (await rl.question(question)).trim();
    if (check(value)) return value;
    console.log(`  ${hint}`);
  }
};

const channel = (await ask('Dein Twitch-Kanalname: ', (v) => /^[a-zA-Z0-9_]{3,25}$/.test(v), 'Bitte nur den Kanalnamen, z. B. nilson1489')).toLowerCase();
const clientId = await ask('Twitch Client-ID: ', (v) => /^[a-z0-9]{20,40}$/i.test(v), 'Die Client-ID besteht aus ca. 30 Buchstaben und Zahlen.');
const clientSecret = await ask('Twitch Client-Secret: ', (v) => /^[a-z0-9]{20,40}$/i.test(v), 'Das Secret besteht aus ca. 30 Buchstaben und Zahlen.');
rl.close();

const env = `# Lokale Einstellungen, erzeugt von "npm run setup" am ${new Date().toLocaleString('de-DE')}
# Diese Datei NIEMALS teilen oder auf GitHub hochladen.
BASE_URL=http://localhost:3000
NODE_ENV=development
TWITCH_CLIENT_ID=${clientId}
TWITCH_CLIENT_SECRET=${clientSecret}
TWITCH_CHANNEL=${channel}
EVENTSUB_SECRET=${crypto.randomBytes(32).toString('hex')}
OVERLAY_KEY=${crypto.randomBytes(32).toString('base64url')}
DATABASE_URL=
DEV_ALWAYS_LIVE=true
`;

fs.writeFileSync(envPath, env, { encoding: 'utf8', mode: 0o600 });

console.log('\n✅ .env angelegt.\n');
console.log('Als Nächstes:');
console.log('  1. In der Twitch-Konsole als OAuth Redirect URL eintragen: http://localhost:3000/auth/callback');
console.log('  2. npm run dev');
console.log('  3. http://localhost:3000 im Browser öffnen\n');
console.log('Deine Overlay-Adresse für OBS steht in der .env (OVERLAY_KEY):');
console.log('  http://localhost:3000/overlay?key=<OVERLAY_KEY>\n');
