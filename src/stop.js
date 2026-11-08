// npm run stop — stop every copy of this bot.
//
// The lock in src/lib/lock.js stops a second copy STARTING. It cannot help
// when the lock file goes missing while a bot is still running (a stray
// delete, a cleaned checkout), and then two copies race every interaction.
// This finds them by command line, so a missing lock file does not hide one.

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const LOCK = path.join(ROOT, '.bot.lock');

// Only ever matches node processes running THIS checkout's bot.js — never
// another project's bot, and never this script.
function findBots() {
  const found = [];
  try {
    if (process.platform === 'win32') {
      const ps =
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
        'ForEach-Object { $_.ProcessId.ToString() + \'|\' + $_.CommandLine }';
      const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
      for (const row of out.split('\n')) {
        const [pid, ...rest] = row.trim().split('|');
        found.push({ pid: Number(pid), cmd: rest.join('|') });
      }
    } else {
      const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
      for (const row of out.split('\n')) {
        const m = row.trim().match(/^(\d+)\s+(.*)$/);
        if (m) found.push({ pid: Number(m[1]), cmd: m[2] });
      }
    }
  } catch (err) {
    console.error(`Could not list processes: ${err.message}`);
    return [];
  }

  const here = path.join('src', 'bot.js');
  return found.filter(
    (p) =>
      Number.isInteger(p.pid) &&
      p.pid !== process.pid &&
      p.cmd &&
      (p.cmd.includes(here) || p.cmd.includes('src/bot.js')) &&
      // Same checkout only: either an absolute path into ROOT, or a relative
      // invocation, which npm always runs from the package root.
      (p.cmd.includes(ROOT) || !path.isAbsolute(p.cmd.split(/\s+/).slice(-1)[0]))
  );
}

const DRY = process.argv.includes('--dry-run');

const bots = findBots();

if (!bots.length) {
  console.log('No bot is running.');
} else {
  for (const bot of bots) {
    if (DRY) {
      console.log(`would stop pid ${bot.pid}  ${bot.cmd.trim()}`);
      continue;
    }
    try {
      process.kill(bot.pid);
      console.log(`Stopped pid ${bot.pid}`);
    } catch (err) {
      console.error(`Could not stop pid ${bot.pid}: ${err.message}`);
    }
  }
}

// A lock left behind by a process that is gone would block the next start.
try {
  if (DRY) throw new Error('dry run');
  if (fs.existsSync(LOCK)) {
    fs.unlinkSync(LOCK);
    console.log('Cleared .bot.lock');
  }
} catch {
  /* nothing to clear */
}

console.log('\nStart one with: npm start');
