// Gut lesbare Ausgabe für den Hackertest (statt der technischen Standardausgabe).
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const reason = (error) => {
  const e = error?.cause ?? error;
  const msg = String(e?.message ?? e ?? '').split('\n')[0];
  if (/ECONNREFUSED|fetch failed/.test(msg)) return 'App nicht erreichbar';
  if (e?.name === 'TypeError' && /reading 'cookie'/.test(msg)) return 'Übersprungen: Der Login hat vorher nicht geklappt';
  if (e?.name === 'TypeError') return `Interner Fehler im Test-Ablauf: ${msg}`;
  return msg.length > 140 ? msg.slice(0, 137) + '...' : msg;
};

export default async function* hackertestReporter(source) {
  const stats = { fnOk: 0, fnFail: 0, atkOk: 0, atkFail: 0, other: 0 };
  let headerShown = false;

  for await (const event of source) {
    if (!headerShown) {
      headerShown = true;
      yield '\n' + c.bold('🍌  HACKERTEST: Wir greifen deine App an') + '\n';
      yield c.dim('    Echte Angriffe gegen deine lokale App, mit einem nachgebauten Twitch.') + '\n\n';
    }
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const { name, details } = event.data;
    if (details?.type === 'suite') continue;

    const failed = event.type === 'test:fail';
    const isAttack = name.startsWith('Angriff:');
    const isFunction = name.startsWith('Funktion:');
    const label = name.replace(/^(Angriff|Funktion):\s*/, '');

    if (isAttack) {
      failed ? stats.atkFail++ : stats.atkOk++;
      yield failed
        ? `  ${c.red('❌ OFFEN      ')} ${label}\n               ${c.dim(reason(details?.error))}\n`
        : `  ${c.green('🛡️  ABGEWEHRT ')} ${label}\n`;
    } else if (isFunction) {
      failed ? stats.fnFail++ : stats.fnOk++;
      yield failed
        ? `  ${c.red('❌ FEHLT      ')} ${label}\n               ${c.dim(reason(details?.error))}\n`
        : `  ${c.green('✅ OK         ')} ${label}\n`;
    } else if (failed) {
      stats.other++;
      yield `  ${c.red('❌ FEHLER     ')} ${name}\n               ${c.dim(reason(details?.error))}\n`;
    }
  }

  const attacks = stats.atkOk + stats.atkFail;
  const functions = stats.fnOk + stats.fnFail;
  yield '\n' + c.bold('Ergebnis') + '\n';
  yield `  Funktionen:  ${stats.fnOk}/${functions} ok\n`;
  yield `  Angriffe:    ${stats.atkOk}/${attacks} abgewehrt\n\n`;
  if (stats.atkFail === 0 && stats.fnFail === 0 && stats.other === 0 && attacks > 0) {
    yield c.green(c.bold('  ✅ Alle Angriffe abgewehrt. Deine App ist bereit für den Stream!')) + '\n\n';
  } else if (stats.fnOk <= 1 && stats.atkOk <= 3) {
    yield c.yellow('  Die App ist noch nicht gebaut. Starte Claude Code und tippe: /hub-bauen') + '\n\n';
  } else {
    yield c.red(c.bold(`  ⚠️  ${stats.atkFail + stats.fnFail + stats.other} Punkt(e) offen. Lass Claude Code sie beheben: /hackertest`)) + '\n\n';
  }
}
