const test = require('node:test');
const assert = require('node:assert');
const ad = require('../adviceblock');

test('photo with round-photo points: 1 to 4 big photos that take turns, up to 4 points with optional round photos', () => {
  const body = 'photos: /uploads/a.jpg bad /uploads/b.jpg /uploads/c.jpg /uploads/d.jpg /uploads/e.jpg\nitem: /uploads/r.jpg | Brush | often\nitem: Just words\nitem: javascript:x | Unsafe photo dropped\nitem: | \nitem: /uploads/s.jpg | Four\nitem: /uploads/t.jpg | Five is too many\nnoise: y';
  const p = ad.parse(body);
  assert.deepEqual(p.photos, ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg', '/uploads/d.jpg']);
  assert.deepEqual(p.items, [{ photo: '/uploads/r.jpg', text: 'Brush often' }, { photo: '', text: 'Just words' }, { photo: '', text: 'Unsafe photo dropped' }, { photo: '/uploads/s.jpg', text: 'Four' }]);
  assert.match(ad.cleanBody(body), /^photos: \/uploads\/a\.jpg \/uploads\/b\.jpg \/uploads\/c\.jpg \/uploads\/d\.jpg\nitem: \/uploads\/r\.jpg \| Brush often\nitem:  \| Just words/);
  assert.equal(ad.cleanSide('right'), 'right'); assert.equal(ad.cleanSide('x'), 'left');
  const v = ad.view({ theme: { primaryColor: '#2563eb' }, sections: {} }, { heading: 'Dog [care]', body: 'photos: /uploads/a.jpg /uploads/b.jpg' }, []);
  assert.equal(v.turns, true); assert.match(v.band, /^#[0-9a-f]{6}$/);
  assert.equal(ad.view({ sections: {} }, { body: 'photos: /uploads/a.jpg' }, []).turns, false);
});
