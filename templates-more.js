// More ready-made starting points. Same shape as templates.js, plus an optional
// `look` (style, colors, fonts) that the generator applies. Copy is deliberately
// plain: it avoids promises about licenses, response times, prices or results,
// which the owner should only add once they are true.
module.exports = [
  {
    id: 'mobile-grooming', keywords: ['mobile groom', 'mobile pet', 'mobile dog', 'grooming van', 'grooming salon on wheels'], label: 'Mobile Pet Grooming',
    look: { style: 'studio', primaryColor: '#c8102e', accentColor: '#7f0a1d' },
    hero: { headline: 'Mobile pet grooming that comes to your door', subheadline: '{name} brings the grooming salon to you, so your pet gets a calm, one-on-one visit at home.', ctaText: 'Book a Grooming' },
    about: '{name} is a mobile grooming service. We come to your home, groom your pet in our van and leave you with a clean, comfortable dog or cat, with no drop-off and no waiting room. Contact us to ask about services and scheduling in your area.',
    services: [
      { title: 'Dog Bath', description: 'A bath, blow-dry and brush-out for a fresh, clean coat.' },
      { title: 'Dog Haircut', description: 'Breed-appropriate trims and styling to suit your dog.' },
      { title: 'Cat Grooming', description: 'Gentle grooming for cats. Ask us how we handle first visits.' },
      { title: 'Nail Trim & Ear Care', description: 'Quick add-ons for nails and ears.' }
    ],
    faq: [
      { question: 'How does a visit work?', answer: 'Book a time, and we arrive at your address. Your pet is groomed in our van and returned to you when finished.' },
      { question: 'Do I need to be home?', answer: 'Ask us about our policy for your first appointment and for repeat visits.' },
      { question: 'Which pets do you groom?', answer: 'We groom dogs and cats. Contact us about size, coat type or special needs before you book.' }
    ],
    blocks: [
      { type: 'photoText', heading: 'Grooming that comes to you', body: '{name} turns your driveway into a grooming room. Your pet stays close to home and gets our full attention for the visit.\n\nTell us about your pet when you book, so we can plan the right services.', buttonText: 'Book a Grooming', buttonUrl: '#contact', bg: 'none', place: 'bottom' },
      { type: 'steps', heading: 'How it works', body: 'Book online or call | Tell us about your pet and pick a time.\nWe arrive at your door | Our van pulls up at your address.\nYour pet gets groomed | One pet at a time, in the van.\nFresh, clean and happy | Your pet is returned ready to relax.', bg: 'brand', place: 'bottom' },
      { type: 'features', heading: 'Why pet owners choose mobile', body: 'No drop-off | Your pet never leaves your driveway.\nOne pet at a time | Your pet is not kept in a kennel while waiting.\nBuilt around your day | Appointments come to you.\nCalm environment | Less noise and fewer other animals.', bg: 'tint', place: 'bottom' }
    ],
    photoQueries: ['dog grooming', 'groomed dog', 'dog bath', 'cat grooming']
  },
  {
    id: 'dog-training', keywords: ['dog train', 'puppy train', 'obedience', 'dog behavior', 'dog behaviour'], label: 'Dog Training',
    look: { style: 'gallery', primaryColor: '#15803d', accentColor: '#14532d' },
    hero: { headline: 'Dog training that fits your dog and your home', subheadline: '{name} helps owners and dogs build good habits with patient, positive training.', ctaText: 'Book a Consultation' },
    about: '{name} works with dogs and the people who live with them. We start by listening to what is going on at home, then build a plan that suits your dog and your routine. Get in touch to talk about what you would like help with.',
    services: [
      { title: 'Puppy Training', description: 'Early habits, house manners and socialization basics.' },
      { title: 'Obedience Training', description: 'Sit, stay, come and walking nicely on a leash.' },
      { title: 'Behavior Help', description: 'Talk through barking, jumping, pulling and other everyday problems.' },
      { title: 'Private Lessons', description: 'One-on-one sessions built around you and your dog.' }
    ],
    faq: [
      { question: 'How do I get started?', answer: 'Contact us with a few details about your dog and what you would like to work on, and we will set up a first conversation.' },
      { question: 'What age can my dog start?', answer: 'Contact us with your dog\'s age and we can talk about what is a good fit.' },
      { question: 'Do I take part in the training?', answer: 'Yes. Training sticks when owners practice with their dogs, so we show you what to do between sessions.' }
    ],
    blocks: [
      { type: 'photoText', heading: 'Training built around your dog', body: 'Every dog learns differently. We use patient, reward-based methods and keep sessions clear and simple, so you know what to practice at home.', buttonText: 'Book a Consultation', buttonUrl: '#contact', bg: 'none', place: 'bottom' },
      { type: 'steps', heading: 'How it works', body: 'Get in touch | Tell us about your dog and your goals.\nFirst conversation | We talk through what is going on at home.\nTraining plan | You get a plan that fits your routine.\nPractice together | We show you how to keep progress going.', bg: 'tint', place: 'bottom' }
    ],
    photoQueries: ['dog training', 'puppy training', 'dog obedience', 'trainer with dog']
  },
  {
    id: 'pet-care', keywords: ['pet sit', 'dog walk', 'pet board', 'dog board', 'kennel', 'pet daycare', 'dog daycare', 'doggy daycare', 'pet care'], label: 'Pet Sitting & Boarding',
    look: { style: 'playful', primaryColor: '#ea580c', accentColor: '#9a3412' },
    hero: { headline: '{name}', subheadline: 'Caring pet sitting, walking and boarding while you are away or busy.', ctaText: 'Request Care' },
    about: '{name} looks after pets when their owners cannot. Tell us about your pet\'s routine, likes and needs, and we will plan care around them. Reach out to ask about availability and services.',
    services: [
      { title: 'Pet Sitting', description: 'Care in your home so your pet keeps its routine.' },
      { title: 'Dog Walking', description: 'Walks to give your dog exercise and a break in the day.' },
      { title: 'Boarding', description: 'Overnight stays while you travel. Ask about how it works.' },
      { title: 'Daycare', description: 'Daytime care and play. Ask about availability.' }
    ],
    faq: [
      { question: 'How do I request care?', answer: 'Send us the dates, your pet\'s details and what you need, and we will get back to you.' },
      { question: 'Can we meet first?', answer: 'Yes. Contact us to arrange a meet-and-greet with you and your pet.' },
      { question: 'What should I share about my pet?', answer: 'Feeding routine, medications, habits and any worries, so we can plan care properly.' }
    ],
    blocks: [
      { type: 'photoText', heading: 'Care that matches your pet\'s routine', body: 'Pets settle in more easily when their day looks familiar. We ask about feeding, walks, play and quirks, and we keep to the routine you describe.', buttonText: 'Request Care', buttonUrl: '#contact', bg: 'none', place: 'bottom' },
      { type: 'steps', heading: 'How it works', body: 'Tell us about your pet | Share dates, needs and routine.\nMeet and greet | We meet you and your pet first.\nCare begins | We follow the plan you gave us.\nStay in touch | Ask us how updates will work.', bg: 'tint', place: 'bottom' }
    ],
    photoQueries: ['dog walking', 'pet sitter', 'dogs playing', 'cat on sofa']
  },
  {
    id: 'tattoo', keywords: ['tattoo', 'piercing', 'ink studio'], label: 'Tattoo Studio',
    look: { style: 'midnight', primaryColor: '#b91c1c', accentColor: '#0b0b0f', headingFont: 'Pirata One', headingCase: 'none' },
    hero: { headline: '{name}', subheadline: 'Custom tattoos, drawn with you and made to last.', ctaText: 'Book a Consultation' },
    about: '{name} is a tattoo studio built around your ideas. Bring a sketch, a story or just a feeling, and we will work out the design together before any needle comes out. Come by to see the shop, meet the artists and look through our portfolio.',
    services: [
      { title: 'Custom Tattoos', description: 'One-of-a-kind designs drawn around your idea.' },
      { title: 'Cover-Ups & Reworks', description: 'Talk through options for refreshing or covering older work.' },
      { title: 'Flash & Walk-Ins', description: 'Ready-to-go designs for smaller pieces. Ask what is available.' },
      { title: 'Piercing', description: 'Ask us which piercings we offer and how to care for them.' }
    ],
    faq: [
      { question: 'How do I book?', answer: 'Send us a message with your idea, where you want it and roughly how big. We will reply to set up a consultation.' },
      { question: 'How should I prepare?', answer: 'Eat beforehand, get a good night of sleep and wear something that gives easy access to the area. We will go over aftercare when you are done.' }
    ],
    photoQueries: ['tattoo artist at work', 'tattoo studio', 'tattoo art']
  },
  {
    id: 'barber', keywords: ['barber'], label: 'Barbershop',
    look: { style: 'poster', primaryColor: '#1d4ed8', accentColor: '#111111' },
    hero: { headline: '{name}', subheadline: 'Haircuts, fades and beard work in a relaxed shop.', ctaText: 'Book a Cut' },
    about: '{name} is a neighborhood barbershop. Tell us what you want, and we will talk it through and get it right. Stop in, grab a seat and see how we work.',
    services: [
      { title: 'Haircuts', description: 'Classic cuts, fades and modern styles.' },
      { title: 'Beard Trims & Shaves', description: 'Shaping, trims and traditional hot-towel shaves.' },
      { title: 'Kids Cuts', description: 'Patient service for younger clients.' },
      { title: 'Line-Ups & Finishing', description: 'Clean edges and finishing touches.' }
    ],
    faq: [
      { question: 'Do I need an appointment?', answer: 'Contact us to ask about booking or walk-in availability.' },
      { question: 'What payment do you take?', answer: 'Ask us which payment methods we accept.' }
    ],
    photoQueries: ['barber shop', 'barber cutting hair', 'beard trim']
  },
  {
    id: 'insurance', keywords: ['insurance'], label: 'Insurance Agency',
    look: { style: 'agency', primaryColor: '#1e4e8c', accentColor: '#0f2a47' },
    hero: { headline: 'Insurance for your car, home, family and health', subheadline: '{name} is a local insurance agency. Talk with us about the coverage you need.', ctaText: 'Request a Quote' },
    about: '{name} helps individuals and families understand their insurance options. We listen first, explain the choices in plain language and help you decide what fits your situation and budget. Reach out and tell us what you are looking for.',
    services: [
      { title: 'Auto Insurance', description: 'Coverage for the cars you drive and the people who drive them.' },
      { title: 'Home Insurance', description: 'Protection for your house and belongings.' },
      { title: 'Life Insurance', description: 'Options to help protect the people who depend on you.' },
      { title: 'Health Insurance', description: 'Talk with us about your health coverage options.' }
    ],
    faq: [
      { question: 'How do I get a quote?', answer: 'Send us a few details through the quote form and we will follow up.' },
      { question: 'Can I review my current coverage?', answer: 'Yes. Contact us and we can walk through what you have today.' }
    ],
    photoQueries: ['family home', 'insurance agent meeting', 'car keys']
  },
  {
    id: 'home-care', keywords: ['home care', 'homecare', 'senior care', 'caregiv', 'home health', 'in-home care'], label: 'Home Care',
    look: { style: 'warm', primaryColor: '#0f766e', accentColor: '#134e4a' },
    hero: { headline: '{name}', subheadline: 'Caring support at home for seniors and the families who love them.', ctaText: 'Talk With Us' },
    about: '{name} supports older adults who want to stay comfortable at home. We start by listening to your family, then work out together what kind of help makes sense. Contact us to talk through your situation. There is no pressure and no obligation.',
    services: [
      { title: 'Companionship', description: 'Friendly company, conversation and help with daily routines.' },
      { title: 'Personal Care', description: 'Help with everyday tasks like bathing, dressing and getting around.' },
      { title: 'Respite Care', description: 'A break for family caregivers when they need one.' },
      { title: 'Care Planning', description: 'Talk through needs and options with our team.' }
    ],
    faq: [
      { question: 'How do we get started?', answer: 'Call or send us a message. We will ask about your loved one and discuss what support might help.' },
      { question: 'What areas do you serve?', answer: 'Contact us to confirm that we serve your area.' }
    ],
    photoQueries: ['caregiver with senior', 'elderly couple at home', 'senior care']
  },
  {
    id: 'party-rental', keywords: ['party rental', 'event rental', 'bounce house', 'tent rental', 'party equipment'], label: 'Party & Event Rentals',
    look: { style: 'modern', primaryColor: '#c026d3', accentColor: '#4a044e' },
    hero: { headline: '{name}', subheadline: 'Tables, chairs, tents and more for your next celebration.', ctaText: 'Check Availability' },
    about: '{name} helps people pull off great parties and events. Tell us the date, the guest count and what you have in mind, and we will help you work out what to rent.',
    services: [
      { title: 'Tables & Chairs', description: 'Seating for parties of many sizes.' },
      { title: 'Tents & Canopies', description: 'Cover for outdoor events.' },
      { title: 'Inflatables & Games', description: 'Fun for birthdays and community events.' },
      { title: 'Linens & Décor', description: 'The finishing touches that make an event feel complete.' }
    ],
    faq: [
      { question: 'How far ahead should I book?', answer: 'Contact us with your date. Busy weekends can fill up.' },
      { question: 'Do you deliver and set up?', answer: 'Ask us about delivery and setup for your location.' }
    ],
    photoQueries: ['party tent', 'event setup', 'birthday party']
  },
  {
    id: 'florist', keywords: ['florist', 'flower shop', 'flowers'], label: 'Florist',
    look: { style: 'warm', primaryColor: '#be185d', accentColor: '#500724', headingFont: 'Cormorant Garamond' },
    hero: { headline: '{name}', subheadline: 'Fresh flowers for every occasion.', ctaText: 'Order Flowers' },
    about: '{name} designs arrangements for birthdays, thank-yous, weddings and everyday moments. Tell us the occasion and your budget and we will put something beautiful together.',
    services: [
      { title: 'Everyday Bouquets', description: 'Fresh arrangements to brighten a day.' },
      { title: 'Weddings & Events', description: 'Flowers designed around your celebration.' },
      { title: 'Sympathy Flowers', description: 'Thoughtful arrangements for difficult times.' },
      { title: 'Delivery', description: 'Ask us about delivery to your recipient.' }
    ],
    faq: [
      { question: 'How do I place an order?', answer: 'Contact us with the occasion, date and budget and we will take it from there.' },
      { question: 'Can I request specific flowers?', answer: 'Yes. Let us know your favorites and we will try to include them.' }
    ],
    photoQueries: ['florist arranging flowers', 'flower bouquet', 'flower shop']
  },
  {
    id: 'car-detailing', keywords: ['detailing', 'car wash', 'auto detail'], label: 'Auto Detailing',
    look: { style: 'midnight', primaryColor: '#0ea5e9', accentColor: '#0c4a6e', headingFont: 'Oswald' },
    hero: { headline: '{name}', subheadline: 'Detailing that brings your vehicle back to life.', ctaText: 'Get a Quote' },
    about: '{name} cleans and protects cars, trucks and SUVs with care. Tell us about your vehicle and what bothers you most, and we will recommend a service to match.',
    services: [
      { title: 'Interior Detailing', description: 'A deep clean for seats, carpets and surfaces.' },
      { title: 'Exterior Wash & Wax', description: 'Hand wash and protection for your paint.' },
      { title: 'Paint Correction', description: 'Ask about options for swirls and light scratches.' },
      { title: 'Ceramic Coating', description: 'Ask us whether a coating makes sense for your vehicle.' }
    ],
    faq: [
      { question: 'How long does detailing take?', answer: 'It depends on the vehicle and the service. Contact us for an estimate.' },
      { question: 'Do you come to me?', answer: 'Ask us whether mobile service is available in your area.' }
    ],
    photoQueries: ['car detailing', 'car wash foam', 'polishing car']
  },
  {
    id: 'catering', keywords: ['catering', 'food truck', 'caterer'], label: 'Catering',
    look: { style: 'warm', primaryColor: '#c2410c', accentColor: '#431407' },
    hero: { headline: '{name}', subheadline: 'Good food for gatherings of any size.', ctaText: 'Request a Menu' },
    about: '{name} cooks for parties, offices and special occasions. Tell us the date, the headcount and any dietary needs, and we will suggest a menu.',
    services: [
      { title: 'Event Catering', description: 'Food for weddings, parties and celebrations.' },
      { title: 'Corporate Lunches', description: 'Meals for meetings and team events.' },
      { title: 'Drop-Off Platters', description: 'Easy trays for casual gatherings.' },
      { title: 'Custom Menus', description: 'Menus built around your tastes and dietary needs.' }
    ],
    faq: [
      { question: 'How far ahead should I book?', answer: 'Contact us with your date as early as you can.' },
      { question: 'Can you handle dietary needs?', answer: 'Tell us what you need and we will talk through options.' }
    ],
    photoQueries: ['catering buffet', 'food platter', 'chef plating food']
  },
  {
    id: 'chiropractor', keywords: ['chiropract'], label: 'Chiropractic',
    look: { style: 'minimal', primaryColor: '#0369a1', accentColor: '#082f49' },
    hero: { headline: '{name}', subheadline: 'Care for your back, neck and everyday movement.', ctaText: 'Request an Appointment' },
    about: '{name} helps people who are dealing with aches, stiffness and pain. At your first visit we listen to your concerns and talk through the care options that may fit you.',
    services: [
      { title: 'Initial Consultation', description: 'Talk through your concerns and goals.' },
      { title: 'Chiropractic Adjustments', description: 'Care options discussed with you at your visit.' },
      { title: 'Wellness Visits', description: 'Ongoing support for staying active.' },
      { title: 'Posture & Movement Guidance', description: 'Practical advice for daily life.' }
    ],
    faq: [
      { question: 'What should I expect at my first visit?', answer: 'We talk about your history and concerns, then discuss what care might help.' },
      { question: 'Do you accept insurance?', answer: 'Contact us to ask about insurance and payment options.' }
    ],
    photoQueries: ['chiropractor', 'physical therapy', 'back pain care']
  },
  {
    id: 'tutoring', keywords: ['tutor', 'test prep', 'learning center'], label: 'Tutoring',
    look: { style: 'warm', primaryColor: '#4f46e5', accentColor: '#1e1b4b' },
    hero: { headline: '{name}', subheadline: 'One-on-one help that builds confidence and skills.', ctaText: 'Ask About Tutoring' },
    about: '{name} works with students to understand what they find hard and build from there. Contact us to talk about your student and what they need.',
    services: [
      { title: 'Homework Help', description: 'Support to keep up with schoolwork.' },
      { title: 'Subject Tutoring', description: 'Focused help in the subjects that need it.' },
      { title: 'Test Preparation', description: 'Practice and strategy for upcoming tests.' },
      { title: 'Study Skills', description: 'Habits that make learning easier.' }
    ],
    faq: [
      { question: 'How do we start?', answer: 'Contact us with your student\'s grade and subjects and we will suggest next steps.' },
      { question: 'Do you offer online sessions?', answer: 'Ask us which formats we offer.' }
    ],
    photoQueries: ['tutor with student', 'studying at desk', 'classroom learning']
  },
  {
    id: 'wedding', keywords: ['wedding', 'event planner', 'event planning', 'event venue'], label: 'Weddings & Events',
    look: { style: 'editorial', primaryColor: '#a16207', accentColor: '#422006', headingFont: 'Cormorant Garamond' },
    hero: { headline: '{name}', subheadline: 'Celebrations planned with care.', ctaText: 'Plan Your Event' },
    about: '{name} helps you create an event that feels like you. Tell us your date, your guest count and your vision, and we will help you work out the details.',
    services: [
      { title: 'Full Planning', description: 'Support from first idea to the last dance.' },
      { title: 'Day-Of Coordination', description: 'Someone to keep the day on track.' },
      { title: 'Venue & Vendor Guidance', description: 'Help finding the right people and places.' },
      { title: 'Design & Décor', description: 'Details that bring your vision to life.' }
    ],
    faq: [
      { question: 'How far ahead should we contact you?', answer: 'The sooner you reach out the more options you will have. Contact us with your date.' },
      { question: 'Can we meet before booking?', answer: 'Yes. Contact us to set up a conversation.' }
    ],
    photoQueries: ['wedding reception', 'wedding decor', 'event planner']
  },
  {
    id: 'pool-service', keywords: ['pool service', 'pool clean', 'pool maintenance', 'pool repair', 'pool care'], label: 'Pool Service',
    look: { style: 'modern', primaryColor: '#0891b2', accentColor: '#164e63' },
    hero: { headline: '{name}', subheadline: 'Pool care so you can just enjoy the water.', ctaText: 'Get a Quote' },
    about: '{name} looks after pools so they are ready when you are. Tell us about your pool and we will suggest a service that fits.',
    services: [
      { title: 'Weekly Pool Service', description: 'Regular cleaning and chemical balancing.' },
      { title: 'Equipment Repair', description: 'Pumps, filters and heaters checked and repaired.' },
      { title: 'Green Pool Cleanup', description: 'Help getting a neglected pool back in shape.' },
      { title: 'Opening & Closing', description: 'Seasonal service where it applies.' }
    ],
    faq: [
      { question: 'How often is service?', answer: 'It depends on your pool. Contact us and we will recommend a schedule.' },
      { question: 'What areas do you serve?', answer: 'Contact us to confirm we serve your area.' }
    ],
    photoQueries: ['swimming pool', 'pool cleaning', 'backyard pool']
  },
  {
    id: 'tree-service', keywords: ['tree service', 'tree trim', 'tree removal', 'arborist', 'tree care'], label: 'Tree Service',
    look: { style: 'bold', primaryColor: '#15803d', accentColor: '#14532d' },
    hero: { headline: '{name}', subheadline: 'Tree trimming and removal done with care for your property.', ctaText: 'Request an Estimate' },
    about: '{name} helps property owners keep their trees healthy and safe. Tell us what you are dealing with and we will take a look and talk through the options.',
    services: [
      { title: 'Tree Trimming', description: 'Shaping and thinning to keep trees healthy.' },
      { title: 'Tree Removal', description: 'Careful removal of trees that need to come down.' },
      { title: 'Stump Grinding', description: 'Clearing what is left behind.' },
      { title: 'Storm Cleanup', description: 'Help with fallen limbs and debris.' }
    ],
    faq: [
      { question: 'How do I get an estimate?', answer: 'Contact us with a description or photos and we will arrange to look at the job.' },
      { question: 'Do you haul away the debris?', answer: 'Ask us what is included with your service.' }
    ],
    photoQueries: ['tree trimming', 'arborist climbing tree', 'tree removal']
  },
  {
    id: 'pressure-washing', keywords: ['pressure wash', 'power wash', 'soft wash'], label: 'Pressure Washing',
    look: { style: 'bold', primaryColor: '#2563eb', accentColor: '#172554' },
    hero: { headline: '{name}', subheadline: 'Pressure washing that brings surfaces back to life.', ctaText: 'Get a Quote' },
    about: '{name} cleans driveways, siding, decks and more. Tell us about the surfaces and we will recommend the right approach.',
    services: [
      { title: 'Driveways & Walkways', description: 'Remove built-up dirt and stains.' },
      { title: 'House Washing', description: 'Gentle cleaning for siding and exteriors.' },
      { title: 'Decks & Patios', description: 'Refresh outdoor living spaces.' },
      { title: 'Commercial Properties', description: 'Cleaning for storefronts and common areas.' }
    ],
    faq: [
      { question: 'Is pressure washing safe for my siding?', answer: 'The right method depends on the surface. We will talk through it before we start.' },
      { question: 'How do I get a quote?', answer: 'Contact us with photos or the address and we will follow up.' }
    ],
    photoQueries: ['pressure washing driveway', 'power washing', 'clean patio']
  },
  {
    id: 'junk-removal', keywords: ['junk', 'hauling', 'debris removal', 'trash removal'], label: 'Junk Removal',
    look: { style: 'bold', primaryColor: '#ea580c', accentColor: '#431407' },
    hero: { headline: '{name}', subheadline: 'We haul away what you no longer need.', ctaText: 'Get a Quote' },
    about: '{name} clears out garages, storage, construction leftovers and more. Tell us what needs to go and we will give you a clear quote.',
    services: [
      { title: 'Household Junk', description: 'Furniture, appliances and clutter.' },
      { title: 'Garage & Storage Cleanouts', description: 'Clear the space you want back.' },
      { title: 'Construction Debris', description: 'Cleanup after projects.' },
      { title: 'Yard Waste', description: 'Branches, brush and other outdoor debris.' }
    ],
    faq: [
      { question: 'How does pricing work?', answer: 'Contact us with a description or photos and we will explain how we price the job.' },
      { question: 'What can\'t you take?', answer: 'Some items cannot be hauled. Ask us before booking.' }
    ],
    photoQueries: ['junk removal truck', 'garage cleanout', 'moving boxes']
  },
  {
    id: 'coffee-shop', keywords: ['coffee', 'cafe', 'café', 'espresso'], label: 'Coffee Shop',
    look: { style: 'warm', primaryColor: '#92400e', accentColor: '#451a03', headingFont: 'Lora' },
    hero: { headline: '{name}', subheadline: 'Coffee, pastries and a place to settle in.', ctaText: 'Visit Us' },
    about: '{name} is a neighborhood coffee spot. Stop by for a cup, a bite and a comfortable place to work or catch up with friends.',
    services: [
      { title: 'Coffee & Espresso', description: 'Drinks made to order.' },
      { title: 'Tea & Other Drinks', description: 'Options for non-coffee drinkers.' },
      { title: 'Pastries & Light Bites', description: 'Something to go with your drink.' },
      { title: 'Catering & Pickup Orders', description: 'Ask about orders for groups.' }
    ],
    faq: [
      { question: 'What are your hours?', answer: 'See our hours on this site, or contact us.' },
      { question: 'Can I order ahead?', answer: 'Ask us about ordering ahead for pickup.' }
    ],
    photoQueries: ['coffee shop', 'barista making coffee', 'latte art']
  },
  {
    id: 'locksmith', keywords: ['locksmith'], label: 'Locksmith',
    look: { style: 'bold', primaryColor: '#ca8a04', accentColor: '#1c1917' },
    hero: { headline: '{name}', subheadline: 'Locks, keys and lockouts handled.', ctaText: 'Call Us' },
    about: '{name} helps with locks and keys for homes, cars and businesses. Contact us to describe the problem and ask about availability.',
    services: [
      { title: 'Lockouts', description: 'Help getting back into your home, car or business.' },
      { title: 'Rekeying & Lock Changes', description: 'Update locks after a move or a lost key.' },
      { title: 'Key Duplication', description: 'Copies of your keys.' },
      { title: 'Lock Installation', description: 'New locks and hardware.' }
    ],
    faq: [
      { question: 'How do I reach you?', answer: 'Call the number on this site, or send us a message.' },
      { question: 'What areas do you serve?', answer: 'Contact us to confirm we serve your area.' }
    ],
    photoQueries: ['locksmith', 'door lock', 'house keys']
  },
  {
    id: 'daycare', keywords: ['daycare', 'child care', 'childcare', 'preschool', 'day care'], label: 'Child Care',
    look: { style: 'warm', primaryColor: '#f59e0b', accentColor: '#78350f', headingFont: 'Nunito' },
    hero: { headline: '{name}', subheadline: 'A caring place for children to learn and play.', ctaText: 'Schedule a Visit' },
    about: '{name} offers a caring, structured place for children to learn, play and grow. Contact us to ask about openings and to arrange a visit.',
    services: [
      { title: 'Full-Day Care', description: 'Care and activities through the day.' },
      { title: 'Early Learning', description: 'Play-based activities that build skills.' },
      { title: 'Meals & Snacks', description: 'Ask us about what is provided.' },
      { title: 'Family Communication', description: 'Staying in touch about your child\'s day.' }
    ],
    faq: [
      { question: 'Do you have openings?', answer: 'Contact us to ask about current availability.' },
      { question: 'Can we visit first?', answer: 'Yes. Contact us to arrange a visit.' }
    ],
    photoQueries: ['children playing', 'preschool classroom', 'kids learning']
  }
];
