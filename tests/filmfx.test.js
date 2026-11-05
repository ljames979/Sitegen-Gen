const test = require('node:test');
const assert = require('node:assert');
const film = require('../filmfx');

test('color film: only known strengths and real colors; brand color from the theme', () => {
  assert.equal(film.clean('brand:30'), 'brand:30'); assert.equal(film.clean('#FF5500:60'), '#ff5500:60');
  assert.equal(film.clean('brand:35'), ''); assert.equal(film.clean('red:30'), ''); assert.equal(film.clean(''), '');
  assert.equal(film.fromFields('40', ''), 'brand:40'); assert.equal(film.fromFields('40', '#123456'), '#123456:40'); assert.equal(film.fromFields('', '#123456'), '');
  assert.deepEqual(film.parts('#123456:20'), { on: true, color: '#123456', strength: '20' });
  assert.deepEqual(film.attrs('brand:50', { primaryColor: '#000000' }), { cls: ' sg-film', style: '--film-c: rgba(0, 0, 0, 0.5);' });
  assert.deepEqual(film.attrs('', { primaryColor: '#000000' }), { cls: '', style: '' });
  assert.match(film.CSS, /pointer-events:none/);
});
