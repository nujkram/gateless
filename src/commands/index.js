// Every slash command the bot serves. Adding a file here is all it takes:
// bot.js registers and dispatches whatever this array contains.

const panels = require('./panels');
const gear = require('./gear');
const need = require('./need');
const lfg = require('./lfg');
const statics = require('./statics');

module.exports = [panels, gear, need, lfg, statics];
