// Turns a pasted video link into something safe to embed.
// Supported: YouTube, Vimeo, and direct .mp4/.webm/.ogg files. Anything else -> null.
function videoInfo(url) {
  const u = String(url || '').trim();
  let m;
  if ((m = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})(?:[&#].*)?$/i.exec(u))
    || (m = /^https?:\/\/youtu\.be\/([\w-]{11})(?:[?#].*)?$/i.exec(u))
    || (m = /^https?:\/\/(?:www\.)?youtube\.com\/(?:embed|shorts)\/([\w-]{11})(?:[?#].*)?$/i.exec(u))) {
    return { kind: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`, poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  }
  if ((m = /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d{5,12})(?:[/?#].*)?$/i.exec(u))
    || (m = /^https?:\/\/player\.vimeo\.com\/video\/(\d{5,12})(?:[?#].*)?$/i.exec(u))) {
    return { kind: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1`, poster: '' };
  }
  if (/^(https?:\/\/|\/)[^\s"'<>]+\.(mp4|webm|ogg)(\?[^\s"'<>]*)?$/i.test(u)) return { kind: 'file', src: u };
  return null;
}
module.exports = { videoInfo };
