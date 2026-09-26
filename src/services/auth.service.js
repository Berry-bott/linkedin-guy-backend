'use strict';

const ApiError = require('../utils/ApiError');
const { prisma } = require('../config/prisma');
const env = require('../config/env');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/token');
const { normalisePhone } = require('../utils/phone');
const { sendVerificationEmail } = require('./email.service');
const {
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  verificationCodeExpiry,
} = require('../utils/verification');

/** Minimum gap between two verification emails to the same account. */
const RESEND_COOLDOWN_MS = 60 * 1000;

/** Columns safe to return to a client — never includes `password` or codes. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Issue a fresh verification code for a user and email it.
 * Assumes the caller has already checked the resend cooldown.
 */
async function issueAndSendVerificationCode(user) {
  const code = generateVerificationCode();
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: hashVerificationCode(code),
      emailVerificationCodeExpiresAt: verificationCodeExpiry(now),
      emailVerificationCodeAttempts: 0,
      emailVerificationLastSentAt: now,
    },
    select: { id: true },
  });

  await sendVerificationEmail({ name: user.name, email: user.email, code });
}

/**
 * Create a new account and email it a verification code.
 * The account stays unverified (and cannot log in) until the code is confirmed.
 *
 * @throws {ApiError} 409 when the email is already registered.
 * @throws {ApiError} 500 when the verification email could not be delivered.
 */
async function register({ name, email, password, phone }) {
  const normalisedEmail = email.trim().toLowerCase();
  const normalisedPhone = normalisePhone(phone);

  const existing = await prisma.user.findFirst({
    where: { email: normalisedEmail },
    select: { email: true },
  });

  if (existing) {
    throw ApiError.conflict('An account with this email already exists.', {
      code: 'EMAIL_IN_USE',
      errors: [{ field: 'email', message: 'This email is already registered.' }],
    });
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalisedEmail,
      phone: normalisedPhone,
      password: hashed,
    },
    select: PUBLIC_FIELDS,
  });

  // The account only exists to receive the code here; if delivery fails, roll
  // it back so the client can retry instead of being stuck unverified.
  try {
    await issueAndSendVerificationCode(user);
  } catch (error) {
    await prisma.user
      .delete({ where: { id: user.id } })
      .catch(() => { /* best effort — the duplicate check above catches retries */ });
    throw error;
  }

  return {
    user,
    message: 'Account created. Check your email for the verification code.',
  };
}

/**
 * Verify the emailed code and activate the account.
 * @throws {ApiError} 400 for bad, expired or exhausted codes.
 */
async function verifyEmail({ email, code }) {
  const normalisedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  // Same message for "no such user", "no code issued" and "wrong code" so the
  // endpoint cannot be used to discover which emails are registered.
  const invalid = ApiError.badRequest('The verification code is invalid.', {
    code: 'INVALID_VERIFICATION_CODE',
    errors: [{ field: 'code', message: 'The verification code is invalid.' }],
  });

  if (!user) throw invalid;

  if (user.emailVerifiedAt) {
    return { user: pickPublicUser(user), message: 'Email already verified. You can log in.' };
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationCodeExpiresAt) throw invalid;

  if (user.emailVerificationCodeAttempts >= env.emailVerificationMaxAttempts) {
    throw ApiError.badRequest('Too many incorrect attempts. Request a new code.', {
      code: 'VERIFICATION_ATTEMPTS_EXCEEDED',
      errors: [{ field: 'code', message: 'Too many incorrect attempts. Request a new code.' }],
    });
  }

  if (user.emailVerificationCodeExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This verification code has expired. Request a new one.', {
      code: 'VERIFICATION_CODE_EXPIRED',
      errors: [{ field: 'code', message: 'This code has expired. Request a new one.' }],
    });
  }

  if (!verificationCodeMatches(code, user.emailVerificationCodeHash)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationCodeAttempts: { increment: 1 } },
      select: { id: true },
    });
    throw invalid;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationCodeExpiresAt: null,
      emailVerificationCodeAttempts: 0,
    },
    select: PUBLIC_FIELDS,
  });

  return { user: updated, message: 'Email verified. You can now log in.' };
}

/**
 * Re-send a verification code. Always returns the same generic message so the
 * endpoint cannot be used to probe registered emails.
 *
 * @throws {ApiError} 409 when called again inside the cooldown window.
 * @throws {ApiError} 500 when the email could not be delivered.
 */
async function resendVerification({ email }) {
  const normalisedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  const genericMessage = 'If that account needs verification, a new code has been sent.';
  if (!user || user.emailVerifiedAt) return { message: genericMessage };

  if (
    user.emailVerificationLastSentAt &&
    Date.now() - user.emailVerificationLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw ApiError.conflict(
      'A code was just sent. Please wait a minute before requesting another.',
      { code: 'VERIFICATION_RESEND_COOLDOWN' },
    );
  }

  await issueAndSendVerificationCode(user);
  return { message: genericMessage };
}

/**
 * Authenticate with email + password.
 * @throws {ApiError} 401 when the credentials are wrong.
 */
async function login({ email, password }) {
  const normalisedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
  });

  // Same message for "no such user" and "wrong password" so the endpoint does
  // not leak which emails are registered.
  const invalid = ApiError.unauthorized('Invalid email or password.', {
    code: 'INVALID_CREDENTIALS',
  });

  if (!user) throw invalid;

  const matches = await comparePassword(password, user.password);
  if (!matches) throw invalid;

  if (!user.emailVerifiedAt) {
    throw ApiError.unauthorized('Please verify your email before logging in.', {
      code: 'EMAIL_NOT_VERIFIED',
      errors: [{ field: 'email', message: 'Check your inbox for the verification code.' }],
    });
  }

  const safeUser = pickPublicUser(user);
  return { user: safeUser, token: signToken(safeUser) };
}


/** Return the current user's profile. */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_FIELDS,
  });

  if (!user) {
    throw ApiError.notFound('User not found.', { code: 'USER_NOT_FOUND' });
  }

  return user;
}

/** Update the current user's profile (name, email and/or phone). */
async function updateProfile(userId, { name, email, phone }) {
  const data = {};

  if (typeof name !== 'undefined') data.name = name.trim();

  if (typeof email !== 'undefined') {
    const normalisedEmail = email.trim().toLowerCase();

    const clash = await prisma.user.findFirst({
      where: { email: normalisedEmail, NOT: { id: userId } },
      select: { id: true },
    });

    if (clash) {
      throw ApiError.conflict('An account with this email already exists.', {
        code: 'EMAIL_IN_USE',
        errors: [{ field: 'email', message: 'This email is already registered.' }],
      });
    }

    data.email = normalisedEmail;
    // A changed address must be re-verified before it can be used to log in.
    data.emailVerifiedAt = null;
    data.emailVerificationCodeHash = null;
    data.emailVerificationCodeExpiresAt = null;
    data.emailVerificationCodeAttempts = 0;
    data.emailVerificationLastSentAt = null;
  }


  // Phone numbers are intentionally NOT unique (a food app lets a household
  // share one number), so changing it needs no clash check.
  if (typeof phone !== 'undefined') {
    data.phone = normalisePhone(phone);
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('No valid fields were provided to update.', {
      code: 'NO_VALID_FIELDS',
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: PUBLIC_FIELDS,
  });
}

/** Change the current user's password after verifying the existing one. */
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.notFound('User not found.', { code: 'USER_NOT_FOUND' });
  }

  const matches = await comparePassword(currentPassword, user.password);
  if (!matches) {
    throw ApiError.unauthorized('Current password is incorrect.', {
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must differ from the current password.', {
      code: 'PASSWORD_UNCHANGED',
      errors: [{ field: 'newPassword', message: 'New password must differ from your current password.' }],
    });
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
    select: { id: true },
  });

  return { message: 'Password updated successfully.' };
}

/** Keep only the columns clients are allowed to see. */
function pickPublicUser(user) {
  const {
    password: _password,
    emailVerificationCodeHash: _codeHash,
    ...safeUser
  } = user;
  return safeUser;
}

module.exports = {
  PUBLIC_FIELDS,
  register,
  login,
  verifyEmail,
  resendVerification,
  getProfile,
  updateProfile,
  changePassword,
};
