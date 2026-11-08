// Ed25519 verification of Discord's request signature.
//
// Anyone can POST to a public URL, so this is the only thing standing between
// the endpoint and a stranger handing out roles. Discord signs
// (timestamp + rawBody) with the application's private key; we check it
// against the public key from the Developer Portal.
//
// Node can do Ed25519 natively, but crypto.verify needs a KeyObject, and
// Discord gives a bare 32-byte key as hex. Wrapping it in the fixed SPKI DER
// prefix below turns it into something createPublicKey accepts, which avoids
// pulling in tweetnacl just for this.

const crypto = require('crypto');

// SPKI header for an Ed25519 public key: SEQUENCE { SEQUENCE { OID 1.3.101.112 }, BIT STRING }
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function toKeyObject(publicKeyHex) {
  const raw = Buffer.from(publicKeyHex, 'hex');
  if (raw.length !== 32) throw new Error('Discord public key must be 32 bytes of hex');
  return crypto.createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

// rawBody must be the EXACT bytes Discord sent. Parsing the JSON and
// re-stringifying it changes the bytes and the signature will not match.
function verifyRequest({ publicKey, signature, timestamp, rawBody }) {
  if (!publicKey || !signature || !timestamp || rawBody == null) return false;
  try {
    const message = Buffer.concat([
      Buffer.from(String(timestamp), 'utf8'),
      Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'),
    ]);
    const sig = Buffer.from(signature, 'hex');
    if (sig.length !== 64) return false;
    return crypto.verify(null, message, toKeyObject(publicKey), sig);
  } catch {
    return false;
  }
}

module.exports = { verifyRequest, toKeyObject };
