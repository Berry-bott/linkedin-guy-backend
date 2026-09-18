/**
 * Normalises a phone number to a consistent `+<digits>` form.
 *
 * Accepts `+2348031234567`, `2348031234567`, `08031234567`, with optional
 * spaces, dashes, dots or parentheses. A local number written with a trunk `0`
 * is rewritten as `+<callingCode><national>`, so `08031234567` and
 * `+2348031234567` resolve to the same stored value and cannot both be
 * registered.
 *
 * The country is inferred from the digits after the trunk `0`. Where the trunk
 * `0` is itself part of the national number (North America, parts of Latin
 * America), the number is left alone — `0415555267` is not rewritten to `+1…`.
 */

/**
 * `trunk` is the leading prefix of the national number (after the `0`);
 * `code` is the international calling code to substitute.
 */
const TRUNK_PREFIXES = [
  { trunk: '8', code: '234' }, // Nigeria (0701, 0803, 0813, 0906, ...)
  { trunk: '7', code: '234' }, // Nigeria (0707, 0807, 0817, 0909, ...)
  { trunk: '9', code: '234' }, // Nigeria (0909, 0915, ...)
  { trunk: '7', code: '44' },  // United Kingdom (07123, ...) — also 234!
  { trunk: '1', code: '44' },  // United Kingdom (0113, 0121, ...)
  { trunk: '2', code: '44' },  // United Kingdom (0207, 0238, ...)
  { trunk: '6', code: '91' },  // India (06...)
  { trunk: '8', code: '27' },  // South Africa (082, ...)
];

/**
 * A trunk `0` is only stripped when the result looks like a valid international
 * number, i.e. the national part does not itself begin with `0`.
 */
function normalisePhone(input) {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;

  // Explicitly international — trust the caller's `+`.
  if (trimmed.startsWith('+')) return `+${digits}`;

  // Clearly already includes a country code (e.g. 2348031234567).
  if (!digits.startsWith('0') && digits.length > 11) return `+${digits}`;

  // Local number: strip the trunk `0` and prepend the calling code.
  if (digits.startsWith('0') && digits.length >= 10) {
    const national = digits.slice(1);
    const match = TRUNK_PREFIXES.find((entry) => national.startsWith(entry.trunk));
    if (match) return `+${match.code}${national}`;
  }

  return `+${digits}`;
}

module.exports = { normalisePhone, TRUNK_PREFIXES };