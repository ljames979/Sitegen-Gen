// Quote / estimate calculator. The owner sets every question and every price; nothing is pre-filled
// with made-up numbers. The visitor sees a live estimate (or just a summary when prices are hidden),
// then sends it as a lead. The server recomputes everything from the saved config, so a visitor can
// never submit a price of their own choosing.
const TYPES = [['select', 'Dropdown (pick one)'], ['radio', 'Buttons (pick one)'], ['number', 'Number × price each'], ['checkbox', 'Yes / no add-on']];
const TYPE_IDS = TYPES.map(t => t[0]);
const MAX_FIELDS = 12;

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const money = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.round(Math.min(n, 1e7) * 100) / 100 : 0; };
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// "Studio | 90" per line
function parseOptions(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const [label, price] = line.split('|');
    const l = clip(label, 60);
    if (l && !out.some(o => o.label.toLowerCase() === l.toLowerCase())) out.push({ label: l, price: money(price) });
  }
  return out.slice(0, 12);
}
const optionsText = (opts) => (opts || []).map(o => `${o.label} | ${o.price || 0}`).join('\n');

function cleanField(f) {
  f = f || {};
  const type = TYPE_IDS.includes(f.type) ? f.type : 'select';
  const min = Math.max(0, parseInt(f.min, 10) || 0);
  const max = Math.max(min, Math.min(10000, parseInt(f.max, 10) || 100));
  return {
    label: clip(f.label, 80) || 'Question',
    type,
    options: type === 'select' || type === 'radio' ? (Array.isArray(f.options) ? f.options.map(o => ({ label: clip(o.label, 60), price: money(o.price) })).filter(o => o.label).slice(0, 12) : parseOptions(f.options)) : [],
    price: type === 'number' || type === 'checkbox' ? money(f.price) : 0,
    unit: type === 'number' ? clip(f.unit, 20) : '',
    min, max,
    required: f.required === true || f.required === 'yes' || f.required === '1'
  };
}

function normalize(c) {
  c = c || {};
  return {
    enabled: !!c.enabled,
    heading: clip(c.heading, 80) || 'Get an estimate',
    intro: clip(c.intro, 400),
    buttonText: clip(c.buttonText, 40) || 'Send me this estimate',
    showPrice: c.showPrice !== false && c.showPrice !== 'no',
    basePrice: money(c.basePrice),
    minimum: money(c.minimum),
    spread: Math.min(100, Math.max(0, parseInt(c.spread, 10) || 0)),
    note: clip(c.note, 400),
    fields: asArray(c.fields).slice(0, MAX_FIELDS).map(cleanField)
  };
}

function fromBody(b) {
  const L = asArray(b.calc_label), T = asArray(b.calc_type), O = asArray(b.calc_options), P = asArray(b.calc_price),
    U = asArray(b.calc_unit), MN = asArray(b.calc_min), MX = asArray(b.calc_max), R = asArray(b.calc_required);
  const fields = [];
  for (let i = 0; i < Math.min(MAX_FIELDS, L.length); i++) {
    if (!clip(L[i], 80) && !clip(O[i], 10)) continue;
    fields.push({ label: L[i], type: T[i], options: O[i], price: P[i], unit: U[i], min: MN[i], max: MX[i], required: R[i] });
  }
  return normalize({
    enabled: b.calc_enabled === '1' || b.calc_enabled === 'on', heading: b.calc_heading, intro: b.calc_intro, buttonText: b.calc_buttonText,
    showPrice: b.calc_showPrice === 'no' ? false : true, basePrice: b.calc_basePrice, minimum: b.calc_minimum, spread: b.calc_spread, note: b.calc_note, fields
  });
}

// answers[i]: select/radio = option index, number = quantity, checkbox = '1'
function compute(cfg, answers) {
  const c = normalize(cfg);
  const a = answers || [];
  const lines = [];
  let total = c.basePrice;
  for (let i = 0; i < c.fields.length; i++) {
    const f = c.fields[i], raw = a[i];
    if (f.type === 'select' || f.type === 'radio') {
      const idx = parseInt(raw, 10);
      const o = Number.isInteger(idx) && idx >= 0 && idx < f.options.length ? f.options[idx] : null;
      if (!o) { if (f.required) return { ok: false, error: `Please answer: ${f.label}` }; continue; }
      total += o.price; lines.push({ label: f.label, value: o.label, amount: o.price });
    } else if (f.type === 'number') {
      if (raw === undefined || raw === '' || raw === null) { if (f.required) return { ok: false, error: `Please answer: ${f.label}` }; continue; }
      let n = parseFloat(raw); if (!Number.isFinite(n)) n = 0;
      n = Math.min(f.max, Math.max(f.min, Math.round(n * 100) / 100));
      const amt = Math.round(n * f.price * 100) / 100;
      total += amt; lines.push({ label: f.label, value: `${n}${f.unit ? ' ' + f.unit : ''}`, amount: amt });
    } else if (f.type === 'checkbox') {
      const yes = raw === '1' || raw === 'on' || raw === true;
      if (yes) { total += f.price; lines.push({ label: f.label, value: 'Yes', amount: f.price }); }
    }
  }
  total = Math.max(total, c.minimum);
  total = Math.round(total * 100) / 100;
  const low = total, high = c.spread ? Math.round(total * (1 + c.spread / 100) * 100) / 100 : total;
  return { ok: true, total, low, high, lines };
}

const fmt = (n) => '$' + (Math.round(n) === n ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
function rangeText(r) { return r.high > r.low ? `${fmt(r.low)} to ${fmt(r.high)}` : fmt(r.low); }

// does the site have enough to show the page?
function isUsable(cfg) {
  const c = normalize(cfg);
  return c.enabled && c.fields.length > 0 && c.fields.some(f => (f.type === 'number' || f.type === 'checkbox') ? true : f.options.length > 0);
}

// a price list with no prices at all
function hasPrices(cfg) {
  const c = normalize(cfg);
  return c.basePrice > 0 || c.fields.some(f => f.price > 0 || f.options.some(o => o.price > 0));
}

const PRESETS = {
  cleaning: { heading: 'Cleaning estimate', fields: [
    { label: 'Size of home', type: 'select', options: 'Studio or 1 bedroom | 0\n2 bedrooms | 0\n3 bedrooms | 0\n4 or more bedrooms | 0', required: 'yes' },
    { label: 'Bathrooms', type: 'number', price: 0, min: 1, max: 10, unit: '', required: 'yes' },
    { label: 'Type of clean', type: 'radio', options: 'Standard | 0\nDeep clean | 0\nMove-out | 0', required: 'yes' },
    { label: 'Inside the oven', type: 'checkbox', price: 0 }] },
  lawn: { heading: 'Lawn care estimate', fields: [
    { label: 'Lawn size', type: 'select', options: 'Small | 0\nMedium | 0\nLarge | 0', required: 'yes' },
    { label: 'How often', type: 'radio', options: 'One time | 0\nEvery 2 weeks | 0\nWeekly | 0', required: 'yes' },
    { label: 'Hedge trimming', type: 'checkbox', price: 0 }] },
  moving: { heading: 'Moving estimate', fields: [
    { label: 'Size of move', type: 'select', options: 'Studio or 1 bedroom | 0\n2 bedrooms | 0\n3 bedrooms | 0\n4 or more bedrooms | 0', required: 'yes' },
    { label: 'Number of movers', type: 'number', price: 0, min: 2, max: 8, unit: 'movers', required: 'yes' },
    { label: 'Packing help', type: 'checkbox', price: 0 }] },
  insurance: { heading: 'Get a quote', showPrice: false, buttonText: 'Request my quote', fields: [
    { label: 'What do you want covered?', type: 'radio', options: 'Auto | 0\nHome | 0\nLife | 0\nHealth | 0\nSeveral of these | 0', required: 'yes' },
    { label: 'People or drivers to cover', type: 'number', price: 0, min: 1, max: 12, unit: '', required: 'yes' },
    { label: 'Currently insured', type: 'radio', options: 'Yes | 0\nNo | 0', required: 'yes' }] }
};

module.exports = { TYPES, MAX_FIELDS, normalize, fromBody, compute, rangeText, isUsable, hasPrices, optionsText, parseOptions, PRESETS, fmt };
