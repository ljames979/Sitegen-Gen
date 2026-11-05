const test = require('node:test');
const assert = require('node:assert');
const ab = require('../aboutblocks');
const op = require('../offsetphoto');

test('about us blocks: every spec has a name, a picture, sides and known field kinds', () => {
  assert.equal(ab.ABOUT_TYPES.length, 7); assert.equal(ab.TYPES.length, 16);
  ab.TYPES.forEach(t => {
    const s = ab.SPECS[t];
    assert.ok(s.name && s.desc && s.pic && s.hint && s.group, t);
    if (s.group === 'about') assert.ok(s.photoLabel && s.sides.length >= 2, t);
    s.fields.forEach(f => assert.ok(['line', 'url', 'paras', 'rows', 'color', 'toggle', 'hint'].includes(f.kind), t + ' ' + f.k));
  });
});

test('about us blocks: parse and clean lines, rows, colors and switches; bad parts dropped', () => {
  const body = ['label: Get | to know', 'caption: Hi', 'item: Grooming | Baths | and trims', 'item: | ', 'item: A | a', 'item: B | b', 'item: C | c', 'item: D | d', 'color: #3D6FD8', 'accent: yellow', 'nope: x'].join('\n');
  const p = ab.parse('aboutme', body);
  assert.equal(p.label, 'Get to know'); assert.equal(p.item.length, 4);
  assert.deepEqual(p.item[0], { title: 'Grooming', words: 'Baths and trims' });
  assert.equal(p.color, '#3d6fd8'); assert.equal(p.accent, '');
  assert.equal(ab.cleanBody('aboutme', 'color: #3d6fd8\nlabel: Hi'), 'label: Hi\ncolor: #3d6fd8');
  assert.equal(ab.cleanBody('aboutfacts', 'shapes: on\nfact: One\nfact: Two'), 'fact: One\nfact: Two');
  assert.equal(ab.cleanBody('aboutfacts', 'shapes: off'), 'shapes: off');
  assert.equal(ab.cleanBody('aboutcollage', 'round: javascript:x\nround: /uploads/b.jpg'), 'round: /uploads/b.jpg');
  assert.equal(ab.cleanBody('nope', 'label: x'), '');
  assert.equal(ab.cleanSide('aboutpanel', 'x'), 'right'); assert.equal(ab.cleanSide('aboutstory', 'left'), 'left'); assert.equal(ab.cleanSide('aboutme', 'x'), 'left');
});

test('about us blocks: view fills photos from the site, cut-outs, colors with readable text', () => {
  const site = { theme: {}, sections: { about: { imageUrl: '/uploads/about.jpg' }, hero: { imageUrl: '/uploads/hero.jpg' } } };
  const v = ab.view('aboutcollage', site, { heading: 'We [care]', imageUrl: '/uploads/cut-me.webp' }, []);
  assert.equal(v.main.cut, true); assert.equal(v.round.length, 2);
  assert.ok(v.round.every(r => r.photo), 'empty round photos use the site photos');
  assert.match(v.style, /--ab-color: #f2a516; --ab-color-on: #111111; --ab-color-ink: #[0-9a-f]{6};/);
  assert.match(v.headingHtml, /<em class="sg-hl">care<\/em>/);
  const n = ab.view('aboutnote', site, { body: 'name: Maria\nbg: #000000' }, []);
  assert.equal(n.main.photo, '/uploads/about.jpg'); assert.deepEqual(n.portrait, [], 'no portrait is made up');
  assert.equal(n.ownBg, true); assert.match(n.style, /--ab-bg: #000000; --edge: #000000/);
  assert.equal(ab.view('aboutpanel', site, { body: 'color: #ffffff' }, []).button, null);
});

test('photo on two color blocks: label, paragraphs, note, four colors, shapes, sides; button shade reads on white', () => {
  const p = op.parse(['label: About | us', 'text: One', 'text: Two', 'text: 3', 'text: 4', 'note: By us', 'color: #A9C4E2', 'accent: pink', 'button: #1b2a4a', 'bg: #ffffff', 'shapes: off'].join('\n'));
  assert.deepEqual(p, { label: 'About us', text: ['One', 'Two', '3'], note: 'By us', color: '#a9c4e2', accent: '', button: '#1b2a4a', bg: '#ffffff', shapes: false });
  assert.equal(op.cleanBody('shapes: on\nbg: #000000\nlabel: Hi'), 'label: Hi\nbg: #000000');
  assert.equal(op.cleanSide('right'), 'right'); assert.equal(op.cleanSide('x'), 'left');
  const site = { sections: { about: { imageUrl: '/uploads/about.jpg' } } };
  const v = op.view(site, { imageUrl: '/uploads/cut-a.webp' }, []);
  assert.equal(v.cut, true); assert.equal(v.color, '#a9c4e2'); assert.equal(v.accent, '#f2b0b5');
  assert.notEqual(v.button, '#a9c4e2', 'the pale blue button is deepened to read on white');
  assert.equal(op.view(site, { body: 'button: #1b2a4a' }, []).buttonOn, '#ffffff');
});

test('social media blocks: links fall back to the Contact section, bad links and networks dropped, counts link to their network', () => {
  const site = { sections: { contact: { social: { facebook: 'https://facebook.com/a', twitter: 'https://twitter.com/a' } } } };
  const v = ab.view('socialcounts', site, { body: 'count: youtube | 2k | subs\ncount: nope | 5 | x\ncount: tiktok | 1k |\nyoutube: https://youtube.com/@a\ntiktok: http://tiktok.com/@a' }, []);
  assert.deepEqual(v.links.map(l => l.k), ['facebook', 'x', 'youtube']);
  assert.deepEqual(v.count.map(r => [r.net, r.url]), [['youtube', 'https://youtube.com/@a'], ['tiktok', '']], 'http links are not kept');
  assert.equal(v.main.photo, '', 'no photo slot, no photo');
  assert.equal(ab.cleanSide('socialstrip', 'left'), 'center');
  const f = ab.view('socialfeed', { sections: { about: { imageUrl: '/uploads/a.jpg' }, hero: { imageUrl: '/uploads/h.jpg' } } }, { body: 'photo: /uploads/x.jpg' }, []);
  assert.deepEqual(f.photo.map(p => p.photo), ['/uploads/x.jpg', '/uploads/h.jpg', '/uploads/a.jpg'], 'empty feed boxes use only the site\'s own photos');
});

test('list blocks that grow: up to 12 rows, links only https or on the site, numbers switch', () => {
  const body = Array.from({ length: 15 }, (_, i) => 'item: T' + i + ' | W' + i + ' | /p' + i).join('\n') + '\nitem: Bad | x | http://x.com\nmore: Read';
  const p = ab.parse('tipcards', body);
  assert.equal(p.item.length, 12); assert.equal(p.item[0].link, '/p0'); assert.equal(p.more, 'Read');
  assert.equal(ab.parse('tipcards', 'item: A | b | http://x.com').item[0].link, '');
  assert.equal(ab.parse('tipcards', 'item: A | b | https://x.com/a').item[0].link, 'https://x.com/a');
  assert.equal(ab.parse('numcards', 'numbers: off').numbers, false);
  assert.equal(ab.cleanSide('numcards', 'x'), 'right'); assert.equal(ab.cleanSide('tipcards', 'left'), 'center');
  const v = ab.view('numcards', { sections: { about: { imageUrl: '/uploads/a.jpg' } } }, { body: 'item: A | b\ndark: #000000' }, []);
  assert.match(v.style, /--ab-dark: #000000; --ab-dark-on: #ffffff;/); assert.equal(v.main.photo, '/uploads/a.jpg');
});
