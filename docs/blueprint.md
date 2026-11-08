# Gateless — Legion & Discord Blueprint

Nov 7, 2026 · @Mark Gersaniva

## Name

**Recommended: Gateless.** It says the whole mission in one word: if the game
lets you in, so do we. Tagline for the Discord and legion notice:
*"The game sets the gate. We don't."*

| Name | Meaning | Trade-off |
| --- | --- | --- |
| Gateless | No gates beyond the game's own item level | Mission-first, less assassin flavor |
| Shadowkin | A family that moves in the shadows | Keeps the "Brotherhood" spirit, gender-neutral |
| Open Blade | An assassin's edge, an open door | Good class identity, mission less obvious |
| Common Wings | Every Daeva flies, nobody grounded | Strong AION tie-in, softer tone |
| The Hidden Hearth | Hidden like assassins, warm like home | Long; may hit the name limit |
| Kinblade | Kin first, blade second | Short and punchy, mission implied |

Shadowkin is the closest upgrade to Brotherhood: same family meaning, no
franchise borrowing, and it welcomes everyone. Check the in-game legion name
limit and availability on Asia servers before committing.

## Charter

The one rule behind everything: in legion runs, the game's item level gate is
the only gate. No CP minimums, no meter checks to join.

1. **Entry = item level.** If the game lets you into a dungeon, you can join a
   legion run for it. Party posts list the content and item level only, never a
   CP number.
2. **No meter shaming.** Never blame, call out, or kick someone for low DPS.
   NotMeter parses are shared only with the player's consent, and only to help
   them improve.
3. **Mentors, not judges.** Stronger players are expected to bring newer ones
   along. If a run fails, the group reviews mechanics and gear together.
4. **Kicks need a reason that isn't numbers.** Valid reasons: AFK, griefing,
   harassment, repeatedly ignoring calls. Every kick gets logged in the officer
   channel.
5. **Outside groups are your choice.** Members can join any public party they
   like. The charter covers runs posted under the legion name.
6. **Respect people, not just players.** No harassment, slurs, or real-life
   attacks. One warning, then removal.

Hard content (Ludra Hard, progression nights) may run as training runs, open to
all eligible members and labeled so expectations are clear, rather than closed
CP-gated groups.

## Server structure

Six categories, about 20 channels: small enough to stay active, with LFG and
statics as the center. Times are in GMT+8 (Philippines) by default.

| Category | Channel | Purpose | Who posts |
| --- | --- | --- | --- |
| START HERE | #welcome | Welcome message and invite to the legion | Officers |
| START HERE | #charter-and-rules | The charter above, pinned | Officers |
| START HERE | #pick-your-roles | Class, content and timezone roles | Bot |
| START HERE | #announcements | Events, patches, Ludra Hunt dates | Officers |
| LEGION | #general | Main chat | Everyone |
| LEGION | #introductions | Name, class, what you play, when you're on | Everyone |
| LEGION | #wins-and-drops | Clears, +15s, rare drops, first kills | Everyone |
| LEGION | #memes | Off-topic | Everyone |
| PARTY UP | #lfg-dungeons | Expedition, Transcendence, Sanctuary posts | Everyone |
| PARTY UP | #lfg-raids | Ludra and 10-player content | Everyone |
| PARTY UP | #statics | Fixed groups: roster, schedule, openings | Static leads |
| PARTY UP | #event-signups | Bot-run signups for legion nights | Officers + bot |
| GROWTH | #gear-help | Post your NotMeter link for build advice | Everyone |
| GROWTH | #class-channels | One thread per class | Everyone |
| GROWTH | #guides-and-patch-notes | Curated guides, one link per post | Mentors |
| GROWTH | #parse-review | Opt-in meter reviews, coaching tone only | Everyone (opt-in) |
| VOICE | Party 1, Party 2, Raid (10), Hangout | Run comms | Everyone |
| OFFICERS | #officer-chat | Planning | Officers |
| OFFICERS | #mod-log | Kick and warning log (charter rule 4) | Officers + bot |

The #parse-review channel is where meters live, so they never spill into
#lfg-dungeons as a screening tool.

## Roles

Roles describe what people do and want, never how strong they are. There are no
CP or item level bracket roles, since those turn into a gate.

| Role | Who | Key permissions |
| --- | --- | --- |
| Legion Master | You | Administrator |
| Officer | 2–4 trusted members | Manage messages, kick, timeout, post in #announcements |
| Mentor | Experienced players who volunteer to coach | Post in #guides-and-patch-notes, pin in #gear-help |
| Static Lead | Whoever runs a fixed group | Post and pin in #statics |
| Member | In the in-game legion | All public channels and voice |
| Guest | Friends and applicants | #general, #lfg-dungeons, voice; no #event-signups |

Self-assigned roles in #pick-your-roles: class (one per class, so LFG posts can
ping Clerics or Templars), content (Dungeons, Ludra, Abyss PvP, Casual), and
timezone (GMT+8, other Asia, other). Members can switch these any time.

## Ready-to-paste texts

Copy these straight into Discord; each is formatted for Discord's markdown.
They also live in [`src/config/content.js`](../src/config/content.js), which is
what `npm run setup` posts and pins.

### #welcome

```
# Welcome to Gateless
**The game sets the gate. We don't.**

We're an AION 2 legion on Asia · Zikel where your item level is the only requirement.
No CP minimums. No meter shaming. Just people who want to clear content together.

1. Read #charter-and-rules
2. Grab your class and content roles in #pick-your-roles
3. Say hi in #introductions
4. Find a run in #lfg-dungeons or join a static in #statics

In-game: search for the legion **Gateless** or message an Officer.
```

### #charter-and-rules

```
# The Gateless Charter
1. **Item level is the only gate.** If the game lets you in, so do we. No CP numbers in legion party posts.
2. **No meter shaming.** Never blame or kick anyone for DPS. Parses are shared only with consent, to help.
3. **Mentors, not judges.** Bring newer players along. Failed runs = review together.
4. **Kicks need a non-numbers reason:** AFK, griefing, harassment, ignoring calls. All kicks are logged.
5. **Respect people.** No harassment or slurs. One warning, then removal.

Public parties outside the legion are your call. This charter covers runs posted under our name.
```

### #lfg-dungeons template (pin it)

```
**Content:** Transcendence Stage 4
**Item level:** 2,500+ (game requirement)
**Time:** Tonight 9:00 PM GMT+8
**Need:** Cleric, 1 DPS
**Type:** Farm run / Learning run / Training run
**Voice:** Party 1 (optional)
React ✅ to join
```

Labeling runs as Farm, Learning, or Training sets expectations without a CP
filter: a learning run tells everyone to expect wipes and explanations.

## Bots and setup checklist

Two bots plus Discord's built-in tools cover everything; avoid stacking more
bots than you'll maintain.

| Tool | Use |
| --- | --- |
| Discord Onboarding (built in, Community servers) | New members pick class, content and timezone roles on join |
| Discord AutoMod (built in) | Keyword rule on #lfg-dungeons and #lfg-raids that flags posts containing patterns like "CP req" or "min CP" to #mod-log, so officers can nudge the poster |
| Carl-bot | Reaction roles in #pick-your-roles, message and kick logging to #mod-log |
| Raid-Helper | Signups for legion nights and Ludra runs, with class slots and GMT+8 times |

Set the AutoMod rule to flag rather than block, since members will still talk
about CP normally in #gear-help.

- [ ] Create the server and enable Community features (needed for Onboarding)
- [ ] Build the six categories and channels from the structure table
- [ ] Create the roles; lock #announcements and #charter-and-rules to Officers
- [ ] Paste and pin the welcome, charter and LFG template
- [ ] Set up Onboarding questions for class, content and timezone
- [ ] Add Carl-bot (reaction roles + logging) and Raid-Helper
- [ ] Add the AutoMod flag rule on the two LFG channels
- [ ] Recruit 2–4 Officers and 2+ Mentors before opening the invite
- [ ] Create the in-game legion and put the Discord invite in the legion notice
- [ ] Post your first event: a Ludra Normal training run before the Hunt closes on Nov 24
