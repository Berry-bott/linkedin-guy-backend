'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CODE_LENGTH,
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  verificationCodeExpiry,
} = require('../src/utils/verification');

test('generateVerificationCode returns a 6-digit numeric string', () => {
  const code = generateVerificationCode();
  assert.equal(code.length, CODE_LENGTH);
  assert.match(code, /^\d{6}$/);
});

test('generateVerificationCode produces different codes', () => {
  const codes = new Set(Array.from({ length: 50 }, generateVerificationCode));
  assert.ok(codes.size > 1, 'expected more than one unique code');
});

test('hashVerificationCode is deterministic and keyed', () => {
  const code = '123456';
  assert.equal(hashVerificationCode(code), hashVerificationCode(code));
  assert.notEqual(hashVerificationCode(code), hashVerificationCode('654321'));
  // The raw code must never appear in the stored hash.
  assert.ok(!hashVerificationCode(code).includes(code));
});

test('verificationCodeMatches accepts only the exact code', () => {
  const stored = hashVerificationCode('483920');
  assert.equal(verificationCodeMatches('483920', stored), true);
  assert.equal(verificationCodeMatches('483921', stored), false);
  assert.equal(verificationCodeMatches('483920', null), false);
  assert.equal(verificationCodeMatches('483920', 'not-a-real-hash'), false);
});

test('verificationCodeExpiry honours the configured TTL', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const expiry = verificationCodeExpiry(from);
  assert.ok(expiry instanceof Date);
  assert.ok(expiry.getTime() > from.getTime());
});
