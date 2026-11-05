const test = require('node:test'); const assert = require('node:assert/strict');
const zlib = require('zlib');
const ip = require('../intakepdf');

// fill our blank PDF the simple way: put values into the fields' /V entries (the reader does not need the xref)
function fill(values, { utf16 = [] } = {}) {
  let s = ip.makeBlank().toString('latin1');
  for (const [k, v] of Object.entries(values)) {
    const enc = utf16.includes(k) ? '<feff' + Buffer.from(v, 'utf16le').swap16().toString('hex') + '>' : '(' + v.replace(/([\\()])/g, '\\$1') + ')';
    s = s.replace(new RegExp(`(/T \\(${k}\\)[^>]*?/V )(\\(\\)|/Off)`), (m, a, b) => a + (b === '/Off' ? '/' + v : enc));
  }
  return Buffer.from(s, 'latin1');
}

test('questionnaire PDF: the blank form has every question as a fillable field, and only ASCII labels', () => {
  const buf = ip.makeBlank({ forName: 'Maria’s Bakery' });
  const s = buf.toString('latin1');
  assert.match(s, /^%PDF-1\.7/); assert.match(s, /\/AcroForm 3 0 R/); assert.match(s, /\/NeedAppearances true/);
  for (const k of ['biz_name', 'svc_name_6', 'faq_a_4', 'mood', 'features_booking', 'agree', 'contact_email']) assert.match(s, new RegExp(`/T \\(${k}\\)`), k);
  assert.equal((s.match(/\/Subtype \/Widget/g) || []).length, ip.FIELD_NAMES.length);
  // xref offsets point at the objects
  const xref = +/startxref\n(\d+)/.exec(s)[1]; assert.equal(s.slice(xref, xref + 4), 'xref');
  const first = /0000000000 65535 f \n(\d{10})/.exec(s)[1]; assert.equal(s.slice(+first, +first + 7), '1 0 obj');
  assert.deepEqual(ip.readForm(buf).fields, {}, 'blank: nothing filled in');
});

test('questionnaire PDF: filled form fields become the online form answers, cleaned the same way', async () => {
  const buf = fill({ biz_name: 'Maria (Bakery)', biz_type: 'Bakery', years: '12 years', svc_name_1: 'Cakes', svc_price_1: 'from $60', svc_name_3: 'Bread', svc_desc_3: 'Daily',
    faq_q_1: 'Delivery?', faq_a_1: 'Yes, nearby.', faq_q_2: 'No answer', mood: 'Warm and welcoming', tone: 'warm', goal: 'calls', features_booking: 'Yes', features_blog: 'Off', agree: 'Yes',
    email: 'not an email', facebook: 'facebook.com/maria/', about: 'Line one\nLine two', contact_name: 'Ana Ruiz' }, { utf16: ['contact_name'] });
  const r = await ip.read(buf, null);
  assert.equal(r.source, 'form');
  const d = r.d;
  assert.equal(d.bizName, 'Maria (Bakery)'); assert.equal(d.years, '12'); assert.equal(d.contactName, 'Ana Ruiz');
  assert.deepEqual(d.services, [{ name: 'Cakes', desc: '', price: 'from $60' }, { name: 'Bread', desc: 'Daily', price: '' }]);
  assert.deepEqual(d.faq, [{ q: 'Delivery?', a: 'Yes, nearby.' }], 'a question without an answer is left out');
  assert.equal(d.mood, 'warm', 'a stored label maps back to its id'); assert.equal(d.tone, 'warm'); assert.equal(d.goal, 'calls');
  assert.deepEqual(d.features, ['booking']); assert.equal(d.agree, true); assert.equal(d.stockOk, false);
  assert.equal(d.email, '', 'an invalid email is dropped, as online'); assert.equal(d.facebook, 'https://facebook.com/maria/');
  assert.equal(d.about, 'Line one\nLine two');
});

test('questionnaire PDF: fields packed in a compressed object stream and later edits are read too', () => {
  const body = '<< /T (biz_name) /V (Old name) >>';
  const later = '<< /T (biz_type) /V <FEFF0042 0061 006B 0065 0072 0079> >>';
  const head = `10 0 11 ${body.length + 1} `;
  const data = zlib.deflateSync(Buffer.from(head + body + ' ' + later, 'latin1'));
  const pdf = Buffer.concat([Buffer.from(`%PDF-1.7\n5 0 obj\n<< /Type /ObjStm /N 2 /First ${head.length} /Filter /FlateDecode /Length ${data.length} >>\nstream\n`, 'latin1'), data,
    Buffer.from('\nendstream\nendobj\n10 0 obj\n<< /T (biz_name) /V (New name) /TU (A label \\(with parens\\)) >>\nendobj\n%%EOF\n', 'latin1')]);
  assert.deepEqual(ip.readForm(pdf).fields, { biz_name: 'New name', biz_type: 'Bakery' });
});

test('questionnaire PDF: no form and no AI is a clear error, never made-up answers', async () => {
  assert.deepEqual(await ip.read(Buffer.from('hello'), null), { error: 'notpdf' });
  assert.deepEqual(await ip.read(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'), { hasAiProvider: () => false }), { error: 'noform' });
  assert.deepEqual(await ip.read(ip.makeBlank(), null), { error: 'empty' }, 'our form sent back blank');
  // the AI path: only known questions are kept, then cleaned like any answer
  const ai = { hasAiProvider: () => true, complete: async ({ content }) => { assert.equal(content[0].type, 'document'); return 'Here: {"biz_name":"Scan Co","phone":"407-555-0100","made_up_key":"x","svc_name_1":"Repairs"}'; } };
  const r = await ip.read(Buffer.from('%PDF-1.4\nscanned image only'), ai);
  assert.equal(r.source, 'ai'); assert.equal(r.d.bizName, 'Scan Co'); assert.deepEqual(r.d.services.map(x => x.name), ['Repairs']);
  assert.ok(!('made_up_key' in r.d));
  assert.match(ip.aiPrompt(), /mood: Which look fits you best\? One of: "modern"/);
});
