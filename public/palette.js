// Matching color palettes. Pure functions, used by the editor in the browser
// (window.Palette) and by the tests (require). A palette is { primary, accent }:
// primary = buttons and links (white text sits on it), accent = dark bands and
// the footer (white text sits on it), so both must stay readable against white.
(function (root) {
  'use strict';
  var clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };

  function parseHex(s) {
    s = String(s || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(function (c) { return c + c; }).join('');
    return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null;
  }
  function hexToRgb(hex) { var n = parseInt((parseHex(hex) || '#000000').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join(''); }
  function hexToHsl(hex) {
    var c = hexToRgb(hex).map(function (v) { return v / 255; }), mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
    var l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === c[0]) h = ((c[1] - c[2]) / d) % 6; else if (mx === c[1]) h = (c[2] - c[0]) / d + 2; else h = (c[0] - c[1]) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: h, s: s, l: l };
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // darken (keeping the hue) until `hex` reaches `min` contrast against white
  function readableOnWhite(hex, min) {
    min = min || 4.5;
    var hsl = hexToHsl(hex), out = hex, guard = 0;
    while (contrast(out, '#ffffff') < min && hsl.l > 0.02 && guard++ < 100) { hsl.l -= 0.01; out = hslToHex(hsl.h, hsl.s, hsl.l); }
    return out;
  }
  // a dark companion in a given hue, for the accent role
  function dark(h, s, l) { return readableOnWhite(hslToHex(h, clamp(s, 0.25, 0.85), l), 7); }

  // Matching sets built from one brand color
  function suggestions(baseHex) {
    var base = parseHex(baseHex); if (!base) return [];
    var p0 = hexToHsl(base), h = p0.h, s = Math.max(p0.s, 0.2);
    var primary = readableOnWhite(base, 4.5);
    var pp = hexToHsl(primary);
    var mk = function (name, note, prim, acc) { return { name: name, note: note, primary: prim, accent: acc }; };
    var out = [
      mk('Same color, deeper', 'A dark shade of your color. Calm and consistent.', primary, dark(h, s, 0.17)),
      mk('Complementary', 'The opposite color for the dark areas. Stands out most.', primary, dark(h + 180, s * 0.8, 0.2)),
      mk('Neighbor (warm)', 'A close color toward warm tones.', primary, dark(h + 30, s * 0.8, 0.19)),
      mk('Neighbor (cool)', 'A close color toward cool tones.', primary, dark(h - 30, s * 0.8, 0.19)),
      mk('Triad', 'Two more colors spaced evenly around the wheel. Playful.', primary, dark(h + 120, s * 0.7, 0.2)),
      mk('Neutral slate', 'Your color with a dark slate. Safe and professional.', primary, '#1e293b'),
      mk('Softer', 'Less saturated. Gentler, more premium.', readableOnWhite(hslToHex(h, pp.s * 0.6, pp.l), 4.5), dark(h, s * 0.4, 0.2)),
      mk('Bolder', 'More saturated. Livelier.', readableOnWhite(hslToHex(h, Math.min(1, pp.s * 1.25 + 0.05), pp.l), 4.5), dark(h, Math.min(1, s * 1.1), 0.16))
    ];
    var seen = {};
    return out.filter(function (x) { var k = x.primary + x.accent; if (seen[k]) return false; seen[k] = 1; return true; });
  }

  // Ready-made palettes. `for` are words matched against the business type.
  var INDUSTRY = [
    { id: 'pet-warm', name: 'Friendly pets', primary: '#c2410c', accent: '#431407', for: ['pet', 'groom', 'dog', 'cat', 'vet', 'kennel', 'boarding'] },
    { id: 'pet-fresh', name: 'Fresh paws', primary: '#0f766e', accent: '#134e4a', for: ['pet', 'groom', 'dog', 'training', 'walk'] },
    { id: 'salon-rose', name: 'Rose salon', primary: '#be185d', accent: '#4a1d33', for: ['salon', 'hair', 'beauty', 'nail', 'lash', 'makeup', 'barber'] },
    { id: 'spa-calm', name: 'Calm spa', primary: '#0f766e', accent: '#1e3a3a', for: ['spa', 'wellness', 'massage', 'yoga', 'chiropract', 'clinic'] },
    { id: 'trust-navy', name: 'Trusted navy', primary: '#1d4ed8', accent: '#0f1f45', for: ['insurance', 'law', 'attorney', 'account', 'financ', 'consult', 'real estate', 'dental', 'dentist'] },
    { id: 'law-gold', name: 'Navy and brass', primary: '#92400e', accent: '#14213d', for: ['law', 'attorney', 'insurance', 'account', 'financ'] },
    { id: 'green-grow', name: 'Garden green', primary: '#15803d', accent: '#14301e', for: ['landscap', 'lawn', 'garden', 'tree', 'pool', 'pest', 'clean', 'organic'] },
    { id: 'trade-blue', name: 'Reliable trades', primary: '#0369a1', accent: '#0c2a43', for: ['plumb', 'hvac', 'air', 'electric', 'roof', 'contract', 'handyman', 'pressure', 'wash'] },
    { id: 'trade-orange', name: 'Workwear orange', primary: '#c2410c', accent: '#1f2937', for: ['roof', 'contract', 'construct', 'paint', 'remodel', 'junk', 'moving', 'auto', 'repair'] },
    { id: 'auto-red', name: 'Garage red', primary: '#b91c1c', accent: '#1c1917', for: ['auto', 'car', 'detail', 'mechanic', 'tire', 'tattoo'] },
    { id: 'food-warm', name: 'Warm kitchen', primary: '#b45309', accent: '#3b1d0b', for: ['restaurant', 'cafe', 'bakery', 'catering', 'food', 'coffee', 'bar'] },
    { id: 'care-soft', name: 'Gentle care', primary: '#4f46e5', accent: '#1e1b4b', for: ['home care', 'senior', 'care', 'child', 'daycare', 'health', 'therapy'] },
    { id: 'tech-violet', name: 'Modern tech', primary: '#6d28d9', accent: '#1e1038', for: ['it ', 'tech', 'software', 'computer', 'web', 'design', 'photo', 'studio'] },
    { id: 'earth', name: 'Earthy', primary: '#4d7c0f', accent: '#2f2a1d', for: ['farm', 'organic', 'eco', 'craft', 'florist', 'flower'] },
    { id: 'mono', name: 'Black and white', primary: '#111827', accent: '#000000', for: ['photo', 'studio', 'gallery', 'art', 'fashion', 'boutique'] },
    { id: 'sunny', name: 'Sunny', primary: '#b45309', accent: '#78350f', for: ['party', 'event', 'rental', 'kids', 'fun', 'florida'] },
    // From Color Hunt's pink collection (colorhunt.co/palettes/pink, picked 2026-11-04 for Leo: "expand on our palette
    // option"). `colors` are the original four; primary is darkened where needed so white button text stays readable
    // (4.5:1) and accent is a deep companion for dark bands and footers (7:1).
    { id: 'ch-plum-mint', name: 'Plum and mint', primary: '#8e1ea2', accent: '#542177', colors: ['#542177', '#8e1ea2', '#d552a3', '#98e8de'], for: ['boutique', 'studio', 'design', 'art', 'tattoo', 'beauty', 'nail'] },
    { id: 'ch-dusty-wine', name: 'Dusty wine', primary: '#aa5e7a', accent: '#7c0e44', colors: ['#7c0e44', '#aa5e7a', '#d49a9a', '#f2dace'], for: ['wine', 'bridal', 'wedding', 'florist', 'boutique', 'salon'] },
    { id: 'ch-sage-blush', name: 'Sage and blush', primary: '#607e5e', accent: '#3f5a3e', colors: ['#f6e2e9', '#fefaf3', '#b8cfb3', '#84a282'], for: ['spa', 'wellness', 'yoga', 'massage', 'wedding', 'florist', 'therap', 'counsel'] },
    { id: 'ch-cherry-gold', name: 'Cherry and gold', primary: '#e11a45', accent: '#5c0a1c', colors: ['#e11a45', '#e3afc9', '#efecd7', '#edc92c'], for: ['bakery', 'restaurant', 'pizza', 'cafe', 'food', 'catering', 'dessert'] },
    { id: 'ch-rose-garden', name: 'Rose garden', primary: '#677b4a', accent: '#3d4a2a', colors: ['#d8a2a2', '#ffdcdc', '#fff9d6', '#8ea66b'], for: ['florist', 'flower', 'garden', 'landscap', 'plant', 'organic'] },
    { id: 'ch-denim-coral', name: 'Denim and coral', primary: '#425b9a', accent: '#1f2b4a', colors: ['#425b9a', '#76c0ec', '#fff6dc', '#ff95a5'], for: ['daycare', 'child', 'tutor', 'school', 'dentist', 'pediatric', 'kids'] },
    { id: 'ch-electric', name: 'Electric violet', primary: '#5003c0', accent: '#2a0166', colors: ['#5003c0', '#ab03a9', '#ff467a', '#ffd51e'], for: ['party', 'event', 'dj', 'entertain', 'night', 'gym', 'fitness', 'music'] },
    { id: 'ch-blush-charcoal', name: 'Blush and charcoal', primary: '#a3616f', accent: '#4a4a4a', colors: ['#fff5f5', '#f7d6d0', '#e2b4bd', '#4a4a4a'], for: ['salon', 'bridal', 'photo', 'boutique', 'beauty', 'makeup', 'lash'] },
    { id: 'ch-pink-forest', name: 'Pink and forest', primary: '#c2334b', accent: '#165823', colors: ['#ff788d', '#ffdada', '#fff2f2', '#165823'], for: ['florist', 'plant', 'cafe', 'bakery', 'garden'] },
    { id: 'ch-blue-blush', name: 'Blue and blush', primary: '#116dff', accent: '#1d2f6b', colors: ['#3a86ff', '#bdb2ff', '#ffd6e0', '#fff4f4'], for: ['clean', 'tech', 'it ', 'tutor', 'app', 'software'] },
    { id: 'ch-mint-slate', name: 'Mint and slate', primary: '#4d6787', accent: '#26354a', colors: ['#f599c6', '#ffea88', '#7dccad', '#4d6787'], for: ['pet', 'vet', 'dentist', 'clinic', 'health', 'care', 'pool'] },
    { id: 'ch-olive-raspberry', name: 'Olive and raspberry', primary: '#cc3a63', accent: '#4c5130', colors: ['#fff7eb', '#f9f0e0', '#a2ab73', '#cc3a63'], for: ['cafe', 'coffee', 'bakery', 'farm', 'restaurant', 'catering'] },
    { id: 'ch-bold-pop', name: 'Bold pop', primary: '#91008d', accent: '#3d003b', colors: ['#00e0ba', '#91008d', '#ff3483', '#ffcf00'], for: ['party', 'kids', 'bounce', 'event', 'rental', 'toy', 'ice cream'] },
    { id: 'ch-sunset', name: 'Sunset violet', primary: '#c13383', accent: '#443199', colors: ['#e05454', '#c13383', '#792ca2', '#443199'], for: ['salon', 'event', 'night', 'lounge', 'bar', 'dance', 'music'] },
    { id: 'ch-garden-party', name: 'Garden party', primary: '#3c8269', accent: '#7a1f33', colors: ['#59b292', '#ffc94d', '#fae7cb', '#fa6781'], for: ['pet', 'daycare', 'ice cream', 'garden', 'groom', 'dog'] },
    { id: 'ch-navy-pink', name: 'Navy and pink', primary: '#d63384', accent: '#021a54', colors: ['#021a54', '#ff85bb', '#ffcee3', '#f5f5f5'], for: ['beauty', 'med spa', 'aesthetic', 'fashion', 'boutique', 'nail', 'lash', 'salon'] },
    { id: 'ch-pink-teal', name: 'Pink and teal', primary: '#36818a', accent: '#173a3f', colors: ['#ff3e9b', '#ff88ba', '#3a8b95', '#66d0bc'], for: ['dental', 'dentist', 'spa', 'groom', 'pet', 'pool', 'clinic'] },
    { id: 'ch-plum-peach', name: 'Plum and peach', primary: '#c44689', accent: '#5d1c6a', colors: ['#fff1d3', '#ffb090', '#ca5995', '#5d1c6a'], for: ['salon', 'spa', 'beauty', 'nail', 'massage', 'candle'] },
    // From Color Hunt's red collection (colorhunt.co/palettes/red, picked 2026-11-04 for Leo: "lets add these as well"),
    // made readable the same way. Palettes already added from the pink collection are not repeated.
    { id: 'cr-fire-lime', name: 'Fire and lime', primary: '#e00000', accent: '#5c0000', colors: ['#e00000', '#ffa97b', '#ffeccb', '#9fed72'], for: ['fitness', 'gym', 'pizza', 'auto', 'sport', 'martial'] },
    { id: 'cr-harvest', name: 'Harvest red and green', primary: '#d9361e', accent: '#2f4b1e', colors: ['#4f7d32', '#ffd16a', '#f5b52e', '#d9361e'], for: ['farm', 'landscap', 'bbq', 'barbecue', 'restaurant', 'market', 'garden'] },
    { id: 'cr-terracotta', name: 'Terracotta', primary: '#a14646', accent: '#4d2121', colors: ['#a14646', '#da6556', '#eb895b', '#fdb773'], for: ['pottery', 'cafe', 'mexican', 'taco', 'restaurant', 'tile', 'craft'] },
    { id: 'cr-olive-brick', name: 'Olive and brick', primary: '#b93636', accent: '#3d4f30', colors: ['#7d9c65', '#b93636', '#ff9c4c', '#fff2a0'], for: ['restaurant', 'pizza', 'italian', 'garden', 'farm', 'catering'] },
    { id: 'cr-black-red', name: 'Black and red', primary: '#bc0202', accent: '#000000', colors: ['#000000', '#830000', '#bc0202', '#ff0000'], for: ['auto', 'gym', 'tattoo', 'barber', 'security', 'mechanic', 'fitness'] },
    { id: 'cr-teal-oxblood', name: 'Teal and oxblood', primary: '#a82020', accent: '#6c1a1a', colors: ['#31aaa9', '#f8e0a4', '#a82020', '#6c1a1a'], for: ['coffee', 'vintage', 'pool', 'surf', 'diner'] },
    { id: 'cr-ember', name: 'Ember', primary: '#c0392b', accent: '#5b1818', colors: ['#972828', '#e45742', '#eb7f31', '#fcad38'], for: ['bbq', 'grill', 'fireplace', 'hvac', 'heating', 'roof', 'smoke'] },
    { id: 'cr-burgundy-cream', name: 'Burgundy and cream', primary: '#b03a4a', accent: '#800020', colors: ['#800020', '#f3e6d5', '#fff9f2', '#d45060'], for: ['law', 'wine', 'winery', 'bridal', 'steakhouse', 'jewel', 'boutique'] },
    { id: 'cr-tomato-turquoise', name: 'Tomato and turquoise', primary: '#df301c', accent: '#004f59', colors: ['#df301c', '#ff9100', '#fff1d1', '#00b7cd'], for: ['food truck', 'taco', 'surf', 'kids', 'beach', 'pool'] },
    { id: 'cr-americana', name: 'Classic red and blue', primary: '#d62839', accent: '#1d3557', colors: ['#8b1e2d', '#e63946', '#f4d35e', '#457b9d'], for: ['roof', 'plumb', 'hvac', 'moving', 'contract', 'insurance', 'electric', 'paint'] },
    { id: 'cr-blue-ruby', name: 'Blue and ruby', primary: '#007ac7', accent: '#7a0335', colors: ['#007dcc', '#ffb900', '#d10056', '#b2054c'], for: ['tech', 'it ', 'event', 'entertain', 'media', 'school'] },
    { id: 'cr-rust-clay', name: 'Rust and clay', primary: '#95271d', accent: '#60241e', colors: ['#60241e', '#95271d', '#b34a44', '#e77b49'], for: ['leather', 'barber', 'coffee', 'brew', 'craft', 'woodwork'] },
    { id: 'cr-ketchup-mustard', name: 'Ketchup and mustard', primary: '#c62828', accent: '#5a1212', colors: ['#f5f5dc', '#fbc02d', '#ff8f00', '#c62828'], for: ['diner', 'burger', 'hot dog', 'restaurant', 'food', 'fast'] },
    { id: 'cr-brick-sage', name: 'Brick and sage', primary: '#bd4444', accent: '#3f4e3b', colors: ['#bd4444', '#f1dec4', '#73976a', '#677e61'], for: ['farm', 'garden', 'nursery', 'home', 'bakery', 'organic'] },
    { id: 'cr-plum-wine', name: 'Plum wine', primary: '#aa1c41', accent: '#5e244e', colors: ['#5e244e', '#aa1c41', '#e68457', '#ffe8b4'], for: ['winery', 'wine', 'salon', 'chocolate', 'bridal', 'spa'] },
    { id: 'cr-rustic', name: 'Rustic ranch', primary: '#a0583c', accent: '#7b2525', colors: ['#607456', '#eee0cc', '#ba6a4c', '#7b2525'], for: ['cabin', 'rustic', 'ranch', 'rental', 'woodwork', 'lodge', 'tree'] },
    { id: 'cr-black-rose', name: 'Black and rose', primary: '#cb2957', accent: '#000000', colors: ['#000000', '#cb2957', '#dddddd', '#eeeeee'], for: ['fashion', 'salon', 'photo', 'tattoo', 'studio', 'nail'] },
    { id: 'cr-primary-pop', name: 'Primary pop', primary: '#e0004a', accent: '#002f7a', colors: ['#ff0052', '#ffd400', '#00c68d', '#0055da'], for: ['kids', 'toy', 'daycare', 'party', 'bounce', 'play'] },
    { id: 'cr-crimson-lemon', name: 'Crimson and lemon', primary: '#d51c39', accent: '#760031', colors: ['#760031', '#d51c39', '#ff6060', '#feec41'], for: ['event', 'cinema', 'ice cream', 'candy', 'party', 'dance'] },
    { id: 'cr-charcoal-orange', name: 'Charcoal and orange', primary: '#d34215', accent: '#303841', colors: ['#f5f5f5', '#76abae', '#303841', '#ff5722'], for: ['construct', 'contract', 'auto', 'roof', 'gym', 'it ', 'repair', 'junk'] },
    { id: 'cr-crimson-sand', name: 'Crimson and sand', primary: '#d92243', accent: '#5e0f1e', colors: ['#d92243', '#f69d39', '#e0c375', '#fff5e5'], for: ['restaurant', 'bakery', 'hotel', 'catering', 'asian', 'cafe'] },
    { id: 'cr-teal-amber', name: 'Teal and amber', primary: '#0a7c6e', accent: '#06403a', colors: ['#0a7c6e', '#f59e0b', '#ff6b35', '#fafafa'], for: ['pool', 'clean', 'health', 'clinic', 'pressure', 'pest'] },
    // From Color Hunt's blue collection (colorhunt.co/palettes/blue, picked 2026-11-04 for Leo: "these also"), made
    // readable the same way; ones already added from the pink and red collections are not repeated.
    { id: 'cb-ocean-navy', name: 'Ocean navy', primary: '#005a9c', accent: '#1b365d', colors: ['#1b365d', '#005a9c', '#60c1e5', '#a0e0ef'], for: ['insurance', 'law', 'plumb', 'marine', 'boat', 'pool', 'account'] },
    { id: 'cb-aqua-clay', name: 'Aqua and clay', primary: '#c2512c', accent: '#2b4d50', colors: ['#ffead3', '#bfe7ea', '#e89b5b', '#d46743'], for: ['cafe', 'beach', 'pottery', 'surf', 'ceramic', 'tile'] },
    { id: 'cb-sky-maroon', name: 'Sky and maroon', primary: '#2777c6', accent: '#930031', colors: ['#bedeff', '#fff2a7', '#ffa500', '#930031'], for: ['school', 'sport', 'ice cream', 'camp', 'team'] },
    { id: 'cb-sunny-harbor', name: 'Sunny harbor', primary: '#3f7ba7', accent: '#162c3b', colors: ['#ff933e', '#ffcb56', '#ffe9a9', '#73a5ca'], for: ['kids', 'beach', 'rental', 'summer', 'camp', 'daycare'] },
    { id: 'cb-bright-beach', name: 'Bright beach', primary: '#0072e5', accent: '#7a0035', colors: ['#2391ff', '#fff83f', '#ffcd54', '#f70063'], for: ['party', 'summer', 'kids', 'water', 'bounce', 'event'] },
    { id: 'cb-royal-electric', name: 'Royal electric', primary: '#0f42c0', accent: '#1f06ac', colors: ['#1f06ac', '#0f42c0', '#5882e8', '#e3ef4f'], for: ['tech', 'gym', 'fitness', 'event', 'software', 'it '] },
    { id: 'cb-harbor', name: 'Harbor blue', primary: '#086288', accent: '#05384d', colors: ['#086288', '#4d8dba', '#97d7ff', '#ffefc4'], for: ['marine', 'pool', 'plumb', 'clinic', 'water', 'dock'] },
    { id: 'cb-burgundy-sky', name: 'Burgundy and sky', primary: '#3f6a8a', accent: '#790d16', colors: ['#790d16', '#e5d3af', '#f5efe1', '#aec4d4'], for: ['law', 'hotel', 'winery', 'inn', 'bed and breakfast', 'golf'] },
    { id: 'cb-midnight-gold', name: 'Midnight and gold', primary: '#363199', accent: '#030164', colors: ['#030164', '#363199', '#2d7495', '#e8e085'], for: ['luxury', 'law', 'account', 'financ', 'event', 'jewel'] },
    { id: 'cb-bright-blue', name: 'Bright blue', primary: '#196df4', accent: '#04204e', colors: ['#2373f4', '#578ef5', '#65d0f4', '#f2f7a0'], for: ['clean', 'it ', 'app', 'tech', 'wash', 'software'] },
    { id: 'cb-navy-cream', name: 'Deep navy and cream', primary: '#22396f', accent: '#010736', colors: ['#010736', '#0d1c42', '#22396f', '#fcf1d0'], for: ['financ', 'insurance', 'law', 'account', 'luxury', 'real estate', 'consult'] },
    { id: 'cb-pool-sun', name: 'Pool and sun', primary: '#006199', accent: '#003452', colors: ['#006199', '#8acff8', '#f4eb6c', '#ffd444'], for: ['pool', 'beach', 'summer', 'clean', 'pressure', 'window'] },
    { id: 'cb-navy-coral', name: 'Navy and coral', primary: '#315b8c', accent: '#413333', colors: ['#f5ebdd', '#f2765e', '#315b8c', '#413333'], for: ['interior', 'design', 'cafe', 'home', 'decor', 'real estate'] },
    { id: 'cb-tropical', name: 'Tropical', primary: '#107fa4', accent: '#073a4a', colors: ['#ff7f50', '#ffd166', '#06d6a0', '#118ab2'], for: ['kids', 'pool', 'travel', 'smoothie', 'juice', 'tour'] },
    { id: 'cb-ocean-teal', name: 'Ocean and teal', primary: '#2f39a9', accent: '#121640', colors: ['#2f39a9', '#2e6fa0', '#49a4bb', '#15d8b3'], for: ['tech', 'marine', 'fitness', 'swim', 'dive', 'it '] },
    { id: 'cb-midnight-blue', name: 'Midnight blue', primary: '#1b2cc1', accent: '#091540', colors: ['#091540', '#1b2cc1', '#7692ff', '#abd2fa'], for: ['tech', 'security', 'it ', 'alarm', 'software', 'computer'] },
    { id: 'cb-lagoon', name: 'Lagoon', primary: '#1e7f9d', accent: '#0d3845', colors: ['#218dae', '#2bbbd7', '#fce59a', '#ffd758'], for: ['pool', 'travel', 'spa', 'beach', 'resort', 'boat'] },
    { id: 'cb-calm-harbor', name: 'Calm harbor', primary: '#3368a0', accent: '#14283e', colors: ['#3368a0', '#66a3bf', '#c8dfdb', '#f2efe7'], for: ['home care', 'senior', 'therap', 'counsel', 'care', 'health'] },
    { id: 'cb-slate-teal', name: 'Slate and teal', primary: '#107fa4', accent: '#464b71', colors: ['#464b71', '#118ab2', '#7cd5c7', '#f2f2ed'], for: ['clinic', 'dentist', 'dental', 'account', 'medical', 'chiropract'] },
    { id: 'cb-blue-marigold', name: 'Blue and marigold', primary: '#525ea7', accent: '#1b1f37', colors: ['#ffc349', '#525ea7', '#5facd3', '#97dde9'], for: ['tutor', 'school', 'daycare', 'learning', 'camp', 'library'] },
    { id: 'cb-clear-blue', name: 'Clear blue steps', primary: '#0b76cc', accent: '#0d47a1', colors: ['#e3f2fd', '#90caf9', '#2196f3', '#0d47a1'], for: ['clean', 'plumb', 'it ', 'medical', 'hvac', 'air'] },
    { id: 'cb-peach-denim', name: 'Peach and denim', primary: '#3e7da2', accent: '#172d3b', colors: ['#ffb6a6', '#ffebd3', '#9bcec1', '#67a2c5'], for: ['baby', 'daycare', 'pet', 'bakery', 'nursery', 'groom'] },
    { id: 'cb-soft-sky', name: 'Soft sky', primary: '#4279ab', accent: '#172a3b', colors: ['#f9e8a2', '#b4e1eb', '#95bdd7', '#78a4cb'], for: ['spa', 'senior', 'wedding', 'yoga', 'wellness', 'care'] },
    { id: 'cb-clinic-blue', name: 'Clinic blue', primary: '#3e71d8', accent: '#293681', colors: ['#293681', '#4274d9', '#95ccdd', '#d0e7e6'], for: ['dentist', 'dental', 'medical', 'clinic', 'doctor', 'pharmacy'] },
    { id: 'cb-indigo-harbor', name: 'Indigo harbor', primary: '#4647ae', accent: '#112e81', colors: ['#112e81', '#4647ae', '#4382df', '#aaccd6'], for: ['law', 'account', 'church', 'school', 'consult', 'insurance'] }
  ];
  function industryFor(businessType) {
    var t = ' ' + String(businessType || '').toLowerCase() + ' ';
    var scored = INDUSTRY.map(function (p, i) {
      var hit = p.for.some(function (w) { return t.indexOf(w) !== -1; });
      return { p: p, hit: hit, i: i };
    });
    scored.sort(function (a, b) { return (b.hit - a.hit) || (a.i - b.i); });
    return scored.map(function (x) { return { id: x.p.id, name: x.p.name, primary: x.p.primary, accent: x.p.accent, match: x.hit }; });
  }


  // Dominant colors of an image. `data` is RGBA pixel data (canvas ImageData.data).
  // Transparent and near-white pixels (usually background) are ignored; colorful
  // pixels count for more than grey ones. Returns up to `max` hex colors, best first.
  function extract(data, max) {
    max = max || 5;
    var buckets = {}, n = data.length;
    for (var i = 0; i + 3 < n; i += 4) {
      var a = data[i + 3]; if (a < 128) continue;
      var r = data[i], g = data[i + 1], b = data[i + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
      if (l > 0.93) continue;            // paper white
      var key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      var w = 0.25 + sat * 1.5 - (l < 0.08 ? 0.15 : 0);
      var e = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, c: 0, w: 0 });
      e.r += r; e.g += g; e.b += b; e.c++; e.w += Math.max(0.02, w);
    }
    var list = Object.keys(buckets).map(function (k) { var e = buckets[k]; return { hex: rgbToHex(e.r / e.c, e.g / e.c, e.b / e.c), w: e.w }; });
    list.sort(function (x, y) { return y.w - x.w; });
    var out = [];
    list.forEach(function (c) {
      if (out.length >= max) return;
      var close = out.some(function (o) { var a = hexToRgb(o.hex), b = hexToRgb(c.hex); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 90; });
      if (close) { var m = out.filter(function (o) { var a = hexToRgb(o.hex), b = hexToRgb(c.hex); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 90; })[0]; m.w += c.w; return; }
      out.push({ hex: c.hex, w: c.w });
    });
    out.sort(function (x, y) { return y.w - x.w; });
    return out.map(function (o) { return o.hex; });
  }
  // The logo's own two main colors as a palette (primary readable, accent a dark companion)
  function fromLogo(colors) {
    if (!colors || !colors.length) return null;
    var p = readableOnWhite(colors[0], 4.5), second = colors.slice(1).filter(function (c) { return c !== colors[0]; })[0];
    var h = hexToHsl(colors[0]);
    var acc = second ? readableOnWhite(hslToHex(hexToHsl(second).h, hexToHsl(second).s, Math.min(hexToHsl(second).l, 0.25)), 7) : dark(h.h, Math.max(h.s, 0.25), 0.17);
    return { name: 'Logo colors', note: 'Built from the two main colors in the logo.', primary: p, accent: acc };
  }

  // Readability report for the two colors. level: 'ok' | 'warn' | 'bad'
  function check(primary, accent) {
    var p = parseHex(primary), a = parseHex(accent), issues = [];
    var rate = function (r) { return r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'bad'; };
    if (!p) issues.push({ level: 'bad', what: 'primary', text: 'The primary color is not a valid hex color like #2563eb.' });
    else { var rp = contrast(p, '#ffffff'); var lp = rate(rp); if (lp !== 'ok') issues.push({ level: lp, what: 'primary', ratio: rp, text: 'White button text on the primary color is ' + (lp === 'bad' ? 'hard' : 'a bit hard') + ' to read (contrast ' + rp.toFixed(1) + ', aim for 4.5 or more).', fix: readableOnWhite(p, 4.5) }); }
    if (!a) issues.push({ level: 'bad', what: 'accent', text: 'The accent color is not a valid hex color like #1e293b.' });
    else { var ra = contrast(a, '#ffffff'); var la = rate(ra); if (la !== 'ok') issues.push({ level: la, what: 'accent', ratio: ra, text: 'White text on the accent color (footer and dark bands) is ' + (la === 'bad' ? 'hard' : 'a bit hard') + ' to read (contrast ' + ra.toFixed(1) + ', aim for 4.5 or more).', fix: readableOnWhite(a, 4.5) }); }
    if (p && a && p === a) issues.push({ level: 'warn', what: 'both', text: 'Primary and accent are the same color, so buttons will not stand out from dark areas.' });
    return issues;
  }

  var api = { parseHex: parseHex, hexToHsl: hexToHsl, hslToHex: hslToHex, contrast: contrast, readableOnWhite: readableOnWhite, suggestions: suggestions, extract: extract, fromLogo: fromLogo, INDUSTRY: INDUSTRY, industryFor: industryFor, check: check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Palette = api;
})(typeof window !== 'undefined' ? window : this);
