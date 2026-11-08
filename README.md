# Gateless

Server bootstrap and self-role bot for the **Gateless** AION 2 legion (Asia · Zikel).

> The game sets the gate. We don't.

The blueprint in [docs/blueprint.md](docs/blueprint.md) ends in a ten-item setup
checklist. Most of it is clicking. This repo does the clicking:

| Checklist item | Here |
| --- | --- |
| Create the server, enable Community | you, in Discord |
| Build the six categories and ~20 channels | `npm run setup` |
| Create the roles; lock #announcements and #charter-and-rules | `npm run setup` |
| Paste and pin welcome, charter, LFG template | `npm run setup` |
| Onboarding questions for class / content / timezone | `npm run setup` posts button panels instead — see below |
| Carl-bot (reaction roles + logging) | role panels are covered here; add Carl-bot if you want message logging |
| Raid-Helper | you, in Discord |
| AutoMod flag rule on the two LFG channels | `npm run setup` |
| Recruit Officers and Mentors | you |
| Create the in-game legion, post the first event | you |

## Quick start

1. Create the server in Discord and turn on **Community** (Server Settings →
   Enable Community). AutoMod needs it.
2. Make an application at <https://discord.com/developers/applications>, add a
   Bot, and copy the token.
3. Configure and install. Paste the token into `.env` yourself — it is a
   password for the bot account, so keep it out of chats and commits
   (`.env` is gitignored):

   ```bash
   cp .env.example .env    # fill in DISCORD_TOKEN now, GUILD_ID in a moment
   npm install
   ```

4. Invite the bot. This prints the link with exactly the permissions the
   project needs, using your own Application ID — no hunting for it:

   ```bash
   npm run invite
   ```

   For a brand-new server you are building from scratch, `npm run invite --
   --admin` is simpler: it sidesteps the "bot can't grant a permission it
   doesn't have" problem described below. Open the link as the server owner.

5. See what it would do, then do it:

   ```bash
   npm run setup:dry
   npm run setup
   ```

6. Leave the bot running so the role buttons respond:

   ```bash
   npm start
   ```

   To stop it — and catch any stray second copy, which is the one failure that
   makes buttons hang:

   ```bash
   npm run stop
   ```

   `npm run stop -- --dry-run` lists what it would stop without touching
   anything. It matches only node processes running this checkout's
   `src/bot.js`.

## What `npm run setup` builds

- **22 roles** — 6 staff (Legion Master, Officer, Mentor, Static Lead, Member,
  Guest) and 16 self-assigned (9 classes, 4 content, 3 timezone), ordered in the
  sidebar.
- **Member list grouped by class.** Discord files someone under their highest
  *hoisted* role, so the 9 class roles are hoisted and **Member and Guest
  deliberately are not** — hoisting those would file the whole legion under one
  "Member" heading and the class grouping would never show. Staff roles stay
  hoisted and rank above the classes, so officers and mentors still stand out.
  Content and timezone roles are unhoisted; sixteen headings would be noise.
- **6 categories, 22 channels** with permissions already applied:
  #announcements and #charter-and-rules are Officer-post, #pick-your-roles takes
  no messages at all, the OFFICERS category is hidden, and Guest sees only
  START HERE, #general, #lfg-dungeons and voice.
- **Three pinned posts** — the welcome, the charter, and the LFG template, with
  real channel links substituted in.
- **Four button panels** in #pick-your-roles. Class and timezone are exclusive
  (a new pick replaces the old); content is multi-select; clicking what you
  already have removes it. The fourth opens the gear dialog.
- **Nine threads** in #class-channels, one per class.
- **One AutoMod rule** that flags CP-gating language in the two LFG channels.

Everything is idempotent. Edit anything under `src/config/` and run it again —
roles, channels and pinned messages are updated in place, never duplicated.

## Gear and party finding

Members record their own numbers; the bot suggests groups from them.

Nobody has to learn a command. `#pick-your-roles` carries a **Set item level /
CP** button under the class panels: clicking it opens a dialog, pre-filled with
whatever is already on record, and the reply is private. The slash commands
below stay for anyone who prefers typing, and they work in **any channel a
member can see** — `UseApplicationCommands` is a separate permission from
`SendMessages`, so they work even in the locked channels. Every `/gear`,
`/need` and `/static join|leave` reply is ephemeral, so none of this clutters a
channel. Only `/lfg` and `/static build` post publicly.

| Command | Who | What |
| --- | --- | --- |
| `/gear set itemlevel: cp:` | everyone | Record either or both. Replies privately. |
| `/gear show [member]` | everyone | Class and item level. Combat power shows **only for yourself**. |
| `/need toggle <dungeon>` | everyone | Mark content you still want to run. |
| `/need list` | everyone | What you are down for. |
| `/lfg <dungeon> [private]` | everyone | Suggest a party for that content. |
| `/static join` / `leave` | everyone | Opt into the fixed-group pool. |
| `/static build <content>` | Static Lead, Officer | Propose balanced rosters from the pool. |

### How combat power is treated

You chose: **item level matches, combat power stays private.** That is wired in,
not just documented.

- **Item level** is public and is the only thing `/lfg` filters on, because it
  is the game's own gate — charter rule 1.
- **Combat power** is stored, shown back to the member who set it, and shown to
  nobody else. It is never passed to the matching code at all: `src/lib/members.js`
  does not copy it onto a candidate, so `src/lib/matching.js` could not read it
  if it tried. A test asserts the string `combatPower` never appears in either
  file outside a comment, and another builds the same party twice — once with
  wildly uneven combat power — and fails if the result shifts by one seat.

Suggestions are ordered by **who has waited longest** for that content, never by
strength. Someone with no item level recorded is reported as *unverified*, never
as too weak — unknown and under the gate are different things, and conflating
them is how a no-gate legion grows a gate by accident.

### Item levels are mostly blank on purpose

`src/config/dungeons.js` ships with one real figure — Transcendence Stage 4 at
2,500, from your own LFG template. Every other dungeon has `itemLevel: null`,
because inventing a number would invent a gate. A null means "no requirement
recorded", and the bot says so in the open and filters nobody. Fill them in as
you confirm them in game.

### Where the data lives

`data/roster.json`, written atomically, gitignored. A legion is tens to low
hundreds of people, so a file is the right size of tool — you can read it, edit
it and back it up without any of this code involved. The bot never needs the
privileged **Server Members** intent: it looks up only the people who have
opted in by running `/gear set`.

## Two things worth knowing

**AutoMod rules are server-wide.** Discord gives you an exempt list, not an
include list, so `setup.js` builds the rule with every text channel exempt
*except* #lfg-dungeons and #lfg-raids. That is what keeps #gear-help usable,
where CP talk is the entire point. **Any channel you add later is not exempt
until you re-run `npm run setup`.** The rule alerts #mod-log and lets the message
through; flip `BLOCK` in `src/config/automod.js` if you ever want it to stop the
post instead.

**Only one copy may run.** Two bots on one token both receive every click,
both try to acknowledge it, and the loser gets `10062 Unknown interaction`
while the member watches the button spin. `src/lib/lock.js` writes a PID to
`.bot.lock` and refuses to start a second copy; a stale PID from a crash is
taken over automatically. That guard cannot help if the lock file is deleted
while a bot is still running, so `npm run stop` finds copies by command line
instead, and the 10062 handler prints the diagnosis rather than a stack trace.

**Role hierarchy.** A bot cannot create a role carrying a permission it does not
hold itself, and cannot assign any role sitting above its own. If you invited it
without Administrator, "Legion Master" is created without the Administrator flag
and the script tells you exactly what to tick by hand. If the setup warns about
hierarchy, drag the bot's own role just under Legion Master in
Server Settings → Roles and run it again. `npm start` re-checks this on every
boot and lists anything it cannot assign.

## Layout

```
src/
  config/
    roles.js      staff roles and their permissions
    channels.js   categories, channels, permission presets, guest visibility
    selfroles.js  class / content / timezone buttons, role names, archetypes
    content.js    the welcome, charter and LFG template texts
    automod.js    CP-gating keywords and the alert behaviour
    dungeons.js   content list, item level gates, party shapes
  lib/
    client.js     login, guild resolution, permission preflight, logging
    panels.js     button panel builder (shared by setup and bot)
    lock.js       single-instance guard
    gearmodal.js  the Set gear button, its dialog and number parsing
    roster.js     the JSON store for gear and needs
    members.js    Discord member -> matching candidate
    matching.js   eligibility, party building, statics (no Discord, no CP)
  commands/       one file per slash command
  setup.js        the one-shot bootstrap
  bot.js          the long-running command and button handler
data/
  roster.json     created on first /gear set, gitignored
test/
  smoke.js        config, permissions, pinned content, lock
  matching.js     party rules and the no-CP invariant
```

## Charter

The one rule behind all of it: **in legion runs, the game's item level gate is
the only gate.** No CP minimums, no meter checks to join. The config reflects
that deliberately — there are no CP or item-level bracket roles anywhere, and
the only automated moderation in the server exists to catch CP gating in party
posts.
