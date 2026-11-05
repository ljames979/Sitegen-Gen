// A library of ready-made copy for common local-business types, used by the
// "Generate a site" feature. Each template's `keywords` are matched (case
// insensitively, substring match) against whatever the user types as their
// business type, e.g. "plumbing company" or "hair salon in Austin".
// {name} is substituted with the business name throughout.

const TEMPLATES = [
  {
    id: 'plumbing',
    keywords: ['plumb'],
    label: 'Plumbing',
    hero: { headline: '{name}', subheadline: 'Fast, reliable plumbing repair and installation you can trust.', ctaText: 'Request Service' },
    about: 'At {name}, we\'ve built our reputation on honest work, fair pricing, and showing up when we say we will. Whether it\'s a leaky faucet or a full repipe, our licensed plumbers get it done right the first time.',
    services: [
      { title: 'Drain Cleaning', description: 'Fast, effective clearing for clogged kitchen, bathroom, and main lines.' },
      { title: 'Water Heater Repair & Install', description: 'Same-day service for gas and electric water heaters, tank or tankless.' },
      { title: 'Leak Detection & Repair', description: 'We find hidden leaks fast and fix them before they cause real damage.' },
      { title: 'Emergency Plumbing', description: '24/7 response when a pipe bursts or a fixture fails.' }
    ],
    faq: [
      { question: 'Do you offer emergency service?', answer: 'Yes — we offer 24/7 emergency plumbing for urgent issues like burst pipes and major leaks.' },
      { question: 'Are your plumbers licensed and insured?', answer: 'Yes, all of our technicians are fully licensed and insured.' }
    ],
    photoQueries: ['plumber at work', 'pipe repair', 'plumbing tools']
  },
  {
    id: 'electrician',
    keywords: ['electric'],
    label: 'Electrical',
    hero: { headline: '{name}', subheadline: 'Licensed electricians for safe, code-compliant work every time.', ctaText: 'Get a Quote' },
    about: '{name} provides residential and commercial electrical services with a focus on safety and quality. From small repairs to full panel upgrades, our licensed electricians treat every job like it\'s in their own home.',
    services: [
      { title: 'Panel Upgrades', description: 'Safely upgrade outdated electrical panels to meet modern demand.' },
      { title: 'Wiring & Rewiring', description: 'New wiring for renovations, additions, and older homes.' },
      { title: 'Lighting Installation', description: 'Indoor and outdoor lighting design and installation.' },
      { title: 'Electrical Repairs', description: 'Troubleshooting and fixing outlets, switches, and circuits.' }
    ],
    faq: [
      { question: 'Is my home\'s wiring safe?', answer: 'We offer full electrical inspections to check for outdated or unsafe wiring and give you a clear report.' },
      { question: 'Do you handle commercial properties?', answer: 'Yes, we service both residential and commercial properties.' }
    ],
    photoQueries: ['electrician working', 'electrical panel', 'wiring']
  },
  {
    id: 'hvac',
    keywords: ['hvac', 'heating', 'air condition', 'ac repair'],
    label: 'HVAC',
    hero: { headline: '{name}', subheadline: 'Heating and cooling repair, installation, and maintenance done right.', ctaText: 'Schedule Service' },
    about: '{name} keeps your home comfortable all year round. Our technicians are trained on all major brands and systems, and we always explain your options in plain language before any work begins.',
    services: [
      { title: 'AC Repair & Installation', description: 'Fast diagnostics and repair, or full system replacement when needed.' },
      { title: 'Heating Repair & Installation', description: 'Furnace and heat pump service to keep you warm all winter.' },
      { title: 'Maintenance Plans', description: 'Seasonal tune-ups that catch small problems before they become big ones.' },
      { title: 'Indoor Air Quality', description: 'Filtration and humidity solutions for healthier indoor air.' }
    ],
    faq: [
      { question: 'How often should I service my HVAC system?', answer: 'We recommend a tune-up twice a year — once before summer and once before winter.' },
      { question: 'Do you offer financing?', answer: 'Ask us about financing options for new system installations.' }
    ],
    photoQueries: ['hvac technician', 'air conditioning unit', 'furnace repair']
  },
  {
    id: 'landscaping',
    keywords: ['landscap', 'lawn care', 'lawn service'],
    label: 'Landscaping',
    hero: { headline: '{name}', subheadline: 'Beautiful, healthy outdoor spaces, maintained year-round.', ctaText: 'Get a Free Estimate' },
    about: '{name} helps homeowners and businesses love their outdoor space again. From weekly mowing to full landscape design, our crew treats every property like a showpiece.',
    services: [
      { title: 'Lawn Maintenance', description: 'Regular mowing, edging, and cleanup to keep your lawn looking sharp.' },
      { title: 'Landscape Design & Installation', description: 'Custom plans for gardens, walkways, and outdoor living spaces.' },
      { title: 'Irrigation Systems', description: 'Sprinkler installation and repair to keep your lawn healthy efficiently.' },
      { title: 'Seasonal Cleanup', description: 'Leaf removal, mulching, and prep for every season.' }
    ],
    faq: [
      { question: 'Do you offer recurring service?', answer: 'Yes, we offer weekly, bi-weekly, and monthly maintenance plans.' },
      { question: 'Do you work with commercial properties?', answer: 'We service both residential yards and commercial properties.' }
    ],
    photoQueries: ['landscaping garden', 'lawn mowing', 'garden design']
  },
  {
    id: 'cleaning',
    keywords: ['clean'],
    label: 'Cleaning Service',
    hero: { headline: '{name}', subheadline: 'A spotless home or office, without lifting a finger.', ctaText: 'Book a Cleaning' },
    about: '{name} provides thorough, reliable cleaning for homes and offices. Our vetted, trained team brings their own supplies and treats every space with care and attention to detail.',
    services: [
      { title: 'Recurring House Cleaning', description: 'Weekly, bi-weekly, or monthly cleanings tailored to your home.' },
      { title: 'Deep Cleaning', description: 'A top-to-bottom clean for move-ins, move-outs, or spring cleaning.' },
      { title: 'Office Cleaning', description: 'Reliable commercial cleaning to keep your workplace welcoming.' },
      { title: 'Move-In / Move-Out Cleaning', description: 'A spotless clean before you arrive or after you leave.' }
    ],
    faq: [
      { question: 'Do I need to provide cleaning supplies?', answer: 'No — our team brings all necessary supplies and equipment.' },
      { question: 'Are your cleaners insured?', answer: 'Yes, all of our cleaners are background-checked, bonded, and insured.' }
    ],
    photoQueries: ['house cleaning', 'cleaning supplies', 'clean office']
  },
  {
    id: 'roofing',
    keywords: ['roof'],
    label: 'Roofing',
    hero: { headline: '{name}', subheadline: 'Quality roofing that protects what matters most.', ctaText: 'Get a Free Inspection' },
    about: '{name} has helped homeowners protect their biggest investment with dependable roof repair, replacement, and inspection services. We work with all major roofing materials and manufacturers.',
    services: [
      { title: 'Roof Repair', description: 'Fast fixes for leaks, missing shingles, and storm damage.' },
      { title: 'Roof Replacement', description: 'Full tear-off and replacement with quality materials and craftsmanship.' },
      { title: 'Roof Inspections', description: 'Thorough inspections for home sales, insurance, or peace of mind.' },
      { title: 'Storm Damage & Insurance Claims', description: 'We help you navigate the claims process from start to finish.' }
    ],
    faq: [
      { question: 'How long does a roof replacement take?', answer: 'Most residential roof replacements are completed in one to three days, weather permitting.' },
      { question: 'Do you help with insurance claims?', answer: 'Yes, we work directly with insurance companies on storm damage claims.' }
    ],
    photoQueries: ['roofing work', 'roof repair', 'roof shingles']
  },
  {
    id: 'contractor',
    keywords: ['contractor', 'construction', 'remodel', 'renovation', 'builder'],
    label: 'General Contracting',
    hero: { headline: '{name}', subheadline: 'From concept to completion, built the right way.', ctaText: 'Start Your Project' },
    about: '{name} brings your renovation or construction project to life with skilled craftsmanship and clear communication at every step. We manage the details so you don\'t have to.',
    services: [
      { title: 'Kitchen & Bath Remodeling', description: 'Full remodels designed and built around how you actually live.' },
      { title: 'Home Additions', description: 'Add the space you need with a seamless, code-compliant addition.' },
      { title: 'General Renovations', description: 'Flooring, drywall, painting, and everything in between.' },
      { title: 'Project Management', description: 'One point of contact managing subcontractors, permits, and timelines.' }
    ],
    faq: [
      { question: 'Are you licensed and insured?', answer: 'Yes, we are fully licensed and insured for residential and commercial work.' },
      { question: 'How do you handle permits?', answer: 'We pull and manage all necessary permits as part of the project.' }
    ],
    photoQueries: ['construction remodel', 'home renovation', 'contractor working']
  },
  {
    id: 'auto-repair',
    keywords: ['auto repair', 'mechanic', 'car repair', 'auto shop'],
    label: 'Auto Repair',
    hero: { headline: '{name}', subheadline: 'Honest, expert auto repair for every make and model.', ctaText: 'Book an Appointment' },
    about: '{name} has been keeping local drivers on the road with straightforward diagnostics, fair pricing, and quality repairs. No upselling, no surprises — just honest work.',
    services: [
      { title: 'Oil Changes & Maintenance', description: 'Routine maintenance to keep your car running smoothly.' },
      { title: 'Brake Service', description: 'Inspection, repair, and replacement to keep you stopping safely.' },
      { title: 'Engine Diagnostics', description: 'Modern diagnostic equipment to find the real issue, fast.' },
      { title: 'Transmission Service', description: 'Repair and maintenance for automatic and manual transmissions.' }
    ],
    faq: [
      { question: 'Do you offer a warranty on repairs?', answer: 'Yes, most repairs come with a warranty on parts and labor.' },
      { question: 'Can I get a free estimate?', answer: 'Yes, we provide free estimates before any work begins.' }
    ],
    photoQueries: ['auto mechanic', 'car repair shop', 'car engine']
  },
  {
    id: 'salon',
    keywords: ['salon', 'hair', 'barber'],
    label: 'Salon',
    hero: { headline: '{name}', subheadline: 'Look and feel your best, every visit.', ctaText: 'Book an Appointment' },
    about: '{name} is where clients come to relax and leave looking their best. Our stylists stay current on the latest techniques and trends, and every visit is tailored to you.',
    services: [
      { title: 'Haircuts & Styling', description: 'Precision cuts and styling for every hair type.' },
      { title: 'Color Services', description: 'Full color, highlights, balayage, and color correction.' },
      { title: 'Treatments', description: 'Deep conditioning and repair treatments for healthy hair.' },
      { title: 'Special Occasion Styling', description: 'Wedding and event styling to make your day perfect.' }
    ],
    faq: [
      { question: 'Do I need an appointment?', answer: 'Appointments are recommended, but walk-ins are welcome when availability allows.' },
      { question: 'Do you offer consultations?', answer: 'Yes, free consultations are available for color and major style changes.' }
    ],
    photoQueries: ['hair salon', 'hairstylist', 'salon interior']
  },
  {
    id: 'spa',
    keywords: ['spa', 'massage', 'wellness'],
    label: 'Spa & Wellness',
    hero: { headline: '{name}', subheadline: 'Relax, restore, and recharge.', ctaText: 'Book Your Escape' },
    about: '{name} offers a peaceful escape from the everyday. Our licensed therapists and estheticians provide personalized treatments in a calm, welcoming space.',
    services: [
      { title: 'Massage Therapy', description: 'Swedish, deep tissue, and therapeutic massage options.' },
      { title: 'Facials', description: 'Customized facials for every skin type and concern.' },
      { title: 'Body Treatments', description: 'Scrubs and wraps that leave your skin renewed.' },
      { title: 'Spa Packages', description: 'Combine services for the ultimate relaxation experience.' }
    ],
    faq: [
      { question: 'What should I expect on my first visit?', answer: 'Arrive a few minutes early to fill out a brief intake form so we can tailor your treatment.' },
      { question: 'Do you sell gift cards?', answer: 'Yes, gift cards are available for any service or dollar amount.' }
    ],
    photoQueries: ['spa massage', 'spa interior', 'relaxation spa']
  },
  {
    id: 'restaurant',
    keywords: ['restaurant', 'diner', 'eatery', 'bistro'],
    label: 'Restaurant',
    hero: { headline: '{name}', subheadline: 'Great food, great company, every time you visit.', ctaText: 'View Our Menu' },
    about: '{name} serves up thoughtfully prepared dishes made with quality ingredients, in a warm and welcoming atmosphere. Whether it\'s date night or a family dinner, we\'ve got a table for you.',
    services: [
      { title: 'Dine-In', description: 'A warm, welcoming space for lunch and dinner.' },
      { title: 'Takeout & Delivery', description: 'Enjoy our menu from the comfort of home.' },
      { title: 'Private Events', description: 'Book our space for your next celebration.' },
      { title: 'Catering', description: 'Bring our menu to your next event or office gathering.' }
    ],
    faq: [
      { question: 'Do you take reservations?', answer: 'Yes, we recommend reservations for weekend evenings.' },
      { question: 'Do you offer catering?', answer: 'Yes, we cater events of all sizes — contact us for a custom quote.' }
    ],
    photoQueries: ['restaurant food', 'restaurant interior', 'chef cooking']
  },
  {
    id: 'bakery',
    keywords: ['bakery', 'bake shop', 'patisserie'],
    label: 'Bakery',
    hero: { headline: '{name}', subheadline: 'Fresh baked, every single day.', ctaText: 'See What\'s Fresh' },
    about: '{name} bakes everything from scratch, every morning, using quality ingredients and time-tested recipes. Stop by for something sweet or order ahead for your next celebration.',
    services: [
      { title: 'Fresh Bread & Pastries', description: 'Baked fresh daily, from croissants to sourdough.' },
      { title: 'Custom Cakes', description: 'Custom cakes for birthdays, weddings, and every celebration.' },
      { title: 'Coffee & Espresso', description: 'Locally roasted coffee to pair with your favorite treat.' },
      { title: 'Catering & Large Orders', description: 'Order ahead for events, offices, and gatherings.' }
    ],
    faq: [
      { question: 'Do you take custom cake orders?', answer: 'Yes! We recommend ordering custom cakes at least a week in advance.' },
      { question: 'Do you offer gluten-free options?', answer: 'We offer a rotating selection of gluten-free items — ask what\'s available today.' }
    ],
    photoQueries: ['bakery bread', 'pastries', 'bakery interior']
  },
  {
    id: 'law',
    keywords: ['law firm', 'attorney', 'lawyer', 'legal'],
    label: 'Law Firm',
    hero: { headline: '{name}', subheadline: 'Experienced legal counsel, focused on your best outcome.', ctaText: 'Schedule a Consultation' },
    about: '{name} provides clear, experienced legal guidance when it matters most. We take the time to understand your situation and build a strategy tailored to your goals.',
    services: [
      { title: 'Free Case Consultation', description: 'We\'ll review your situation and lay out your options, at no cost.' },
      { title: 'Case Representation', description: 'Dedicated, experienced representation from start to resolution.' },
      { title: 'Document Review', description: 'Thorough review of contracts and legal documents.' },
      { title: 'Ongoing Legal Counsel', description: 'Retained counsel for individuals and businesses.' }
    ],
    faq: [
      { question: 'Do you offer free consultations?', answer: 'Yes, initial consultations are free with no obligation.' },
      { question: 'What areas of law do you practice?', answer: 'Contact us to discuss your specific legal needs and how we can help.' }
    ],
    photoQueries: ['law office', 'attorney meeting', 'law books']
  },
  {
    id: 'accounting',
    keywords: ['accounting', 'tax', 'bookkeep', 'cpa'],
    label: 'Accounting & Tax',
    hero: { headline: '{name}', subheadline: 'Straightforward accounting and tax help you can rely on.', ctaText: 'Schedule a Consultation' },
    about: '{name} helps individuals and small businesses stay organized and compliant, year-round — not just at tax time. We translate the numbers into decisions you can act on.',
    services: [
      { title: 'Tax Preparation', description: 'Accurate, on-time tax filing for individuals and businesses.' },
      { title: 'Bookkeeping', description: 'Ongoing bookkeeping so your books are always up to date.' },
      { title: 'Payroll Services', description: 'Reliable payroll processing for small teams.' },
      { title: 'Business Advisory', description: 'Financial guidance to help your business grow.' }
    ],
    faq: [
      { question: 'Do you work with small businesses?', answer: 'Yes, we work with individuals, freelancers, and small businesses of all sizes.' },
      { question: 'Can you help with back taxes?', answer: 'Yes, we can help you get caught up and communicate with tax authorities on your behalf.' }
    ],
    photoQueries: ['accounting office', 'tax documents', 'bookkeeping']
  },
  {
    id: 'real-estate',
    keywords: ['real estate', 'realtor', 'realty'],
    label: 'Real Estate',
    hero: { headline: '{name}', subheadline: 'Local expertise, real results, from listing to closing.', ctaText: 'Find Your Home' },
    about: '{name} guides buyers and sellers through every step of the real estate process, with deep knowledge of the local market and a commitment to your goals.',
    services: [
      { title: 'Home Buying', description: 'Personalized guidance to find the right home at the right price.' },
      { title: 'Home Selling', description: 'Strategic pricing and marketing to sell for top dollar.' },
      { title: 'Market Analysis', description: 'A clear picture of your home\'s value in today\'s market.' },
      { title: 'Investment Properties', description: 'Helping investors find and evaluate opportunities.' }
    ],
    faq: [
      { question: 'How do I get a home value estimate?', answer: 'Contact us for a free, no-obligation market analysis of your home.' },
      { question: 'What areas do you serve?', answer: 'Reach out to confirm we cover your specific neighborhood or area.' }
    ],
    photoQueries: ['real estate house', 'for sale sign', 'modern home exterior']
  },
  {
    id: 'dentist',
    keywords: ['dental', 'dentist', 'orthodont'],
    label: 'Dental',
    hero: { headline: '{name}', subheadline: 'Gentle, modern dental care for the whole family.', ctaText: 'Book an Appointment' },
    about: '{name} provides comprehensive dental care in a comfortable, welcoming environment. Our team focuses on prevention, education, and treating every patient with genuine care.',
    services: [
      { title: 'Routine Cleanings & Exams', description: 'Preventive care to keep your smile healthy.' },
      { title: 'Cosmetic Dentistry', description: 'Whitening, veneers, and smile makeovers.' },
      { title: 'Restorative Care', description: 'Fillings, crowns, and bridges to restore function and appearance.' },
      { title: 'Emergency Dental Care', description: 'Prompt care when a dental emergency strikes.' }
    ],
    faq: [
      { question: 'Do you accept dental insurance?', answer: 'Yes, we accept most major dental insurance plans.' },
      { question: 'Do you see new patients?', answer: 'Yes, we welcome new patients of all ages.' }
    ],
    photoQueries: ['dental office', 'dentist patient', 'dental clinic']
  },
  {
    id: 'veterinary',
    keywords: ['vet', 'veterinar', 'animal hospital'],
    label: 'Veterinary',
    hero: { headline: '{name}', subheadline: 'Compassionate care for every member of your family.', ctaText: 'Schedule a Visit' },
    about: '{name} provides thorough, compassionate veterinary care for pets at every life stage. Our team treats every animal like their own.',
    services: [
      { title: 'Wellness Exams', description: 'Routine checkups to keep pets healthy year-round.' },
      { title: 'Vaccinations', description: 'Core and lifestyle vaccines tailored to your pet.' },
      { title: 'Surgery', description: 'Safe, modern surgical care including spay/neuter.' },
      { title: 'Dental Care', description: 'Cleanings and dental health for your pet.' }
    ],
    faq: [
      { question: 'Do you accept walk-ins?', answer: 'We recommend appointments, but call us for urgent same-day needs.' },
      { question: 'Do you offer emergency care?', answer: 'Contact us to learn about our emergency and after-hours options.' }
    ],
    photoQueries: ['veterinarian pet', 'vet clinic', 'dog vet checkup']
  },
  {
    id: 'fitness',
    keywords: ['gym', 'fitness', 'personal train', 'crossfit', 'yoga studio'],
    label: 'Fitness',
    hero: { headline: '{name}', subheadline: 'Real results, real support, every workout.', ctaText: 'Start Your Free Trial' },
    about: '{name} is more than a gym — it\'s a community built around helping you reach your goals. Whatever your fitness level, our coaches meet you where you are.',
    services: [
      { title: 'Group Classes', description: 'High-energy classes for every fitness level.' },
      { title: 'Personal Training', description: 'One-on-one coaching tailored to your goals.' },
      { title: 'Open Gym Access', description: 'Full access to equipment whenever you want to train.' },
      { title: 'Nutrition Coaching', description: 'Guidance to fuel your training and reach your goals faster.' }
    ],
    faq: [
      { question: 'Do you offer a free trial?', answer: 'Yes, new members can try a free class or day pass.' },
      { question: 'Do I need to be in shape to start?', answer: 'Not at all — our coaches meet every member at their current fitness level.' }
    ],
    photoQueries: ['gym workout', 'personal training', 'fitness class']
  },
  {
    id: 'photography',
    keywords: ['photograph', 'photo studio'],
    label: 'Photography',
    hero: { headline: '{name}', subheadline: 'Capturing your story, one frame at a time.', ctaText: 'Book a Session' },
    about: '{name} specializes in creating beautiful, genuine images that you\'ll treasure for years. From portraits to events, every session is tailored to you.',
    services: [
      { title: 'Portrait Sessions', description: 'Individual, couple, and family portrait photography.' },
      { title: 'Wedding Photography', description: 'Timeless coverage of your entire wedding day.' },
      { title: 'Event Photography', description: 'Professional coverage for corporate and private events.' },
      { title: 'Product Photography', description: 'Clean, professional images for your business.' }
    ],
    faq: [
      { question: 'How far in advance should I book?', answer: 'We recommend booking weddings 6-12 months in advance, and portrait sessions 2-4 weeks ahead.' },
      { question: 'Do you travel for sessions?', answer: 'Yes, we\'re available for travel — reach out for details and pricing.' }
    ],
    photoQueries: ['photographer camera', 'photo studio', 'portrait photography']
  },
  {
    id: 'pet-grooming',
    keywords: ['pet groom', 'dog groom'],
    label: 'Pet Grooming',
    hero: { headline: '{name}', subheadline: 'Happy, healthy, good-looking pets — every visit.', ctaText: 'Book a Grooming' },
    about: '{name} provides gentle, professional grooming in a calm, pet-friendly environment. We treat every pet like part of the family.',
    services: [
      { title: 'Full Grooming', description: 'Bath, haircut, nail trim, and ear cleaning.' },
      { title: 'Bath & Brush', description: 'A quick refresh between full grooming visits.' },
      { title: 'Nail Trims', description: 'Fast, stress-free nail trims.' },
      { title: 'Breed-Specific Styling', description: 'Styling tailored to your pet\'s breed and coat type.' }
    ],
    faq: [
      { question: 'How often should my pet be groomed?', answer: 'Most pets benefit from grooming every 4-8 weeks, depending on breed and coat.' },
      { question: 'Do you groom cats?', answer: 'Yes, we offer grooming services for both dogs and cats.' }
    ],
    photoQueries: ['dog grooming', 'pet salon', 'groomed dog']
  },
  {
    id: 'it-repair',
    keywords: ['computer repair', 'it support', 'tech support', 'it services'],
    label: 'IT Services',
    hero: { headline: '{name}', subheadline: 'Reliable tech support for home and business.', ctaText: 'Get Support' },
    about: '{name} solves technology problems quickly so you can get back to what matters. From a single laptop to a full office network, we\'ve got you covered.',
    services: [
      { title: 'Computer Repair', description: 'Fast, honest diagnostics and repair for PCs and Macs.' },
      { title: 'Managed IT Services', description: 'Ongoing IT support and monitoring for small businesses.' },
      { title: 'Network Setup', description: 'Reliable, secure networks for home or office.' },
      { title: 'Data Recovery', description: 'Recovering lost or corrupted data when disaster strikes.' }
    ],
    faq: [
      { question: 'Do you offer remote support?', answer: 'Yes, many issues can be resolved remotely — contact us to find out.' },
      { question: 'Do you work with businesses?', answer: 'Yes, we offer managed IT plans for small and growing businesses.' }
    ],
    photoQueries: ['computer repair', 'it technician', 'network server']
  },
  {
    id: 'moving',
    keywords: ['moving company', 'movers', 'relocation'],
    label: 'Moving',
    hero: { headline: '{name}', subheadline: 'Moving made easy, from the first box to the last.', ctaText: 'Get a Free Quote' },
    about: '{name} takes the stress out of moving day with careful, efficient service you can count on. Local or long-distance, we treat your belongings like our own.',
    services: [
      { title: 'Local Moving', description: 'Efficient, careful moving within the area.' },
      { title: 'Long-Distance Moving', description: 'Reliable moving service across the state or country.' },
      { title: 'Packing Services', description: 'Full or partial packing to save you time and stress.' },
      { title: 'Storage Solutions', description: 'Short and long-term storage for your belongings.' }
    ],
    faq: [
      { question: 'Do you provide packing materials?', answer: 'Yes, boxes and packing supplies are available, and we offer full packing service too.' },
      { question: 'Are you licensed and insured?', answer: 'Yes, we are fully licensed and insured for local and long-distance moves.' }
    ],
    photoQueries: ['moving boxes', 'movers truck', 'moving day']
  },
  {
    id: 'pest-control',
    keywords: ['pest control', 'exterminat'],
    label: 'Pest Control',
    hero: { headline: '{name}', subheadline: 'Effective pest control for a comfortable, pest-free home.', ctaText: 'Schedule an Inspection' },
    about: '{name} protects your home or business from unwanted pests with safe, effective treatments and a team that shows up on time, every time.',
    services: [
      { title: 'General Pest Control', description: 'Ongoing protection against common household pests.' },
      { title: 'Termite Treatment', description: 'Inspection and treatment to protect your property from termite damage.' },
      { title: 'Rodent Control', description: 'Safe, effective removal and prevention of rodents.' },
      { title: 'Mosquito Control', description: 'Seasonal treatments to reclaim your outdoor space.' }
    ],
    faq: [
      { question: 'Is your treatment safe for pets and kids?', answer: 'Yes, we use treatments that are safe for your family and pets when applied as directed.' },
      { question: 'Do you offer recurring service plans?', answer: 'Yes, we offer quarterly and seasonal service plans.' }
    ],
    photoQueries: ['pest control technician', 'exterminator spraying', 'home inspection']
  },
  {
    id: 'painting',
    keywords: ['paint'],
    label: 'Painting',
    hero: { headline: '{name}', subheadline: 'A fresh coat that transforms any space.', ctaText: 'Get a Free Estimate' },
    about: '{name} delivers clean, professional painting for homes and businesses. We prep thoroughly, protect your space, and leave every job site spotless.',
    services: [
      { title: 'Interior Painting', description: 'Precise, clean interior painting for any room.' },
      { title: 'Exterior Painting', description: 'Durable exterior painting that boosts curb appeal.' },
      { title: 'Cabinet Refinishing', description: 'Give your kitchen a fresh look without a full remodel.' },
      { title: 'Commercial Painting', description: 'Minimal-disruption painting for offices and businesses.' }
    ],
    faq: [
      { question: 'Do you provide the paint?', answer: 'Yes, we can supply quality paint or use paint you\'ve already purchased.' },
      { question: 'How long does a typical job take?', answer: 'Most interior rooms take one to two days; we\'ll give you a firm timeline with your estimate.' }
    ],
    photoQueries: ['house painting', 'painter at work', 'painted room']
  }
];

// newer templates take precedence over the older ones where keywords overlap
TEMPLATES.unshift(...require('./templates-more'));

const GENERIC_TEMPLATE = {
  id: 'generic',
  label: 'General Business',
  hero: { headline: '{name}', subheadline: 'Quality {type} service you can count on.', ctaText: 'Get in Touch' },
  about: 'At {name}, we\'re committed to providing our customers with excellent {type} service, backed by experience and a genuine commitment to doing things right.',
  services: [
    { title: 'Our Services', description: 'Reach out to learn more about what we offer.' },
    { title: 'Quality Work', description: 'We take pride in doing the job right, every time.' },
    { title: 'Customer Focused', description: 'Your satisfaction is our top priority.' }
  ],
  faq: [
    { question: 'How do I get started?', answer: 'Contact us today and we\'ll walk you through the next steps.' },
    { question: 'What areas do you serve?', answer: 'Contact us to confirm we serve your area.' }
  ],
  photoQueries: ['small business', 'local business owner', 'storefront']
};

// Strips everything but letters/numbers so matching doesn't care about
// spacing, punctuation, or hyphenation — "lawn care", "lawn-care", and
// "lawncare" all normalize to the same string and match a "lawn care" keyword.
function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findTemplate(businessType) {
  const type = normalize(businessType);
  for (const tpl of TEMPLATES) {
    if (tpl.keywords.some(kw => type.includes(normalize(kw)))) return tpl;
  }
  return GENERIC_TEMPLATE;
}

function fillTemplate(tpl, businessName, businessType) {
  const name = businessName || `${businessType.charAt(0).toUpperCase()}${businessType.slice(1)}`.trim();
  const sub = (s) => s.replace(/\{name\}/g, name).replace(/\{type\}/g, businessType || tpl.label.toLowerCase());
  // Benefit first: when a template's headline is just the business name (already in the nav bar),
  // lead with what the customer gets and keep the name in the supporting line.
  const nameOnly = tpl.hero.headline.trim() === '{name}';
  return {
    name,
    hero: {
      headline: nameOnly ? sub(tpl.hero.subheadline).replace(/[.]+$/, '') : sub(tpl.hero.headline),
      subheadline: nameOnly ? `${name}: ${tpl.label}` : sub(tpl.hero.subheadline),
      ctaText: tpl.hero.ctaText
    },
    about: sub(tpl.about),
    services: tpl.services.map(s => ({ title: s.title, description: s.description })),
    faq: tpl.faq.map(f => ({ question: f.question, answer: f.answer })),
    blocks: (tpl.blocks || []).map(b => ({ ...b, heading: sub(b.heading || ''), body: sub(b.body || '') })),
    photoQueries: tpl.photoQueries
  };
}

module.exports = { TEMPLATES, GENERIC_TEMPLATE, findTemplate, fillTemplate };
