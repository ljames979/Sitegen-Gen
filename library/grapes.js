// The section library as GrapesJS blocks, for the visual editor. Each block is the real template rendered with
// clearly-labeled sample content, so a dropped block already looks like the site (it carries the same theme
// variables) and the owner just edits the words. Usage:  const blocks = await toGrapesBlocks(ejs, viewsDir)
//   editor.BlockManager.add(b.id, { label: b.label, category: b.category, content: b.content })
const path = require('path');
const { SECTIONS, FAMILIES } = require('./index');

const img = '/sample-photo.jpg';
const SAMPLES = {
  hero: { trust: ['Locally owned', 'Clear pricing'], stats: [{ value: '10', label: 'Years in business' }, { value: '4.9', label: 'Average rating' }], images: [img, img, img], headline: 'Your headline goes here', sub: 'One clear sentence about what you do and who it is for.', image: img, ctaText: 'Get a quote', ctaHref: '#contact', phone: '(555) 010-0100', phoneHref: '5550100100' },
  about: { heading: 'About us', body: 'Tell visitors who you are, where you work and what you do.', image: img, imageAlt: '', moreHref: '#' },
  services: { heading: 'What we do', moreHref: '#', items: [1, 2, 3].map(n => ({ title: 'Service ' + n, description: 'A short description of this service.', price: '', imageUrl: img, href: '#' })) },
  why: { heading: 'Why choose us', items: [1, 2, 3].map(n => ({ title: 'Reason ' + n, text: 'One sentence that backs it up.' })) },
  stats: { items: [{ value: '10', label: 'Years in business' }, { value: '4.9', label: 'Average rating' }, { value: '300', label: 'Jobs done' }] },
  testimonials: { heading: 'What customers say', moreHref: '', items: [1, 2, 3].map(n => ({ quote: 'A customer quote goes here.', name: 'Customer name', role: '', rating: 5 })) },
  pricing: { heading: 'Pricing', ctaHref: '#contact', items: [1, 2, 3].map(n => ({ title: 'Option ' + n, price: '$0', description: 'What is included.', href: '#' })) },
  faq: { heading: 'Frequently asked questions', moreHref: '', ctaHref: '#contact', phone: '(555) 010-0100', phoneHref: '5550100100', items: [1, 2, 3].map(n => ({ question: 'Question ' + n + '?', answer: 'The answer goes here.' })) },
  gallery: { heading: 'Our work', moreHref: '', images: [1, 2, 3, 4, 5, 6].map(n => ({ src: img, alt: '' })) },
  areas: { heading: 'Areas we serve', items: ['Town one', 'Town two', 'Town three', 'Town four'].map(name => ({ name, href: '' })) },
  cta: { heading: 'Ready to get started?', text: 'Tell us what you need.', ctaText: 'Contact us', ctaHref: '#contact', phone: '(555) 010-0100', phoneHref: '5550100100' },
  contact: { heading: 'Get in touch', ctaText: 'Send a message', ctaHref: '#contact', items: [{ kind: 'call', label: 'Call', value: '(555) 010-0100', href: 'tel:5550100100' }, { kind: 'text', label: 'Text', value: '(555) 010-0100', href: 'sms:5550100100' }, { kind: 'email', label: 'Email', value: 'you@example.com', href: 'mailto:you@example.com' }, { kind: 'visit', label: 'Visit', value: '1 Main St', href: '#' }] },
  custom: { heading: 'Your heading', body: 'Write a few sentences here, or add photos.', images: [1, 2, 3].map(() => ({ src: img, alt: '' })), buttonText: '', buttonHref: '' },
  banner: { items: ['Family owned', 'Free estimates', 'Local service', 'Fast response'] },
  bento: { heading: 'At a glance', photos: [{ src: img, alt: '' }, { src: img, alt: '' }], stats: [{ value: '10', label: 'Years in business' }, { value: '4.9', label: 'Average rating' }], services: ['Service one', 'Service two', 'Service three'].map(title => ({ title, href: '#' })), servicesHeading: 'What we do', servicesHref: '#', review: { text: 'A customer quote goes here.', name: 'Customer name', rating: 5 }, place: 'Your town', phone: '(555) 010-0100', phoneHref: '5550100100', ctaText: 'Get in touch', ctaHref: '#contact' },
  logos: { heading: 'Trusted by', items: [1, 2, 3, 4].map(() => ({ src: img, alt: '' })) },
};

async function toGrapesBlocks(ejs, viewsDir) {
  const out = [];
  for (const s of SECTIONS) {
    const content = await ejs.renderFile(path.join(viewsDir, 'library', s.file + '.ejs'), { d: SAMPLES[s.family] });
    out.push({
      id: 'sg-' + s.file, label: `${FAMILIES[s.family]}: ${s.label}`, category: FAMILIES[s.family],
      content: content.trim(), attributes: { title: s.hint, 'data-source': s.source, 'data-license': s.license },
    });
  }
  return out;
}
module.exports = { toGrapesBlocks, SAMPLES };
