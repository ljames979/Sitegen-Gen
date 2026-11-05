// Form builder: lets the site owner replace the standard contact form with
// their own questions, optionally split into steps ("What do you need? ->
// Timeline and budget -> Your details"). Name / email / phone / service /
// message fields still land in the normal Leads columns, so the leads inbox,
// CSV and email alerts keep working; every other answer is stored as a
// labelled list next to the lead.
const TYPES = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['service', 'Service list (from your Services)'],
  ['message', 'Message (long text)'], ['text', 'Short answer'], ['textarea', 'Long answer'],
  ['select', 'Dropdown'], ['radio', 'Pick one (buttons)'], ['checkbox', 'Pick several (checkboxes)'],
  ['date', 'Date'], ['number', 'Number'], ['photo', 'Photo upload']
];
const TYPE_IDS = TYPES.map(t => t[0]);
const HAS_OPTIONS = ['select', 'radio', 'checkbox'];
const MAX_FIELDS = 20;
const MAX_STEPS = 5;

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function cleanOptions(v) {
  const out = [];
  for (const part of String(v || '').split(/[\n;]+|,(?!\d{3}(?!\d))/)) { // a comma inside $2,000 stays
    const t = clip(part, 60);
    if (t && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 15);
}

function cleanField(f) {
  const type = TYPE_IDS.includes(f && f.type) ? f.type : 'text';
  const step = Math.max(1, Math.min(MAX_STEPS, parseInt(f && f.step, 10) || 1));
  const label = clip(f && f.label, 80) || (TYPES.find(t => t[0] === type) || [0, 'Question'])[1].replace(/ \(.*\)/, '');
  return {
    label, type,
    required: !!(f && (f.required === true || f.required === '1' || f.required === 1)),
    options: HAS_OPTIONS.includes(type) ? cleanOptions(Array.isArray(f && f.options) ? f.options.join(',') : f && f.options) : [],
    step
  };
}

function normalize(form) {
  const f = form || {};
  const fields = asArray(f.fields).map(cleanField).slice(0, MAX_FIELDS);
  // only one photo upload is supported, and drop dropdowns that have no choices
  let photo = false;
  const kept = fields.filter(x => {
    if (x.type === 'photo') { if (photo) return false; photo = true; }
    if (HAS_OPTIONS.includes(x.type) && !x.options.length) return false;
    return true;
  });
  return {
    mode: f.mode === 'custom' && kept.length ? 'custom' : 'standard',
    title: clip(f.title, 80),
    intro: clip(f.intro, 200),
    submitText: clip(f.submitText, 40),
    fields: kept
  };
}

// Parse the editor's parallel arrays
function fromBody(b) {
  const labels = asArray(b.cf_label);
  const get = (k, i) => asArray(b[k])[i];
  const fields = labels.map((label, i) => ({
    label, type: get('cf_type', i), required: get('cf_required', i), options: get('cf_options', i), step: get('cf_step', i)
  })).filter(f => clip(f.label, 80) || f.type !== 'text');
  return normalize({
    mode: b.cf_mode === 'custom' ? 'custom' : 'standard',
    title: b.cf_title, intro: b.cf_intro, submitText: b.cf_submitText, fields
  });
}

// Fields grouped into steps (in step order). Each field keeps its index in the
// form, which is what the input names (cf_<index>) refer to.
function stepsOf(form) {
  const f = normalize(form);
  const nums = [...new Set(f.fields.map(x => x.step))].sort((a, b) => a - b);
  return nums.map((n, i) => ({ n: i + 1, fields: f.fields.map((x, index) => ({ ...x, index })).filter(x => x.step === n) }));
}

const SEE_YOU = {
  name: 'Please enter your name.', email: 'Please enter a valid email address.', phone: 'Please enter a phone number.',
  required: 'Please answer this question.', photo: 'Please add a photo.'
};

// Checks a submitted form against the site's definition. `body` is the parsed
// request body, `ctx` = { services: [titles], hasFile, isValidEmail }.
// Returns { ok:true, values:{name,email,phone,message,service}, answers:[{label,value}] }
// or { ok:false, error, index }.
function validate(form, body, ctx) {
  const f = normalize(form);
  const values = { name: '', email: '', phone: '', message: '', service: '' };
  const answers = [];
  for (let i = 0; i < f.fields.length; i++) {
    const fld = f.fields[i];
    const raw = body['cf_' + i];
    let v = '';
    switch (fld.type) {
      case 'name': v = clip(raw, 100); break;
      case 'email': v = ctx.isValidEmail(clip(raw, 254)) ? clip(raw, 254) : ''; break;
      case 'phone': v = clip(raw, 40); break;
      case 'message': v = clip(raw, 2000); break;
      case 'service': v = (ctx.services || []).includes(clip(raw, 60)) ? clip(raw, 60) : ''; break;
      case 'text': v = clip(raw, 200); break;
      case 'textarea': v = clip(raw, 2000); break;
      case 'select': case 'radio': { const t = clip(asArray(raw)[0], 60); v = fld.options.includes(t) ? t : ''; break; }
      case 'checkbox': v = asArray(raw).map(x => clip(x, 60)).filter(x => fld.options.includes(x)).filter((x, k, a) => a.indexOf(x) === k).join(', '); break;
      case 'date': { const t = clip(raw, 10); v = /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(Date.parse(t)) ? t : ''; break; }
      case 'number': { const t = clip(raw, 30); v = t !== '' && Number.isFinite(Number(t)) ? t : ''; break; }
      case 'photo': v = ctx.hasFile ? 'yes' : ''; break;
      default: v = '';
    }
    // a service field on a site with no services has nothing to choose from
    if (fld.type === 'service' && !(ctx.services || []).length) continue;
    if (!v && fld.required) {
      const msg = fld.type === 'email' ? SEE_YOU.email : fld.type === 'photo' ? SEE_YOU.photo : `Please answer: ${fld.label}`;
      return { ok: false, error: msg, index: i };
    }
    if (!v) continue;
    if (['name', 'email', 'phone', 'message', 'service'].includes(fld.type)) {
      if (!values[fld.type]) values[fld.type] = v;
      else answers.push({ label: fld.label, value: v }); // a second one of the same kind
    } else if (fld.type !== 'photo') {
      answers.push({ label: fld.label, value: v });
    }
  }
  return { ok: true, values, answers };
}

// "Label: value" lines for emails and CSV
function answersText(answers, sep = '\n') {
  return asArray(answers).map(a => `${a.label}: ${a.value}`).join(sep);
}

function parseAnswers(json) {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a.filter(x => x && x.label) : []; } catch { return []; }
}

const F = (label, type, step, required, options) => ({ label, type, step, required: !!required, options: options || '' });
const PRESETS = [
  {
    id: 'home-services', name: 'Estimate request (3 steps)', description: 'Project type, timing and budget first, contact details last. Good for contractors, cleaners, landscapers, movers.',
    title: 'Request an estimate', intro: 'A few quick questions so we can give you a useful answer.', submitText: 'Send my request',
    fields: [
      F('What do you need help with?', 'service', 1, true),
      F('Type of property', 'radio', 1, false, 'House, Apartment or condo, Business'),
      F('Tell us about the job', 'textarea', 1, false),
      F('Photos of the area (optional)', 'photo', 1, false),
      F('When would you like it done?', 'radio', 2, false, 'As soon as possible, Within a month, Just planning ahead'),
      F('Budget range', 'select', 2, false, 'Under $500, $500 – $2,000, $2,000 – $10,000, Over $10,000, Not sure yet'),
      F('Your name', 'name', 3, true),
      F('Phone', 'phone', 3, true),
      F('Email', 'email', 3, false),
      F('Best way to reach you', 'radio', 3, false, 'Phone call, Text message, Email')
    ]
  },
  {
    id: 'insurance', name: 'Insurance / financial quote (3 steps)', description: 'Coverage types, current situation, then contact details. Good for agencies, advisers, mortgage and tax pros.',
    title: 'Get a quote', intro: 'Tell us what you are looking for and we will follow up.', submitText: 'Request my quote',
    fields: [
      F('What would you like a quote for?', 'checkbox', 1, true, 'Auto, Home, Life, Health, Business, Something else'),
      F('ZIP code', 'text', 1, true),
      F('Do you have coverage today?', 'radio', 2, false, 'Yes, No'),
      F('When does it renew?', 'date', 2, false),
      F('Anything else we should know?', 'textarea', 2, false),
      F('Your name', 'name', 3, true),
      F('Phone', 'phone', 3, true),
      F('Email', 'email', 3, false),
      F('Best time to call', 'select', 3, false, 'Morning, Afternoon, Evening')
    ]
  },
  {
    id: 'pet-grooming', name: 'Pet appointment request (2 steps)', description: 'Pet details, then owner details. Good for groomers, trainers, walkers, vets.',
    title: 'Tell us about your pet', intro: '', submitText: 'Send request',
    fields: [
      F("Pet's name", 'text', 1, true),
      F('Breed', 'text', 1, false),
      F('Size', 'radio', 1, false, 'Small, Medium, Large'),
      F('Service', 'service', 1, false),
      F('Anything we should know? (allergies, nervous, health)', 'textarea', 1, false),
      F('Your name', 'name', 2, true),
      F('Phone', 'phone', 2, true),
      F('Email', 'email', 2, false),
      F('Preferred days', 'radio', 2, false, 'Weekdays, Weekends, Either')
    ]
  },
  {
    id: 'event', name: 'Event inquiry (2 steps)', description: 'Event type, date and size, then contact details. Good for caterers, venues, rentals, photographers, DJs.',
    title: 'Plan your event', intro: '', submitText: 'Send inquiry',
    fields: [
      F('Type of event', 'select', 1, true, 'Wedding, Birthday, Corporate, Holiday party, Other'),
      F('Event date', 'date', 1, false),
      F('Number of guests', 'number', 1, false),
      F('Venue or location', 'text', 1, false),
      F('Tell us more', 'textarea', 1, false),
      F('Your name', 'name', 2, true),
      F('Email', 'email', 2, true),
      F('Phone', 'phone', 2, false)
    ]
  },
  {
    id: 'consult', name: 'Consultation request (one page)', description: 'A short, single-page form. Good for professionals, clinics, coaches, advisers.',
    title: 'Request a consultation', intro: '', submitText: 'Send request',
    fields: [
      F('Your name', 'name', 1, true),
      F('Email', 'email', 1, true),
      F('Phone', 'phone', 1, false),
      F('What would you like to talk about?', 'select', 1, false, 'General question, New client, Existing client, Other'),
      F('Best way to reach you', 'radio', 1, false, 'Phone call, Text message, Email'),
      F('Message', 'message', 1, false)
    ]
  }
];

module.exports = { TYPES, TYPE_IDS, HAS_OPTIONS, MAX_FIELDS, MAX_STEPS, PRESETS, normalize, fromBody, stepsOf, validate, answersText, parseAnswers };
