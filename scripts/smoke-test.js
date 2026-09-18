'use strict';

/**
 * Manual smoke test for the auth module.
 *
 * Usage: node scripts/smoke-test.js [baseUrl]
 *
 * Exercises the full auth lifecycle against a running server and prints a
 * pass/fail summary. Requires a reachable database (Neon).
 */

const BASE_URL = process.argv[2] || 'http://localhost:5000';

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function request(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json };
}

async function main() {
  const stamp = Date.now();
  const email = `smoke${stamp}@example.com`;
  const phone = `+23480${String(stamp).slice(-8)}`;
  const password = 'Passw0rd123';
  const newPassword = 'NewPassw456';

  console.log(`\nRunning auth smoke test against ${BASE_URL}\n`);

  const health = await request('GET', '/api/health');
  check('health returns 200', health.status === 200, `got ${health.status}`);

  const missingAll = await request('POST', '/api/auth/register', { body: {} });
  check(
    'register with no fields returns 400',
    missingAll.status === 400 && missingAll.body?.errors?.length >= 4,
    `got ${missingAll.status}`,
  );

  const noName = await request('POST', '/api/auth/register', {
    body: { email, password, phone },
  });
  check('register without name returns 400', noName.status === 400, `got ${noName.status}`);

  const noPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password },
  });
  check('register without phone returns 400', noPhone.status === 400, `got ${noPhone.status}`);

  const badPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, phone: 'abc' },
  });
  check('register with invalid phone returns 400', badPhone.status === 400, `got ${badPhone.status}`);

  const ok = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, phone },
  });
  check('register with all 4 fields returns 201', ok.status === 201, `got ${ok.status}`);
  check('register returns a token', Boolean(ok.body?.data?.token));
  check('register does not leak password', ok.body?.data?.user?.password === undefined);
  check('register stores the name', ok.body?.data?.user?.name === 'Smoke Tester');
  check('register stores the phone', ok.body?.data?.user?.phone === phone);

  // A local-format number must resolve to the same stored value as its
  // international equivalent, so the two cannot be registered separately.
  const localFormat = phone.replace('+234', '0');
  const localDup = await request('POST', '/api/auth/register', {
    body: { name: 'Local Person', email: `local${stamp}@example.com`, password, phone: localFormat },
  });
  check(
    'local-format phone is treated as a duplicate',
    localDup.status === 409 && localDup.body?.code === 'PHONE_IN_USE',
    `got ${localDup.status} ${localDup.body?.code}`,
  );

  const token = ok.body?.data?.token;

  const dupPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Other Person', email: `other${stamp}@example.com`, password, phone },
  });
  check('duplicate phone returns 409', dupPhone.status === 409, `got ${dupPhone.status}`);
  check('duplicate phone code is PHONE_IN_USE', dupPhone.body?.code === 'PHONE_IN_USE');

  const dup = await request('POST', '/api/auth/register', {
    body: {
      name: 'Smoke Tester',
      email,
      password,
      phone: `+23481${String(stamp).slice(-8)}`,
    },
  });
  check('duplicate email returns 409', dup.status === 409, `got ${dup.status}`);

  const bad = await request('POST', '/api/auth/register', {
    body: { name: 'X', email: 'not-an-email', password: 'weak', phone: '1' },
  });
  check('invalid payload returns 400', bad.status === 400, `got ${bad.status}`);
  check('validation returns field errors', Array.isArray(bad.body?.errors));

  const login = await request('POST', '/api/auth/login', { body: { email, password } });
  check('login returns 200', login.status === 200, `got ${login.status}`);
  check('login does not leak password', login.body?.data?.user?.password === undefined);

  const wrong = await request('POST', '/api/auth/login', {
    body: { email, password: 'TotallyWrong1' },
  });
  check('wrong password returns 401', wrong.status === 401, `got ${wrong.status}`);

  const noToken = await request('GET', '/api/auth/me');
  check('missing token returns 401', noToken.status === 401, `got ${noToken.status}`);

  const badToken = await request('GET', '/api/auth/me', { token: 'garbage.token.here' });
  check('invalid token returns 401', badToken.status === 401, `got ${badToken.status}`);

  const me = await request('GET', '/api/auth/me', { token });
  check('GET /me with token returns 200', me.status === 200, `got ${me.status}`);
  check('GET /me returns the right user', me.body?.data?.user?.email === email);
  check('GET /me includes the phone', me.body?.data?.user?.phone === phone);

  const patch = await request('PATCH', '/api/auth/me', {
    token,
    body: { name: 'Renamed Tester' },
  });
  check('PATCH /me returns 200', patch.status === 200, `got ${patch.status}`);
  check('PATCH /me updates the name', patch.body?.data?.user?.name === 'Renamed Tester');

  const patchPhone = await request('PATCH', '/api/auth/me', {
    token,
    body: { phone: `+23481${String(stamp).slice(-8)}` },
  });
  check('PATCH /me updates the phone', patchPhone.status === 200, `got ${patchPhone.status}`);

  const patchEmpty = await request('PATCH', '/api/auth/me', { token, body: {} });
  check('PATCH /me with no fields returns 400', patchEmpty.status === 400, `got ${patchEmpty.status}`);

  const wrongCurrent = await request('POST', '/api/auth/change-password', {
    token,
    body: { currentPassword: 'Nope12345', newPassword },
  });
  check('wrong current password returns 401', wrongCurrent.status === 401, `got ${wrongCurrent.status}`);

  const changed = await request('POST', '/api/auth/change-password', {
    token,
    body: { currentPassword: password, newPassword },
  });
  check('change-password returns 200', changed.status === 200, `got ${changed.status}`);

  const loginNew = await request('POST', '/api/auth/login', {
    body: { email, password: newPassword },
  });
  check('login with new password works', loginNew.status === 200, `got ${loginNew.status}`);

  const loginOld = await request('POST', '/api/auth/login', { body: { email, password } });
  check('old password no longer works', loginOld.status === 401, `got ${loginOld.status}`);

  const notFound = await request('GET', '/api/does-not-exist');
  check('unknown route returns 404', notFound.status === 404, `got ${notFound.status}`);

  const allowed = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://chuks-kitchen-seven.vercel.app',
      'Access-Control-Request-Method': 'POST',
    },
  });
  check('CORS allows the production origin', allowed.status === 204, `got ${allowed.status}`);

  const denied = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
  });
  check('CORS rejects an unknown origin', denied.status === 403, `got ${denied.status}`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});