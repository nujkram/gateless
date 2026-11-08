// AutoMod keyword rule for charter rule 1: LFG posts list content and item
// level, never a CP number.
//
// Two things worth knowing about how this is built:
//
// 1. The action is ALERT, not BLOCK. Members get to post; an officer gets a
//    heads-up in #mod-log and can nudge them. Blocking would read as the kind
//    of gate the legion exists to not have.
//
// 2. Discord AutoMod rules are server-wide. There is no "only watch these
//    channels" option — only an exempt list. So setup.js builds the rule with
//    every channel exempt EXCEPT #lfg-dungeons and #lfg-raids. That is what
//    keeps #gear-help usable, where talking about CP is the whole point.
//    Any channel you add later is NOT exempt until you re-run `npm run setup`.

const RULE_NAME = 'Gateless: no CP gating in LFG';

// Discord keyword syntax: * is a wildcard at the start or end of a term.
const KEYWORDS = [
  '*cp req*',
  '*cp requirement*',
  '*min cp*',
  '*minimum cp*',
  '*cp min*',
  '*cp check*',
  '*cp gate*',
  '*cp only*',
  '*no low cp*',
  '*low cp dont*',
  '*cp or higher*',
  '*cp and above*',
  '*cp+*',
];

// Phrases that should never trip the rule even inside the LFG channels.
const ALLOW_LIST = [
  'no cp req',
  'no cp requirement',
  'no min cp',
  'no cp minimum',
  'no cp check',
  'no cp gate',
];

// Alert only by default: the post goes through, officers get a ping. Flip this
// to true and the rule blocks the message and shows CUSTOM_MESSAGE instead.
// (Discord only renders a custom message on a BLOCK action, not an alert.)
const BLOCK = false;

const CUSTOM_MESSAGE =
  'Heads up: Gateless party posts list content and item level only — no CP numbers. ' +
  'Your post went through, but an officer will nudge you to reword it.';

module.exports = { RULE_NAME, KEYWORDS, ALLOW_LIST, BLOCK, CUSTOM_MESSAGE };
