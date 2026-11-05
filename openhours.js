// "Open now" badge: reads the Hours rows the owner typed ("Mon–Fri" / "9:00 AM – 5:00 PM")
// into a weekly schedule. If any row can't be read for sure, parse() returns null and no
// badge is shown, because a wrong "Open now" is worse than none.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayOf(word) {
  const w = word.replace(/\.$/, '');
  if (w === 'weds') return 3;
  return w.length >= 3 ? DAY_NAMES.findIndex(d => d.startsWith(w)) : -1;
}

function parseDays(text) {
  const t = String(text || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+through\s+|\s+thru\s+|\s+to\s+/g, '-').replace(/\s*&\s*|\s+and\s+|\s*\/\s*/g, ',').trim();
  if (!t) return null;
  if (/^(daily|every ?day|7 days( a week)?|all week)$/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^weekdays$/.test(t)) return [1, 2, 3, 4, 5];
  if (/^weekends?$/.test(t)) return [0, 6];
  const out = new Set();
  for (const part of t.split(',').map(x => x.trim()).filter(Boolean)) {
    const ends = part.split(/\s*-\s*/);
    if (ends.length === 1) {
      const d = dayOf(ends[0]); if (d < 0) return null; out.add(d);
    } else if (ends.length === 2) {
      const a = dayOf(ends[0]), b = dayOf(ends[1]); if (a < 0 || b < 0) return null;
      for (let d = a, n = 0; n < 7; d = (d + 1) % 7, n++) { out.add(d); if (d === b) break; }
    } else return null;
  }
  return out.size ? [...out].sort() : null;
}

function parseTime(text, isClose) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (t === 'noon') return 720;
  if (t === 'midnight') return isClose ? 1440 : 0;
  let m = /^(\d{1,2})(?::(\d{2}))? ?([ap])\.?m?\.?$/.exec(t);
  if (m) {
    const h = +m[1], min = m[2] ? +m[2] : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    return (h % 12 + (m[3] === 'p' ? 12 : 0)) * 60 + min;
  }
  m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m && +m[1] <= 24 && +m[2] <= 59) return +m[1] * 60 + +m[2];
  return null;
}

// returns [[open, close], ...] in minutes from midnight; close past 1440 runs into the next day
function parseTimes(text) {
  const t = String(text || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+to\s+/g, '-').trim();
  if (!t) return null;
  if (/^closed$/.test(t)) return [];
  if (/^(open )?24 ?(hours|hrs|h)$|^24\/7$/.test(t)) return [[0, 1440]];
  const out = [];
  for (const part of t.split(/\s*(?:,|&|\band\b)\s*/).filter(Boolean)) {
    const ends = part.split(/\s*-\s*/);
    if (ends.length !== 2) return null;
    // "9-5pm" style: the first end borrows the second's am/pm only when that keeps it before the close
    let a = parseTime(ends[0], false), b = parseTime(ends[1], true);
    if (a === null && /^\d{1,2}(:\d{2})?$/.test(ends[0].trim()) && b !== null) {
      const mer = /([ap])\.?m?\.?$/.exec(ends[1].trim());
      for (const x of mer ? [mer[1], 'a'] : []) { const guess = parseTime(ends[0].trim() + x + 'm', false); if (guess !== null && guess < b) { a = guess; break; } }
    }
    if (a === null || b === null) return null;
    out.push([a, b <= a ? b + 1440 : b]);
  }
  return out.length ? out : null;
}

function parse(items) {
  const rows = (items || []).filter(r => r && (String(r.day || '').trim() || String(r.time || '').trim()));
  if (!rows.length) return null;
  const week = [[], [], [], [], [], [], []];
  for (const r of rows) {
    const days = parseDays(r.day), times = parseTimes(r.time);
    if (!days || !times) return null;
    days.forEach(d => { week[d] = week[d].concat(times); });
  }
  return week.some(d => d.length) ? week : null;
}

// for tests and the server: is it open at this minute of this weekday?
function isOpen(week, day, minute) {
  if ((week[day] || []).some(([o, c]) => minute >= o && minute < c)) return true;
  const prev = (day + 6) % 7;
  return (week[prev] || []).some(([, c]) => c > 1440 && minute < c - 1440);
}

module.exports = { parse, parseDays, parseTimes, isOpen };
