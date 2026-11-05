const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 200;
}

function isValidHostname(host) {
  return typeof host === 'string' && host.length <= 253 && HOSTNAME_RE.test(host.trim());
}

// Trims to a max length, always returns a string (never undefined/null).
function str(value, maxLen = 500) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLen);
}

function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim());
}

// Only allow http(s) URLs (or empty) for user-supplied link/image fields,
// to avoid javascript: or data: URIs ending up in href/src attributes.
function isSafeUrl(value) {
  if (!value) return true;
  try {
    const u = new URL(value, 'https://placeholder.invalid');
    return ['http:', 'https:'].includes(u.protocol) || value.startsWith('#') || value.startsWith('/');
  } catch {
    return value.startsWith('#') || value.startsWith('/');
  }
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidHostname,
  isValidHexColor,
  isSafeUrl,
  str
};
