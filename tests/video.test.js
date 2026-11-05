const { test } = require('node:test');
const assert = require('node:assert/strict');
const { videoInfo } = require('../video');

test('video links: YouTube, Vimeo and direct files are recognised; anything else is refused', () => {
  assert.equal(videoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(videoInfo('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.equal(videoInfo('https://youtu.be/dQw4w9WgXcQ?t=5').id, 'dQw4w9WgXcQ');
  assert.equal(videoInfo('https://youtube.com/shorts/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
  assert.match(videoInfo('https://youtu.be/dQw4w9WgXcQ').embed, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.equal(videoInfo('https://vimeo.com/123456789').embed, 'https://player.vimeo.com/video/123456789?autoplay=1&dnt=1');
  assert.deepEqual(videoInfo('https://cdn.example.com/clips/a.mp4?x=1'), { kind: 'file', src: 'https://cdn.example.com/clips/a.mp4?x=1' });
  assert.equal(videoInfo('/uploads/clip.webm').kind, 'file');
  for (const bad of ['', 'javascript:alert(1)', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://example.com/page.html', 'https://youtu.be/short', 'https://vimeo.com/abc', 'data:video/mp4;base64,AAA', 'https://x.com/a.mp4"onload="x']) assert.equal(videoInfo(bad), null, bad);
});
