'use strict';

const ApiError = require('../utils/ApiError');
const { prisma } = require('../config/prisma');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/token');
const { normalisePhone } = require('../utils/phone');

/** Columns safe to return to a client — never includes `password`. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Create a new account.
 * @throws {ApiError} 409 when the email or phone number is already registered.
 */
async function register({ name, email, password, phone }) {
  const normalisedEmail = email.trim().toLowerCase();
  const normalisedPhone = normalisePhone(phone);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalisedEmail }, { phone: normalisedPhone }],
    },
    select: { email: true, phone: true },
  });

    if (existing) {
    if (existing.email === normalisedEmail) {
      throw ApiError.conflict('An account with this email already exists.', {
        code: 'EMAIL_IN_USE',
        errors: [{ field: 'email', message: 'This email is already registered.' }],
      });
    }
    throw ApiError.conflict('An account with this phone number already exists.', {
      code: 'PHONE_IN_USE',
      errors: [{ field: 'phone', message: 'This phone number is already registered.' }],
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

  return { user, token: signToken(user) };
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

  const { password: _password, ...safeUser } = user;
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
  }

  if (typeof phone !== 'undefined') {
    const normalisedPhone = normalisePhone(phone);

    const clash = await prisma.user.findFirst({
      where: { phone: normalisedPhone, NOT: { id: userId } },
      select: { id: true },
    });

    if (clash) {
      throw ApiError.conflict('An account with this phone number already exists.', {
        code: 'PHONE_IN_USE',
        errors: [{ field: 'phone', message: 'This phone number is already registered.' }],
      });
    }

    data.phone = normalisedPhone;
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

module.exports = {
  PUBLIC_FIELDS,
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
};
