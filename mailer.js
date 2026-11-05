// Email alerts for new contact-form leads. Entirely optional: if SMTP isn't
// configured in .env, sendLeadAlert() quietly does nothing and leads still
// land on the Leads page as before.
const fs = require('fs');
const nodemailer = require('nodemailer');

function isConfigured() {
  return !!(process.env.MAIL_CAPTURE_FILE || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.MAIL_CAPTURE_FILE) {
    // test hook: don't send anything, just record what would have been sent
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

const oneLine = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();

async function sendLeadAlert({ to, siteName, lead, leadsUrl, photoUrl }) {
  if (!isConfigured() || !to) return false;
  const lines = [
    `You have a new message from your website "${siteName}".`,
    '',
    `Name:    ${oneLine(lead.name) || '(not given)'}`,
    `Email:   ${oneLine(lead.email) || '(not given)'}`,
    `Phone:   ${oneLine(lead.phone) || '(not given)'}`,
    lead.service ? `Service: ${oneLine(lead.service)}` : null,
    ...((lead.answers || []).length ? ['', ...lead.answers.map(a => `${oneLine(a.label)}: ${oneLine(a.value)}`)] : []),
    '',
    'Message:',
    lead.message || '(no message)',
  ];
  if (photoUrl) lines.push('', `Photo attached: ${photoUrl}`);
  lines.push('', `See all messages: ${leadsUrl}`);

  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'alerts@localhost',
    to,
    replyTo: lead.email || undefined,
    subject: oneLine(`New message from ${lead.name || 'a visitor'} — ${siteName}`).slice(0, 200),
    text: lines.filter(l => l !== null).join('\n')
  });
  if (process.env.MAIL_CAPTURE_FILE) {
    fs.appendFileSync(process.env.MAIL_CAPTURE_FILE, info.message + '\n');
  }
  return true;
}

// Short receipt sent to the person who filled in the form.
async function sendAutoReply({ to, siteName, text, replyTo }) {
  if (!isConfigured() || !to) return false;
  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'alerts@localhost',
    to,
    replyTo: replyTo || undefined,
    subject: oneLine(`We received your request — ${siteName}`).slice(0, 200),
    text: `${text}\n\n— ${siteName}`
  });
  if (process.env.MAIL_CAPTURE_FILE) fs.appendFileSync(process.env.MAIL_CAPTURE_FILE, info.message + '\n');
  return true;
}

async function sendMail(msg) {
  const info = await getTransporter().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || 'alerts@localhost', ...msg });
  if (process.env.MAIL_CAPTURE_FILE) fs.appendFileSync(process.env.MAIL_CAPTURE_FILE, info.message + '\n');
  return true;
}

// Asks a past customer to review the business (sent by the owner on purpose).
async function sendReviewRequest({ to, name, siteName, link, replyTo }) {
  if (!isConfigured() || !to) return false;
  return sendMail({
    to, replyTo: replyTo || undefined,
    subject: oneLine(`How did we do? — ${siteName}`).slice(0, 200),
    text: `Hi${oneLine(name) ? ' ' + oneLine(name) : ''},\n\nThank you for choosing ${siteName}. If you have a minute, we would really appreciate a short review of your experience:\n\n${link}\n\nThank you!\n— ${siteName}`
  });
}

// Tells the owner a customer submitted a review that needs approving.
async function sendReviewAlert({ to, siteName, review, reviewsUrl }) {
  if (!isConfigured() || !to) return false;
  return sendMail({
    to,
    subject: oneLine(`New review to approve (${review.rating}/5) — ${siteName}`).slice(0, 200),
    text: `${oneLine(review.name) || 'A customer'} left a ${review.rating}-star review for "${siteName}":\n\n${review.quote}\n\nApprove or reject it here: ${reviewsUrl}`
  });
}

// Plain-text activity report sent to the business owner.
async function sendReport({ to, subject, text, replyTo }) {
  if (!isConfigured() || !to) return false;
  return sendMail({ to, replyTo: replyTo || undefined, subject: oneLine(subject).slice(0, 200), text });
}

// The payment link the owner sends to a client to start their hosting plan.
async function sendPaymentLink({ to, siteName, link, replyTo }) {
  if (!isConfigured() || !to) return false;
  return sendMail({
    to, replyTo: replyTo || undefined,
    subject: oneLine(`Website hosting for ${siteName}`).slice(0, 200),
    text: `Hello,\n\nHere is the secure link to set up hosting for the ${siteName} website. Payment is handled by Stripe; we never see your card details.\n\n${link}\n\nThe link works for 24 hours. If it has expired, just ask and we will send a new one.\n\nThank you!`
  });
}

// Tells the owner a customer asked for (or made) an appointment.
async function sendBookingAlert({ to, siteName, summary, bookingsUrl, replyTo, needsAction }) {
  if (!isConfigured() || !to) return false;
  return sendMail({
    to, replyTo: replyTo || undefined,
    subject: oneLine(`${needsAction ? 'New booking request' : 'New booking'} — ${siteName}`).slice(0, 200),
    text: `${summary}\n\n${needsAction ? 'Confirm or decline it here' : 'See all bookings here'}: ${bookingsUrl}`
  });
}

// Tells the customer what happened to their booking (received / confirmed / declined / cancelled).
async function sendBookingCustomer({ to, siteName, subject, text, replyTo }) {
  if (!isConfigured() || !to) return false;
  return sendMail({ to, replyTo: replyTo || undefined, subject: oneLine(`${subject} — ${siteName}`).slice(0, 200), text: `${text}\n\n— ${siteName}` });
}

module.exports = { sendBookingAlert, sendBookingCustomer, sendPaymentLink, isConfigured, sendLeadAlert, sendAutoReply, sendReviewRequest, sendReviewAlert, sendReport };
