// Six categories, ~20 channels. Small enough to stay active, with LFG and
// statics as the centre.
//
// perms presets (resolved in src/setup.js):
//   open          everyone reads and posts
//   officer-post  everyone reads, only Legion Master / Officer post
//   mentor-post   everyone reads, Mentor and up post
//   panel         everyone reads, nobody posts (bot button panels live here)
//   officers-only hidden from everyone except Legion Master / Officer
//
// guest: true  -> the Guest role can see it.
// guest: false -> Guest is denied View Channel. Per the blueprint, guests get
//                 the START HERE category, #general, #lfg-dungeons and voice.

const { ChannelType } = require('discord.js');

const CATEGORIES = [
  {
    name: 'START HERE',
    channels: [
      { name: 'welcome',           perms: 'officer-post', guest: true,
        topic: 'What Gateless is and how to get started. The game sets the gate. We don’t.' },
      { name: 'charter-and-rules', perms: 'officer-post', guest: true,
        topic: 'The six rules we actually run on. Pinned above.' },
      { name: 'pick-your-roles',   perms: 'panel',        guest: true,
        topic: 'Class, content and timezone roles. Click a button, change it any time.' },
      { name: 'announcements',     perms: 'officer-post', guest: true,
        topic: 'Events, patches, Ludra Hunt dates.' },
    ],
  },
  {
    name: 'LEGION',
    channels: [
      { name: 'general',        perms: 'open', guest: true,  topic: 'Main chat.' },
      { name: 'introductions',  perms: 'open', guest: false, topic: 'Name, class, what you play, when you’re on.' },
      { name: 'wins-and-drops', perms: 'open', guest: false, topic: 'Clears, +15s, rare drops, first kills. Brag freely.' },
      { name: 'memes',          perms: 'open', guest: false, topic: 'Off-topic.' },
    ],
  },
  {
    name: 'PARTY UP',
    channels: [
      { name: 'lfg-dungeons',  perms: 'open',         guest: true,
        topic: 'Expedition, Transcendence, Sanctuary. Content and item level only — no CP numbers.' },
      { name: 'lfg-raids',     perms: 'open',         guest: false,
        topic: 'Ludra and 10-player content. Content and item level only — no CP numbers.' },
      { name: 'statics',       perms: 'open',         guest: false,
        topic: 'Fixed groups: roster, schedule, openings. Static Leads post and pin.' },
      { name: 'event-signups', perms: 'officer-post', guest: false,
        topic: 'Raid-Helper signups for legion nights. Officers and the bot post here.' },
    ],
  },
  {
    name: 'GROWTH',
    channels: [
      { name: 'gear-help',             perms: 'open',        guest: false,
        topic: 'Post your NotMeter link for build advice. CP talk is fine in here.' },
      { name: 'class-channels',        perms: 'open',        guest: false,
        topic: 'One thread per class. Find yours below.' },
      { name: 'guides-and-patch-notes', perms: 'mentor-post', guest: false,
        topic: 'Curated guides, one link per post. Mentors and Officers post.' },
      { name: 'parse-review',          perms: 'open',        guest: false,
        topic: 'Opt-in meter reviews, coaching tone only. Meters live here and nowhere else.' },
    ],
  },
  {
    name: 'VOICE',
    channels: [
      { name: 'Party 1',  type: ChannelType.GuildVoice, perms: 'open', guest: true, userLimit: 6 },
      { name: 'Party 2',  type: ChannelType.GuildVoice, perms: 'open', guest: true, userLimit: 6 },
      { name: 'Raid (10)', type: ChannelType.GuildVoice, perms: 'open', guest: true, userLimit: 12 },
      { name: 'Hangout',  type: ChannelType.GuildVoice, perms: 'open', guest: true },
    ],
  },
  {
    name: 'OFFICERS',
    channels: [
      { name: 'officer-chat', perms: 'officers-only', guest: false, topic: 'Planning.' },
      { name: 'mod-log',      perms: 'officers-only', guest: false,
        topic: 'Kick and warning log (charter rule 4). AutoMod CP-flag alerts land here too.' },
    ],
  },
];

// Channels the setup script posts a pinned message into.
const PINNED = {
  welcome: 'welcome',
  'charter-and-rules': 'charter',
  'lfg-dungeons': 'lfgTemplate',
};

// #class-channels gets one thread per class, created from the class self-roles.
const THREADED_CHANNEL = 'class-channels';

// AutoMod alerts go here.
const MOD_LOG = 'mod-log';

// The two channels the CP keyword rule actually watches.
const LFG_CHANNELS = ['lfg-dungeons', 'lfg-raids'];

module.exports = { CATEGORIES, PINNED, THREADED_CHANNEL, MOD_LOG, LFG_CHANNELS };
