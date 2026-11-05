// A default style (and optionally home layout) for every industry template that
// does not set its own `look`, so generated sites do not all share one design.
// Colors still come from the template's palette; the owner can switch the style
// at any time in Theme > Style.
module.exports = {
  plumbing: { style: 'studio' },
  electrician: { style: 'corporate' },
  hvac: { style: 'corporate' },
  landscaping: { style: 'earthy' },
  cleaning: { style: 'coastal' },
  roofing: { style: 'studio' },
  contractor: { style: 'gallery' },
  'auto-repair': { style: 'bold' },
  salon: { style: 'luxe' },
  spa: { style: 'coastal', homeLayout: 'tiles' },
  restaurant: { style: 'gallery' },
  bakery: { style: 'playful' },
  law: { style: 'journal' },
  accounting: { style: 'corporate', homeLayout: 'list' },
  'real-estate': { style: 'gallery' },
  dentist: { style: 'coastal' },
  veterinary: { style: 'playful', homeLayout: 'story' },
  fitness: { style: 'gallery' },
  photography: { style: 'gallery', homeLayout: 'tiles' },
  'pet-grooming': { style: 'studio' },
  'it-repair': { style: 'corporate' },
  moving: { style: 'studio' },
  'pest-control': { style: 'corporate' },
  painting: { style: 'journal', homeLayout: 'story' }
};
