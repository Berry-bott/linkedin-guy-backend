// 'use strict';

// const nodemailer = require('nodemailer');
// const env = require('../config/env');
// const ApiError = require('../utils/ApiError');

// /**
//  * Lazily created shared transport. Creating it at module load would throw in
//  * environments that have not configured SMTP yet, which would break the whole
//  * app instead of just email delivery.
//  */
// let transporter;

// function getTransporter() {
//   if (!env.smtpHost) {
//     // Development fallback handled by the caller (code is logged instead).
//     if (env.emailLogVerificationCode) return null;
//     throw ApiError.internal(
//       'Email delivery is not configured. Set SMTP_HOST (and friends) in the environment.',
//       { code: 'EMAIL_NOT_CONFIGURED' },
//     );
//   }

//   // if (!transporter) {
//   //   transporter = nodemailer.createTransport({
//   //     host: env.smtpHost,
//   //     port: env.smtpPort,
//   //     secure: env.smtpSecure,
//   //     // `family` forces the IP version for the socket. Without it, Node may pick
//   //     // Gmail's AAAA record and fail with ENETUNREACH on IPv6-less hosts.
//   //     family: env.smtpFamily,
//   //     auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
//   //     // Fail fast instead of leaving a request hanging on a dead SMTP host.
//   //     connectionTimeout: 10_000,
//   //     greetingTimeout: 10_000,
//   //     socketTimeout: 20_000,
//   //   });
//   // }
//   if (!transporter) {
//   console.log('[email] SMTP config:', {
//     host: env.smtpHost,
//     port: env.smtpPort,
//     secure: env.smtpSecure,
//     family: env.smtpFamily,
//     hasUser: Boolean(env.smtpUser),
//     hasPassword: Boolean(env.smtpPass),
//   });

//   // transporter = nodemailer.createTransport({
//   //   host: env.smtpHost,
//   //   port: env.smtpPort,
//   //   secure: env.smtpSecure,
//   //   family: env.smtpFamily,
//   //   auth: env.smtpUser
//   //     ? { user: env.smtpUser, pass: env.smtpPass }
//   //     : undefined,
//   //   connectionTimeout: 10_000,
//   //   greetingTimeout: 10_000,
//   //   socketTimeout: 20_000,
//   // });
//   transporter = nodemailer.createTransport({
//   host: env.smtpHost,
//   port: env.smtpPort,
//   secure: env.smtpSecure,

//   auth: env.smtpUser
//     ? {
//         user: env.smtpUser,
//         pass: env.smtpPass,
//       }
//     : undefined,

//   // Force smtp.gmail.com to resolve using IPv4.
//   lookup: (hostname, options, callback) => {
//     require('dns').lookup(
//       hostname,
//       {
//         family: 4,
//         all: false,
//       },
//       callback,
//     );
//   },

//   tls: {
//     servername: env.smtpHost,
//   },

//   connectionTimeout: 15_000,
//   greetingTimeout: 15_000,
//   socketTimeout: 30_000,
// });
// }

//   return transporter;
// }

// /**
//  * Send the email-verification message.
//  *
//  * @param {{ name: string, email: string, code: string }} params
//  * @returns {Promise<void>}
//  */
// async function sendVerificationEmail({ name, email, code }) {
//   const minutes = env.emailVerificationCodeTtlMinutes;
//   const verifyUrl = `${env.appUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}`;

//   const text = [
//     `Hi ${name},`,
//     '',
//     'Your verification code is:',
//     '',
//     `    ${code}`,
//     '',
//     `It expires in ${minutes} minutes. Enter it at ${verifyUrl} to activate your account.`,
//     '',
//     'If you did not create an account, you can safely ignore this email.',
//   ].join('\n');

//   const html = `
//     <div style="font-family: Arial, sans-serif; line-height: 1.5;">
//       <p>Hi ${escapeHtml(name)},</p>
//       <p>Use the code below to verify your email address:</p>
//       <p style="font-size: 28px; letter-spacing: 8px; font-weight: bold; margin: 24px 0;">
//         ${escapeHtml(code)}
//       </p>
//       <p>It expires in ${minutes} minutes.</p>
//       <p><a href="${escapeHtml(verifyUrl)}">Verify your email</a></p>
//       <p>If you did not create an account, you can safely ignore this email.</p>
//     </div>
//   `;

//   // Resolved *before* the try block: a missing SMTP configuration is a
//   // deployment problem, not a delivery failure, so it must keep its own
//   // EMAIL_NOT_CONFIGURED message instead of being masked as EMAIL_NOT_SENT.
//   const transport = getTransporter();

//   if (!transport) {
//     // Development escape hatch (never enabled in production): log the code
//     // locally so the flow can be exercised without SMTP credentials.
//     console.warn(`[email] SMTP not configured. Verification code for ${email}: ${code}`);
//     return;
//   }

//   try {
//     await transport.sendMail({
//       from: env.smtpFrom,
//       to: email,
//       subject: 'Verify your email address',
//       text,
//       html,
//     });
//   } catch (error) {
//     // Development escape hatch so the flow can be exercised without SMTP: the
//     // code is logged locally and NEVER enabled in production (see env.js).
//     if (env.emailLogVerificationCode) {
//       console.warn(
//         `[email] SMTP unavailable (${error.message}). Verification code for ${email}: ${code}`,
//       );
//       return;
//     }

//     console.error('[email] Failed to send verification email:', error.message);
//     throw ApiError.internal('We could not send the verification email. Please try again.', {
//       code: 'EMAIL_NOT_SENT',
//     });
//   }
// }

// /** Minimal HTML escaping for the few interpolated values in the template. */
// function escapeHtml(value) {
//   return String(value)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');
// }

// module.exports = { sendVerificationEmail };




'use strict';

const nodemailer = require('nodemailer');
const dns = require('dns');

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Lazily created shared transport.
 * Creating it at module load would throw in environments that have not
 * configured SMTP yet, which would break the whole app instead of just
 * email delivery.
 */
let transporter;

function getTransporter() {
  if (!env.smtpHost) {
    // Development fallback handled by the caller (code is logged instead).
    if (env.emailLogVerificationCode) return null;

    throw ApiError.internal(
      'Email delivery is not configured. Set SMTP_HOST (and friends) in the environment.',
      { code: 'EMAIL_NOT_CONFIGURED' },
    );
  }

  if (!transporter) {
    console.log('[email] SMTP config:', {
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      family: env.smtpFamily,
      hasUser: Boolean(env.smtpUser),
      hasPassword: Boolean(env.smtpPass),
    });

    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,

      auth: env.smtpUser
        ? {
            user: env.smtpUser,
            pass: env.smtpPass,
          }
        : undefined,

      /**
       * Force DNS resolution to IPv4.
       *
       * Render is unable to reach Gmail's IPv6 SMTP addresses,
       * which previously caused:
       * ENETUNREACH 2607:f8b0:...
       */
      lookup: (hostname, options, callback) => {
        dns.lookup(
          hostname,
          {
            family: 4,
            all: false,
          },
          callback,
        );
      },

      /**
       * Keep TLS certificate validation tied to smtp.gmail.com
       * even though the DNS lookup is forced to IPv4.
       */
      tls: {
        servername: env.smtpHost,
      },

      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }

  return transporter;
}

/**
 * Send the email-verification message.
 *
 * @param {{ name: string, email: string, code: string }} params
 * @returns {Promise<void>}
 */
async function sendVerificationEmail({ name, email, code }) {
  const minutes = env.emailVerificationCodeTtlMinutes;

  const verifyUrl =
    `${env.appUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}`;

  const text = [
    `Hi ${name},`,
    '',
    'Your verification code is:',
    '',
    `    ${code}`,
    '',
    `It expires in ${minutes} minutes. Enter it at ${verifyUrl} to activate your account.`,
    '',
    'If you did not create an account, you can safely ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>Hi ${escapeHtml(name)},</p>

      <p>Use the code below to verify your email address:</p>

      <p style="font-size: 28px; letter-spacing: 8px; font-weight: bold; margin: 24px 0;">
        ${escapeHtml(code)}
      </p>

      <p>It expires in ${minutes} minutes.</p>

      <p>
        <a href="${escapeHtml(verifyUrl)}">Verify your email</a>
      </p>

      <p>
        If you did not create an account, you can safely ignore this email.
      </p>
    </div>
  `;

  // Resolve the transporter before the try block so missing SMTP
  // configuration is not incorrectly reported as an email delivery failure.
  const transport = getTransporter();

  if (!transport) {
    // Development escape hatch.
    console.warn(
      `[email] SMTP not configured. Verification code for ${email}: ${code}`,
    );
    return;
  }

  try {
    await transport.sendMail({
      from: env.smtpFrom,
      to: email,
      subject: 'Verify your email address',
      text,
      html,
    });

    console.log(`[email] Verification email sent to ${email}`);
  } catch (error) {
    // Development escape hatch.
    if (env.emailLogVerificationCode) {
      console.warn(
        `[email] SMTP unavailable (${error.message}). Verification code for ${email}: ${code}`,
      );
      return;
    }

    console.error('[email] Failed to send verification email:', error.message);

    throw ApiError.internal(
      'We could not send the verification email. Please try again.',
      {
        code: 'EMAIL_NOT_SENT',
      },
    );
  }
}

/**
 * Minimal HTML escaping for interpolated values.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { sendVerificationEmail };
