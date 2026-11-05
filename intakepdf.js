// The client questionnaire as a PDF. The owner can download a blank, fillable PDF with the same questions as the
// online form (a client fills it in on a computer, or prints it and writes by hand), and upload a filled-out one.
// An uploaded PDF is read in two ways, with no extra packages:
//   1. its form fields, when it is our fillable PDF (exact, offline);
//   2. otherwise (a scan, a printed copy written by hand, any other PDF) the AI reads it, when an AI key is set.
// Either way the answers go through intake.clean like an online submission, and only what the client wrote is kept.
const zlib = require('zlib');
const intake = require('./intake');
const grounding = require('./grounding');

const N_SVC = 6, N_DIFF = 4, N_FAQ = 4;

// The questions, in the order of the online form. type: text | area (lines) | choice (options) | check | note
function fields() {
  const F = [];
  const sec = (title) => F.push({ type: 'section', label: title });
  const t = (name, label, opt = {}) => F.push({ type: 'text', name, label, ...opt });
  const a = (name, label, lines, opt = {}) => F.push({ type: 'area', name, label, lines, ...opt });
  sec('Your business');
  t('biz_name', 'Business name *'); t('biz_type', 'What kind of business is it? *');
  t('city', 'City or area you serve', { half: true }); t('years', 'Years in business', { half: true });
  t('tagline', 'In one sentence, what do you do for customers?');
  sec('Your services');
  F.push({ type: 'note', label: 'Up to 6 services. The price is optional (for example "from $90").' });
  for (let i = 1; i <= N_SVC; i++) { t('svc_name_' + i, `Service ${i}`, { wide: 0.68 }); t('svc_price_' + i, 'Price', { wide: 0.32, join: true }); t('svc_desc_' + i, `Short description of service ${i}`); }
  t('areas', 'Towns or neighborhoods you serve');
  sec('Your story');
  F.push({ type: 'note', label: 'What sets you apart? One short point per line.' });
  for (let i = 1; i <= N_DIFF; i++) t('diff_item_' + i, `Point ${i}`);
  a('about', 'Tell us about your business', 5);
  a('badges', 'Licenses, certifications, insurance or awards you can show (optional)', 2);
  F.push({ type: 'note', label: 'Questions your customers often ask, with your answers.' });
  for (let i = 1; i <= N_FAQ; i++) { t('faq_q_' + i, `Question ${i}`); a('faq_a_' + i, `Answer ${i}`, 2); }
  F.push({ type: 'choice', name: 'tone', label: 'How should the words sound?', options: grounding.TONES.map(x => [x[0], x[1]]) });
  sec('Contact details for the website');
  t('phone', 'Phone', { half: true }); t('email', 'Email for customers', { half: true });
  t('address', 'Business address (leave empty if you travel to customers)');
  t('hrs_weekday', 'Hours Monday to Friday', { third: true }); t('hrs_sat', 'Saturday', { third: true }); t('hrs_sun', 'Sunday', { third: true });
  t('facebook', 'Facebook page link', { half: true }); t('instagram', 'Instagram link', { half: true });
  sec('Look and feel');
  F.push({ type: 'choice', name: 'mood', label: 'Which look fits you best?', options: intake.MOODS.map(m => [m[0], m[1]]) });
  t('brand_color', 'Brand color, if you have one (for example #1e40af)');
  F.push({ type: 'check', name: 'stock_ok', label: 'Stock photos are fine until we have our own' });
  t('inspo', 'Websites you like (optional)'); t('inspo_like', 'What do you like about them?');
  sec('Goals and extras');
  F.push({ type: 'choice', name: 'goal', label: 'The main thing the website should do', options: [['', 'Choose one']].concat(intake.GOALS) });
  F.push({ type: 'note', label: 'Extras you would like (tick any):' });
  intake.FEATURES.forEach(f => F.push({ type: 'check', name: 'features_' + f[0], label: f[1] }));
  a('notes', 'Anything else we should know? (optional)', 3);
  sec('About you');
  t('contact_name', 'Your name *'); t('contact_email', 'Your email *', { half: true }); t('contact_phone', 'Your phone', { half: true });
  F.push({ type: 'check', name: 'agree', label: 'The information above is accurate and can be used on my website *' });
  F.push({ type: 'note', label: 'Please send your logo and photos with this form (by email or as attachments).' });
  return F;
}
const FIELD_NAMES = fields().filter(f => f.name).map(f => f.name);

// ---------- writing the blank fillable PDF ----------
const pdfStr = (s) => '(' + String(s).replace(/[^\x20-\x7e]/g, ' ').replace(/([\\()])/g, '\\$1') + ')';
// rough Helvetica width, to wrap labels
const textWidth = (s, size) => String(s).length * size * 0.5;
function wrap(s, size, max) {
  const out = []; let line = '';
  String(s).split(/\s+/).forEach(w => { const next = line ? line + ' ' + w : w; if (textWidth(next, size) > max && line) { out.push(line); line = w; } else line = next; });
  if (line) out.push(line);
  return out;
}

function makeBlank(opts = {}) {
  const W = 612, H = 792, M = 48, CW = W - M * 2;
  const pages = []; let page = null, y = 0;
  const newPage = () => { page = { ops: [], widgets: [] }; pages.push(page); y = H - M; };
  const need = (h) => { if (!page || y - h < M) newPage(); };
  const text = (s, x, yy, size, bold, gray) => page.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${gray || 0} g ${x} ${yy} Td ${pdfStr(s)} Tj ET`);
  const box = (x, yy, w, h) => page.ops.push(`0.97 0.98 1 rg 0.55 0.6 0.68 RG 0.8 w ${x} ${yy} ${w} ${h} re B`);

  newPage();
  text('Website questionnaire', M, y - 20, 20, true); y -= 34;
  if (opts.forName) { text('For: ' + opts.forName, M, y - 10, 11, false, 0.25); y -= 18; }
  wrap('Fill this in on your computer (Adobe Reader, Mac Preview or a web browser) and save it, or print it and write by hand. Questions marked * are needed. Leave anything you are not sure about empty: your website only says what you tell us here.', 10, CW)
    .forEach(l => { text(l, M, y - 10, 10, false, 0.3); y -= 14; });
  y -= 6;

  let row = null; // fields sharing a row: { x, h }
  fields().forEach((f) => {
    if (f.type === 'section') { need(60); y -= 14; text(f.label, M, y - 14, 13, true); page.ops.push(`0.85 0.87 0.9 RG 1 w ${M} ${y - 20} m ${M + CW} ${y - 20} l S`); y -= 30; return; }
    if (f.type === 'note') { const ls = wrap(f.label, 9.5, CW); need(ls.length * 13 + 4); ls.forEach(l => { text(l, M, y - 10, 9.5, false, 0.35); y -= 13; }); y -= 4; return; }
    if (f.type === 'choice') {
      // the choices are printed too, so a printed copy can be answered by hand (circle one)
      const ls = wrap('Choices: ' + f.options.filter(o => o[0]).map(o => o[1]).join('  /  '), 8.5, CW);
      need(ls.length * 11 + 44);
      text(f.label, M, y - 10, 9.5, false, 0.15); box(M, y - 34, CW, 20); page.widgets.push({ f, rect: [M, y - 34, M + CW, y - 14] }); y -= 40;
      ls.forEach(l => { text(l, M, y - 8, 8.5, false, 0.4); y -= 11; }); y -= 6; row = null; return;
    }
    if (f.type === 'check') { need(22); box(M, y - 14, 13, 13); text(f.label, M + 20, y - 11, 10); page.widgets.push({ f, rect: [M, y - 14, M + 13, y - 1] }); y -= 22; return; }
    const frac = f.wide || (f.half ? 0.5 : f.third ? 1 / 3 : 1);
    const h = f.type === 'area' ? f.lines * 14 + 8 : 20;
    if (!row || !(f.join || f.half || f.third) || row.used + frac > 1.001) {
      // a new row; fields of a row share one line (half / third widths, or a joined price)
      need(h + 18); row = { used: 0, top: y }; y -= h + 20;
    }
    const gap = row.used ? 10 : 0, x = M + CW * row.used + gap, w = CW * frac - gap;
    text(f.label, x, row.top - 10, 9.5, false, 0.15);
    box(x, row.top - 14 - h, w, h);
    page.widgets.push({ f, rect: [x, row.top - 14 - h, x + w, row.top - 14] });
    row.used += frac;
    if (row.used >= 0.999) row = null;
  });

  // objects: 1 catalog, 2 pages, 3 acroform, 4 Helvetica, 5 ZapfDingbats, 6 Helvetica-Bold, 7/8 checkbox looks, then pages
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add(''); add(''); add('');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /ZapfDingbats >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const stream = (dict, data) => `<< ${dict} /Length ${Buffer.byteLength(data, 'latin1')} >>\nstream\n${data}\nendstream`;
  const yes = add(stream('/Type /XObject /Subtype /Form /BBox [0 0 13 13] /Resources << /Font << /ZaDb 5 0 R >> >>', '0 g BT /ZaDb 10 Tf 2 2.5 Td (4) Tj ET'));
  const off = add(stream('/Type /XObject /Subtype /Form /BBox [0 0 13 13]', ''));
  const fieldRefs = [], pageRefs = [];
  pages.forEach(pg => {
    const content = add(stream('', pg.ops.join('\n')));
    const pageNo = objs.length + 1 + pg.widgets.length; // the page object comes after its widgets
    const annots = pg.widgets.map(({ f, rect }) => {
      const r = `/Rect [${rect.map(n => n.toFixed(1)).join(' ')}]`;
      const base = `/Type /Annot /Subtype /Widget /T ${pdfStr(f.name)} /TU ${pdfStr(f.label)} ${r} /F 4 /P ${pageNo} 0 R`;
      let body;
      if (f.type === 'check') body = `<< ${base} /FT /Btn /V /Off /AS /Off /DA (/ZaDb 0 Tf 0 g) /MK << /CA (4) >> /AP << /N << /Yes ${yes} 0 R /Off ${off} 0 R >> >> >>`;
      else if (f.type === 'choice') body = `<< ${base} /FT /Ch /Ff 131072 /Opt [${f.options.map(o => `[${pdfStr(o[0])} ${pdfStr(o[1])}]`).join(' ')}] /V () /DA (/Helv 10 Tf 0 g) >>`;
      else body = `<< ${base} /FT /Tx /V () /DA (/Helv 10 Tf 0 g)${f.type === 'area' ? ' /Ff 4096' : ''}${f.name === 'years' ? ' /MaxLen 4' : ''} >>`;
      const ref = add(body); fieldRefs.push(ref); return ref;
    });
    const p = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents ${content} 0 R /Annots [${annots.map(n => n + ' 0 R').join(' ')}] >>`);
    if (p !== pageNo) throw new Error('page object numbering');
    pageRefs.push(p);
  });
  objs[0] = '<< /Type /Catalog /Pages 2 0 R /AcroForm 3 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${pageRefs.map(n => n + ' 0 R').join(' ')}] /Count ${pageRefs.length} >>`;
  objs[2] = `<< /Fields [${fieldRefs.map(n => n + ' 0 R').join(' ')}] /NeedAppearances true /DA (/Helv 10 Tf 0 g) /DR << /Font << /Helv 4 0 R /ZaDb 5 0 R >> >> >>`;

  let out = '%PDF-1.7\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objs.map((body, i) => { const at = Buffer.byteLength(out, 'latin1'); out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title (Website questionnaire) /Producer (SiteGen) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- reading a filled PDF's form fields ----------
// A small PDF object parser: enough for field dictionaries (names, strings, numbers, arrays, dictionaries, references),
// including objects packed in compressed object streams and later edits appended to the file.
function parseObj(s, i) {
  const ws = () => { while (i < s.length) { const c = s[i]; if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; } else if (' \t\r\n\f\0'.includes(c)) i++; else break; } };
  const val = () => {
    ws();
    const c = s[i];
    if (c === '<' && s[i + 1] === '<') {
      i += 2; const d = {};
      for (;;) { ws(); if (s[i] === '>' && s[i + 1] === '>') { i += 2; return d; } if (i >= s.length) return d; const k = val(); const v = val(); if (k && k.name) d[k.name] = v; }
    }
    if (c === '<') { const j = s.indexOf('>', i); const hex = s.slice(i + 1, j).replace(/\s/g, ''); i = j + 1; return { str: Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex').toString('latin1') }; }
    if (c === '(') {
      let depth = 1, out = ''; i++;
      while (i < s.length && depth) {
        const ch = s[i++];
        if (ch === '\\') {
          const e = s[i++];
          if (e === 'n') out += '\n'; else if (e === 'r') out += '\r'; else if (e === 't') out += '\t'; else if (e === 'b') out += '\b'; else if (e === 'f') out += '\f';
          else if (e === '\r') { if (s[i] === '\n') i++; } else if (e === '\n') { /* line continues */ }
          else if (/[0-7]/.test(e)) { let o = e; while (o.length < 3 && /[0-7]/.test(s[i])) o += s[i++]; out += String.fromCharCode(parseInt(o, 8) & 255); }
          else out += e;
        } else if (ch === '(') { depth++; out += ch; } else if (ch === ')') { if (--depth) out += ch; } else out += ch;
      }
      return { str: out };
    }
    if (c === '[') { i++; const a = []; for (;;) { ws(); if (s[i] === ']' || i >= s.length) { i++; return a; } a.push(val()); } }
    if (c === '/') { let j = i + 1; while (j < s.length && !/[\s/<>\[\]()%{}]/.test(s[j])) j++; const n = s.slice(i + 1, j).replace(/#([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))); i = j; return { name: n }; }
    const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(?:\s+(\d+)\s+R(?![A-Za-z]))?/.exec(s.slice(i, i + 40));
    if (m) { i += m[0].length; return m[2] !== undefined ? { ref: +m[1] } : +m[1]; }
    const w = /^[A-Za-z]+/.exec(s.slice(i, i + 10));
    if (w) { i += w[0].length; return w[0] === 'true' ? true : w[0] === 'false' ? false : null; }
    i++; return null;
  };
  const v = val();
  return { v, end: i };
}

// PDFDocEncoding: Latin-1 except 0x80-0xA0, where it has curly quotes, dashes and a few letters
const PDFDOC = [0x2022, 0x2020, 0x2021, 0x2026, 0x2014, 0x2013, 0x0192, 0x2044, 0x2039, 0x203A, 0x2212, 0x2030, 0x201E, 0x201C, 0x201D, 0x2018,
  0x2019, 0x201A, 0x2122, 0xFB01, 0xFB02, 0x0141, 0x0152, 0x0160, 0x0178, 0x017D, 0x0131, 0x0142, 0x0153, 0x0161, 0x017E, 0xFFFD, 0x20AC];
const pdfDoc = (s) => s.replace(/[\x80-\xa0]/g, c => String.fromCharCode(PDFDOC[c.charCodeAt(0) - 0x80]));
// PDF text strings: UTF-16BE (with its byte order mark) or the PDF's own Latin-like encoding
function textOf(v) {
  if (!v || v.str === undefined) return v && v.name ? v.name : '';
  const s = v.str;
  if (s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    const b = Buffer.from(s.slice(2), 'latin1'); let out = '';
    for (let k = 0; k + 1 < b.length; k += 2) out += String.fromCharCode((b[k] << 8) | b[k + 1]);
    return out;
  }
  if (s.charCodeAt(0) === 0xef && s.charCodeAt(1) === 0xbb && s.charCodeAt(2) === 0xbf) return Buffer.from(s.slice(3), 'latin1').toString('utf8');
  return pdfDoc(s);
}

function readObjects(buf) {
  const s = buf.toString('latin1'), objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  while ((m = re.exec(s))) {
    let parsed;
    try { parsed = parseObj(s, m.index + m[0].length); } catch { continue; }
    const num = +m[1], v = parsed.v;
    objs.set(num, v);
    // a compressed object stream: unpack the objects inside it
    if (v && v.Type && v.Type.name === 'ObjStm') {
      const at = s.indexOf('stream', parsed.end);
      if (at < 0) continue;
      let start = at + 6; if (s[start] === '\r') start++; if (s[start] === '\n') start++;
      const len = typeof v.Length === 'number' ? v.Length : -1;
      const end = len > 0 ? start + len : s.indexOf('endstream', start);
      let data;
      try { data = zlib.inflateSync(buf.subarray(start, end)).toString('latin1'); } catch { try { data = zlib.inflateSync(buf.subarray(start, s.indexOf('endstream', start))).toString('latin1'); } catch { continue; } }
      const head = data.slice(0, v.First).trim().split(/\s+/).map(Number);
      for (let k = 0; k + 1 < head.length; k += 2) {
        try { objs.set(head[k], parseObj(data, v.First + head[k + 1]).v); } catch { /* skip a bad object */ }
      }
      re.lastIndex = end;
    }
  }
  return { objs, encrypted: /\/Encrypt\s/.test(s.slice(-4096)) || /\/Encrypt\s+\d+\s+\d+\s+R/.test(s) };
}

// All form fields with a value: { fullName: value }. Checkboxes give their "on" name (or ''), lists their choice.
function readForm(buf) {
  const { objs, encrypted } = readObjects(buf);
  if (encrypted) return { encrypted: true, fields: {} };
  const get = (v) => (v && v.ref !== undefined ? objs.get(v.ref) : v);
  const fullName = (d, depth = 0) => {
    const own = d.T ? textOf(d.T) : '';
    const parent = depth < 12 ? get(d.Parent) : null;
    const up = parent && typeof parent === 'object' ? fullName(parent, depth + 1) : '';
    return [up, own].filter(Boolean).join('.');
  };
  const fields = {};
  for (const d of objs.values()) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || !d.T) continue;
    let v = get(d.V);
    if (v === undefined || v === null) continue;
    let out;
    if (Array.isArray(v)) out = v.map(textOf).filter(Boolean).join(', ');
    else if (v.name !== undefined) out = v.name === 'Off' ? '' : v.name;
    else out = textOf(v);
    const name = fullName(d);
    if (name && String(out).trim()) fields[name] = String(out).replace(/\r\n?/g, '\n').trim();
  }
  return { encrypted: false, fields };
}

// ---------- answers to the online form's field names ----------
// Works for our fillable PDF's fields and for the AI's reading of any questionnaire (it answers with the same names).
function toBody(f) {
  const val = (k) => String(f[k] == null ? '' : f[k]).trim();
  const b = {};
  ['biz_name', 'biz_type', 'city', 'years', 'tagline', 'areas', 'about', 'badges', 'phone', 'email', 'address', 'hrs_weekday', 'hrs_sat', 'hrs_sun',
    'facebook', 'instagram', 'brand_color', 'inspo', 'inspo_like', 'notes', 'contact_name', 'contact_email', 'contact_phone'].forEach(k => { if (val(k)) b[k] = val(k); });
  if (b.years) b.years = b.years.replace(/\D/g, '');
  if (b.brand_color && /^[0-9a-f]{6}$/i.test(b.brand_color)) b.brand_color = '#' + b.brand_color;
  // a link typed without https:// still counts
  ['facebook', 'instagram'].forEach(k => { if (b[k] && !/^https?:\/\//i.test(b[k]) && /^[\w.-]+\.[a-z]{2,}\//i.test(b[k])) b[k] = 'https://' + b[k]; });
  b.svc_name = []; b.svc_desc = []; b.svc_price = [];
  for (let i = 1; i <= 8; i++) if (val('svc_name_' + i)) { b.svc_name.push(val('svc_name_' + i)); b.svc_desc.push(val('svc_desc_' + i)); b.svc_price.push(val('svc_price_' + i)); }
  b.diff_item = []; for (let i = 1; i <= 5; i++) if (val('diff_item_' + i)) b.diff_item.push(val('diff_item_' + i));
  b.faq_q = []; b.faq_a = []; for (let i = 1; i <= 6; i++) if (val('faq_q_' + i) && val('faq_a_' + i)) { b.faq_q.push(val('faq_q_' + i)); b.faq_a.push(val('faq_a_' + i)); }
  // choices: the id, or the label a reader may have stored instead
  const pick = (k, list) => { const v = val(k).toLowerCase(); const hit = list.find(o => o[0] && (o[0].toLowerCase() === v || String(o[1]).toLowerCase() === v)); if (hit) b[k] = hit[0]; };
  pick('tone', grounding.TONES); pick('mood', intake.MOODS); pick('goal', intake.GOALS);
  const on = (k) => { const v = val(k).toLowerCase(); return !!v && !['off', 'no', 'false', '0'].includes(v); };
  b.features = intake.FEATURES.map(x => x[0]).filter(id => on('features_' + id));
  if (on('stock_ok')) b.stock_ok = '1';
  if (on('agree')) b.agree = '1';
  return b;
}

// ---------- the AI reading any questionnaire PDF (a scan, handwriting, another layout) ----------
const AI_SYSTEM = `You read a filled-in questionnaire that a small business owner completed for their new website, and copy their answers into JSON.

Hard rules:
- Copy only what the client actually wrote or ticked. Never guess, complete, improve or invent anything. If an answer is blank, unreadable or not asked, leave that key out.
- Keep the client's own words. Fix nothing except obvious line breaks.
- Output a single JSON object and nothing else.`;

function aiPrompt() {
  const lines = fields().filter(f => f.name).map(f => {
    if (f.type === 'choice') return `${f.name}: ${f.label} One of: ${f.options.filter(o => o[0]).map(o => `"${o[0]}" (${o[1]})`).join(', ')}`;
    if (f.type === 'check') return `${f.name}: "yes" if ticked: ${f.label}`;
    return `${f.name}: ${f.label}`;
  });
  return `Copy the client's answers into a JSON object using these keys (strings only). Services, points, and questions are numbered from 1 in the order they appear.\n${lines.join('\n')}`;
}

async function aiRead(buf, ai) {
  if (!ai || !ai.hasAiProvider()) return null;
  const reply = await ai.complete({
    system: AI_SYSTEM, maxTokens: 4000,
    content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }, { type: 'text', text: aiPrompt() }]
  });
  if (!reply) return null;
  const m = /\{[\s\S]*\}/.exec(reply);
  if (!m) return null;
  try {
    const raw = JSON.parse(m[0]), out = {};
    FIELD_NAMES.forEach(k => { if (raw[k] != null && typeof raw[k] !== 'object') out[k] = String(raw[k]).slice(0, 2000); });
    return out;
  } catch { return null; }
}

// Read an uploaded questionnaire: { d (cleaned answers), source: 'form' | 'ai', found (count) } or { error }
async function read(buf, ai) {
  if (!Buffer.isBuffer(buf) || buf.subarray(0, 1024).indexOf('%PDF-') < 0) return { error: 'notpdf' };
  let source = 'form', f = {};
  try {
    const r = readForm(buf);
    f = Object.fromEntries(Object.entries(r.fields).filter(([k]) => FIELD_NAMES.includes(k)));
  } catch { f = {}; }
  // our own form sent back without answers
  if (!Object.keys(f).length && buf.indexOf('(biz_name)') >= 0) return { error: 'empty' };
  if (!Object.keys(f).length) {
    const got = await aiRead(buf, ai).catch(() => null);
    if (!got) return { error: ai && ai.hasAiProvider() ? 'unreadable' : 'noform' };
    f = got; source = 'ai';
  }
  const d = intake.clean(toBody(f));
  const found = Object.keys(f).length;
  if (!d.bizName) return { error: 'empty' };
  return { d, source, found };
}

module.exports = { fields, FIELD_NAMES, makeBlank, readForm, readObjects, toBody, aiPrompt, read };
