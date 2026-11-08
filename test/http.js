// The HTTP interactions layer: signature checking, payload reading, and the
// Vercel handler end to end. No network, no Discord, no token.
// Run with: node test/http.js

const assert = require('assert');
const crypto = require('crypto');
const { Readable } = require('stream');

const { verifyRequest } = require('../src/http/verify');
const router = require('../src/http/router');

let checks = 0;
const check = async (label, fn) => {
  await fn();
  checks += 1;
  console.log(`  ok  ${label}`);
};

// A real Ed25519 keypair, signing exactly the way Discord does.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUBLIC_HEX = publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('hex');
const sign = (timestamp, body) =>
  crypto.sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');

async function signatures() {
  console.log('\nSignature verification');

  await check('a correctly signed request is accepted', () => {
    const body = JSON.stringify({ type: 1 });
    assert.strictEqual(
      verifyRequest({ publicKey: PUBLIC_HEX, signature: sign('100', body), timestamp: '100', rawBody: body }),
      true
    );
  });

  await check('a tampered body is rejected', () => {
    const body = JSON.stringify({ type: 1 });
    const signature = sign('100', body);
    const tampered = JSON.stringify({ type: 2, data: { name: 'gear' } });
    assert.strictEqual(
      verifyRequest({ publicKey: PUBLIC_HEX, signature, timestamp: '100', rawBody: tampered }),
      false
    );
  });

  await check('a replayed signature under a new timestamp is rejected', () => {
    const body = JSON.stringify({ type: 1 });
    assert.strictEqual(
      verifyRequest({ publicKey: PUBLIC_HEX, signature: sign('100', body), timestamp: '101', rawBody: body }),
      false
    );
  });

  await check('another application key is rejected', () => {
    const body = JSON.stringify({ type: 1 });
    const other = crypto
      .generateKeyPairSync('ed25519')
      .publicKey.export({ type: 'spki', format: 'der' })
      .subarray(12)
      .toString('hex');
    assert.strictEqual(
      verifyRequest({ publicKey: other, signature: sign('100', body), timestamp: '100', rawBody: body }),
      false
    );
  });

  await check('malformed input is rejected rather than throwing', () => {
    const bads = [
      { signature: 'zz', timestamp: '1', rawBody: '{}' },
      { signature: null, timestamp: '1', rawBody: '{}' },
      { signature: 'ab'.repeat(32), timestamp: null, rawBody: '{}' },
    ];
    for (const bad of bads) assert.strictEqual(verifyRequest({ publicKey: PUBLIC_HEX, ...bad }), false);
    assert.strictEqual(
      verifyRequest({ publicKey: 'nothex', signature: 'ab', timestamp: '1', rawBody: '{}' }),
      false
    );
  });
}

async function payloads() {
  console.log('\nReading the payload');

  await check('subcommand options are flattened', () => {
    const { sub, get } = router.readOptions({
      options: [{ name: 'set', type: 1, options: [{ name: 'itemlevel', value: 2500 }] }],
    });
    assert.strictEqual(sub, 'set');
    assert.strictEqual(get('itemlevel'), 2500);
    assert.strictEqual(get('cp'), null, 'an absent option must read as null');
  });

  await check('a top-level option list still reads', () => {
    const { sub, get } = router.readOptions({ options: [{ name: 'dungeon', value: 'expedition' }] });
    assert.strictEqual(sub, null);
    assert.strictEqual(get('dungeon'), 'expedition');
  });

  await check('false comes back as false, not swallowed as missing', () => {
    const { get } = router.readOptions({ options: [{ name: 'private', value: false }] });
    assert.strictEqual(get('private'), false);
  });

  await check('modal fields flatten to id -> value', () => {
    const fields = router.modalFields({
      components: [
        { components: [{ custom_id: 'itemlevel', value: '2500' }] },
        { components: [{ custom_id: 'cp', value: '' }] },
      ],
    });
    assert.strictEqual(fields.get('itemlevel'), '2500');
    assert.strictEqual(fields.get('cp'), '');
  });

  await check('Manage Guild is read from the permission bitfield', () => {
    assert.strictEqual(router.hasManageGuild({ permissions: '32' }), true);
    assert.strictEqual(router.hasManageGuild({ permissions: '8589934591' }), true);
    assert.strictEqual(router.hasManageGuild({ permissions: '0' }), false);
    assert.strictEqual(router.hasManageGuild({ permissions: 'nonsense' }), false);
    assert.strictEqual(router.hasManageGuild(undefined), false);
  });

  console.log('\nRouting');

  await check('PING is answered with PONG', async () => {
    assert.deepStrictEqual(await router.handleInteraction({ type: 1 }), { type: 1 });
  });

  await check('an interaction with no guild is refused without touching Discord', async () => {
    const res = await router.handleInteraction({ type: 2, data: { name: 'gear' } });
    assert.strictEqual(res.type, 4);
    assert.strictEqual(res.data.flags, 64, 'the refusal must be private');
  });
}

async function endpoint() {
  console.log('\nThe Vercel endpoint');

  // Minimal stand-ins for Vercel's req and res.
  const makeReq = (method, body, headers = {}) => {
    const req = Readable.from([Buffer.from(body)]);
    req.method = method;
    req.headers = headers;
    return req;
  };
  const makeRes = () => {
    const res = { code: null, body: null };
    res.status = (c) => ((res.code = c), res);
    res.json = (b) => ((res.body = b), res);
    res.send = (b) => ((res.body = b), res);
    return res;
  };

  const handler = require('../api/interactions');
  const previous = process.env.DISCORD_PUBLIC_KEY;
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;

  await check('a signed PING gets 200 and a PONG', async () => {
    const body = JSON.stringify({ type: 1 });
    const res = makeRes();
    await handler(
      makeReq('POST', body, {
        'x-signature-ed25519': sign('100', body),
        'x-signature-timestamp': '100',
      }),
      res
    );
    assert.strictEqual(res.code, 200);
    assert.deepStrictEqual(res.body, { type: 1 });
  });

  await check('an unsigned request gets 401, which Discord requires', async () => {
    const res = makeRes();
    await handler(makeReq('POST', JSON.stringify({ type: 1 }), {}), res);
    assert.strictEqual(res.code, 401);
  });

  await check('a forged signature gets 401', async () => {
    const res = makeRes();
    await handler(
      makeReq('POST', JSON.stringify({ type: 1 }), {
        'x-signature-ed25519': 'ab'.repeat(32),
        'x-signature-timestamp': '100',
      }),
      res
    );
    assert.strictEqual(res.code, 401);
  });

  await check('a browser GET reports readiness without leaking any value', async () => {
    const res = makeRes();
    await handler(makeReq('GET', '', {}), res);
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.service, 'gateless');
    assert.strictEqual(typeof res.body.ready, 'boolean');
    assert.strictEqual(res.body.config.DISCORD_PUBLIC_KEY, true, 'should see the key is present');

    // The whole response must not contain any secret's VALUE.
    const asText = JSON.stringify(res.body);
    assert.ok(!asText.includes(PUBLIC_HEX), 'the public key value leaked into the health check');
    for (const name of ['DISCORD_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN']) {
      const value = process.env[name];
      if (value) assert.ok(!asText.includes(value), `${name} value leaked into the health check`);
    }
  });

  await check('an unconfigured store reports variable names but no values', async () => {
    const res = makeRes();
    await handler(makeReq('GET', '', {}), res);
    // Local test run has no Upstash, so the diagnostic block should be there.
    assert.strictEqual(res.body.config.storage, 'file');
    assert.ok(res.body.storageEnv, 'should report what it looked for');
    assert.ok(Array.isArray(res.body.storageEnv.candidates));
    const asText = JSON.stringify(res.body);
    for (const name of ['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']) {
      const value = process.env[name];
      if (value) assert.ok(!asText.includes(value), `${name} value leaked`);
    }
  });

  await check('a GET names what is missing when it is not configured', async () => {
    const saved = process.env.DISCORD_PUBLIC_KEY;
    delete process.env.DISCORD_PUBLIC_KEY;
    const res = makeRes();
    await handler(makeReq('GET', '', {}), res);
    assert.strictEqual(res.body.ready, false);
    assert.ok(res.body.missing.includes('DISCORD_PUBLIC_KEY'));
    process.env.DISCORD_PUBLIC_KEY = saved;
  });

  await check('a missing public key refuses everything rather than trusting it', async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const body = JSON.stringify({ type: 1 });
    const res = makeRes();
    await handler(
      makeReq('POST', body, {
        'x-signature-ed25519': sign('100', body),
        'x-signature-timestamp': '100',
      }),
      res
    );
    assert.strictEqual(res.code, 500);
  });

  if (previous === undefined) delete process.env.DISCORD_PUBLIC_KEY;
  else process.env.DISCORD_PUBLIC_KEY = previous;
}

async function main() {
  await signatures();
  await payloads();
  await endpoint();
  console.log(`\n${checks} checks passed.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
