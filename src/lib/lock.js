// Single-instance guard.
//
// Two copies of the bot on one token both receive every interaction, both try
// to acknowledge it, and the loser gets "Unknown interaction" (10062) while
// the member sees the click hang. Nothing in the Discord API warns you about
// this, and the symptom looks like a logic bug, so stop it at the door.

const fs = require('fs');
const path = require('path');

const LOCK_PATH = path.join(__dirname, '..', '..', '.bot.lock');

// process.kill(pid, 0) sends no signal; it just tests whether the pid exists.
// ESRCH means gone, EPERM means alive but owned by someone else.
function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readLock() {
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function release() {
  if (readLock() === process.pid) {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      /* already gone */
    }
  }
}

// Exits the process if another live instance holds the lock.
function acquire() {
  const held = readLock();
  if (held && held !== process.pid && isRunning(held)) {
    console.error(`\nAnother copy of the bot is already running (pid ${held}).`);
    console.error('Running two on one token makes button clicks fail intermittently:');
    console.error('both answer each click and the slower one gets "Unknown interaction".\n');
    console.error('Stop that one first:');
    console.error(`  Stop-Process -Id ${held}`);
    console.error('\nThen start this one again.\n');
    process.exit(1);
  }

  fs.writeFileSync(LOCK_PATH, String(process.pid), 'utf8');

  process.on('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => {
      release();
      process.exit(0);
    });
  }
  return LOCK_PATH;
}

module.exports = { acquire, release, readLock, isRunning, LOCK_PATH };
