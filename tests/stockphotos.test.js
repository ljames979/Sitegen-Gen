const test = require('node:test');
const assert = require('node:assert');
const photos = require('../photos');
const images = require('../images');

test('stock photo sizes: Pexels and Unsplash addresses at a chosen width, keeping Unsplash\'s own settings', () => {
  const px = 'https://images.pexels.com/photos/77/pexels-photo-77.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  assert.equal(photos.sizedStock(px, 2400), 'https://images.pexels.com/photos/77/pexels-photo-77.jpeg?auto=compress&cs=tinysrgb&w=2400');
  assert.equal(photos.sizedStock(px, 1600, '&amp;'), 'https://images.pexels.com/photos/77/pexels-photo-77.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1600');
  assert.equal(photos.sizedStock('https://images.unsplash.com/photo-1?ixid=a&ixlib=rb-4.0.3&q=75&w=1080&h=700', 1600), 'https://images.unsplash.com/photo-1?ixid=a&ixlib=rb-4.0.3&q=75&fit=max&w=1600');
  assert.equal(photos.sizedStock('https://example.com/a.jpg?w=10', 1600), 'https://example.com/a.jpg?w=10', 'other sites are left alone');
});

test('stock photo sizes: a page gets srcsets on stock <img> tags and 2400px copies for backgrounds', () => {
  const px = 'https://images.pexels.com/photos/77/pexels-photo-77.jpeg?auto=compress&amp;cs=tinysrgb&amp;h=650&amp;w=940';
  const html = images.optimizeHtml(`<head></head><main><img src="${px}" alt="Roof"><div style="--hero-photo: url('${px}')" data-hero-photo="${px}"></div><style>.x { background-image: url(https://images.unsplash.com/photo-9?ixid=a&w=1080) }</style><img src="https://example.com/x.jpg" alt=""></main>`);
  assert.doesNotMatch(html, /w=940|photo-9[^)]*w=1080/, 'no small copies left');
  assert.match(html, /<img srcset="https:\/\/images\.pexels\.com\/photos\/77\/pexels-photo-77\.jpeg\?auto=compress&amp;cs=tinysrgb&amp;w=640 640w, [^"]+&amp;w=1080 1080w, [^"]+&amp;w=1600 1600w, [^"]+&amp;w=2400 2400w" sizes="[^"]+" src="[^"]+&amp;w=1600" alt="Roof"/);
  assert.match(html, /--hero-photo: url\('https:\/\/images\.pexels\.com\/photos\/77\/pexels-photo-77\.jpeg\?auto=compress&amp;cs=tinysrgb&amp;w=2400'\)/);
  assert.match(html, /url\(https:\/\/images\.unsplash\.com\/photo-9\?ixid=a&q=80&fit=max&w=2400\)/, 'inside <style> the plain & stays');
  assert.match(html, /<img src="https:\/\/example\.com\/x\.jpg" alt="">/, 'other photos are left alone');
});
