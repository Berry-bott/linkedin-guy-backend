'use strict';

const { Router } = require('express');

const authService = require('../services/auth.service');
const { validate } = require('../utils/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  registerRules,
  loginRules,
  updateProfileRules,
  changePasswordRules,
  verifyEmailRules,
  resendVerificationRules,
} = require('../validators/auth.validator');

const router = Router();

/** POST /api/auth/register — create an unverified account and email a code. */
router.post(
  '/register',
  registerRules,
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;
    const result = await authService.register({ name, email, password, phone });

    res.status(201).json({
      success: true,
      message: result.message,
      data: { user: result.user },
    });
  }),
);

/** POST /api/auth/verify-email — confirm the emailed code. */
router.post(
  '/verify-email',
  verifyEmailRules,
  validate,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const result = await authService.verifyEmail({ email, code });

    res.status(200).json({
      success: true,
      message: result.message,
      data: { user: result.user },
    });
  }),
);

/** POST /api/auth/resend-verification — email a fresh code. */
router.post(
  '/resend-verification',
  resendVerificationRules,
  validate,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.resendVerification({ email });

    res.status(200).json({ success: true, message: result.message });
  }),
);


/** POST /api/auth/login — exchange credentials for a token. */
router.post(
  '/login',
  loginRules,
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: result,
    });
  }),
);

/** GET /api/auth/me — the authenticated user's profile. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: { user: req.user } });
  }),
);

/** PATCH /api/auth/me — update the authenticated user's profile. */
router.patch(
  '/me',
  requireAuth,
  updateProfileRules,
  validate,
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  }),
);

/** POST /api/auth/change-password — rotate the authenticated user's password. */
router.post(
  '/change-password',
  requireAuth,
  changePasswordRules,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.changePassword(req.user.id, req.body);

    res.status(200).json({ success: true, message: result.message });
  }),
);

module.exports = router;
