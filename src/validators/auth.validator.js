'use strict';

const { body } = require('express-validator');
const { passwordRule } = require('../utils/validate');
const { normalisePhone } = require('../utils/phone');

/** POST /api/auth/register */
const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .bail()
    .isString()
    .bail(),
  passwordRule(body('password')),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required.')
    .bail()
    .isString()
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required.')
    .customSanitizer((value) => normalisePhone(value) || value)
    .custom((value) => {
      if (!/^\+\d{8,15}$/.test(value)) {
        throw new Error('Please provide a valid phone number (8-15 digits, optional +).');
      }
      return true;
    }),
];

/** POST /api/auth/login */
const loginRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

/** PATCH /api/auth/me */
const updateProfileRules = [
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('name')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters.'),
  body('phone')
    .optional()
    .trim()
    .customSanitizer((value) => normalisePhone(value) || value)
    .custom((value) => {
      if (!/^\+\d{8,15}$/.test(value)) {
        throw new Error('Please provide a valid phone number (8-15 digits, optional +).');
      }
      return true;
    }),
  body().custom((value) => {
    const fields = ['name', 'email', 'phone'];
    if (!fields.some((field) => typeof value[field] !== 'undefined')) {
      throw new Error('Provide at least one of "name", "email" or "phone".');
    }
    return true;
  }),
];

/** POST /api/auth/change-password */
const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').notEmpty().withMessage('New password is required.').bail().isString().bail(),
  passwordRule(body('newPassword')),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required.')
    .bail()
    .isString()
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
];

/** POST /api/auth/verify-email */
const verifyEmailRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Verification code is required.')
    .isString()
    .bail()
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be 6 digits.')
    .bail()
    .matches(/^\d{6}$/)
    .withMessage('Verification code must be 6 digits.'),
];

/** POST /api/auth/resend-verification */
const resendVerificationRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
];

module.exports = {
  registerRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
  verifyEmailRules,
  resendVerificationRules,
};
