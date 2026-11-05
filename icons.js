// Simple line icons for service tiles (24x24 viewBox, stroke-based). The icon
// is chosen from the service title unless the owner picks one.
const ICONS = {
  auto: '<path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  building: '<path d="M4 21V5l8-3v19"/><path d="M12 8h8v13"/><path d="M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  motorcycle: '<circle cx="6" cy="16" r="3.2"/><circle cx="18" cy="16" r="3.2"/><path d="M6 16l4-7h5l3 7M9 9H7M13 9l-2 7"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  boat: '<path d="M3 17l2 3h14l2-3z"/><path d="M12 3v11M12 4l6 8h-6M12 7l-4 5h4"/>',
  truck: '<rect x="2" y="7" width="12" height="9"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  wrench: '<path d="M14 6a4 4 0 0 0 5 5l-9 9a2.5 2.5 0 0 1-4-4l9-9z"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="10" r="1.8"/><path d="M8 17c0-3 2-4.5 4-4.5s4 1.5 4 4.5c0 2-2 2.5-4 2.5s-4-.5-4-2.5z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
};
const LABELS = { auto: 'Car', home: 'House', building: 'Building / commercial', water: 'Water / flood', motorcycle: 'Motorcycle', heart: 'Heart / life', health: 'Health', shield: 'Shield', umbrella: 'Umbrella', briefcase: 'Briefcase / business', boat: 'Boat', truck: 'Truck', key: 'Key', star: 'Star', wrench: 'Wrench / repair', paw: 'Pet', calendar: 'Calendar' };

const RULES = [
  [/motorcycle|motorbike|\bbike|scooter|atv|powersport/i, 'motorcycle'],
  [/boat|marine|watercraft|yacht|jet ?ski/i, 'boat'],
  [/flood|water/i, 'water'],
  [/auto|car\b|vehicle|driver/i, 'auto'],
  [/truck|fleet|trucking/i, 'truck'],
  [/condo|commercial|business|office|building|apartment|landlord/i, 'building'],
  [/home|house|renter|property|dwelling|roof/i, 'home'],
  [/life|funeral|final|annuit/i, 'heart'],
  [/health|medical|medicare|dental|vision|supplement/i, 'health'],
  [/umbrella|liability/i, 'umbrella'],
  [/pet|dog|cat|vet/i, 'paw'],
  [/lock|key/i, 'key'],
  [/repair|plumb|hvac|electric/i, 'wrench']
];

function iconKeyFor(title, chosen) {
  if (chosen && ICONS[chosen]) return chosen;
  for (const [re, key] of RULES) if (re.test(title || '')) return key;
  return 'shield';
}
const iconPath = (title, chosen) => ICONS[iconKeyFor(title, chosen)];

module.exports = { ICONS, LABELS, iconPath, iconKeyFor };
