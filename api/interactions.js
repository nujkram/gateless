// Vercel entry point. Discord POSTs every interaction here.
//
// Set this URL as the "Interactions Endpoint URL" in the Developer Portal:
//   https://<your-deployment>.vercel.app/api/interactions
//
// Discord will immediately send a signed PING and refuse to save the URL
// unless it gets a valid PONG back, so a bad DISCORD_PUBLIC_KEY shows up at
// the moment you paste the URL rather than later.

const { verifyRequest } = require('../src/http/verify');
const { handleInteraction } = require('../src/http/router');

// Vercel parses JSON bodies by default. The signature covers the exact bytes
// Discord sent, and parsing then re-stringifying changes them, so the raw
// body has to survive intact.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // A plain visit in a browser. Reports whether the deployment is actually
  // configured, because the alternative is finding out when Discord refuses
  // to save the endpoint URL and not knowing which variable is missing.
  //
  // Booleans only. No value of any secret is ever returned here.
  if (req.method === 'GET') {
    const store = require('../src/lib/store');
    const onVercel = process.env.VERCEL === '1';
    const config = {
      DISCORD_PUBLIC_KEY: Boolean(process.env.DISCORD_PUBLIC_KEY),
      DISCORD_TOKEN: Boolean(process.env.DISCORD_TOKEN),
      GUILD_ID: Boolean(process.env.GUILD_ID),
      storage: store.usingUpstash ? 'upstash' : 'file',
    };

    const missing = Object.entries(config)
      .filter(([k, v]) => k !== 'storage' && !v)
      .map(([k]) => k);

    // A file-backed roster on Vercel loses everything between invocations,
    // so that counts as not ready even though nothing errors.
    if (onVercel && !store.usingUpstash) missing.push('storage (add Upstash)');

    // Only while something is wrong: the NAMES (never values) of the
    // storage variables present, so a prefixed or half-connected store is
    // visible rather than silently falling back to a file. Dropped once
    // configured, so a healthy deployment reports nothing extra.
    const storageEnv = store.usingUpstash ? undefined : store.storageEnvNames();

    return res.status(200).json({
      service: 'gateless',
      ready: missing.length === 0,
      missing,
      config,
      storageEnv,
      note: missing.length
        ? 'Set the missing variables in Vercel, redeploy, then set the Interactions Endpoint URL in the Developer Portal.'
        : 'Ready. Set this URL as the Interactions Endpoint URL in the Developer Portal.',
    });
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error('DISCORD_PUBLIC_KEY is not set — refusing every request.');
    return res.status(500).send('Server misconfigured');
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).send('Could not read body');
  }

  const valid = verifyRequest({
    publicKey,
    signature: req.headers['x-signature-ed25519'],
    timestamp: req.headers['x-signature-timestamp'],
    rawBody,
  });

  // 401 is required here: Discord's endpoint check expects a bad signature to
  // be rejected, and will not accept the URL otherwise.
  if (!valid) return res.status(401).send('invalid request signature');

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  try {
    return res.status(200).json(await handleInteraction(body));
  } catch (err) {
    console.error('Interaction failed:', err);
    // Still answer, or the member watches a spinner until it times out.
    return res.status(200).json({
      type: 4,
      data: { content: 'Something went wrong on my side. An Officer can check the logs.', flags: 64 },
    });
  }
};
