// Decorative accents: a site's own emoji, and the options for the animated hero.
// Only real emoji are kept, so the value is safe to place in a CSS string and in a canvas.

const EMOJI = /\p{Extended_Pictographic}(?:️|⃣|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*/gu;

function cleanEmoji(v, max = 4) {
  const found = String(v == null ? '' : v).slice(0, 80).match(EMOJI) || [];
  return found.slice(0, max).join(' ');
}

const HERO_MOTIONS = ['cinematic'];
const HERO_FLOATS = ['emoji', 'sparkles', 'bubbles', 'confetti'];

// Quick picks shown in the editor, grouped by kind of business.
const EMOJI_SETS = [
  ['Pets', '🐾 ✂️ 🦴'], ['Salon & beauty', '💇 ✨ 💅'], ['Cleaning', '🧼 🫧 ✨'], ['Home repair', '🔧 🛠️ 🏡'],
  ['Food & bakery', '🍰 🥐 ☕'], ['Flowers', '🌸 💐 🌿'], ['Cars', '🚗 ✨ 🧽'], ['Fitness', '💪 🔥 🏋️'],
  ['Dental & health', '🦷 😁 💙'], ['Garden', '🌿 🌳 ☀️'], ['Party & events', '🎉 🎈 ✨'], ['Insurance & finance', '🛡️ 🏠 🤝']
];

module.exports = { cleanEmoji, HERO_MOTIONS, HERO_FLOATS, EMOJI_SETS };
