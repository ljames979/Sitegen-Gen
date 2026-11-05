const { test } = require('node:test');
const assert = require('node:assert/strict');
const forms = require('../forms');

const ok = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const ctx = (extra) => ({ services: ['Mowing', 'Trimming'], hasFile: false, isValidEmail: ok, ...extra });

test('normalize: needs fields to be custom, caps, drops empty choice lists and extra photo fields', () => {
  assert.equal(forms.normalize({ mode: 'custom', fields: [] }).mode, 'standard');
  assert.equal(forms.normalize(null).mode, 'standard');
  const n = forms.normalize({ mode: 'custom', fields: [
    { label: 'Pick', type: 'select', options: '' },            // no choices -> dropped
    { label: 'Pic 1', type: 'photo' }, { label: 'Pic 2', type: 'photo' }, // second photo dropped
    { label: '', type: 'phone', step: 99 },                    // label defaults, step capped
    { label: 'Weird', type: 'nonsense', step: 'x' }
  ] });
  assert.deepEqual(n.fields.map(f => f.type), ['photo', 'phone', 'text']);
  assert.equal(n.fields[1].label, 'Phone');
  assert.equal(n.fields[1].step, forms.MAX_STEPS);
  assert.equal(n.fields[2].step, 1);
  const many = forms.normalize({ mode: 'custom', fields: Array.from({ length: 50 }, () => ({ label: 'q', type: 'text' })) });
  assert.equal(many.fields.length, forms.MAX_FIELDS);
});

test('choices: commas split but "$2,000" stays whole; duplicates removed', () => {
  const f = forms.normalize({ mode: 'custom', fields: [{ label: 'Budget', type: 'select', options: 'Under $500, $500 – $2,000; $2,000 – $10,000\nunder $500' }] }).fields[0];
  assert.deepEqual(f.options, ['Under $500', '$500 – $2,000', '$2,000 – $10,000']);
});

test('fromBody reads the editor rows and stepsOf groups them in order', () => {
  const f = forms.fromBody({
    cf_mode: 'custom', cf_title: 'Get a quote',
    cf_label: ['What', 'Name', 'Phone'], cf_type: ['radio', 'name', 'phone'], cf_options: ['A, B', '', ''],
    cf_step: ['1', '2', '2'], cf_required: ['0', '1', '1']
  });
  assert.equal(f.mode, 'custom');
  assert.equal(f.title, 'Get a quote');
  const steps = forms.stepsOf(f);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0].fields.map(x => x.label), ['What']);
  assert.deepEqual(steps[1].fields.map(x => [x.label, x.index]), [['Name', 1], ['Phone', 2]]);
  // a single row sent as a plain string works too
  assert.equal(forms.fromBody({ cf_mode: 'custom', cf_label: 'Only', cf_type: 'text' }).fields.length, 1);
  assert.equal(forms.fromBody({}).mode, 'standard');
});

test('validate maps contact fields to lead columns and keeps the rest as answers', () => {
  const form = forms.normalize({ mode: 'custom', fields: [
    { label: 'Service', type: 'service', required: true }, { label: 'Name', type: 'name', required: true },
    { label: 'Phone', type: 'phone' }, { label: 'Email', type: 'email' },
    { label: 'Timeline', type: 'radio', options: 'Soon, Later' }, { label: 'Extras', type: 'checkbox', options: 'A, B, C' },
    { label: 'When', type: 'date' }, { label: 'How many', type: 'number' }, { label: 'Notes', type: 'message' }
  ] });
  const r = forms.validate(form, {
    cf_0: 'Mowing', cf_1: 'Ann', cf_2: '555-1111', cf_3: 'ann@x.co', cf_4: 'Soon', cf_5: ['A', 'C', 'Z', 'A'], cf_6: '2026-12-01', cf_7: '3.5', cf_8: 'hello'
  }, ctx());
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { name: 'Ann', email: 'ann@x.co', phone: '555-1111', message: 'hello', service: 'Mowing' });
  assert.deepEqual(r.answers, [
    { label: 'Timeline', value: 'Soon' }, { label: 'Extras', value: 'A, C' }, { label: 'When', value: '2026-12-01' }, { label: 'How many', value: '3.5' }
  ]);
});

test('validate rejects missing required answers and ignores values that are not allowed', () => {
  const form = forms.normalize({ mode: 'custom', fields: [
    { label: 'Name', type: 'name', required: true }, { label: 'Email', type: 'email', required: true },
    { label: 'Size', type: 'radio', options: 'S, M', required: false }, { label: 'Service', type: 'service' },
    { label: 'When', type: 'date' }, { label: 'Qty', type: 'number' }
  ] });
  assert.equal(forms.validate(form, { cf_1: 'a@b.co' }, ctx()).ok, false);
  const badMail = forms.validate(form, { cf_0: 'Ann', cf_1: 'nope' }, ctx());
  assert.equal(badMail.ok, false);
  assert.match(badMail.error, /email/i);
  const r = forms.validate(form, { cf_0: 'Ann', cf_1: 'a@b.co', cf_2: 'XL', cf_3: 'Hacking', cf_4: 'tomorrow', cf_5: 'abc' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.values.service, '');
  assert.deepEqual(r.answers, [], 'invalid choice / date / number are dropped, not stored');
  // required photo needs a file; required service is skipped when the site lists none
  const pf = forms.normalize({ mode: 'custom', fields: [{ label: 'Pic', type: 'photo', required: true }, { label: 'S', type: 'service', required: true }, { label: 'P', type: 'phone' }] });
  assert.equal(forms.validate(pf, { cf_2: '1' }, ctx({ services: [] })).ok, false);
  assert.equal(forms.validate(pf, { cf_2: '1' }, ctx({ services: [], hasFile: true })).ok, true);
});

test('answers round-trip as text and tolerate junk', () => {
  const a = [{ label: 'A', value: '1' }, { label: 'B', value: '2' }];
  assert.equal(forms.answersText(a), 'A: 1\nB: 2');
  assert.equal(forms.answersText(a, ' | '), 'A: 1 | B: 2');
  assert.deepEqual(forms.parseAnswers(JSON.stringify(a)), a);
  assert.deepEqual(forms.parseAnswers('not json'), []);
  assert.deepEqual(forms.parseAnswers(''), []);
});

test('every template is valid, has a way to reply, and makes no claims', () => {
  assert.ok(forms.PRESETS.length >= 4);
  for (const p of forms.PRESETS) {
    const n = forms.normalize({ mode: 'custom', fields: p.fields });
    assert.equal(n.mode, 'custom', p.id);
    assert.equal(n.fields.length, p.fields.length, `${p.id}: nothing silently dropped`);
    assert.ok(n.fields.some(f => ['phone', 'email'].includes(f.type)), `${p.id}: has phone or email`);
    assert.ok(forms.stepsOf(n).length <= forms.MAX_STEPS);
    assert.doesNotMatch(JSON.stringify(p), /licensed|insured|24\/7|\bbest (?!way|time)|most popular|free estimate|guarantee/i, `${p.id}: honest wording`);
  }
});
