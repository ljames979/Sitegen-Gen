// Visitor login areas: a site can have a members-only page set. Visitors sign up (or are added by the owner),
// log in, and see pages the owner wrote. Everything here is cleaning and small helpers; the routes are in server.js.
const crypto = require('crypto');
const { str, isSafeUrl, isValidEmail } = require('./validate');

const SIGNUP = ['open', 'approval', 'invite'];
const MAX_PAGES = 6;

function clean(m) {
  m = m || {};
  const pages = (Array.isArray(m.pages) ? m.pages : []).map(p => ({
    title: str(p && p.title, 80),
    body: str(p && p.body, 4000),
    linkLabel: str(p && p.linkLabel, 60),
    linkUrl: p && isSafeUrl(p.linkUrl) ? str(p.linkUrl, 500) : ''
  })).filter(p => p.title || p.body).slice(0, MAX_PAGES);
  return {
    enabled: m.enabled === true || m.enabled === '1' || m.enabled === 'on',
    title: str(m.title, 60) || 'Members area',
    navLabel: str(m.navLabel, 24) || 'Members',
    intro: str(m.intro, 400),
    signup: SIGNUP.includes(m.signup) ? m.signup : 'approval',
    pages
  };
}

const normEmail = (e) => str(e, 254).toLowerCase();
const okEmail = (e) => isValidEmail(e);
// bcrypt only reads the first 72 bytes
function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'Choose a password with at least 8 characters.';
  if (Buffer.byteLength(pw) > 72) return 'That password is too long. Use 72 characters or fewer.';
  return '';
}

const newToken = () => crypto.randomBytes(24).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// a hash to compare against when the email is unknown, so "no such account" takes as long as "wrong password"
let dummy = '';
const dummyHash = () => dummy || (dummy = require('bcryptjs').hashSync(crypto.randomBytes(8).toString('hex'), 10));

module.exports = { SIGNUP, MAX_PAGES, clean, normEmail, okEmail, passwordProblem, newToken, hashToken, dummyHash };
