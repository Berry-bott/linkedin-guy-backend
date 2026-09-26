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
  const confirmPassword = password;
  const newPassword = 'NewPassw456';

  console.log(`\nRunning auth smoke test against ${BASE_URL}\n`);

  const health = await request('GET', '/api/health');
  check('health returns 200', health.status === 200, `got ${health.status}`);

  const missingAll = await request('POST', '/api/auth/register', { body: {} });
  check(
    'register with no fields returns 400',
    missingAll.status === 400 && missingAll.body?.errors?.length >= 5,
    `got ${missingAll.status}`,
  );

  const noName = await request('POST', '/api/auth/register', {
    body: { email, password, confirmPassword, phone },
  });
  check('register without name returns 400', noName.status === 400, `got ${noName.status}`);

  const noPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, confirmPassword },
  });
  check('register without phone returns 400', noPhone.status === 400, `got ${noPhone.status}`);

  const mismatchedPassword = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, confirmPassword: 'Different1', phone },
  });
  check(
    'mismatched confirmPassword returns 400',
    mismatchedPassword.status === 400,
    `got ${mismatchedPassword.status}`,
  );

  const badPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, confirmPassword, phone: 'abc' },
  });
  check('register with invalid phone returns 400', badPhone.status === 400, `got ${badPhone.status}`);

  const ok = await request('POST', '/api/auth/register', {
    body: { name: 'Smoke Tester', email, password, confirmPassword, phone },
  });
  check('register with all 5 fields returns 201', ok.status === 201, `got ${ok.status}`);
  check('register does not return a token before verification', ok.body?.data?.token === undefined);
  check('register marks the account unverified', ok.body?.data?.user?.emailVerifiedAt == null);
  check('register does not leak password', ok.body?.data?.user?.password === undefined);
  check('register stores the name', ok.body?.data?.user?.name === 'Smoke Tester');
  check('register stores the phone', ok.body?.data?.user?.phone === phone);

  // Phone numbers are NOT unique in this app (a food-ordering app lets a
  // household share one number), so a second account may reuse the same value,
  // including a differently-formatted spelling of it.
  const localFormat = phone.replace('+234', '0');
  const localDup = await request('POST', '/api/auth/register', {
    body: {
      name: 'Local Person',
      email: `local${stamp}@example.com`,
      password,
      confirmPassword,
      phone: localFormat,
    },
  });
  check(
    'repeated phone (local format) is allowed',
    localDup.status === 201,
    `got ${localDup.status} ${localDup.body?.code ?? ''}`,
  );
  check(
    'repeated phone is normalised to the same stored value',
    localDup.body?.data?.user?.phone === phone,
    `got ${localDup.body?.data?.user?.phone}`,
  );

  const dupPhone = await request('POST', '/api/auth/register', {
    body: { name: 'Other Person', email: `other${stamp}@example.com`, password, confirmPassword, phone },
  });
  check('repeated phone returns 201', dupPhone.status === 201, `got ${dupPhone.status}`);
  check('repeated phone is not rejected as PHONE_IN_USE', dupPhone.body?.code !== 'PHONE_IN_USE');

  const dup = await request('POST', '/api/auth/register', {
    body: {
      name: 'Smoke Tester',
      email,
      password,
      confirmPassword,
      phone: `+23481${String(stamp).slice(-8)}`,
    },
  });
  check('duplicate email returns 409', dup.status === 409, `got ${dup.status}`);

  const bad = await request('POST', '/api/auth/register', {
    body: { name: 'X', email: 'not-an-email', password: 'weak', confirmPassword: 'weak', phone: '1' },
  });
  check('invalid payload returns 400', bad.status === 400, `got ${bad.status}`);
  check('validation returns field errors', Array.isArray(bad.body?.errors));

  const preVerifyLogin = await request('POST', '/api/auth/login', { body: { email, password } });
  check(
    'login before verification returns 401 EMAIL_NOT_VERIFIED',
    preVerifyLogin.status === 401 && preVerifyLogin.body?.code === 'EMAIL_NOT_VERIFIED',
    `got ${preVerifyLogin.status} ${preVerifyLogin.body?.code}`,
  );

  const badCode = await request('POST', '/api/auth/verify-email', {
    body: { email, code: '000000' },
  });
  check(
    'wrong verification code returns 400',
    badCode.status === 400 && badCode.body?.code === 'INVALID_VERIFICATION_CODE',
    `got ${badCode.status} ${badCode.body?.code}`,
  );

  const codeFromEnv = process.env.SMOKE_VERIFICATION_CODE;
  let token;
  if (codeFromEnv) {
    const verified = await request('POST', '/api/auth/verify-email', {
      body: { email, code: codeFromEnv },
    });
    check(
      'verify-email with SMOKE_VERIFICATION_CODE returns 200',
      verified.status === 200,
      `got ${verified.status} ${verified.body?.code || ''}`,
    );

    const resend = await request('POST', '/api/auth/resend-verification', { body: { email } });
    check(
      'resend-verification returns 200 (or 409 inside the cooldown)',
      resend.status === 200 || resend.status === 409,
      `got ${resend.status}`,
    );

    const login = await request('POST', '/api/auth/login', { body: { email, password } });
    check('login after verification returns 200', login.status === 200, `got ${login.status}`);
    check('login does not leak password', login.body?.data?.user?.password === undefined);
    token = login.body?.data?.token;
  } else {
    console.log(
      '  SKIP  full verification/login checks — set SMOKE_VERIFICATION_CODE (from the server log) to run them',
    );
  }

  const wrong = await request('POST', '/api/auth/login', {
    body: { email, password: 'TotallyWrong1' },
  });
  check('wrong password returns 401', wrong.status === 401, `got ${wrong.status}`);

  const noToken = await request('GET', '/api/auth/me');
  check('missing token returns 401', noToken.status === 401, `got ${noToken.status}`);

  const badToken = await request('GET', '/api/auth/me', { token: 'garbage.token.here' });
  check('invalid token returns 401', badToken.status === 401, `got ${badToken.status}`);

  if (token) {
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
      body: { currentPassword: 'Nope12345', newPassword, confirmPassword: newPassword },
    });
    check('wrong current password returns 401', wrongCurrent.status === 401, `got ${wrongCurrent.status}`);

    const changed = await request('POST', '/api/auth/change-password', {
      token,
      body: { currentPassword: password, newPassword, confirmPassword: newPassword },
    });
    check('change-password returns 200', changed.status === 200, `got ${changed.status}`);

    const loginNew = await request('POST', '/api/auth/login', {
      body: { email, password: newPassword },
    });
    check('login with new password works', loginNew.status === 200, `got ${loginNew.status}`);

    const loginOld = await request('POST', '/api/auth/login', { body: { email, password } });
    check('old password no longer works', loginOld.status === 401, `got ${loginOld.status}`);
  } else {
    console.log('  SKIP  authenticated profile/password checks — no token (see above)');
  }

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