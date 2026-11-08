// The ready-to-paste texts from the blueprint, formatted for Discord markdown.
// Edit them here and re-run `npm run setup` — the script edits the existing
// pinned message in place rather than posting a second copy.

const TAGLINE = 'The game sets the gate. We don’t.';

const welcome = [
  '# Welcome to Gateless',
  `**${TAGLINE}**`,
  '',
  'We’re an AION 2 legion on Asia · Zikel where your item level is the only requirement.',
  'No CP minimums. No meter shaming. Just people who want to clear content together.',
  '',
  '1. Read <#charter-and-rules>',
  '2. Grab your class and content roles in <#pick-your-roles>',
  '3. Say hi in <#introductions>',
  '4. Find a run in <#lfg-dungeons> or join a static in <#statics>',
  '',
  'In-game: search for the legion **Gateless** or message an Officer.',
].join('\n');

const charter = [
  '# The Gateless Charter',
  '1. **Item level is the only gate.** If the game lets you in, so do we. No CP numbers in legion party posts.',
  '2. **No meter shaming.** Never blame or kick anyone for DPS. Parses are shared only with consent, to help.',
  '3. **Mentors, not judges.** Bring newer players along. Failed runs = review together.',
  '4. **Kicks need a non-numbers reason:** AFK, griefing, harassment, ignoring calls. All kicks are logged.',
  '5. **Respect people.** No harassment or slurs. One warning, then removal.',
  '',
  'Public parties outside the legion are your call. This charter covers runs posted under our name.',
].join('\n');

const lfgTemplate = [
  '**Copy this when you post a run:**',
  '',
  '> **Content:** Transcendence Stage 4',
  '> **Item level:** 2,500+ (game requirement)',
  '> **Time:** Tonight 9:00 PM GMT+8',
  '> **Need:** Cleric, 1 DPS',
  '> **Type:** Farm run / Learning run / Training run',
  '> **Voice:** Party 1 (optional)',
  '> React ✅ to join',
  '',
  'Label the run so expectations are clear without a CP filter:',
  '· **Farm run** — everyone knows it, in and out',
  '· **Learning run** — expect wipes and explanations',
  '· **Training run** — open to all eligible members, mentors on hand',
  '',
  '**Item level is the only requirement.** Posts with CP minimums get flagged to the officers.',
].join('\n');

// Shown at the top of the #pick-your-roles channel, above the button panels.
const rolesIntro = [
  '# Pick your roles',
  'None of these say how strong you are — they just tell people what you play,',
  'what you run and when you’re on. Change them whenever you like.',
  '',
  '**Then record your gear** — the button at the bottom of this channel opens a',
  'box for it, or use `/gear set` if you prefer typing.',
  '· **Item level** is what party suggestions use. It is the game’s own gate.',
  '· **Combat power** is optional and private. Only you ever see it, and it is',
  '  never used to match, rank or filter anyone.',
  '',
  'Mark what you still want to run with `/need toggle`. Then anyone can use',
  '`/lfg` to put a group together from people who are eligible and still need it.',
].join('\n');

module.exports = { TAGLINE, welcome, charter, lfgTemplate, rolesIntro };
