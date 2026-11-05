// Online booking: opening hours -> bookable time slots, plus industry presets.
// Times are the business's local wall-clock times (stored as "YYYY-MM-DD HH:MM"),
// so the owner never has to think about time zones except for "what time is it
// for the business right now" (used for lead time and past-slot checks).

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const TIMEZONES = [
  ['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']
];

function defaultHours() {
  const h = {};
  for (const d of DAYS) h[d] = { closed: d === 'sun' || d === 'sat', open: '09:00', close: '17:00' };
  return h;
}

function defaultBooking() {
  return {
    enabled: false,
    kind: 'generic',
    heading: 'Book an Appointment',
    intro: 'Choose a service, pick a time that works for you and tell us a little about what you need.',
    autoConfirm: false,   // false: the owner confirms each request
    timezone: 'America/New_York',
    stepMinutes: 30,
    leadHours: 24,        // earliest a customer can book, from now
    windowDays: 45,       // how far ahead they can book
    capacity: 1,          // appointments allowed at the same time
    hours: defaultHours(),
    services: [],         // [{ name, minutes, price, description }]
    addons: [],           // [{ name, price, minutes }]
    fields: [],           // [{ label, type: 'text'|'select'|'textarea', options: [], required }]
    askAddress: false,    // for mobile / on-site services
    policy: '',
    confirmNote: ''
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mergeBooking(raw) {
  const d = defaultBooking();
  const b = { ...d, ...(raw || {}) };
  b.hours = { ...d.hours, ...((raw && raw.hours) || {}) };
  for (const k of DAYS) b.hours[k] = { ...d.hours[k], ...(b.hours[k] || {}) };
  for (const k of ['services', 'addons', 'fields']) if (!Array.isArray(b[k])) b[k] = [];
  return b;
}

const toMin = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// "Now" in the business's time zone, as { date: 'YYYY-MM-DD', minutes: since midnight, epochMin: wall-clock minutes }
function nowIn(tz, at = new Date()) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  } catch { return nowIn('America/New_York', at); }
  const g = (t) => parts.find(p => p.type === t).value;
  const date = `${g('year')}-${g('month')}-${g('day')}`;
  const minutes = parseInt(g('hour'), 10) * 60 + parseInt(g('minute'), 10);
  return { date, minutes, epochMin: Math.floor(Date.UTC(+g('year'), +g('month') - 1, +g('day')) / 60000) + minutes };
}

const dateEpochMin = (date) => { const [y, m, d] = date.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 60000); };
const weekdayKey = (date) => { const [y, m, d] = date.split('-').map(Number); return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };

// existing: [{ start_at: 'YYYY-MM-DD HH:MM', duration: minutes }] that still hold a slot
function slotsFor(booking, date, durationMin, existing, at = new Date()) {
  const b = mergeBooking(booking);
  if (!DATE_RE.test(date)) return [];
  const now = nowIn(b.timezone, at);
  const dayDiff = (dateEpochMin(date) - dateEpochMin(now.date)) / 1440;
  if (dayDiff < 0 || dayDiff > b.windowDays) return [];
  const h = b.hours[weekdayKey(date)];
  if (!h || h.closed || !TIME_RE.test(h.open) || !TIME_RE.test(h.close)) return [];
  const open = toMin(h.open), close = toMin(h.close);
  const step = [10, 15, 20, 30, 45, 60].includes(+b.stepMinutes) ? +b.stepMinutes : 30;
  const dur = Math.max(5, Math.min(600, +durationMin || 60));
  const day = existing.filter(e => e.start_at.slice(0, 10) === date)
    .map(e => ({ s: toMin(e.start_at.slice(11, 16)), e: toMin(e.start_at.slice(11, 16)) + (+e.duration || 60) }));
  const cap = Math.max(1, +b.capacity || 1);
  const earliest = now.epochMin + Math.max(0, +b.leadHours || 0) * 60;
  const out = [];
  for (let s = open; s + dur <= close; s += step) {
    if (dateEpochMin(date) + s < earliest) continue;
    const overlapping = day.filter(x => x.s < s + dur && x.e > s).length;
    if (overlapping >= cap) continue;
    out.push(fmt(s));
  }
  return out;
}

function prettyTime(hhmm) {
  const m = toMin(hhmm); const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`;
}
function prettyDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// ---------- industry presets ----------
// Owner-editable starting points. No prices, no promises: durations are only
// placeholders for the owner to adjust.
const PRESETS = {
  grooming: {
    label: 'Pet grooming', heading: 'Book a Grooming', intro: 'Tell us about your pet, pick a service and choose a time. We will confirm your appointment by email.',
    addons: [{ name: 'Nail trim', price: '', minutes: 0 }, { name: 'Teeth brushing', price: '', minutes: 10 }, { name: 'De-shedding treatment', price: '', minutes: 20 }],
    fields: [
      { label: 'Pet name', type: 'text', options: [], required: true },
      { label: 'Pet type', type: 'select', options: ['Dog', 'Cat', 'Other'], required: true },
      { label: 'Breed', type: 'text', options: [], required: true },
      { label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Extra large'], required: true },
      { label: 'Coat type', type: 'select', options: ['Short', 'Medium', 'Long', 'Curly / double coat', 'Not sure'], required: false },
      { label: 'Temperament, health or handling notes', type: 'textarea', options: [], required: false },
      { label: 'Date of last grooming', type: 'text', options: [], required: false }
    ],
    policy: 'Please arrive on time. If you need to change or cancel, contact us as early as you can.', askAddress: false, minutes: 90
  },
  'mobile-grooming': {
    label: 'Mobile pet grooming', heading: 'Book a Mobile Grooming', intro: 'We come to you. Tell us about your pet and where we are heading, choose a time and we will confirm by email.',
    addons: [{ name: 'Nail trim', price: '', minutes: 0 }, { name: 'Teeth brushing', price: '', minutes: 10 }, { name: 'De-shedding treatment', price: '', minutes: 20 }],
    fields: [
      { label: 'Pet name', type: 'text', options: [], required: true },
      { label: 'Pet type', type: 'select', options: ['Dog', 'Cat', 'Other'], required: true },
      { label: 'Breed', type: 'text', options: [], required: true },
      { label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Extra large'], required: true },
      { label: 'Parking or access notes', type: 'textarea', options: [], required: false },
      { label: 'Temperament, health or handling notes', type: 'textarea', options: [], required: false }
    ],
    policy: 'We come to the address you enter. Please make sure there is room for our van to park nearby.', askAddress: true, minutes: 90
  },
  salon: {
    label: 'Salon / beauty', heading: 'Book an Appointment', intro: 'Choose your service and a time. We will confirm your appointment by email.',
    addons: [{ name: 'Deep conditioning treatment', price: '', minutes: 15 }],
    fields: [
      { label: 'Preferred stylist (optional)', type: 'text', options: [], required: false },
      { label: 'Have you visited us before?', type: 'select', options: ['Yes', 'No'], required: false },
      { label: 'Tell us what you have in mind', type: 'textarea', options: [], required: false }
    ],
    policy: 'If you need to reschedule, please let us know as early as you can.', askAddress: false, minutes: 60
  },
  barber: {
    label: 'Barbershop', heading: 'Book a Cut', intro: 'Pick a service and a time. We will confirm by email.',
    addons: [{ name: 'Beard trim', price: '', minutes: 15 }],
    fields: [{ label: 'Preferred barber (optional)', type: 'text', options: [], required: false }, { label: 'What are you after?', type: 'textarea', options: [], required: false }],
    policy: '', askAddress: false, minutes: 30
  },
  trades: {
    label: 'Home services (on-site)', heading: 'Request a Visit', intro: 'Tell us what you need and where, and choose a time that suits you. We will confirm by email or phone.',
    addons: [],
    fields: [
      { label: 'What do you need help with?', type: 'textarea', options: [], required: true },
      { label: 'How urgent is it?', type: 'select', options: ['Not urgent', 'Soon', 'As soon as possible'], required: false },
      { label: 'Access or parking notes', type: 'textarea', options: [], required: false }
    ],
    policy: 'Arrival windows can shift. We will contact you if anything changes.', askAddress: true, minutes: 60
  },
  wellness: {
    label: 'Spa / wellness / clinic', heading: 'Book an Appointment', intro: 'Choose a service and a time. We will confirm your appointment by email.',
    addons: [],
    fields: [{ label: 'Is this your first visit?', type: 'select', options: ['Yes', 'No'], required: false }, { label: 'Anything we should know before your visit?', type: 'textarea', options: [], required: false }],
    policy: 'Please let us know as early as you can if you need to change your appointment.', askAddress: false, minutes: 60
  },
  training: {
    label: 'Dog training', heading: 'Book a Consultation', intro: 'Tell us about your dog and what you would like help with, then pick a time.',
    addons: [],
    fields: [
      { label: 'Dog name', type: 'text', options: [], required: true },
      { label: 'Breed', type: 'text', options: [], required: false },
      { label: 'Age', type: 'text', options: [], required: false },
      { label: 'What would you like help with?', type: 'textarea', options: [], required: true }
    ],
    policy: '', askAddress: false, minutes: 60
  },
  generic: {
    label: 'General', heading: 'Book an Appointment', intro: 'Choose a service, pick a time that works for you and tell us a little about what you need.',
    addons: [], fields: [{ label: 'Anything we should know?', type: 'textarea', options: [], required: false }], policy: '', askAddress: false, minutes: 60
  }
};

// which preset suits which industry template
const TEMPLATE_KIND = {
  'pet-grooming': 'grooming', 'mobile-grooming': 'mobile-grooming', 'dog-training': 'training', 'pet-care': 'generic',
  salon: 'salon', barber: 'barber', tattoo: 'generic', spa: 'wellness', chiropractor: 'wellness', dentist: 'wellness', veterinary: 'wellness',
  plumbing: 'trades', electrician: 'trades', hvac: 'trades', roofing: 'trades', landscaping: 'trades', cleaning: 'trades', contractor: 'trades',
  painting: 'trades', 'pest-control': 'trades', moving: 'trades', 'tree-service': 'trades', 'pressure-washing': 'trades', 'junk-removal': 'trades',
  'pool-service': 'trades', locksmith: 'trades', 'auto-repair': 'generic', 'car-detailing': 'generic', 'it-repair': 'generic'
};

// Apply a preset to a booking section, turning the site's services into bookable services.
function applyPreset(current, kind, siteServices) {
  const p = PRESETS[kind] || PRESETS.generic;
  const b = mergeBooking(current);
  b.kind = PRESETS[kind] ? kind : 'generic';
  b.heading = p.heading; b.intro = p.intro; b.policy = p.policy; b.askAddress = !!p.askAddress;
  b.addons = p.addons.map(a => ({ ...a }));
  b.fields = p.fields.map(f => ({ ...f, options: [...f.options] }));
  b.services = (siteServices || []).filter(s => s.title).slice(0, 12).map(s => ({ name: s.title, minutes: p.minutes, price: '', description: s.description || '' }));
  return b;
}

module.exports = { DAYS, DAY_LABELS, TIMEZONES, PRESETS, TEMPLATE_KIND, defaultBooking, mergeBooking, slotsFor, nowIn, prettyDate, prettyTime, applyPreset, TIME_RE, DATE_RE, toMin, weekdayKey };
