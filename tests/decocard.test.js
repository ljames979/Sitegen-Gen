const test = require('node:test');
const assert = require('node:assert');
const dc = require('../decocard');
const catalog = require('../blockcatalog');

const IMPERIAL = ['style: royal', 'icon: crown', 'eyebrow: By Royal Appointment', 'tagline: Purveyors of Fine Dog & Cat Grooming',
  'text: At Imperial Pet Group, every dog and cat gets the royal treatment.', 'quote: Because to you, they\'re not just a pet. They\'re family.',
  'detail: [ADDRESS]', 'detail: [PHONE]', 'detail: [HOURS]', 'border: #B8923A', 'card: #ffffff', 'btnc: #B8326A', 'sec: glow', 'sec1: #fdeef4', 'sec2: #c9e4f5'].join('\n');

test('decorative card: body lines are cleaned, bad values dropped, defaults left out', () => {
  const p = dc.parse(['style: nope', 'icon: paw', 'text: One', 'text: Two', 'text: Three', 'text: Four', 'text: Five', 'detail: a', 'detail: b', 'detail: c', 'detail: d',
    'hide: eyebrow, div2, bogus', 'border: gold', 'orn: #AABBCC', 'thick: 9', 'radius: -3', 'cardop: 40', 'pad: xl', 'width: l', 'shadow: strong', 'sec: sparkle', 'hfont: Cinzel Decorative', 'noise'].join('\n'));
  assert.equal(p.style, 'royal'); assert.equal(p.icon, 'paw');
  assert.deepEqual(p.text, ['One', 'Two', 'Three', 'Four']); assert.deepEqual(p.details, ['a', 'b', 'c']);
  assert.deepEqual(p.hide, ['eyebrow', 'div2']);
  assert.equal(p.border, ''); assert.equal(p.orn, '#aabbcc');
  assert.equal(p.thick, 6); assert.equal(p.radius, 0); assert.equal(p.cardop, 40);
  assert.equal(p.pad, 'm'); assert.equal(p.width, 'l'); assert.equal(p.shadow, 'strong'); assert.equal(p.sec, ''); assert.equal(p.hfont, 'Cinzel Decorative');
  assert.equal(dc.cleanBody(''), 'style: royal\nicon: crown');
  const again = dc.cleanBody(dc.cleanBody(IMPERIAL));
  assert.equal(again, dc.cleanBody(IMPERIAL), 'cleaning twice changes nothing');
  assert.match(again, /border: #b8923a/);
});

test('decorative card: switching style keeps every word', () => {
  const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const blk = { id: 'bdeco001', heading: 'Welcome to Imperial Pet Group', body: IMPERIAL, buttonText: 'Book Your Visit', buttonUrl: '#book' };
  dc.STYLE_IDS.forEach(s => {
    const h = dc.html({ theme: { primaryColor: '#cc407c' } }, { ...blk, body: blk.body.replace('style: royal', 'style: ' + s) });
    const w = words(h);
    ['By Royal Appointment', 'Welcome to Imperial Pet Group', 'Purveyors of Fine Dog &amp; Cat Grooming', 'royal treatment', 'They&#39;re family', '[ADDRESS]', '[PHONE]', '[HOURS]', 'Book Your Visit']
      .forEach(t => assert.ok(w.includes(t), s + ' shows ' + t));
    assert.match(h, new RegExp('sg-dc-' + s + '\\b'));
    assert.equal((h.match(/<h2/g) || []).length, 1, 'the heading is one real h2');
    assert.equal((h.match(/<h1/g) || []).length, 0);
    assert.match(h, /<a class="btn sg-dc-btn" href="#book">Book Your Visit<\/a>/, 'the button is a real link in the site button style');
    assert.match(h, /class="sg-dc-fr" aria-hidden="true"/); assert.match(h, /class="sg-dc-icon" aria-hidden="true"/);
    assert.ok(!/<img/.test(h), 'drawn, no images');
  });
});

test('decorative card: royal draws a double border, four mirrored curls and star dividers; glow behind the card', () => {
  const h = dc.html({}, { heading: 'Hi', body: IMPERIAL });
  assert.equal((h.match(/class="sg-dc-curl /g) || []).length, 4);
  ['tl', 'tr', 'bl', 'br'].forEach(c => assert.match(h, new RegExp('sg-dc-curl sg-dc-' + c)));
  assert.match(h, /sg-dc-inner/);
  assert.equal((h.match(/class="sg-dc-div /g) || []).length, 2);
  assert.match(h, /radial-gradient\(ellipse[^;]*#c9e4f5[^;]*#fdeef4;/);
  assert.match(h, /--dc-btn: #b8326a/);
});

test('decorative card: hidden slots are left out; empty slots draw nothing', () => {
  const h = dc.html({}, { heading: 'Hello', body: 'style: minimal\nicon: none\nhide: heading, div1, div2, button, details\ndetail: x', buttonText: 'Go', buttonUrl: '/x' });
  assert.ok(!/<h2/.test(h)); assert.ok(!/sg-dc-div/.test(h)); assert.ok(!/sg-dc-icon/.test(h)); assert.ok(!/sg-dc-details/.test(h)); assert.ok(!/sg-dc-btn/.test(h));
});

test('decorative card: words are escaped; colors default to the site palette, darkened to read; low contrast is reported', () => {
  const h = dc.html({}, { heading: '<script>x</script>', body: 'eyebrow: "quoted" <b>' });
  assert.ok(!/<script>/.test(h)); assert.match(h, /&lt;script&gt;/); assert.match(h, /&quot;quoted&quot; &lt;b&gt;/);
  const v = dc.view({ theme: { primaryColor: '#f7c6cc' } }, { body: 'border: #d4a5b5' });
  assert.notEqual(v.colors.head, '#f7c6cc', 'a pale brand color is darkened for the heading');
  assert.notEqual(v.colors.accent, '#d4a5b5');
  assert.equal(v.warn.length, 0, 'no warning for colors the app picked');
  const w = dc.view({}, { body: 'headc: #e9d8a6\nbodyc: #222222' }).warn;
  assert.equal(w.length, 1); assert.equal(w[0].key, 'headc'); assert.ok(w[0].ratio < 4.5); assert.notEqual(w[0].better, '#e9d8a6');
});

test('decorative card: glass is see-through by default; fonts are collected for the page; thumbnails for every style', () => {
  assert.match(dc.html({}, { body: 'style: glass' }), /--dc-card: rgba\(255, 255, 255, 0.62\)/);
  assert.match(dc.html({}, { body: 'style: glass\ncardop: 90' }), /0.9\)/);
  const site = { sections: { blocks: { items: [{ type: 'decocard', body: 'hfont: Cinzel Decorative\nbfont: Lato' }, { type: 'decocard', body: 'hfont: Lato' }, { type: 'steps', body: 'hfont: X' }] } } };
  assert.deepEqual(dc.fontsOf(site), ['Cinzel Decorative', 'Lato']);
  dc.STYLE_IDS.forEach(s => assert.match(dc.thumb(s), /^<svg class="blk-pic"/));
  const item = catalog.groups().flatMap(g => g.items).find(i => i.type === 'decocard');
  assert.ok(item, 'listed in the Add block picker');
  assert.deepEqual(item.styles.filter(s => !s.reveal).map(s => s.id), dc.STYLE_IDS);
  assert.ok(item.styles.some(s => s.reveal === 'envelope' && s.name === 'Invitation Reveal'), 'the Invitation Reveal card is in the picker');
  assert.equal(catalog.info('decocard').name, 'Decorative card');
});

test('Invitation Reveal: the envelope settings are kept, cleaned and dropped when it is off', () => {
  const body = 'style: royal\nreveal: envelope\nenv: #F2A9C6\nflap: #e57faa\nseal: red\nsealicon: paw\nlen: l\nhint: Open me <b>\nonce: yes\npat: crowns\npatc: #f2a9c6\npatop: 55\nledge: #fbd9e7';
  const p = dc.parse(body);
  assert.equal(p.reveal, 'envelope'); assert.equal(p.env, '#f2a9c6'); assert.equal(p.seal, ''); assert.equal(p.sealicon, 'paw');
  assert.equal(p.len, 'l'); assert.equal(p.once, true); assert.equal(p.pat, 'crowns'); assert.equal(p.patop, 55); assert.equal(p.ledge, '#fbd9e7');
  const c = dc.cleanBody(body);
  assert.match(c, /reveal: envelope/); assert.match(c, /env: #f2a9c6/); assert.match(c, /once: yes/); assert.match(c, /patop: 55/);
  const off = dc.cleanBody(c.replace('reveal: envelope', 'reveal: nope'));
  assert.doesNotMatch(off, /env:|reveal:|sealicon:|once:/);   // the envelope's own settings go with it
  assert.match(off, /pat: crowns/);                          // the wallpaper stays: it works without the envelope
  assert.doesNotMatch(dc.cleanBody('pat: \npatc: #ff0000'), /patc/);
});

test('Invitation Reveal markup: an envelope around the card, open without the script, still in the preview', () => {
  const blk = { id: 'w1', heading: 'Welcome', buttonText: 'Book', buttonUrl: '#book', body: 'style: royal\nreveal: envelope\nsec: glow\nsec2: #c9e4f5\npat: crowns\nledge: #fbd9e7\nhint: Scroll to open' };
  const h = dc.html({ theme: {} }, blk, {});
  assert.match(h, /class="blk blk-decocard[^"]* sg-rv /);
  assert.match(h, /--rv-len: 250vh/);
  assert.match(h, /sg-rv-live/);                                 // the little script that turns the envelope on
  assert.match(h, /class="sg-rv-envf" role="button" tabindex="0" aria-label="Open the invitation"/);
  assert.match(h, /<div class="sg-rv-sheet"><div class="blk-inner sg-dc-stage">.*<h2 class="sg-dc-h">Welcome<\/h2>.*<span class="sg-dc-ledge"/);
  assert.match(h, /--rv-glow: radial-gradient/);
  assert.match(h, /class="sg-dc-pat"[^>]*data:image\/svg\+xml/);
  assert.doesNotMatch(h, /data-reveal/);                         // no fade-in on top of the envelope
  assert.ok(!/<\/script>[\s\S]*<script/.test(h.replace(/<script>[^<]*<\/script>/, '')), 'only the one small script');
  const pv = dc.html({ theme: {} }, { ...blk, _i: 0 }, { pv: true });
  assert.doesNotMatch(pv, /<script/);                            // the owner's preview shows the card open
  const plain = dc.html({ theme: {} }, { ...blk, body: 'style: royal\nledge: #fbd9e7' }, {});
  assert.doesNotMatch(plain, /sg-rv/); assert.match(plain, /sg-dc-ledge/); assert.match(plain, /data-reveal/);
  assert.ok(dc.REVEAL_SCRIPT.includes('.sg-rv.sg-rv-live') && !/<\//.test(dc.REVEAL_SCRIPT));
  assert.ok(dc.REVEAL_SCRIPT.includes('window.sgReveal'), 'the editor can play it in the preview');
});
