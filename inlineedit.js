// Edit on the page (Blocks screen): the owner clicks words or a photo in the preview and changes it there. The page
// only knows what it shows, so the change is matched back to the one saved box that holds those words (or that
// photo), preferring the clicked block's own section. Nothing is changed when the match is missing or not unique:
// words the design writes itself (a "Talk to ..." heading) or the same words in two boxes are edited in the editor.
// [Highlighted] and {{styled|...}} words keep their marks when those words are still there.
const SECTION_OF = { hero: 'hero', about: 'about', services: 'services', why: 'whyChoose', testimonials: 'testimonials', faq: 'faq',
  gallery: 'gallery', contact: 'contact', stats: 'trust', logos: 'trust', banner: 'trust', areas: 'trust', pricing: 'services', cta: 'contact' };
// keys whose values are settings, not words a visitor reads
const SKIP = /^(id|slug|page|layout|design|align|pill|scrim|scrimLayout|focal[XY]|icon|kind|type|style|variant|href|link|ctaLink|buttonUrl|url|videoUrl|email|notifyEmail|phone|date)$/i;
const IMG = /\.(?:jpe?g|png|gif|webp|avif|svg)(?:[?#].*)?$/i;

const MARK = /\{\{([^{}|<>]{1,300}?)((?:\|[^{}|<>]{0,40}){1,6})\}\}/g;
const plain = (t) => String(t || '').replace(MARK, '$1').replace(/[\[\]]/g, '');
const norm = (t) => plain(t).replace(/\s+/g, ' ').trim().toLowerCase();
const fileKey = (u) => { const m = /([^\/?#]+?)(?:-\d{2,4})?\.(?:jpe?g|png|gif|webp|avif|svg)(?:[?#].*)?$/i.exec(String(u || '')); return m ? m[1].toLowerCase() : ''; };

// every string in the saved sections, with the box that holds it and its section: [{ obj, key, value, top }]
function leaves(sections) {
  const out = [];
  for (const top of Object.keys(sections || {})) {
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 6) return;
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (typeof v === 'string') out.push({ obj: o, key: k, value: v, top });
        else if (v && typeof v === 'object') walk(v, depth + 1);
      }
    })(sections[top], 0);
  }
  return out;
}

// the owner's new words with the old box's [highlight] and {{style}} marks put back on the words still there
function keepMarks(orig, next) {
  let out = next;
  const styled = []; String(orig).replace(MARK, (m, w, o) => { styled.push([w, o]); return m; });
  for (const [w, o] of styled) { const at = out.indexOf(w); if (at >= 0 && !out.slice(Math.max(0, at - 2), at).includes('{{')) out = out.slice(0, at) + '{{' + w + o + '}}' + out.slice(at + w.length); }
  const hl = /\[([^\]]+)\]/.exec(String(orig).replace(MARK, '$1'));
  if (hl) { const at = out.indexOf(hl[1]); if (at >= 0) out = out.slice(0, at) + '[' + hl[1] + ']' + out.slice(at + hl[1].length); }
  return out;
}

function pick(cands, fam) {
  const home = SECTION_OF[fam];
  const mine = home ? cands.filter(c => c.top === home) : [];
  return mine.length ? mine : cands;
}

// change one box in place. Returns { ok: true, where } or { ok: false, error }
function apply(sections, req, isSafeUrl) {
  const kind = req && req.kind, fam = String((req && req.fam) || '');
  if (kind === 'text') {
    const old = norm(req.old), next = String(req.new == null ? '' : req.new).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim();
    if (!old) return { ok: false, error: 'Nothing to change there.' };
    if (!next) return { ok: false, error: 'Words cannot be left empty here. To remove them, clear the box in the editor.' };
    if (next.length > 2000) return { ok: false, error: 'That is too long for one box (2,000 characters at most).' };
    const cands = pick(leaves(sections).filter(l => !SKIP.test(l.key) && !IMG.test(l.value) && norm(l.value) === old), fam);
    if (!cands.length) return { ok: false, error: 'Those words are written by the design, so they are changed in the editor.' };
    if (cands.length > 1 && new Set(cands.map(c => c.obj)).size > 1) return { ok: false, error: 'Those words are in more than one place, so change them in the editor.' };
    const c = cands[0];
    // a box kept on one line stays on one line (the page may wrap it with a line break)
    const words = /\n/.test(c.value) ? next : next.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ');
    c.obj[c.key] = /[\[\]]|\{\{/.test(c.value) ? keepMarks(c.value, words) : words;
    return { ok: true, where: c.top + '.' + c.key };
  }
  if (kind === 'photo') {
    const key = fileKey(req.old), next = String(req.new || '').trim();
    if (!key) return { ok: false, error: 'That photo could not be found.' };
    if (!/^(\/uploads\/|https:\/\/)[^\s"'<>]+$/i.test(next) || (isSafeUrl && !isSafeUrl(next))) return { ok: false, error: 'That photo address cannot be used.' };
    const cands = pick(leaves(sections).filter(l => fileKey(l.value) === key), fam);
    if (!cands.length) return { ok: false, error: 'That photo is part of the design, so it is changed in the editor.' };
    const c = cands[0];
    c.obj[c.key] = next;
    return { ok: true, where: c.top + '.' + c.key };
  }
  return { ok: false, error: 'Unknown change.' };
}

// the site's own photos, to pick from
function photos(sections) {
  const seen = new Set(), out = [];
  for (const l of leaves(sections)) {
    const v = l.value.trim();
    if (!fileKey(v) || !/^(\/uploads\/|https:\/\/)/i.test(v) || /favicon|touchicon|logo/i.test(l.key) || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out.slice(0, 40);
}

module.exports = { apply, photos, norm, fileKey, keepMarks, SECTION_OF };
