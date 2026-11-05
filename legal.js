// Privacy policy + terms pages, written from what the site really does.
// Nothing is claimed that the site does not do: each paragraph is included only when it applies.
// This is a starting template, not legal advice (the editor and the pages' owner notes say so).

function clean(l) {
  l = l || {};
  const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  return {
    enabled: !!l.enabled,
    ownerName: s(l.ownerName, 120),
    email: s(l.email, 254),
    address: s(l.address, 200),
    state: s(l.state, 60),
    updated: s(l.updated, 40),
    banner: l.banner === 'always' ? 'always' : '',
    privacyExtra: s(l.privacyExtra, 3000),
    termsExtra: s(l.termsExtra, 3000)
  };
}

function monthYear(d = new Date()) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// what this site actually does with visitor information
function facts(site) {
  const sec = site.sections || {};
  const contact = sec.contact || {};
  const meta = sec.meta || {};
  const book = sec.booking || {};
  const form = contact.form || {};
  return {
    form: !!contact.acceptSubmissions,
    photoUpload: !!contact.acceptSubmissions && Array.isArray(form.fields) && form.fields.some(f => f.type === 'photo'),
    booking: !!book.enabled,
    reviews: !!(sec.testimonials && !((site.layout || {}).hidden || []).includes('testimonials')),
    analytics: !!(meta.gaId || meta.metaPixelId),
    ga: !!meta.gaId,
    pixel: !!meta.metaPixelId,
    ask: meta.trackingMode !== 'always',
    chat: !!(sec.chat && sec.chat.enabled),
    members: !!(sec.members && sec.members.enabled)
  };
}

function build(site) {
  const L = clean((site.sections || {}).legal);
  const f = facts(site);
  const who = L.ownerName || site.name;
  const contactEmail = L.email || ((site.sections.contact || {}).email) || '';
  const contactBits = [contactEmail, (site.sections.contact || {}).phone, L.address || (site.sections.contact || {}).address].filter(Boolean);
  const updated = L.updated || monthYear();

  const priv = [];
  priv.push({ h: 'Who we are', p: [`This website is run by ${who}. This page explains what information the site collects and what we do with it. If you have questions, contact us${contactBits.length ? ': ' + contactBits.join(' · ') : ''}.`] });

  const collect = [];
  if (f.form) collect.push('When you send us a message or request through a form on this site, we receive what you type into it (for example your name, email address, phone number and message)' + (f.photoUpload ? ', plus any photo you choose to attach' : '') + '.');
  if (f.booking) collect.push('When you request a booking, we receive the details you enter (such as your name, contact details, the service and time you chose, and any notes).');
  if (f.members) collect.push('If you create an account for the members area, we keep your name, email address and a scrambled (hashed) version of your password, and the time you last logged in.');
  collect.push('Like most websites, our server keeps a simple count of page visits. This count does not use cookies and is not tied to your name.');
  collect.push('We also count taps on buttons such as call, email and directions, without recording who tapped them.');
  priv.push({ h: 'What we collect', p: collect });

  const use = [];
  if (f.members) use.push('We use your account details only to let you log in and to contact you about your account.');
  if (f.form || f.booking) use.push('We use the details you send only to reply to you, provide the service you asked about, and keep a record of the request. We do not sell your information.');
  else use.push('This site does not have a form that collects personal details. If you contact us by phone or email, we use what you send only to reply to you.');
  priv.push({ h: 'How we use it', p: use });

  const third = [];
  third.push('Pages on this site load fonts from Google Fonts, so your browser contacts Google when a page opens. Google receives your IP address as part of that request.');
  if (f.analytics) {
    const names = [f.ga ? 'Google Analytics' : '', f.pixel ? 'Meta Pixel' : ''].filter(Boolean).join(' and ');
    third.push(`We use ${names} to understand how people find and use this site${f.pixel ? ' and how our ads perform' : ''}. These tools set cookies and send information such as pages viewed and your device and approximate location to ${f.ga && f.pixel ? 'Google and Meta' : f.ga ? 'Google' : 'Meta'}. ` + (f.ask ? 'They load only after you click Accept on the cookie notice, and you can decline.' : 'They load when you visit the site.'));
  }
  if (f.chat) third.push('This site has a chat assistant. What you type into it is sent to an AI service (Anthropic) so it can write a reply. We do not save chat messages unless you choose to send us your contact details, in which case the conversation is included with your request.');
  third.push('Some pages may show a Google map. Viewing it sends your IP address to Google.');
  priv.push({ h: 'Other companies that see some information', p: third });

  priv.push({ h: 'Cookies and similar storage', p: [
    f.analytics
      ? (f.ask ? 'We remember your cookie choice in your browser so we do not keep asking. Analytics cookies are used only if you accept.' : 'Analytics cookies are used on this site, as described above.')
      : 'This site does not use advertising or analytics cookies. It may store small settings in your browser, such as whether you closed a notice.',
    'You can clear or block cookies in your browser settings.'
  ] });

  priv.push({ h: 'How long we keep it', p: ['We keep messages and requests for as long as we need them to help you and run our business, then delete them when they are no longer needed.'] });
  priv.push({ h: 'Your choices', p: [`You can ask us what we hold about you, ask us to correct it, or ask us to delete it${contactEmail ? ' by emailing ' + contactEmail : ' by contacting us using the details above'}. Depending on where you live, you may have additional rights under local law.`] });
  priv.push({ h: 'Children', p: ['This site is meant for adults and is not directed at children under 13. We do not knowingly collect information from children.'] });
  priv.push({ h: 'Changes', p: ['If we change how the site handles information, we will update this page and the date below.'] });
  if (L.privacyExtra) priv.push({ h: 'Additional information', p: L.privacyExtra.split(/\n{2,}|\r\n\r\n/).map(x => x.trim()).filter(Boolean) });

  const terms = [];
  terms.push({ h: 'About this site', p: [`This website is provided by ${who}. By using it you agree to these terms. If you do not agree, please do not use the site.`] });
  terms.push({ h: 'Information on the site', p: ['We work to keep the information here accurate, but descriptions, prices, hours and availability can change. Please confirm details with us before you rely on them.'] });
  if (f.form || f.booking) terms.push({ h: 'Requests and bookings', p: [f.booking ? 'Sending a message or a booking request does not by itself create an agreement. A booking is only set once we confirm it to you.' : 'Sending a message or request through this site does not by itself create an agreement. Services are agreed with us directly.'] });
  terms.push({ h: 'Your use of the site', p: ['Please use the site lawfully. Do not try to disrupt it, gain access to parts you are not meant to see, or send us anything harmful or unlawful.'] });
  terms.push({ h: 'Our content', p: [`The text, photos and design on this site belong to ${who} or are used with permission. You may view and share links to pages, but please do not copy the content for another business without asking.`] });
  terms.push({ h: 'Links to other sites', p: ['This site may link to other websites. We do not control them and are not responsible for their content or practices.'] });
  terms.push({ h: 'Limits on our responsibility', p: ['The site is provided as is. To the extent the law allows, we are not responsible for losses that result from using the site or relying on its content.'] });
  terms.push({ h: 'Governing law', p: [L.state ? `These terms are governed by the laws of the State of ${L.state.replace(/^state of /i, '')}.` : 'These terms are governed by the laws that apply where our business is located.'] });
  terms.push({ h: 'Contact', p: [contactBits.length ? `Questions about these terms: ${contactBits.join(' · ')}.` : 'Questions about these terms can be sent to us using the contact details on this site.'] });
  if (L.termsExtra) terms.push({ h: 'Additional terms', p: L.termsExtra.split(/\n{2,}|\r\n\r\n/).map(x => x.trim()).filter(Boolean) });

  return {
    privacy: { title: 'Privacy Policy', updated, sections: priv },
    terms: { title: 'Terms of Use', updated, sections: terms }
  };
}

const PAGES = ['privacy', 'terms'];
function enabled(site) { return !!(site.sections && site.sections.legal && site.sections.legal.enabled); }

// a cookie/notice bar is wanted when tracking asks for consent, or the owner chose a notice on every page
function bannerMode(site, trackingOn, trackingMode) {
  const L = (site.sections || {}).legal || {};
  if (trackingOn && trackingMode === 'ask') return 'consent';
  if (L.enabled && L.banner === 'always') return 'notice';
  return '';
}

module.exports = { clean, facts, build, PAGES, enabled, bannerMode, monthYear };
