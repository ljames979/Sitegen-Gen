// One-off (Leo, 2026-11-17): build the LocalBite marketing site (local food delivery and pickup for food trucks and
// restaurants in Kissimmee and Osceola County, FL) as a normal, fully editable SiteGen site:
//   Home (a Blocks page), For Restaurants, Drive, About, FAQ, Contact, plus Privacy and Terms.
// Every section is a standard content block you can edit, move, duplicate or delete in the editor; colors, fonts and
// buttons come from the site's theme tokens; the EN / ES switch, the "Order now" menu button, the phone menu, the app
// badges and the TikTok link are in Design > Pages, languages and header button, with every Spanish line in the word
// list there. Every [BRACKET] is a placeholder for you to fill in, and every photo is a labeled stand-in picture until
// you upload your own. Nothing is made up: no reviews, ratings or numbers that are not yours.
//
// Run it once:  node tools/create-localbite.js
// It makes a NEW site with the address "localbite" and prints its editor address. Running it again changes nothing
// while a site with that address exists.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { defaultSections, defaultTheme } = require('../defaults');
const themeTokens = require('../themetokens');
const mixPage = require('../mixpage');
const siteKit = require('../sitekit');
const aboutBlocks = require('../aboutblocks');
const shapeForm = require('../shapeform');

const SLUG = 'localbite', NAME = 'LocalBite';
const APP = 'https://localbite-customer.onrender.com';
if (db.prepare('SELECT id FROM sites WHERE slug = ?').get(SLUG)) { console.log(`A site with the address "${SLUG}" already exists. Nothing changed.`); process.exit(0); }
const owner = db.prepare('SELECT id AS user_id FROM users ORDER BY id LIMIT 1').get();
if (!owner) { console.error('No SiteGen account found. Sign up in SiteGen first, then run this again.'); process.exit(1); }

// ---- English | Spanish word pairs: every T() line is also added to the site's word list ----
const PAIRS = [];
const T = (en, es) => { PAIRS.push([en, es]); return en; };

// ---- labeled stand-in pictures: replace each one with Change photo in the editor ----
const UP = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UP, { recursive: true });
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function slot(file, label, hint, w = 1200, h = 900, bg = '#f3ead8', ink = '#1f7a45') {
  const f = path.join(UP, `lb-slot-${file}.svg`);
  const lines = [label].concat(hint ? [hint] : []);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>`
    + `<rect x="18" y="18" width="${w - 36}" height="${h - 36}" fill="none" stroke="${ink}" stroke-width="4" stroke-dasharray="18 14" rx="28"/>`
    + `<g fill="${ink}" font-family="Arial, sans-serif" text-anchor="middle">`
    + `<g transform="translate(${w / 2 - 48} ${h / 2 - 130}) scale(4)" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M16 7c0-2 2-2 2-4"/></g>`
    + lines.map((l, i) => `<text x="${w / 2}" y="${h / 2 + 40 + i * 50}" font-size="${i ? 30 : 42}" font-weight="${i ? 400 : 700}">${esc(l)}</text>`).join('')
    + '</g></svg>';
  fs.writeFileSync(f, svg);
  return `/uploads/lb-slot-${file}.svg`;
}
const IMG = {
  hero: slot('hero', '[HERO PHOTO]', 'Tacos or a burger held up in front of a food truck', 1000, 1000),
  trucks: slot('trucks-out', '[FOOD TRUCK PHOTO]', 'A truck window at golden hour, people picking up', 1600, 900),
  spot1: slot('spot-1', '[SPOT 1 PHOTO]', 'Their best dish, close up', 900, 675),
  spot2: slot('spot-2', '[SPOT 2 PHOTO]', 'Their best dish, close up', 900, 675),
  spot3: slot('spot-3', '[SPOT 3 PHOTO]', 'Their best dish, close up', 900, 675),
  spot4: slot('spot-4', '[SPOT 4 PHOTO]', 'Their best dish, close up', 900, 675),
  spot5: slot('spot-5', '[SPOT 5 PHOTO]', 'Their best dish, close up', 900, 675),
  spot6: slot('spot-6', '[SPOT 6 PHOTO]', 'Their best dish, close up', 900, 675),
  invite: slot('invite', '[FRIENDS SHARING FOOD PHOTO]', 'Friends sharing a meal outdoors', 900, 1200),
  reviews: slot('reviews', '[HAPPY CUSTOMER PHOTO]', 'A customer picking up an order', 1000, 960),
  av1: slot('avatar-1', '[CUSTOMER 1]', '', 300, 300), av2: slot('avatar-2', '[CUSTOMER 2]', '', 300, 300), av3: slot('avatar-3', '[CUSTOMER 3]', '', 300, 300),
  vendor: slot('vendor', '[OWNER AT THE TRUCK PHOTO]', 'A truck or restaurant owner at the window', 1000, 1000),
  signup: slot('signup', '[KITCHEN PHOTO]', 'A cook plating food', 1000, 1100),
  driver: slot('driver', '[DRIVER PHOTO]', 'A driver handing over a bag with a smile', 1000, 1000),
  driverReq: slot('driver-2', '[DRIVER ON THE ROAD PHOTO]', 'Car or scooter in Kissimmee', 1000, 1000),
  about: slot('about', '[YOUR PHOTO]', 'You, or you with a local vendor', 1000, 1000),
  mission: slot('mission', '[KISSIMMEE PHOTO]', 'A local street, lake or market', 1600, 900)
};

// ---- theme: fresh green, warm cream, deep charcoal, tomato-red buttons, rounded, friendly sans ----
const GREEN = '#2F9E5B', GREEN_TEXT = '#1F7A45', CREAM = '#FFF8EC', CHARCOAL = '#2E2E2E', TOMATO = '#D0402A';
const tokens = themeTokens.clean({
  on: true,
  name: 'LocalBite Fresh market',
  colors: [['fresh-green', GREEN], ['green-text', GREEN_TEXT], ['green-light', '#E3F3E8'], ['cream', CREAM], ['cream-deep', '#F3EAD8'], ['charcoal', CHARCOAL], ['tomato', TOMATO], ['tomato-hover', '#B5361F'], ['white', '#FFFFFF']].map(([key, hex]) => ({ key, hex })),
  fonts: {
    display: { family: 'Plus Jakarta Sans', weights: '700;800', italic: false },
    accent: { family: 'Plus Jakarta Sans', weights: '600', italic: false },
    body: { family: 'Nunito Sans', weights: '400;600;700', italic: false }
  },
  text: { heading: CHARCOAL, body: '#3D3D3D', eyebrow: GREEN_TEXT, eyebrowOnBlue: GREEN_TEXT, eyebrowSize: 13, eyebrowSpacing: 0.14, surface: '#E3F3E8', brandColor: 'fresh-green' },
  buttons: {
    primary: { bg: TOMATO, text: '#FFFFFF', border: '', borderW: 0, hover: '#B5361F', padY: 14, padX: 26, lift: 2, weight: 700, shape: 'pill' },
    secondary: { bg: '#FFFFFF', text: GREEN_TEXT, border: GREEN, borderW: 2, hover: '', padY: 14, padX: 26, lift: 2, weight: 700, shape: 'pill' },
    onDark: { bg: '#FFFFFF', text: TOMATO, border: '', borderW: 0, hover: '', padY: 14, padX: 26, lift: 2, weight: 700, shape: 'pill' }
  },
  cards: {
    glass: { fill: 'rgba(227,243,232,0.7)', border: 'rgba(47,158,91,0.25)', radius: 20, shadow: 'none' },
    square: { fill: '#FFFFFF', border: '', radius: 20, shadow: '0 14px 34px rgba(46,46,46,0.10)' },
    rounded: { fill: '#FFFFFF', border: '', radius: 20, shadow: '0 10px 28px rgba(46,46,46,0.08)' }
  },
  layout: { maxWidth: 1200, sidePad: 20, sectionPad: 88 }
});
const theme = {
  ...defaultTheme(), style: 'modern', homeLayout: 'mix', tokens, bgColor: CREAM,
  header: '', glassNav: true, softShadows: true, hoverLift: true, motionStyle: 'subtle', corners: 'round', footerStyle: 'brand'
};
Object.assign(theme, themeTokens.linked(theme));

// ---- blocks ----
const used = new Set();
const bid = () => { let id; do { id = 'b' + Math.random().toString(36).slice(2, 9).padEnd(7, '0'); } while (used.has(id) || !/^b[a-z0-9]{7}$/.test(id)); used.add(id); return id; };
const block = (type, o) => ({ id: bid(), type, heading: '', body: '', imageUrl: '', buttonText: '', buttonUrl: '', side: 'auto', bg: 'none', bgmix: '', bgink: '', gx: '', cardbg: '', cardgx: '', edge: 'none', place: 'top', page: 'home', pin: '', film: '', imgfx: '', height: '', ...o });
const lines = (a) => a.filter(Boolean).join('\n');
const spec = (type, o, body) => block(type, { ...o, body: aboutBlocks.cleanBody(type, lines(body)), side: aboutBlocks.cleanSide(type, o.side) });

const ORDER_NOW = T('Order now', 'Ordenar ahora');

// ========== HOME ==========
const hHero = spec('apphero', {
  heading: T("Order from Kissimmee's best food trucks and local restaurants.", 'Ordena de los mejores food trucks y restaurantes locales de Kissimmee.'),
  imageUrl: IMG.hero, buttonText: ORDER_NOW, buttonUrl: APP, side: 'right'
}, [
  `label: ${T('Local food, fair prices.', 'Comida local, precios justos.')}`,
  `text: ${T('Order ahead for pickup or get it delivered. Real local spots, fair prices, and no line.', 'Ordena por adelantado para recoger o pide entrega a domicilio. Lugares locales de verdad, precios justos y sin filas.')}`,
  `second: ${T('List your restaurant', 'Registra tu restaurante')} | ~/services`,
  `note: ${T('Serving Kissimmee and Osceola County, Florida.', 'Servimos a Kissimmee y el condado de Osceola, Florida.')}`,
  `color: ${TOMATO}`, `accent: ${GREEN}`, `bg: ${CREAM}`
]);
const hBanner = block('cta', {
  heading: T('$5 off your first order + free delivery.', '$5 de descuento en tu primer pedido + entrega gratis.'),
  body: T('New to LocalBite? [Add how the offer works, e.g. the promo code and terms].', '¿Nuevo en LocalBite? [Agrega cómo funciona la oferta, por ejemplo el código y las condiciones].'),
  buttonText: T('Claim my $5', 'Quiero mis $5'), buttonUrl: APP, bg: 'brand'
});
const hSteps = block('steps', {
  heading: T('How it works', 'Cómo funciona'),
  body: lines([
    `${T('Find a truck', 'Encuentra un food truck')} | ${T('See the food trucks and local restaurants open near you right now.', 'Mira los food trucks y restaurantes locales abiertos cerca de ti ahora mismo.')}`,
    `${T('Order ahead', 'Ordena por adelantado')} | ${T('Pick your food and pay in the app. No waiting in line.', 'Elige tu comida y paga en la app. Sin esperar en fila.')}`,
    `${T('Pick up or get it delivered', 'Recoge o recíbelo en casa')} | ${T("Grab it when it's ready, or have it brought to your door.", 'Recógelo cuando esté listo o te lo llevamos a la puerta.')}`
  ]),
  buttonText: ORDER_NOW, buttonUrl: APP, bg: 'none'
});
const hTrucks = spec('aboutpanel', {
  heading: T('Food trucks out now', 'Food trucks abiertos ahora'),
  imageUrl: IMG.trucks, buttonText: T('See trucks out now', 'Ver food trucks abiertos'), buttonUrl: APP, side: 'right'
}, [
  `label: ${T('Pickup tip', 'Consejo para recoger')}`,
  `text: ${T('Skip the line and the delivery fee.', 'Evita la fila y el cargo de entrega.')}`,
  `text: ${T("Trucks tap “I'm parked here now” in LocalBite, so you always know where to find them today. Order ahead and pick it up hot at the window.", 'Los food trucks marcan “Estoy aquí ahora” en LocalBite, así siempre sabes dónde encontrarlos hoy. Ordena por adelantado y recógelo calientito en la ventanilla.')}`,
  `color: ${GREEN_TEXT}`
]);
const spotRow = (n, kind) => `item: ${IMG['spot' + n]} | ${T(`[Spot ${n} name]`, `[Nombre del lugar ${n}]`)} | ${kind} | ${T(`[One line about spot ${n}'s food]`, `[Una línea sobre la comida del lugar ${n}]`)} | ${APP}`;
const FT = T('Food truck', 'Food truck'), RS = T('Restaurant', 'Restaurante');
const hSpots = spec('spotcards', { heading: T('Featured local spots', 'Lugares locales destacados'), buttonText: T('See every spot', 'Ver todos los lugares'), buttonUrl: APP }, [
  `label: ${T('Kissimmee favorites', 'Favoritos de Kissimmee')}`,
  `text: ${T('Food trucks and family restaurants from right here in Osceola County.', 'Food trucks y restaurantes familiares de aquí mismo, del condado de Osceola.')}`,
  spotRow(1, FT), spotRow(2, RS), spotRow(3, FT), spotRow(4, RS), spotRow(5, FT), spotRow(6, RS),
  `more: ${T('Order', 'Ordenar')}`,
  `color: ${GREEN_TEXT}`, 'card: #ffffff', `bg: ${CREAM}`
]);
const hInvite = spec('aboutbig', {
  heading: T('Give $5, get $5.', 'Regala $5, recibe $5.'),
  imageUrl: IMG.invite, buttonText: T('Invite friends', 'Invita a tus amigos'), buttonUrl: APP, side: 'right'
}, [
  `label: ${T('Invite friends', 'Invita a tus amigos')}`,
  `text: ${T('Share your invite link. Your friend gets $5 off their first order, and you get $5 when they order.', 'Comparte tu enlace de invitación. Tu amigo recibe $5 de descuento en su primer pedido y tú recibes $5 cuando ordene.')}`,
  `note: ${T('[Add the referral terms here]', '[Agrega aquí las condiciones del programa de referidos]')}`,
  `color: ${TOMATO}`, 'bg: #ffffff'
]);
const REVIEW = T('[Customer review here]', '[Reseña de cliente aquí]');
const RNAME = T('[Customer name] · [Neighborhood]', '[Nombre del cliente] · [Vecindario]');
const hReviews = block('reviewcard', {
  heading: T('What locals are saying', 'Lo que dicen los vecinos'),
  body: lines([`bg: ${GREEN}`, 'card: #ffffff', `review: ${IMG.av1} | ${REVIEW} | ${RNAME}`, `review: ${IMG.av2} | ${REVIEW} | ${RNAME}`, `review: ${IMG.av3} | ${REVIEW} | ${RNAME}`]),
  imageUrl: IMG.reviews, buttonText: ORDER_NOW, buttonUrl: APP, side: 'left'
});
const homeOrder = [hHero, hBanner, hSteps, hTrucks, hSpots, hInvite, hReviews];

// ========== FOR RESTAURANTS & FOOD TRUCKS (the Services page, built only from blocks) ==========
const P = 'services';
const rHero = spec('apphero', {
  page: P, heading: T('No commissions. One flat monthly price.', 'Sin comisiones. Un solo precio mensual fijo.'),
  imageUrl: IMG.vendor, buttonText: T('Get started', 'Empezar'), buttonUrl: '#form', side: 'right'
}, [
  `label: ${T('For restaurants & food trucks', 'Para restaurantes y food trucks')}`,
  `text: ${T('Big delivery apps take a cut of every order. LocalBite charges one flat monthly fee, so a busy month stays yours.', 'Las grandes apps de entrega se quedan con una parte de cada pedido. LocalBite cobra una tarifa mensual fija, así que un mes con muchas ventas sigue siendo tuyo.')}`,
  `second: ${T('Talk to us', 'Habla con nosotros')} | ~/contact`,
  `offer: ${T('First 10 vendors: 60 days free', 'Primeros 10 negocios: 60 días gratis')}`,
  `color: ${TOMATO}`, `accent: ${GREEN}`, `bg: ${CREAM}`
]);
const rCompare = spec('compare', { page: P, heading: T('Keep more of every order', 'Quédate con más de cada pedido') }, [
  `label: ${T('Compare', 'Compara')}`,
  `cols: ${T('What you pay', 'Lo que pagas')} | ${T('DoorDash / Uber Eats', 'DoorDash / Uber Eats')} | LocalBite`,
  `row: ${T('Fee per order', 'Cargo por pedido')} | ${T('Typically 15-30% per order', 'Por lo general 15-30% por pedido')} | ${T('None', 'Ninguno')}`,
  `row: ${T('Monthly price', 'Precio mensual')} | ${T('Commission grows with your sales', 'La comisión crece con tus ventas')} | ${T('One flat fee, from $49/month', 'Una tarifa fija, desde $49 al mes')}`,
  `row: ${T('A busy month', 'Un mes con muchas ventas')} | ${T('You pay more', 'Pagas más')} | ${T('You pay the same', 'Pagas lo mismo')}`,
  `row: ${T('Pickup orders', 'Pedidos para recoger')} | ${T('Commission still applies', 'Igual se cobra comisión')} | ${T('Included', 'Incluido')}`,
  `note: ${T('Commission ranges are typical published rates for the big delivery apps and vary by plan and market. LocalBite is not affiliated with DoorDash or Uber Eats.', 'Los rangos de comisión son tarifas típicas publicadas por las grandes apps de entrega y varían según el plan y el mercado. LocalBite no está afiliado a DoorDash ni a Uber Eats.')}`,
  `color: ${GREEN}`, 'card: #ffffff', `bg: ${CREAM}`
]);
const rExample = block('cta', {
  page: P,
  heading: T('A truck doing $3,000/month in deliveries pays $450-$750 on DoorDash vs. $49 on LocalBite.', 'Un food truck que vende $3,000 al mes en entregas paga $450-$750 en DoorDash vs. $49 en LocalBite.'),
  body: T('Example at a typical 15-25% commission on $3,000 of delivery orders, compared with the $49 Food Truck plan.', 'Ejemplo con una comisión típica de 15-25% sobre $3,000 en pedidos de entrega, comparado con el plan Food Truck de $49.'),
  bg: 'g-brand-bold'
});
const feat = (a, b) => `${a}`;
const rPricing = block('pricing', {
  page: P, heading: T('Simple, flat pricing', 'Precios simples y fijos'),
  body: lines([
    `${T('Food Truck', 'Food Truck')} | ${T('$49/mo', '$49 al mes')} | ${[T('Delivery and pickup orders', 'Pedidos de entrega y para recoger'), T("“I'm parked here now” location", 'Ubicación “Estoy aquí ahora”'), T('Menu in English and Spanish', 'Menú en inglés y español'), T('Automatic payouts', 'Pagos automáticos')].map(feat).join(', ')}`,
    `*${T('Restaurant', 'Restaurante')} | ${T('$99/mo', '$99 al mes')} | ${[T('Everything in Food Truck', 'Todo lo del plan Food Truck'), T('Clover POS sync', 'Sincronización con Clover POS'), T('Marketing campaigns', 'Campañas de marketing'), T('[Add another feature]', '[Agrega otra función]')].map(feat).join(', ')}`,
    `${T('Restaurant Pro', 'Restaurant Pro')} | ${T('$149/mo', '$149 al mes')} | ${[T('Everything in Restaurant', 'Todo lo del plan Restaurante'), T('[Add a Pro feature]', '[Agrega una función Pro]'), T('[Add a Pro feature]', '[Agrega una función Pro]'), T('[Add a Pro feature]', '[Agrega una función Pro]')].map(feat).join(', ')}`
  ]),
  buttonText: T('Get started', 'Empezar'), buttonUrl: '#form', bg: 'none'
});
const rFounding = block('cta', {
  page: P,
  heading: T('Founding Partner offer', 'Oferta de Socio Fundador'),
  body: T('First 10 vendors: 60 days free, then $39/month locked for a year.', 'Primeros 10 negocios: 60 días gratis y luego $39 al mes, precio fijo por un año.'),
  buttonText: T('Claim a founding spot', 'Reserva tu lugar de fundador'), buttonUrl: '#form', bg: 'brand'
});
const rFeatures = block('features', {
  page: P, heading: T('Everything you need to sell more', 'Todo lo que necesitas para vender más'),
  body: lines([
    `${T('Delivery + pickup', 'Entrega + para recoger')} | ${T('Take both kinds of orders from one simple dashboard.', 'Recibe los dos tipos de pedidos desde un solo panel sencillo.')}`,
    `${T("“I'm parked here now”", '“Estoy aquí ahora”')} | ${T('One tap shows customers where your truck is today.', 'Con un toque tus clientes ven dónde está tu food truck hoy.')}`,
    `${T('Marketing campaigns', 'Campañas de marketing')} | ${T('Send deals to your regulars and bring new customers in.', 'Envía ofertas a tus clientes fieles y atrae clientes nuevos.')}`,
    `${T('Clover POS sync', 'Sincronización con Clover POS')} | ${T('Orders and menu items stay in step with your Clover POS.', 'Tus pedidos y tu menú se mantienen al día con tu Clover POS.')}`,
    `${T('English / Spanish', 'Inglés / español')} | ${T('Your menu and orders work for customers in both languages.', 'Tu menú y tus pedidos funcionan para clientes en los dos idiomas.')}`,
    `${T('Automatic payouts', 'Pagos automáticos')} | ${T('Your money is sent to your bank account automatically.', 'Tu dinero se envía a tu cuenta bancaria de forma automática.')}`
  ]),
  bg: 'tint'
});
const rForm = block('shapeform', {
  page: P, heading: T('List your restaurant or truck', 'Registra tu restaurante o food truck'),
  body: shapeForm.cleanBody(lines([`text: ${T("Tell us about your business and we'll get back to you within a day.", 'Cuéntanos sobre tu negocio y te respondemos en menos de un día.')}`, `color: ${GREEN_TEXT}`, `accent: ${TOMATO}`, 'panel: #e3f3e8', `bg: ${CREAM}`])),
  imageUrl: IMG.signup, side: 'left'
});
const restOrder = [rHero, rCompare, rExample, rPricing, rFounding, rFeatures, rForm];

// ========== DRIVE WITH LOCALBITE (the "Why choose us" page, built only from blocks) ==========
const D = 'whyChoose';
const DRIVE_APPLY = T('Apply to drive', 'Solicita ser repartidor');
const dHero = spec('apphero', {
  page: D, heading: T('Drive with LocalBite. Earn on your schedule.', 'Maneja con LocalBite. Gana con tu propio horario.'),
  imageUrl: IMG.driver, buttonText: DRIVE_APPLY, buttonUrl: '#form', side: 'right'
}, [
  `label: ${T('Drive with LocalBite', 'Maneja con LocalBite')}`,
  `text: ${T('Deliver food from the local trucks and restaurants your neighbors love. Short trips around Kissimmee and Osceola County, paid every order.', 'Entrega comida de los food trucks y restaurantes locales que tus vecinos aman. Viajes cortos por Kissimmee y el condado de Osceola, con pago por cada pedido.')}`,
  `second: ${T('Questions? Read the FAQ', '¿Preguntas? Lee las preguntas frecuentes')} | ~/faq`,
  `color: ${TOMATO}`, `accent: ${GREEN}`, `bg: ${CREAM}`
]);
const dPerks = block('features', {
  page: D, heading: T('Why drive with us', 'Por qué manejar con nosotros'),
  body: lines([
    `${T('Earnings', 'Ganancias')} | ${T('Earn on every delivery, and keep 100% of your tips. [Add your pay details]', 'Gana en cada entrega y quédate con el 100% de tus propinas. [Agrega los detalles de pago]')}`,
    `${T('Flexible hours', 'Horario flexible')} | ${T('Drive when you want: lunch, dinner or weekends. No minimum hours.', 'Maneja cuando quieras: almuerzo, cena o fines de semana. Sin mínimo de horas.')}`,
    `${T('Stay local', 'Quédate cerca')} | ${T('Short trips around Kissimmee and Osceola County, close to home.', 'Viajes cortos por Kissimmee y el condado de Osceola, cerca de casa.')}`
  ]),
  bg: 'none'
});
const dReq = spec('aboutfacts', { page: D, heading: T('What you need', 'Lo que necesitas'), imageUrl: IMG.driverReq, buttonText: DRIVE_APPLY, buttonUrl: '#form', side: 'left' }, [
  `label: ${T('Requirements', 'Requisitos')}`,
  `text: ${T('Here is what you need to start. [Confirm these requirements]', 'Esto es lo que necesitas para empezar. [Confirma estos requisitos]')}`,
  `fact: ${T('18 or older', '18 años o más')}`,
  `fact: ${T("A valid driver's license", 'Licencia de conducir vigente')}`,
  `fact: ${T('A car, scooter or bike with insurance', 'Auto, scooter o bicicleta con seguro')}`,
  `fact: ${T('A smartphone', 'Un teléfono inteligente')}`,
  `fact: ${T('Pass a background check', 'Aprobar una verificación de antecedentes')}`,
  `color: ${GREEN}`, 'bg: #ffffff'
]);
const dForm = block('shapeform', {
  page: D, heading: DRIVE_APPLY,
  body: shapeForm.cleanBody(lines([`text: ${T('Send us your details and pick "Driver". We will reach out with next steps.', 'Envíanos tus datos y elige "Repartidor". Te contactaremos con los siguientes pasos.')}`, `color: ${GREEN_TEXT}`, `accent: ${TOMATO}`, 'panel: #e3f3e8', `bg: ${CREAM}`])),
  imageUrl: IMG.driver, side: 'right'
});
const driveOrder = [dHero, dPerks, dReq, dForm];

// ========== ABOUT (built only from blocks) ==========
const A = 'about';
const aHero = spec('apphero', { page: A, heading: T('Local, Kissimmee-owned.', 'Local, de dueños de Kissimmee.'), buttonText: ORDER_NOW, buttonUrl: APP }, [
  `label: ${T('About LocalBite', 'Sobre LocalBite')}`,
  `text: ${T('LocalBite is a food delivery and pickup app built in Kissimmee, for Kissimmee.', 'LocalBite es una app de entrega y comida para recoger creada en Kissimmee, para Kissimmee.')}`,
  'pic: off', `color: ${TOMATO}`, `accent: ${GREEN}`, `bg: ${CREAM}`
]);
const aStory = spec('aboutstory', { page: A, heading: T('Our story', 'Nuestra historia'), imageUrl: IMG.about, side: 'left' }, [
  `label: ${T('How it started', 'Cómo empezó')}`,
  `text: ${T('[Your story here: who you are, why you started LocalBite and what you love about Kissimmee food.]', '[Tu historia aquí: quién eres, por qué empezaste LocalBite y lo que te encanta de la comida de Kissimmee.]')}`,
  `note: ${T('[Your name], founder', '[Tu nombre], fundador')}`,
  `color: ${GREEN}`, `bg: ${CREAM}`
]);
const aMission = spec('aboutpanel', { page: A, heading: T('Our mission', 'Nuestra misión'), imageUrl: IMG.mission, buttonText: T('List your restaurant', 'Registra tu restaurante'), buttonUrl: '~/services', side: 'right' }, [
  `label: ${T('Why we do it', 'Por qué lo hacemos')}`,
  `text: ${T('Help local food trucks and restaurants keep more of what they earn, and help neighbors find great local food at fair prices.', 'Ayudar a los food trucks y restaurantes locales a quedarse con más de lo que ganan, y ayudar a los vecinos a encontrar buena comida local a precios justos.')}`,
  `color: ${GREEN_TEXT}`
]);
const aboutOrder = [aHero, aStory, aMission];

// ========== FAQ (built only from blocks: one list for customers, one for vendors) ==========
const F = 'faq';
const fHero = spec('apphero', { page: F, heading: T('Frequently asked questions', 'Preguntas frecuentes') }, [
  `text: ${T("Answers for customers, restaurants, food trucks and drivers. Can't find yours? Send us a message.", '¿Eres cliente, restaurante, food truck o repartidor? Aquí tienes respuestas. ¿No encuentras la tuya? Escríbenos.')}`,
  `second: ${T('Contact us', 'Contáctanos')} | ~/contact`, 'pic: off', `color: ${TOMATO}`, `accent: ${GREEN}`, `bg: ${CREAM}`
]);
const qa = (q, a) => `${q} | ${a}`;
const fCustomers = block('accordion', {
  page: F, heading: T('For customers', 'Para clientes'), bg: 'none',
  body: lines([
    qa(T('Where does LocalBite deliver?', '¿Dónde entrega LocalBite?'), T('Kissimmee and nearby areas of Osceola County. Enter your address in the app to see the spots that deliver to you.', 'En Kissimmee y zonas cercanas del condado de Osceola. Escribe tu dirección en la app para ver los lugares que te entregan.')),
    qa(T('Can I pick up my order instead?', '¿Puedo recoger mi pedido?'), T('Yes. Choose pickup at checkout, skip the line and skip the delivery fee.', 'Sí. Elige recoger al pagar, evita la fila y el cargo de entrega.')),
    qa(T('How do I find food trucks that are open now?', '¿Cómo encuentro food trucks abiertos ahora?'), T('Open the app and look for trucks out now. Trucks share their spot when they park, so the map shows where they are today.', 'Abre la app y busca los food trucks abiertos. Los trucks comparten su ubicación cuando se estacionan, así el mapa muestra dónde están hoy.')),
    qa(T('How does the $5 off my first order work?', '¿Cómo funcionan los $5 de descuento en mi primer pedido?'), T('[Explain the offer: who it is for, how to claim it and any limits.]', '[Explica la oferta: para quién es, cómo usarla y sus límites.]')),
    qa(T('Is the app in Spanish?', '¿La app está en español?'), T('Yes. LocalBite works in English and Spanish.', 'Sí. LocalBite funciona en inglés y en español.'))
  ])
});
const fVendors = block('accordion', {
  page: F, heading: T('For restaurants & food trucks', 'Para restaurantes y food trucks'), bg: 'tint',
  body: lines([
    qa(T('Does LocalBite take a commission?', '¿LocalBite cobra comisión?'), T('No. You pay one flat monthly price: $49 for food trucks, $99 for restaurants, $149 for Restaurant Pro.', 'No. Pagas un solo precio mensual fijo: $49 para food trucks, $99 para restaurantes y $149 para Restaurant Pro.')),
    qa(T('What is the Founding Partner offer?', '¿Qué es la oferta de Socio Fundador?'), T('The first 10 vendors get 60 days free, then $39/month locked for a year.', 'Los primeros 10 negocios reciben 60 días gratis y luego $39 al mes, precio fijo por un año.')),
    qa(T('Does it work with my Clover POS?', '¿Funciona con mi Clover POS?'), T('Yes. LocalBite syncs with Clover POS. [Confirm which plans include it.]', 'Sí. LocalBite se sincroniza con Clover POS. [Confirma qué planes lo incluyen.]')),
    qa(T('How and when do I get paid?', '¿Cómo y cuándo me pagan?'), T('Payouts go to your bank account automatically. [Add the payout schedule.]', 'Los pagos llegan a tu cuenta bancaria de forma automática. [Agrega el calendario de pagos.]')),
    qa(T('Can I take both delivery and pickup orders?', '¿Puedo recibir pedidos de entrega y para recoger?'), T('Yes. Every plan includes both, and food trucks can share their live spot with “I\'m parked here now”.', 'Sí. Todos los planes incluyen los dos, y los food trucks pueden compartir su ubicación con “Estoy aquí ahora”.'))
  ]),
  buttonText: T('List your restaurant', 'Registra tu restaurante'), buttonUrl: '~/services'
});
const faqOrder = [fHero, fCustomers, fVendors];

// ========== CONTACT (the built-in contact page: form, details, map; plus these blocks under it) ==========
const C = 'contact';
const AREAS = ['Kissimmee', 'St. Cloud', 'Celebration', 'Poinciana', 'Buenaventura Lakes', 'Campbell', 'Harmony', 'Narcoossee'];
const cAreas = block('chips', { page: C, place: 'bottom', heading: T('Service area', 'Zona de servicio'), body: AREAS.join('\n'), bg: 'tint' });
const cWays = block('split', {
  page: C, place: 'bottom', heading: T('Other ways to reach us', 'Otras formas de contactarnos'),
  body: T('Email: [Email] · Phone: [Phone]', 'Correo: [Email] · Teléfono: [Teléfono]'), bg: 'none'
});
const cSocial = spec('socialstrip', { page: C, place: 'bottom', heading: T('Follow LocalBite', 'Sigue a LocalBite') }, [
  `color: ${GREEN_TEXT}`, 'instagram: https://www.instagram.com/', 'facebook: https://www.facebook.com/', 'tiktok: https://www.tiktok.com/'
]);
const contactOrder = [cAreas, cWays, cSocial];

const all = [...homeOrder, ...restOrder, ...driveOrder, ...aboutOrder, ...faqOrder, ...contactOrder];
const sections = defaultSections();
sections.blocks.items = all;
theme.mix = mixPage.clean(homeOrder.map((b) => ({ k: 'blk', f: 'own', v: b.id, ...(b === hSteps ? { a: 'how-it-works' } : b === hSpots ? { a: 'spots' } : b === hInvite ? { a: 'invite' } : {}) })));

// page names in the menu (the section headings) and the built-in sections that still show
sections.services.heading = T('For Restaurants', 'Para restaurantes');
sections.services.items = [];
sections.whyChoose.heading = T('Drive', 'Maneja');
sections.whyChoose.items = [];
sections.about.heading = T('About', 'Nosotros');
sections.about.body = '';
sections.faq.heading = T('FAQ', 'Preguntas');
sections.faq.items = [];
sections.contact.heading = T('Contact', 'Contacto');
T('Home', 'Inicio');
// words the site itself draws (menu, footer, thank-you page)
[['Coming soon', 'Próximamente'], ['Food delivery app in Kissimmee', 'App de entrega de comida en Kissimmee'], ['Featured', 'Destacado'],
  ['Privacy Policy', 'Política de privacidad'], ['Terms of Use', 'Términos de uso'], ['Quick Links', 'Enlaces rápidos'], ['Skip to content', 'Saltar al contenido'],
  ['Open the menu', 'Abrir el menú'], ['Close the menu', 'Cerrar el menú'], ['Menu', 'Menú'], ['Map', 'Mapa'], ['Language', 'Idioma'],
  [`© ${new Date().getFullYear()} LocalBite. All rights reserved.`, `© ${new Date().getFullYear()} LocalBite. Todos los derechos reservados.`],
  ['Thank you!', '¡Gracias!'], ['Thank you — LocalBite', 'Gracias — LocalBite'], ['Back to home', 'Volver al inicio'],
  ["We received your request and will be in touch. If it's urgent, you can also call us directly.", 'Recibimos tu solicitud y te contactaremos pronto. Si es urgente, también puedes llamarnos directamente.']
].forEach(([a, b]) => T(a, b));
Object.assign(sections.hero, { headline: "Order from Kissimmee's best food trucks and local restaurants.", subheadline: T('Local food, fair prices.', 'Comida local, precios justos.'), ctaText: ORDER_NOW, ctaLink: APP });
Object.assign(sections.contact, {
  phone: '', email: '', address: 'Kissimmee, FL', footerHours: false, acceptSubmissions: true,
  social: { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', twitter: '' },
  form: {
    mode: 'custom', title: T('Send us a message', 'Envíanos un mensaje'),
    intro: T("Customers, vendors and drivers: tell us what you need and we'll get back to you.", 'Clientes, negocios y repartidores: cuéntanos qué necesitas y te responderemos.'),
    submitText: T('Send message', 'Enviar mensaje'),
    fields: [
      { label: T('Your name', 'Tu nombre'), type: 'name', required: true },
      { label: T('Business name (if you have one)', 'Nombre del negocio (si tienes uno)'), type: 'text', required: false },
      { label: T('Phone', 'Teléfono'), type: 'phone', required: false },
      { label: T('Email', 'Correo electrónico'), type: 'email', required: true },
      { label: T('I am a', 'Soy'), type: 'radio', required: true, options: [T('Food truck', 'Food truck'), RS, T('Customer', 'Cliente'), T('Driver', 'Repartidor')] },
      { label: T('Message', 'Mensaje'), type: 'message', required: false }
    ]
  }
});
sections.trust.serviceAreas = AREAS;
sections.meta = { ...sections.meta, businessType: 'food delivery app', city: 'Kissimmee' };
sections.legal = { ...sections.legal, enabled: true, ownerName: 'LocalBite', email: '', address: 'Kissimmee, FL', state: 'Florida', updated: '' };

// SEO: the home page and each page's own title and description
const seoTitle = T('LocalBite | Kissimmee food delivery from food trucks & local restaurants', 'LocalBite | Entrega de comida en Kissimmee de food trucks y restaurantes locales');
const seoDesc = T('Kissimmee food delivery and pickup from food trucks and local restaurants in Osceola County. Find food trucks in Kissimmee, order ahead, skip the line.', 'Entrega y comida para recoger en Kissimmee de food trucks y restaurantes locales del condado de Osceola. Encuentra food trucks en Kissimmee, ordena por adelantado y evita la fila.');
sections.seo.title = seoTitle; sections.seo.description = seoDesc;
const page = (title, description) => ({ title, description, shareImage: '', noindex: false });
sections.seo.pages = {
  services: page(T('For restaurants & food trucks: no commissions | LocalBite Kissimmee', 'Para restaurantes y food trucks: sin comisiones | LocalBite Kissimmee'), T('List your Kissimmee restaurant or food truck on LocalBite. No commissions, one flat monthly price from $49. Delivery, pickup and Clover POS sync.', 'Registra tu restaurante o food truck de Kissimmee en LocalBite. Sin comisiones, un precio mensual fijo desde $49. Entrega, para recoger y sincronización con Clover POS.')),
  whyChoose: page(T('Drive with LocalBite | Food delivery driver jobs in Kissimmee', 'Maneja con LocalBite | Trabajo de repartidor de comida en Kissimmee'), T('Deliver for local food trucks and restaurants in Kissimmee and Osceola County. Flexible hours, earn on every delivery. Apply to drive.', 'Entrega para food trucks y restaurantes locales en Kissimmee y el condado de Osceola. Horario flexible, gana en cada entrega. Solicita ser repartidor.')),
  about: page(T('About LocalBite | Kissimmee-owned food delivery', 'Sobre LocalBite | Entrega de comida de dueños de Kissimmee'), T('LocalBite is a local, Kissimmee-owned food delivery and pickup app for food trucks and restaurants in Osceola County.', 'LocalBite es una app local de entrega y comida para recoger, de dueños de Kissimmee, para food trucks y restaurantes del condado de Osceola.')),
  faq: page(T('FAQ | LocalBite Kissimmee food delivery & food trucks', 'Preguntas frecuentes | LocalBite, entrega de comida y food trucks en Kissimmee'), T('Answers about Kissimmee food delivery, food trucks in Kissimmee, pickup, pricing for vendors and driving with LocalBite.', 'Respuestas sobre la entrega de comida en Kissimmee, los food trucks, recoger pedidos, precios para negocios y manejar con LocalBite.')),
  contact: page(T('Contact LocalBite | Kissimmee food delivery', 'Contacta a LocalBite | Entrega de comida en Kissimmee'), T('Questions about ordering, listing your restaurant or food truck, or driving? Contact LocalBite in Kissimmee, FL.', '¿Preguntas sobre pedidos, registrar tu restaurante o food truck, o manejar? Contacta a LocalBite en Kissimmee, FL.'))
};

// Site kit: language switch, the Order now button, block-only pages, phone menu, app badges, TikTok
sections.kit = siteKit.clean({
  langs: { on: true, code: 'es', first: 'EN', second: 'ES', words: PAIRS },
  button: { text: ORDER_NOW, url: APP, newTab: true },
  blockPages: ['services', 'whyChoose', 'about', 'faq'],
  apps: { on: true, ios: '', android: '' },
  tiktok: 'https://www.tiktok.com/',
  phoneMenu: true
});

const layout = {
  order: ['hero', 'services', 'whyChoose', 'about', 'faq', 'contact', 'testimonials', 'gallery', 'blog', 'extraPages', 'hours'],
  hidden: ['testimonials', 'gallery', 'blog', 'extraPages', 'hours'],
  items: []
};
layout.items = layout.order.concat(all.map(b => 'blk:' + b.id));

const info = db.prepare('INSERT INTO sites (user_id, slug, name, theme, sections, layout, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .run(owner.user_id, SLUG, NAME, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), seoTitle, seoDesc);
db.prepare('INSERT INTO site_versions (site_id, theme, sections, layout, label) VALUES (?, ?, ?, ?, ?)')
  .run(info.lastInsertRowid, JSON.stringify(theme), JSON.stringify(sections), JSON.stringify(layout), 'First build (LocalBite)');
console.log(`Made "${NAME}" (site ${info.lastInsertRowid}). Open http://localhost:3000/sites/${info.lastInsertRowid}/edit`);
