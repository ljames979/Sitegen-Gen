# SiteGen

A live, editable website builder. Users sign up, fill in simple forms
(hero, about, services, testimonials, gallery, FAQ, hours, contact),
and publish a real, public website instantly — paste the URL of an old
website to have it modernized automatically, or just type a business type
("plumbing company", "hair salon") to generate a full starting site with
real photos.

## Run it

**Windows (easiest):** double-click `start.bat`. It installs what's needed,
creates your `.env` (with a random `SESSION_SECRET`) the first time, stops an
old copy still holding the port, starts the server and opens your browser.
Leave the window open while you use SiteGen; close it (or press Ctrl+C) to stop.

**Anywhere else, or by hand:**

```
npm install
cp .env.example .env   # then edit SESSION_SECRET in .env
node server.js
```

Then open http://localhost:3000

Run the automated tests:

```
npm test
```

## Core features

- Sign up / log in with email + password (bcrypt-hashed, session-based auth).
- Dashboard listing all of a user's sites.
- Form-based editor: hero, about, services, testimonials, gallery, FAQ,
  hours, and contact sections, plus a theme picker (colors, font, style,
  logo). Changes autosave a second or so after you stop typing, with a
  full "Save changes" button as a fallback.
- **Drag to reorder sections**, and hide any section from the published
  page without deleting its content.
- **Version history** — every save snapshots the previous version (last 10
  kept), restorable with one click.
- **Image uploads** — upload a photo directly instead of only pasting a URL,
  for the hero background, logo, and each gallery image.
- Publishing makes the site live at `/site/:slug`. Unpublishing takes it
  down again. Users can only edit their own sites.
- **Every site is a real multi-page site** — Home is just the hero, featured
  photos, and a closing call-to-action; About, Services, Reviews, Why Choose
  Us, Gallery, FAQ, Hours, and Contact each get their own page/URL (e.g.
  `/site/:slug/about`), linked from a real nav bar instead of in-page jump
  links. A page only exists (and only appears in the nav) if its section is
  visible and has content — an empty or hidden section's URL 404s. This
  applies to every site automatically, including ones built before this
  existed. The editor's preview panel has a page picker so you can preview
  each page on its own.
- **SEO basics** — per-site page title and meta description, plus a global
  `/sitemap.xml` (published sites only) and `/robots.txt`.
- **Custom domains** — set a domain on a site and, once its DNS points at
  wherever this app is deployed, visitors to that domain see the site.
- An automatic map embed appears on the contact section whenever an
  address is filled in.
- **"Why Choose Us" section** — a row of colored icon cards (pick from 10
  icons) for short, scannable reasons to choose the business. Hidden
  automatically until at least one reason is added.
- **A real, working contact form** on the published page (toggle it on/off
  per site in the Contact section) — visitors can send a message and
  optionally attach a photo. Submissions land on a **Leads** page in the
  editor (linked from the top bar, with an unread-style count), never in
  fabricated form; spam is screened with an invisible honeypot field. A
  dedicated rate limit protects the endpoint since it's reachable by anyone
  who finds the live site.
- **Top phone/social bar + social links** — set Facebook/Instagram/Twitter
  URLs in the Contact section and they show as icon links in a thin top bar
  and in the footer; the top bar also surfaces the phone number if one is
  set.
- **Featured photo row** — if a gallery has photos, the first two appear as
  a large side-by-side pair right under the hero, before the smaller
  gallery grid further down the page.
- **Testimonials support a real star rating and date** (both optional, and
  both exactly what the business owner enters — nothing is invented or
  defaulted to 5 stars).
- **Client intake on the dashboard** — "Client details (optional)" under
  *Generate a site*: phone, email, address, weekday/Saturday/Sunday hours,
  Facebook/Instagram links and a brand color. Anything filled in lands in the
  new site (contact page, hours page, social links, theme color) so there's
  far less to fix by hand. Blank fields are left alone.
- **"Before you publish" checklist** at the top of the editor, refreshed
  after every autosave. Red items would look unfinished to a visitor (no
  phone/email, the default Mon–Fri 9–5 hours still in place, empty About
  or Services); tips are nice-to-haves (hero photo, address for the map,
  SEO description, real reviews).
- **Duplicate** button on each site in the dashboard — copies the content,
  theme and layout into a new draft (never published, no custom domain).
- **Email alerts for contact-form leads** — see "Email alerts" below.
- **Search & sharing polish** on every published page: canonical link,
  Open Graph / Twitter share tags (with absolute image URLs), a favicon
  generated from the brand color and business initial, and `LocalBusiness`
  structured data built only from what the owner entered (nothing invented).
  `/sitemap.xml` lists every real page of every published site (on a custom
  domain it lists just that site), and `robots.txt` points to it. The editor
  preview is marked `noindex`.
- **Photo cleanup** — uploaded photos (and photos sent through the contact
  form) are auto-rotated and shrunk to at most 1920px (1600px for visitor
  photos) so phone-camera originals don't slow the site down. If the optional
  `sharp` package can't load on a machine, uploads are simply kept as-is.
  Photos attached to spam or rejected submissions are deleted, not kept.
- **Export** button in the editor — downloads the finished site as a zip of
  plain HTML files (`index.html`, `about.html`, …) with its uploaded photos
  bundled and links rewritten to work from any folder or web host. The
  contact form is left out of the export (it needs this server to receive
  messages); phone, email, address and map still show.

## Email alerts

Off by default. To get an email whenever someone submits a site's contact
form, add SMTP settings to `.env` (see `.env.example`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-google-app-password
```

(For Gmail, create an *app password* in your Google account's security
settings; your normal password won't work.) Each site's Contact section has
a "Send new-message alerts to" field; if it's blank the alert goes to the
site's contact email. Replying to the alert replies to the visitor. If
sending ever fails, the visitor's message is still saved on the Leads page —
the failure is only logged in the server window.

- **AI-written copy** (optional, see "AI-written copy" below) — instead of generic
  template text, Claude writes the headline, About text, services, FAQ and search
  description from the client's real details, with strict rules against inventing
  licenses, years, guarantees or other claims. A "Rewrite text with AI" box in the
  editor redoes the copy later (with optional direction like "more premium"); the
  previous version is saved to history first.
- **Photo picker** — a "Choose photo" button next to the hero, About and gallery
  image fields opens a searchable grid of free Pexels photos (needs the Pexels key).
- **Trust & credentials** — owner-entered badges ("Licensed & Insured"), highlight
  numbers ("12 Years in business"), a service-area list, a Google reviews link, and
  before/after photo pairs. They show as a trust strip on the home page, an
  "Areas We Serve" block on the About page, a Google button on the Reviews page and a
  before/after section on the Gallery page; the service area also goes into the
  search-engine data. Nothing is filled in automatically.
- **Honest checklist** — the "Before you publish" panel now also flags claims in the
  text (licensed, insured, 24/7, same-day, free estimates, guarantees…) until the
  owner confirms them.
- **Client edit link** — in the editor's "Client access" box, create a private link
  your client can open (no account) to update their headline, About text, services,
  hours, contact details and photos. They can't touch the design, publishing, domain,
  credentials or reviews. Replace or turn off the link any time; every client save is
  kept in version history.
- **Full backup** — an admin-only "Download a full backup" link on the dashboard
  (zip with the whole database and all uploaded photos).

- **Local SEO** — set a **Main city** (editor → "Local SEO & tracking", or the
  "City" box when generating). It goes into the page titles, a small
  "Roofer in Orlando, FL" tag above the home headline, the Services page, the
  footer, and the business details Google reads. **Every service gets its own
  page** (`/site/<name>/services/roof-repair`) with the city in its heading, a
  built-in quote form, links to the other services and the service-area list.
  Add a few sentences of real text per service in the editor (or use "Rewrite
  text with AI") — a service page only goes into the sitemap, and is only
  indexable, once it has its own text, so thin duplicate pages don't hurt you.
- **Quote requests that convert** — the contact form is now "Request a quote"
  with a **Service needed** dropdown (the chosen service shows on the Leads page
  and in the email alert). Submitting sends the visitor to a **Thank-you page**.
  On phones a **Call Now / Get a Quote bar** stays at the bottom of every page.
  Links like `/contact?service=Roof%20Repair` preselect a service (handy for ads).
- **Tracking (optional)** — paste a **Google Analytics ID** (`G-…`) and/or a
  **Meta Pixel ID** under "Local SEO & tracking". Only the live site is tracked,
  never the preview. A finished quote request counts as a lead
  (`generate_lead` / `Lead`) and a tap on the phone number as a call. Depending
  on where visitors are, the business may need a cookie/privacy notice.

- **Lead follow-up** — the Leads page now has **New / Contacted / Won / Lost**
  statuses, a private note on each lead, filter tabs and a **CSV download**. Turn
  on "Email visitors a 'we received your request' note" in the Contact section to
  send each visitor a short receipt (needs email sending set up; replies go to your
  alert address).
- **Real reviews** — the **Reviews** button in the editor gives you a review link
  (`/site/<name>/review`, or `/review` on the client's own domain), a ready-to-paste
  message, and (with email set up) a button to email the request. Customers' reviews
  wait for your **Approve / Reject**; approved ones go onto the Reviews page. The
  link is meant for every customer, not only happy ones; Google and review sites
  forbid filtering who you ask.
- **Client reports** — the **Report** button shows page views (counted without
  cookies or personal data, bots excluded), leads, what people asked about, new
  reviews and the most viewed pages for 7, 30 or 90 days, printable as a PDF.
  Clients see the same report from their private edit link. Add a "Send monthly
  website reports to" address (Local SEO & tracking) and last month's numbers are
  emailed automatically on the first run each month (email must be set up).
- **Town pages** — every town in the service-area list gets its own page
  ("Roofing company in Kissimmee"). Write something true and specific per town in
  the editor; a town page only goes in the sitemap once it has text.
- **Blog / News & tips** and **Extra pages** (Financing, Service plans, Careers ...)
  — new blocks in the editor. Posts get their own pages; each extra page gets its
  own address and a menu link. Both are included in the sitemap and the static export.

## AI-written copy

Off by default (sites use the built-in templates). To turn it on, get an API key from
https://console.anthropic.com and add it to `.env`:

```
ANTHROPIC_API_KEY=your-key-here
```

Each generated site or rewrite makes one API call (typically a few cents). The model
can be changed with `ANTHROPIC_MODEL`. If the call ever fails, the site is built from
the templates instead, so generating never breaks. **Always read AI (and template) text
before publishing** — the prompt forbids invented facts, but only the owner knows what
is actually true.

## Putting it online (HTTPS for client domains)

Running SiteGen on your own computer is fine for building sites; to host client sites
for real you need it on an always-on server (a small VPS works). The `deploy/` folder
has what's needed:

1. On the server install Node.js and [Caddy](https://caddyserver.com/docs/install), copy
   the project there, run `npm install`, and fill in `.env` — set `NODE_ENV=production`,
   a strong `SESSION_SECRET`, `APP_DOMAIN=app.yourcompany.com` (where you log in) and
   optionally `ADMIN_EMAIL`.
2. Keep SiteGen running with `deploy/sitegen.service` (systemd) or any process manager.
3. Run Caddy with `deploy/Caddyfile`. It gets and renews free HTTPS certificates
   automatically for the dashboard domain and for every client's custom domain the
   first time it is visited. Before issuing one it asks SiteGen (`/internal/domain-check`)
   whether it really hosts that domain: only published sites with that exact custom
   domain (or `APP_DOMAIN`) are approved.
4. Point DNS at the server: an A record for `APP_DOMAIN`, and for each client domain
   (enter it in the site's "Custom domain" box exactly as visitors will type it, e.g.
   `www.clientsite.com`).

Back up regularly with the dashboard's backup link. To restore: stop SiteGen, put
`sitegen.db` from the zip into `data/` and the `uploads/` files into `public/uploads/`.

## Generate a site from a business type

From the dashboard, type a business type (e.g. "plumbing company", "hair
salon", "Italian restaurant") and optionally a business name, then click
"Generate site." The app:

1. Matches the business type against a library of ~25 common local-business
   categories (plumbing, electrical, HVAC, landscaping, cleaning, roofing,
   contracting, auto repair, salon, spa, restaurant, bakery, law, accounting,
   real estate, dental, veterinary, fitness, photography, pet grooming, IT
   services, moving, pest control, painting, and more) — or falls back to a
   generic small-business template if nothing matches
2. Fills in a real headline, about text, 3-4 services with descriptions, and
   FAQ entries for that category
3. Pulls real, free-to-use stock photos for the hero image and gallery from
   Pexels, matched to the business type
4. Creates the site and sends you to the editor to review, personalize, and
   publish

**To enable real photos**, get a free Pexels API key:

1. Go to https://www.pexels.com/api/ and click "Get Started" (a free
   Pexels account is all that's required — no credit card)
2. Copy your API key from the dashboard it gives you
3. Paste it into `.env` as `PEXELS_API_KEY=your-key-here`
4. Restart the server (`Ctrl+C`, then `node server.js` again)

Without a key, sites still generate fully (headline, text, services, FAQ) —
they just won't have a hero image or gallery photos until you add your own.
Pexels' free tier is generous (200 requests/hour, 20,000/month) and doesn't
require attribution, though crediting photographers is appreciated.

**Sharper stock photos.** Pexels' "large" size is only 940px wide, so full-width photos used to look soft. The
published page now asks Pexels (and Unsplash) for the right size per use: photos in the page get 640 to 2400px
copies so each screen downloads a sharp one, and full-width hero and section backgrounds get a 2400px copy.
Photos already on a site get this too, nothing needs re-picking.

**Unsplash as a second source (optional).** The editor's "Choose photo" window can also search Unsplash:

1. Go to https://unsplash.com/developers, sign in and click "Your apps", then "New Application"
2. Accept the API guidelines and name the app (for example "SiteGen")
3. Copy the "Access Key" (not the Secret key)
4. Paste it into `.env` as `UNSPLASH_ACCESS_KEY=your-access-key`, then restart the server

With both keys set, the picker shows Pexels / Unsplash buttons. Unsplash's rules, which the app follows for you:
photos are shown from Unsplash's own servers, Unsplash is told each time a photo is picked, and the photographer is
credited ("Photos by Name on Unsplash") in the footer of the published site for as long as the photo is used.
A new app starts in Unsplash's demo mode (50 searches an hour); you can apply for production from the app's page.

## Modernize an old website

From the dashboard, paste the URL of an existing live website. The app:

1. Fetches and parses it (headline, intro text, service-like headings,
   contact email/phone/address, a logo, real photos — filtering out
   icons/logos from the gallery)
2. Creates a brand-new site from that content using the modern theme
   (keeping the old site's brand color if it declared one)
3. Sends you to the editor with a banner flagging it as imported, so you
   can review and adjust anything before publishing

If a site was created this way, its editor gets a **"Refresh from
source"** button to re-pull content from the same URL later (your current
content is saved to version history first, so it's never a one-way trip).

This reads static HTML. If a site renders its content entirely via
JavaScript, install Playwright to enable a headless-browser fallback the
scraper will use automatically:

```
npm install playwright && npx playwright install chromium
```

(Not installed by default, to keep the base install light — most old
business sites are plain server-rendered HTML and never need it.)

## Pull inspiration from social media

Both "Generate a site" and "Modernize an existing website" have an optional
"Facebook / Instagram / Google Business link" field. When filled in, the app
fetches that page's public metadata (Open Graph tags) — a profile/cover
photo, a bio, and a declared brand color — and uses it in the new site:

- **Generate a site**: a real photo from the link replaces the generic stock
  hero image, and the brand color (if found) replaces the auto-picked one.
- **Modernize an existing website**: the social link only fills in what the
  old site was missing (e.g. no hero image, no brand color) rather than
  overriding what was already found.

This only works with whatever a page exposes **without logging in**.
Facebook and Instagram both aggressively limit that for most business
pages, so results range from "a nice cover photo and brand color" to
"nothing at all" — if nothing usable comes back, the site still generates
normally, just without that extra polish. Google Business Profile listings
and plain business websites tend to work better than Instagram in
particular. There's no error shown if a social link comes back empty; it's
treated as a bonus, not a requirement.

## Design

Published sites use a clean, corporate/premium visual style out of the
box: full-bleed hero imagery with a color overlay, card-based sections,
generous whitespace, a sticky nav with real links to each page (not
in-page anchors), an accessible FAQ accordion, a two-column About section
with a photo (falls back to centered text if no photo is set), and a
two-column contact section with an embedded map (shown automatically once
an address is filled in). A closing call-to-action band appears above the
footer on every page except Contact itself. Six style options plus a primary/accent
color picker and font choice are available per site from the theme
settings in the editor:

- **Modern** — the default: clean sans-serif, pill buttons, soft shadows.
- **Classic** — a more traditional serif/4px-corner look.
- **Bold** — modern's shapes with punchier color use.
- **Editorial** — a warmer, premium/magazine style: cream page background,
  serif headlines (Playfair Display), left-aligned section headers instead
  of centered ones. Modeled on premium service-business sites (law firms,
  consultancies) that favor an editorial feel over a tech-startup one.
- **Minimal** — quiet and flat: no shadows, thin hairline rules, small
  tracked-out uppercase section labels, sharp-cornered buttons. Good for
  studios, consultants, anyone who wants restraint over polish.
- **Warm** — cozy and rounded: a soft cream/peach background, a gentle
  serif (Fraunces) for headings, extra-rounded cards and photos. Good for
  home services, salons, and family-run businesses.

All styles share the optional hero **"trust line"** field — short facts
separated by `•` (e.g. "Free consultation • No hidden fees • Available
24/7"), rendered as a row of checkmark bullets under the subheadline.

Nothing fabricated ships by default: there's no placeholder testimonial, no
invented trust badges ("Licensed & Insured" etc.) — sections with no real
content (like testimonials) simply don't render until you add some,
instead of showing something fake. If a hero or About photo URL ever goes
dead (stock-photo links do rot), the page detects the failed load and
falls back to a themed pattern background instead of showing a broken
image or a blank gray box.

## Security & production hardening

- **Rate limiting** on login, signup, the URL importer, the "generate a
  site" tool, and the public contact form (which has no login to protect
  it, since anyone who finds the live site can reach it).
- **Spam honeypot** on the public contact form: a hidden field real
  visitors never fill in; a submission that does gets silently dropped
  instead of stored, with no indication to the bot that anything failed.
- **SSRF protection** on the importer: it resolves the target host and
  refuses to fetch anything pointing at loopback, private (RFC1918),
  link-local, or other non-public IP ranges — including through redirects,
  checked hop by hop. Set `ALLOW_PRIVATE_IMPORT_HOSTS=true` in `.env` only
  for local development if you need to import from `localhost`.
- **Input validation** on signup/login (email format, password length),
  and on every editor field (length caps, hex-color checks, and
  `href`/`src` values restricted to `http(s)`/`#`/relative paths so a
  pasted value can't become a `javascript:` link).
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` when
  `NODE_ENV=production`.
- `SESSION_SECRET` and `PORT` come from `.env` (see `.env.example`)
  instead of being hardcoded.

## Performance

- An index on `sites.user_id` keeps dashboard queries fast as the number
  of sites grows.
- Published pages are cached in memory per-page (home, about, contact, …)
  and served without touching the database or re-rendering, invalidated
  immediately whenever that site is saved, published, unpublished, or
  deleted (5-minute safety-net TTL besides that).
- Gallery and map images use `loading="lazy"`.
- Photo speed pass: see "Speed, header options, form builder and launch audit" below.

## Files

- `server.js` — all routes (auth, dashboard, editor, autosave, uploads,
  versions, import/refresh, custom domains, public renderer, sitemap)
- `db.js` — SQLite schema, migrations, and connection (`DB_PATH` env var
  overrides the file location, used by the test suite)
- `defaults.js` — default content/theme/layout for a new site
- `scraper.js` — fetches a URL (with SSRF protection) and extracts content
  for the "modernize" import and "refresh from source" features
- `templates.js` — the business-type copy library for the "generate a site"
  feature
- `photos.js` — Pexels stock-photo search, used by "generate a site"
- `social.js` — best-effort Open Graph scrape of a Facebook/Instagram/Google
  Business link for a photo, bio, and brand color ("draw inspiration")
- `validate.js` — shared input validation helpers
- `cache.js` — tiny in-memory cache for rendered public pages
- `mailer.js` — optional SMTP email alerts for new leads
- `checklist.js` — the "Before you publish" checks
- `images.js` — optional (sharp-based) upload resizing/rotation
- `ai.js` — optional Claude-written copy (with strict no-invented-claims rules)
- `deploy/` — Caddyfile (automatic HTTPS) and a systemd unit for running on a server
- `views/client-edit.ejs` — the limited editor behind client edit links
- `start.bat`, `scripts/setup-env.js` — the Windows launcher and its `.env` helper
- `views/` — EJS templates; `views/sections/*.ejs` are the individual
  editor field partials, looped over in the order stored per site;
  `views/leads.ejs` lists a site's contact-form submissions
- `tests/` — `node --test` integration + unit tests
- `data/sitegen.db` — SQLite database file (created on first run; includes
  the `contact_submissions` table that backs the Leads page)
- `public/uploads/` — user-uploaded images (hero/about/gallery photos, and
  photos attached to contact-form submissions)

## Known limitations / next steps

- Uploaded images are stored on local disk — fine for a single server,
  but swap `multer`'s disk storage for S3 (or similar) before running
  multiple server instances behind a load balancer.
- The importer only follows redirects and reads one page; it doesn't
  crawl a whole old site.
- Custom domains require you to actually deploy this app somewhere with a
  stable address and point DNS at it — there's no automatic TLS/certificate
  provisioning here (put it behind something like Caddy or a
  load balancer that handles that).
- No password reset / email verification flow yet.

## Round 5: cookie notice, accessibility, speed, Sankara starter site

**Cookie notice and tracking.** In the editor's Local SEO box, "Tracking" is either *Ask visitors first* (default) or *Always on*. With "ask", a small banner appears and Google Analytics / Meta Pixel load only after a visitor clicks Accept. The built-in page counts and reports use no cookies, so they are unaffected. Existing sites that already had tracking IDs will now show the banner; switch to "Always on" if you prefer the old behavior (check your local rules first).

**Legal note.** The Trust box has a "Legal note" field (license numbers, disclosures). It shows in the footer. Only enter things that are true and verifiable.

**Accessibility basics.** Skip-to-content link, visible keyboard focus, a main landmark, and a checklist warning when white text on the brand color would be hard to read.

**Speed.** Pages are gzip-compressed (about 75% smaller), uploaded photos are cached for 30 days, Google Fonts no longer block rendering, and the home hero photo is preloaded.

**Create the Sankara Insurance Group starter site** (run once, after you've signed up in SiteGen):

    node scripts\create-site.js examples\sankara.json

It lands in your account unpublished. It deliberately contains no license numbers, years in business, service areas or carrier claims. Add your phone, email, address, license number (Legal note), photos and hours, then follow the checklist before publishing. Use `node scripts\create-site.js file.json you@email.com` to pick the account. You can make your own starter files by copying `examples/sankara.json`.

## Round 6: more looks, and charging for hosting

**Three new styles** (editor, Theme box, Style): *Midnight* (dark), *Split hero* (text on the left, photo on the right on wide screens), and *Poster* (loud uppercase headings, hard edges). They work with any brand colors. Check the contrast warning in the checklist if you pick a very light primary color.

### Charging for hosting

SiteGen can take a monthly hosting fee through Stripe and automatically take a client's site offline if they stop paying. You never handle card numbers; Stripe does.

One-time setup (about 10 minutes):

1. Make a Stripe account at stripe.com. Start in **Test mode** (toggle at the top) until everything works.
2. **Product catalog → Add product**: for example "Website hosting", **Recurring**, monthly, your price. Copy its **Price ID** (starts with `price_`).
3. **Developers → API keys**: copy the **Secret key** (starts with `sk_test_`, later `sk_live_`).
4. **Developers → Webhooks → Add endpoint**: the address is `https://YOUR-SITEGEN-ADDRESS/stripe/webhook` (it must be your public https address; see "Putting it online"). Select these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy the **Signing secret** (starts with `whsec_`).
5. In your `.env` file add:

       STRIPE_SECRET_KEY=sk_test_...
       STRIPE_PRICE_ID=price_...
       STRIPE_WEBHOOK_SECRET=whsec_...

   then restart SiteGen.
6. Optional: **Settings → Billing → Customer portal** in Stripe: turn it on so clients can update their card or cancel.

Using it, per site: open the site in the editor, click **Billing**. Enter the client's email and click *Create link* (or *Create and email it*). The client pays on Stripe's page and the status turns Active by itself. Tick *Take this site offline when its hosting subscription is not active* once the client has agreed to the terms. Then:

- A failed payment keeps the site live for 7 days while Stripe retries the card, then it goes offline (visitors see a polite "temporarily unavailable" page).
- A cancelled subscription takes the site offline right away. When they pay again it comes back right away.
- Your own preview and editor always work, and you can untick the box at any time to put a site back online.
- One price applies to every site. If you want different prices, tell me and I'll add a price per site.

Things to know: this only works when SiteGen is online at a public https address (Stripe needs to reach the webhook). To test on your own computer, use Stripe's free CLI: `stripe listen --forward-to localhost:3000/stripe/webhook`, and put the `whsec_` it prints in `.env`. Test with Stripe's test card `4242 4242 4242 4242`. Put a short hosting agreement in front of clients before you turn on the offline switch, and check your local rules on taxes and recurring billing.

### Fonts

Editor → Theme has a **Heading font** and a **Body font**. Pick from about 40 curated Google Fonts (grouped: Eccentric, Bold headlines, Elegant, Clean, Script, Mono), or type the name of *any* font from fonts.google.com. The sample text under each one previews it as you choose. "Heading capitalization" lets you force Normal (best for gothic and script fonts, which are hard to read in capitals) or UPPERCASE.

For an edgy shop (tattoo, barber, bar): try the **Midnight** or **Poster** style with heading font *Pirata One* or *UnifrakturCook*, capitalization *Normal*, and body font *Inter* or *Lora* so the paragraphs stay easy to read. Keep the body font plain; eccentric fonts are for headings.

Fonts come from Google at view time, so visitors need to be online (a fallback font shows meanwhile). Leaving both on "Style default" changes nothing for existing sites.

### More starting templates

"Generate a site" now knows 42 business types. New ones: tattoo studio, barbershop, insurance agency, home care, party and event rentals, florist, auto detailing, catering and food trucks, chiropractor, tutoring, weddings and events, pool service, tree service, pressure washing, junk removal, coffee shop, locksmith and child care. Several come with their own look (for example the tattoo studio starts in the dark Midnight style with a blackletter heading font); you can change all of it afterward. The copy deliberately makes no promises about licenses, response times or prices. Add those yourself once they are true.

To add your own, copy an entry in `templates-more.js` (the optional `look` block sets style, colors and fonts). Entries listed there win over older ones when keywords overlap.

### The Agency look (full home page)

Pick **Agency** in Theme → Style (or tick "Show service tiles, service photos and reviews on the home page" in any style) and the home page becomes a full landing page:

- a dark top bar with phone, "Email an agent" and social links
- a photo hero, then a row of colored **service tiles** with icons (up to 8; the icon is chosen from the service name, or pick one per service)
- a short intro from your About text
- a dark band of **service cards with photos** and "Read more" links
- a **ratings summary and review cards** built only from the reviews you have entered or approved (the average and count are computed from them, never invented)
- a footer with quick links, your latest blog posts, and your main and **other offices** (Contact box → Other offices)
- on desktop, a slim "Questions? We're here to help. Get a Quote / Call" bar along the bottom that visitors can close

For each service, use **Choose photo** (Services box) to add the card photo; the checklist reminds you if any are missing. The Insurance template and the Sankara starter file use this look. Headings use the condensed Oswald font in capitals unless you pick a heading font yourself.

## Hero photo slideshow and office maps

- **More hero photos** (Hero box in the editor): after you set the main hero photo, add up to 5 more. The home page then fades between them every 6 seconds, with previous/next arrows. It pauses on hover and does not auto-play for visitors who ask their device to reduce motion. Leave the list empty for a single photo.
- **Other offices** (Contact box): add up to 6 offices (name, address, phone). They show as cards with a Google map on the Contact page and in the footer. The main address also gets a footer map on the full home look (Agency, or the "full home page" checkbox).
- Maps load only when a visitor scrolls to them, and need an internet connection. They are not included in static exports.

## Content blocks

In the editor, open **Content blocks** and use **+ Photo + text block** or **+ Numbered steps block**. Add as many as you like.

- **Photo + text:** a photo beside a heading, paragraphs and an optional button. With "Alternate automatically", the photo switches sides from one block to the next.
- **Numbered steps:** one step per line, written as `Title | short description`.
- Each block can have a plain, light-tint or brand-color background, and can sit near the top or lower on the home page.
- Use the arrows to reorder, **Duplicate** to copy a block, **Delete** to remove it.
- Blocks show on the home page only. Nothing is filled in automatically. Empty blocks are dropped when you save.

More block types: **Feature cards** (one per line, `Title | description`, with an icon picked from the title), **Closing call-to-action band** (headline, text and button over an optional background photo) and **Area chips** (one place per line; add `| /link` to make a chip clickable).

New pet templates: **Mobile Pet Grooming** (type "mobile pet grooming"; Agency look with photo + text, steps and feature-card blocks), **Dog Training** and **Pet Sitting & Boarding** (also matches dog walking, daycare and kennel). Plain "pet grooming" still uses the salon template. Templates can now bring their own content blocks.

## More themes

Theme > Style now also has **Luxe**, **Coastal**, **Playful**, **Earthy**, **Corporate** and **Blush**. Switch between them on any site at any time; your text, photos and blocks stay the same. Each theme sets its own background, corner roundness, button shape and heading font, and still uses the site's brand colors, so adjust the primary color after switching. Tick "full home page" to get the tiles, service cards and review layout in any theme. Picking your own heading font overrides the theme's. New themes are defined in `themes.js`.

## Styles and home page layouts

There are now 19 styles (Theme > Style, or click a style name above the list). The newer ones (Luxe, Coastal, Playful, Earthy, Corporate, Blush, Studio, Gallery, Journal) each bring their own home page layout and hero arrangement, so a site no longer has to look like the others. **Home page layout** lets you override that with Basic, Full, Story (photo + text rows), Photo tiles or List. Switch as often as you like; the preview refreshes after a moment and nothing you've written is lost. Pet templates now use Studio (mobile grooming), Gallery (dog training) and Playful (pet sitting).

## Styles across pages

- **Inner pages follow the layout.** The Story, Photo tiles and List layouts now also apply to the Services page, not just the home page.
- **Different style on specific pages.** In the editor, open "Different style on specific pages" and pick a style for any page (Home, About, Services, Reviews, FAQ, Contact, and so on). The Services choice also covers each individual service page. That page's menu and footer follow its style, so use it sparingly. "Same as the site" removes the override. It also works in the preview and in the static export.

## Style hints and per-industry defaults

- Hover over a style name in Theme to see what it feels like and which businesses it suits.
- Every industry template now generates with its own style (and sometimes home layout): salons get Luxe, law firms Journal, plumbers Studio, accountants Corporate with a list layout, and so on. The mapping is in `template-looks.js`; change it if you disagree. Unmatched business types still get the generic Modern look. You can always switch in Theme > Style.

## Hero feature cards and logo strip

- **Feature cards over the hero** (Hero box): up to 4 cards, each a short title and one line, that overlap the bottom of the hero photo on the home page. Empty rows are left out. Only say things that are true for the business.
- **Logo strip** (Trust & credentials): up to 8 association, certification or partner logos with an optional heading such as "Our memberships". They show as a row on the home page. Only add logos the business is entitled to show.
Both are empty by default and never filled in automatically.

## Photo strip, split blocks and shaped edges

New content block types (Content blocks > add):
- **Side-scrolling photo strip:** a row of up to 20 photos that visitors scroll sideways (arrows on desktop, swipe on phones). Add photos by upload, stock search or URL. An optional button underneath works well as "Follow us on Instagram".
- **Heading + text (split):** a big uppercase heading on the left, paragraphs and an optional button on the right.
- **Dark band** is now a background choice for any block.
- **Wavy or scalloped top edge** for any block, and a **bottom edge for the hero** (Hero box).

Instagram: the strip shows photos you add yourself. A live Instagram feed needs a Meta developer app and access token, which SiteGen does not set up, so link to the profile with the button instead.

## Online booking

Each site can have a booking page (`/book`) where customers choose a service, optional add-ons, a date and a time, answer questions that suit the industry (for pet grooming: pet name, type, breed, size, coat, handling notes), and send the request.

**Turn it on:** editor → *Online booking*. Tick "Turn on online booking", pick a **ready-made setup** (pet grooming, mobile grooming, salon, barber, home services, spa/clinic, dog training, general) and press *Load*. That fills in the industry questions and turns the site's services into bookable services. Then set your own:

- opening hours per weekday, time zone, how often start times are offered, earliest booking (hours from now), how far ahead customers can book, and how many appointments can overlap
- service lengths (minutes) and optional price text such as "from $65". Prices are only displayed, never charged
- add-ons (extra minutes are added to the appointment), your own questions (short text, dropdown, long text; required or optional), a policy text and a confirmation note

Generated sites from an industry template get the matching setup pre-loaded, **switched off**. Nothing is bookable until you turn it on and check the services and hours.

**What happens to a request:** it waits on the **Bookings** page (button in the editor). You confirm or decline it (with an optional message), or turn on *Confirm automatically*. Booked times disappear from the open times straight away, including requests still waiting for you, and a declined or cancelled one frees its time again. Customers get a private link to see their status or cancel. With email set up (see "Email alerts") you are emailed about new requests and the customer is emailed when you confirm or decline.

**Good to know**
- Times are the business's own clock in the time zone you pick. There is no calendar sync (Google/Outlook) and no payments or deposits; put cancellation or deposit rules in the policy text.
- Customers can't reschedule themselves; they cancel with their link or call you.
- Booking needs the running server, so the static export has no booking page (the "Book Now" button is left out there).
- Loading a ready-made setup replaces services, add-ons and questions (a version is saved to history first). Opening hours stay.

## Matching color palettes

In the editor, under the Primary and Accent color boxes, open **Matching color palettes**:

- **Pull colors from a logo:** choose the client's logo file (or press *Use the site logo*) and it finds the main colors, ignoring white and transparent backgrounds. Click *Logo colors* to use the logo's own pair, or click one color to build matching sets from it. The image is read in your browser and is not uploaded. A logo hosted on another website can't be read that way; choose the file from your computer instead.
- **Build matches from one color:** pick the client's brand color and get eight matching sets (same color deeper, complementary, warm and cool neighbors, triad, neutral slate, softer, bolder). Click one to use it; the preview updates.
- **Ready-made for businesses like this:** 16 palettes (pets, salon, spa, navy, garden, trades, auto, kitchen, care, tech, earthy, black and white, sunny). The ones that fit the site's business type are listed first.
- **Readability check:** white button text sits on the primary color and white text sits on the accent (footer and dark bands). If either is hard to read you get a warning and a one-click darker color of the same hue.
- **Undo palette** puts the previous two colors back. Colors stay the same when you switch styles. Photos and text are never touched.


## Pricing table, announcement bar, photo lightbox, search markup

- **Pricing / packages block** (editor → Content blocks → "+ Pricing / packages block"): one plan per line as `Name | Price | what is included, separated by commas`. Start a line with `*` to highlight that plan (shown with a "Featured" label; nothing says "most popular" unless you write it). The block's button appears on every plan, so point it at your booking page or contact page. Prices are just text you type.
- **Announcement bar** (editor → Announcement bar): a thin bar above the menu on every page, with optional link. Uses the accent color. Visitors can close it and it stays closed until you change the message.
- **Photo lightbox:** clicking a photo on the Gallery page or in a side-scrolling photo strip opens it large, with next/previous arrows, keyboard arrows, Esc, and swipe on phones. Nothing to set up.
- **Search-engine markup:** pages already carried business details (name, phone, address, area, social links). Now the opening hours are included too, but only rows that read as a weekday plus a time range such as "Monday | 9:00 AM – 5:30 PM" (rows like "Closed" or "Call us" are left out rather than guessed), and the FAQ page carries FAQ markup matching the questions shown. Review-star markup is deliberately not added: search engines disapprove of a business marking up reviews it collected itself.

## More blocks and extras

All of these are in the editor under *Content blocks* (add as many as you like, reorder, duplicate) unless noted.

- **Team / staff:** one person per line, `Name | Role | Short bio | Photo link`. Role, bio and photo are optional; without a photo the card shows the person's initial in a color circle.
- **Numbers:** one per line, `Number | Label`, for example `12 | Years in business`. They count up when scrolled into view (not for visitors who prefer reduced motion). You type the numbers; nothing is filled in for you.
- **Video:** paste a YouTube or Vimeo page link, or a direct `.mp4`/`.webm` link. YouTube and Vimeo load only after a visitor clicks play, so nothing from them is loaded or tracked until then. Other links show nothing.
- **Tabs** and **Accordion:** one item per line, `Title | text`. Tabs show one panel at a time; the accordion opens and closes each item.
- **Review carousel:** in the Testimonials section choose "Sliding row" instead of the grid. It applies to the Reviews page and the home page review row, with arrows and swipe.
- **Floating Text us / WhatsApp button** (Contact section): a button in the corner of every page that opens a text message or WhatsApp chat to the site's phone number. A 10-digit number is assumed to be a US number (+1). Only switch it on if the business actually answers texts.
- **Share picture** (the SEO fields at the top of the editor): the picture shown when a link to the site is texted or posted. Empty means the home photo.

The site already has a cookie notice (it appears when the owner adds Google Analytics or a Meta pixel with tracking set to "ask first"), so no separate one was added.

## Page-wide controls (work with every style and industry)

- **Blocks on any page:** every content block has a "page" choice (home, About, Services, Reviews, Why Choose Us, Gallery, FAQ, News & Tips, Hours, Contact) and a "near the top / lower on the page" choice. Use it for a pricing block on the Services page, a team block on About, an accordion on Contact, and so on. Blocks default to the home page, as before.
- **Hero controls** (Hero section): click the photo preview to choose which part stays in view when it is cropped for different screens (a face, a storefront); pick how dark the photo is made so the text reads (or let the style decide); choose text left, centered or right; optionally add a short looping background video (a direct .mp4/.webm link). The video plays silently on computers only; phones and visitors who prefer less motion see the photo, so keep a hero photo set too.
- **Feel controls** (Theme section, above the colors): button shape (square, rounded, pill), corner roundness for cards and photos (sharp, soft, very round) and space between sections (compact, normal, airy). "Let the style decide" keeps each style's own look.
- **Logo as browser-tab icon:** if a logo is set, it is used as the site's tab icon (and home-screen icon on phones) instead of a letter. A square logo image works best.

## Speed, header options, form builder and launch audit

- **Photos load fast on phones.** Every photo you upload gets smaller WebP copies (480, 960, 1440 and 1920 px wide) next to the original. Published pages use them automatically: a phone downloads the small copy, a desktop the large one, photos below the top of the page load only when scrolled to, and the home page photo is WebP and preloaded. Nothing to switch on. Photos uploaded before this update get their copies made in the background the first time a page that uses them is viewed (the first visitor may still get the old file). The exported static site includes the copies. GIFs, SVGs and photos linked from other websites are left as they are, and the logo is never resized.
- **Header options** (Theme section): *Sticky bar* (the default), *Sticky, shrinks as you scroll*, *Transparent over the home photo, solid on scroll* (home page only; other pages have no photo to float over) or *Not sticky*. *Header layout* puts the logo left with the menu right (default) or centered with the menu underneath. Works with every style.
- **Contact form builder** (Contact section): choose *My own form* instead of the standard one. Pick a template (estimate request, insurance or financial quote, pet appointment, event inquiry, consultation) or add your own questions: name, email, phone, a list of your services, long or short answers, dropdown, pick-one buttons, pick-several checkboxes, date, number, photo upload. Give each question a **Step**; questions on different steps become a step-by-step form with a progress bar and Back/Next buttons (everything on step 1 is a normal one-page form). Required questions are checked in the browser and again on the server. Name, email, phone, service and message answers fill the usual Leads columns; every other answer shows on the lead, in the CSV (an "Answers" column) and in the email alert. The same form also appears on service pages. Switching back to *Standard form* keeps your questions saved. Keep a phone or email question so you can reply (the launch audit warns if you do not).
- **Photo descriptions** (Gallery and About): each photo can have a short description, used as alt text for screen readers and Google Images. Blank ones fall back to the business name.
- **Launch audit** (the "Before you publish" list in the editor) now also catches: placeholder text left behind (Lorem ipsum, example.com addresses, 555-01xx phone numbers, the default About text), phone numbers that are too short, buttons that link to a page that does not exist or is hidden, uploaded photos missing from the uploads folder, very large photos, insecure http:// photos, gallery photos with no description, search title or description that is too long or too short, no share picture, a very long headline, a custom form with no way to reply, and booking switched on with no services or no alert email.

## Block library, per-page search settings, redirects, 404 page and visitor actions

- **Block library** (Content blocks section): click "Save to library" on any block, give it a name, and it is saved to *your account*. On any of your sites, pick it in the Block library box and press "Insert into this page"; then choose which page it shows on. Copies are independent: editing the library copy later does not change blocks already placed on sites, and deleting a library entry leaves those blocks alone. Up to 200 saved blocks; other users never see yours.
- **Search & sharing for each page** (own box under Site & SEO): for About, Services, Reviews, Why Choose Us, Gallery, FAQ, News & Tips, Hours, Contact (and Booking when it is on) you can write your own Google title, description and share picture, or ask Google not to list the page (it is also dropped from the sitemap). Each service also has its own title and description boxes inside the Services section. Empty boxes keep the automatic text.
- **Redirects:** map old addresses to new pages (`/about-us.html` to `/about`), a whole folder (`/old-blog/*` to `/news/*`) or another website. Permanent (301) tells Google the move is for good; temporary is 302. Matching ignores capital letters and a trailing slash, keeps the visitor's `?utm=` tags, and works on `/site/<name>/...` links and on a site's own domain. Only GET requests are redirected. The pre-launch list warns if a redirect hides a page that exists or leads to a page that does not.
- **"Page not found" page:** any unknown address on a published site (including its own domain) shows a page in the site's own style, with the header, footer and links to its main pages, and the right 404 status so Google does not index it. You can change the heading and message. Addresses that belong to no site get the plain 404.
- **What visitors did** (on the Report page and in the monthly email): counts of taps on the phone number, email address and Text/WhatsApp button, clicks on "Contact / Book" buttons, taps on directions links, plus booking requests and the share of page views that ended in an action. No cookies, no personal data; bots, the editor preview and the exported static copy are not counted. A tap is not a completed call. If a Google Analytics or Meta Pixel ID is set, those tools also receive `click_to_call`, `click_email`, `click_text` and, after a booking request, `generate_lead` / `Schedule`.

## Scroll animation, privacy & terms, backups and client logins

**Scroll animation.** Replaced by the Motion style setting (see "Motion style" below). "Cards lift on hover" is still in the Design box.

**Privacy Policy and Terms of Use.** Settings → *Privacy & Terms pages*. Turn it on and `/privacy` and `/terms` appear, linked in the footer, in the sitemap and in the exported zip. The text is written from what the site really does (a form, photo upload, booking, Google Analytics / Meta Pixel, Google Fonts), so a paragraph only appears when it applies. It is a starting template, **not legal advice**: have a lawyer review it, and use the "extra text" boxes for your own rules. The cookie bar still appears when tracking IDs are set (asking before anything loads); you can also choose a short privacy notice on every site. The launch audit suggests a policy when a site collects details but has none.

**Backups.** SiteGen saves a compressed copy of the database to `data/backups` about two minutes after starting and every six hours if none exists for today, keeping the newest 14 (`BACKUP_KEEP`, `BACKUP_DIR`, `BACKUP_AUTO=off` in `.env`). The admin account sees them under Dashboard → *Automatic backups* (download, or "Back up now"). They hold the database only; the existing "full backup" zip also includes uploaded photos. Copy backups to another drive or cloud folder now and then.

**One-click copies.** Dashboard → *Duplicate* (exact copy), *Use as template* (keeps design and wording, clears phone, email, address, tracking IDs, report email, redirects and client links) and *Save file* (a `.sitegen.json` file). *Bring in a saved site* turns such a file into a new, unpublished site. Photos are not inside the file. Copies never get the original's custom domain or client access.

**Client logins.** Editor → *Client logins*: enter a client's email, and they get an invite link (emailed if email sending is set up, otherwise shown once for you to send). They choose a password and sign in at `/client-login`, where they can change the same basics as with the private link, plus their report, and nothing about design, publishing or domain. *Reset password* and *Remove* are on the same box. The client session is separate from your owner login. The older private link still works.

## Lead pipeline, follow-up emails, chat assistant, Google reviews and estimate calculator

**Lead pipeline.** On the Leads page every lead has a status (New, Contacted, Quoted, Won, Lost), a private note and a **follow-up date**. A "Follow up today" filter shows what is due, and once a day you get one email per site listing the due leads (turn it off under Settings → *Lead follow-up*). Leads are marked where they came from (form, chat, estimate). The CSV has the new columns.

**Automatic follow-up emails.** Settings → *Lead follow-up*: up to three emails to a new lead who left an email address, sent a number of hours after they asked (for example 1, 48 and 168 hours). Each email goes out only while the lead is still **New**: change the status and the rest are cancelled. Every email carries a "stop emailing me" link. Use [name], [business] and [phone] in the text. Needs email sending set up (see "Email alerts"). Set `PUBLIC_URL` in `.env` (for example `https://sites.yourdomain.com`) so the stop link in the emails points at your real address.

**Chat assistant.** Settings → *Chat assistant* adds a chat bubble. It answers only from the site's own text (services, FAQ, hours, contact) and says "I don't have that detail" instead of guessing, then offers a box that sends the visitor's details as a lead with the conversation attached. It is labelled as automated. With `ANTHROPIC_API_KEY` set it uses AI (`ANTHROPIC_CHAT_MODEL` can pick a cheaper model); without it, it answers from the FAQ and hours only. Each site has a daily cap on AI replies (default 200) to keep costs in check. The Privacy Policy mentions the chat when it is on. Real FAQ answers make it much better.

**Google reviews.** Settings → Reviews box → *Google reviews*: enter the business's Place ID and choose "Star rating badge" or "Badge and Google reviews". Add `GOOGLE_PLACES_API_KEY` to `.env` (a Google Cloud key with the **Places API (New)** enabled; Google gives a monthly free allowance, check their current pricing). Reviews are fetched once a day and shown exactly as Google returns them (nothing is picked or edited), with a "Reviews from Google" credit. Please check Google's current terms for showing and storing their reviews. Not included in the downloaded static copy.

**Estimate / quote calculator.** Settings → *Quote / estimate calculator* adds an estimate page to the menu. You write the questions (dropdowns, buttons, number × price, yes/no add-ons) and set **every price yourself**; starting points for cleaning, lawn care, moving and an insurance quote wizard come with blank prices. The visitor sees a live price range, then sends it as a lead with their choices attached. The server recalculates the price, so it cannot be tampered with. Turn "Show prices" off for a quote wizard without prices. The launch audit warns if every price is zero. Not included in the downloaded static copy (it needs the server).

## Client questionnaire

Open **Client questionnaires** from the dashboard (or `/intake`) and press **Create a link**. Send that link to a new client. They answer a friendly 7-step form on their phone or computer: business, services, story, contact and hours, look and feel, goals and a final step. They can upload a logo and photos, and their progress is saved in their browser as they go.

When they press **Send my answers** you get an email (if email is set up) and their answers appear on the same page. Open them, check the "Check these before you publish" box, then press **Build the website**. The site is built from the client's own words for the services, story, tagline and FAQ, using their logo, photos, colors and chosen look. Nothing is invented. Privacy and terms pages are switched on, and the chat assistant only if they asked for it. Anything you still need to do (no logo, no photos, extras like a store) is listed for you.

You can close a link at any time. A closed or unknown link shows a polite "this form is closed" page. No new setup or environment variables are needed.

## Preview first, section labels, bigger headings, alternating bands and the floating button

- **Preview before creating.** On the dashboard, Generate now opens a preview instead of saving straight away. Switch between ten looks (the words and photos stay the same), flip between desktop and phone width, then press **Create this site** or **Discard**. Nothing is saved until you create it. Unused previews are cleaned up after 7 days.
- **Section labels.** Each section has an optional small label above its heading (for example "Our care") under the heading box in the editor. Generated sites start with a few sensible ones.
- **Heading size** (Normal, Large, Extra large) and **Alternate light and dark sections** are in the editor's look settings. Alternating bands show on home layouts that have several sections.
- **Floating button** (contact settings) now also offers **Call us**, **Book now** (needs online booking on) and **Get a quote**, besides Text and WhatsApp.
- **Benefit-first headlines.** Built-in templates now lead with what the customer gets and keep the business name in the supporting line. AI-written copy is told to do the same.

## Publish online (Netlify), custom domain and HTTPS

Open a site and press **Publish online**. One time only: make a free Netlify account, create a personal access token (User settings, Applications, New access token), add `NETLIFY_AUTH_TOKEN=...` to your `.env` file and restart. The token is never shown on any page.

- **Publish to Netlify** sends the finished site (plain HTML files and photos) to a new Netlify site and gives you a web address straight away. **Publish again** updates the same site after you edit.
- **Your own domain:** enter the domain, add the DNS records the page shows at the company where the domain is registered, wait a little, then press **Turn on HTTPS**. The certificate is free and renews itself.
- **Contact form:** works on the published copy through Netlify Forms. Messages are emailed to the contact notify address (or the contact email, or your login email) and also kept in the Netlify dashboard under Forms. The spam trap field is kept.
- **A 404 page and a thank-you page** are added to the published copy.
- **Not on the published copy:** online booking, the estimate calculator, the chat assistant, the review form, lead follow-ups and visitor reports. They need SiteGen running on a server, so they keep working on the address SiteGen itself serves. The page lists the ones this site uses.
- Netlify allows 3 deploys per minute and 100 per day. The normal **Export** download is unchanged.

## Card payments (Stripe): deposits, payment requests and service purchases

Each site uses the **owner's own Stripe account**: in the editor open *Card payments (Stripe)*, tick the box and paste a Stripe secret or restricted key (`sk_` / `rk_`). The key is stored encrypted, is never shown again, and money goes straight to the owner's Stripe. No webhook or extra setup is needed.

- **Booking deposits** – set a fixed amount or a percent of the service price. The customer is sent to Stripe; the time is held for 30 minutes and the booking is confirmed once paid. Unpaid holds are released automatically.
- **Pay buttons** – put a price (digits only, e.g. `89`) on a service and a "Pay online" button appears on its page.
- **Payment requests (quotes/invoices)** – *Payments* in the editor, or "Request payment" on a lead: enter an amount and description, copy the link or email it. Owners can resend, cancel or mark as paid (cash/check).
- Payments are confirmed by asking Stripe when the customer returns, when the owner views the page, and every 5 minutes in the background.
- Prices always come from the owner's settings, never from the visitor.

## Ask AI to change something (chat-to-edit)

Needs `ANTHROPIC_API_KEY`. In the editor (and on the client edit page) type a change in plain words, for example "make the headline friendlier, add a service called Gutter Cleaning, change the main color to dark green". The AI proposes edits, you see before and after, and nothing is saved until you click **Apply**. Applying saves the previous version to history first.

- It can only change headings, hero text, About, service and FAQ text (and add or remove services and FAQs), the SEO title/description, the announcement bar, and (owner only) colors and style options.
- It cannot touch contact details, hours, prices, photos, payments or credentials, and it is told never to invent facts.
- Clients get the same box with text-only changes.

## Luxury dark style, quick-jump buttons, "Where we work" map, footer columns

- **Style: Luxury dark.** Black with a warm glow, an elegant serif, and outlined pill buttons. The glow, buttons and headings use the **Primary color**; the footer and bands use the **Accent**; the page background is the new **Background color** box (leave empty for near-black). Under the color boxes, click one of eight ready-made palettes (black and gold, navy and rose gold, forest and champagne...) to set all three at once. Button text switches between dark and white automatically so it stays readable.
- **Quick-jump buttons** (Hero section): a row of pills under the hero for Book, Services, About, Reviews, Location and Contact. Only the ones the site actually has are shown.
- **"Where we work" map** (Contact section): a map plus the service areas on the home page.
- **Footer hours** (Contact section) and a **"We accept"** footer column that appears automatically once card payments are on.

## Emoji and doodles, cinematic hero, floating shapes

- **Your emoji** (Colors and fonts): type up to four, or click a quick pick for the kind of business (pets, salon, cleaning, home repair...). Only real emoji are kept.
- **Hand-drawn touches:** sparkle marks around the home headline and a squiggle under section headings. **Emoji next to headings:** shows your first emoji beside every section title.
- **Cinematic hero** is now part of the *Lively* motion style (slow photo zoom, headline rising word by word). Sites that used it were moved to Lively automatically.
- **Floating shapes over the hero:** your emoji drifting upward, twinkling sparkles, rising bubbles, or falling confetti. Drawn on a canvas, so there is nothing to upload; it pauses when scrolled out of view.
- Everything here is switched off for visitors whose device is set to "reduce motion".

## Design data (step 1 of the design-intelligence work)

`design-data/` holds JSON converted from the open-source **UI UX Pro Max** skill (MIT licence, © Next Level Builder; the licence file stays with the data): 192 kinds of business with recommended styles, palettes, fonts, landing patterns and "avoid" lists, plus 88 styles, 74 font pairings, 34 landing patterns and 109 web UX rules. `designdata.js` searches and resolves it (`searchProductTypes`, `designFor`, `recommend`, `searchGuidelines`...) with no Python or network. To refresh it: `node tools/import-design-data.js <path to the skill's data folder>`. Nothing in the editor uses it yet; steps 2 to 5 (industry mapping, recommended looks after the questionnaire, a pre-publish quality check, and on-brand AI prompts) build on it.

## Smart generator: industry, logo colors, new blocks

"Generate a site" (and building a site from a client questionnaire) now does three extra things (autosite.js):

- **Finds the industry** from the business type, the name and the extra details. Every industry is scored on whole words
  with common endings and extra everyday words ("groomer", "handyman", "pizza", "coding for kids"), so "spa" no longer
  matches "space" and "roofing contractor" is Roofing. With no match and an Anthropic key, the AI picks one of our industries.
- **Logo colors to our palettes.** Add the client's logo on the form (or the questionnaire's logo): its main colors are read
  and matched to the closest of the ready-made palettes (public/palette.js, plus the generator's 8), comparing colors the
  way eyes see them; a palette made for the industry wins a near tie. The logo also goes in the top bar. A brand color
  typed in "Client details" still wins.
- **New blocks that suit the industry** (box ticked by default): pets get Our story circle and Photo picks the words, trades
  Facts in a soft shape (only facts the client gave) and Photo in frames, beauty Who am I and Round photo, food Photo collage
  and Photo in frames, offices Photo on two color blocks and Photo and words pairs; every site closes with the Contact form
  with shapes. A Facebook or Instagram link adds a Social media block. The blocks use the site's own words, services and
  photos in the matched colors, and the home page becomes a Blocks page (Mix and match) built on the industry blueprint.

The preview page shows what was picked: the industry, the logo's colors, the new blocks (with "take them out") and color
buttons to swap to the logo's own colors or the next closest palettes.

## Design suggestions per industry

Each of the 45 industry templates is mapped (`industry-design.js`) to the closest business type in the bundled design data (`design-data/`, MIT, see its LICENSE file). In the editor, under Style, a "Suggested for …" panel shows the styles that suit the business, colour sets (adjusted to pass AA contrast), font pairs, the page flow that works, and what to avoid. Clicking a suggestion only fills the style, colour and font fields; text and photos are untouched. The panel is hidden for the generic template. Fit is marked direct / close / approximate; the data leans toward app and software businesses, so some trades (tattoo, barber, dog training, pet care) are approximate.

## Design options after the questionnaire

On a client's answers page (before building), SiteGen shows 2–3 design options (`design-options.js`). They come from the business type (see "Design suggestions per industry"), the look the client picked, their brand color, and the words they wrote (what they like about other sites, what makes them different, notes). The client's own look always leads; styles the design data says to avoid for that business are not suggested unless the client chose them (then a note says so). Each option shows its style, colors, fonts and why it was suggested. The chosen option is recomputed on the server when you click Build, so a tampered form value is ignored.

## Quality check before publishing

Every site has a "Check quality" button in the editor (`/sites/:id/quality`, code in `quality.js`). It reports, as a fix list:
- **Contrast (WCAG AA):** main and secondary text on the style's background, button labels on the brand color, and the brand color against the page. One click adjusts a weak brand color; the earlier version is saved in history.
- **Phone tap targets:** the page must enforce 44px minimum controls, allow pinch-zoom and have a mobile viewport.
- **Images:** insecure http images, formats browsers can't show, missing files, photos over about 700 KB or 2600px wide, large PNG photos, missing alt text, and lazy loading. "Optimize all photos" re-encodes heavy uploads to WebP (max 1920px) and keeps the originals.
- **Fonts:** font names that can't be requested from Google, `display=swap` and preconnect.

Red items (real problems) pause **Publish** and **Publish to Netlify** and show the list, with a "Publish anyway" button. Orange items are advice only. Photos hosted on other websites can't be measured.

New themes are guarded by tests: `tests/quality.test.js` checks every style's text contrast, and `tests/tap-targets.test.js` opens every style at phone width in a real browser (skipped if Playwright isn't installed) and fails if any button, field or link is under 44px.


## Motion style (Subtle, Lively, None)

One setting per site, in the editor under Colors and fonts → *Motion style*. It drives the only animation script on a site (`public/sitegen-motion.js`, built on the Motion library from motion.dev, version 11.11.17, MIT).

- **Subtle** (default for new sites): soft fade-ups as sections scroll in, quick number counters. **Lively**: bigger movement, the headline rises word by word, the hero photo slowly zooms, staggered cards. **None**: no animation, and the scripts are not even loaded.
- New sites start on Subtle; sites built from an industry template get a suggestion (restaurants, bakeries, events, groomers and similar → Lively; home care, insurance, law, dental and similar → Subtle; a style like Playful also suggests Lively). If a site's industry suggests something different from what it has, the editor offers it with one click. Advice that says an industry should stay calm caps the suggestion at Subtle.
- Pages carry only `data-animate="fade-up | stagger | hero | scene"` attributes and `data-count` (with `data-prefix`, `data-suffix`, `data-decimals`, `data-comma`) on numbers. Numbers like "24/7", "9-5" and years are left alone. There is no per-site animation code.
- **Bundled:** `public/vendor/motion.js` and `public/sitegen-motion.js` are served by your own server and copied into every export and Netlify publish, so a client site never loads code from a CDN. The Motion licence is in `public/vendor/LICENSE-motion.txt`.
- **Safe if anything fails:** content is fully visible without JavaScript. A tiny line in the page head hides animated items only while the script loads, and shows them after 3 seconds if it never starts. If the library is missing or the script throws, the page is shown as it is. Visitors with "reduce motion" turned on never see animation, and printing shows everything.
- **Preview switcher:** the dashboard Preview shows a Subtle / Lively / None bar with Replay, so you can show a client the difference. It exists only in your preview, never on the live site or in exports. "Use this style" saves the choice (the earlier version goes into history).
- Sites saved before this setting existed keep what they had: an old scroll animation becomes Subtle (Zoom becomes Lively), the cinematic hero becomes Lively, and sites with none stay on None.
- Floating shapes, emoji and doodles are separate "accents" and work alongside any motion style.

## Design guidance in the AI prompts

When an AI key is set, the industry's design guidance (the same advice the editor's "Suggested for…" panel shows) now goes into the AI prompts through `design-brief.js`:
- **Copy** (generate a site, "Rewrite with AI", build from a questionnaire): a short "Design direction" block with the site's look, the page flow that works for that business and what to avoid. It shapes tone and structure only; the rules against inventing facts are unchanged.
- **Chat-to-edit** (owner side only, not the client link): styles and color pairs to prefer, styles and options usually not recommended. If the AI proposes something against the guidance, such as a dark style for a salon, the proposal comes back with a "Heads up:" line. The change can still be applied, because the owner decides.
- Businesses with no guidance (the generic template) get exactly the prompts they had before.

## Publish history and rollback

Every publish keeps a copy of the site (newest 20). **Publish history** (editor top bar, and the Hosting page) lets you look at an old copy or roll back to it. A rollback first saves your current content to the editor's version history, so it can be undone. Netlify copies also make the matching Netlify deploy live again.

## Members area (visitor log-ins)

Editor → **Members area**. Turn it on to add a log-in page (`/members`) with members-only pages (text plus a button link). Sign-up can be open, approved by you, or invite-only. Manage people on the **Members** page: approve, add, turn off, remove, or make a one-hour reset link (shown once, for when email is not set up).

- Passwords are hashed with bcrypt; reset tokens are stored hashed and expire in an hour. Log-in errors are the same for a wrong password and an unknown email.
- The members page is `noindex`, `no-store`, excluded from the sitemap and `robots.txt`, and is **not** included in downloaded/static or Netlify exports (it needs this server).
- It is meant for ordinary members-only content, not high-security data.

## Client questionnaire: facts only, no invented claims

The questionnaire now also collects a price per service (optional), up to five "what makes us different" lines, up to six customer questions with the client's own answers, and a preferred tone of voice (alongside services, areas served and years in business).

When you click **Build the website**:
- The AI gets only those facts (`generateGroundedCopy` in `ai.js`). It may rephrase, but it must use exactly the client's services, may not add services, prices, numbers, places or claims, and must leave a field empty rather than pad it.
- `grounding.js` checks the result. If the draft contains a claim, number, place, filler phrase or service the client did not give, the AI is asked once more with the problems listed.
- Then every part of the site (AI wording and template wording alike) is scrubbed. Anything unsupported (for example a template line such as "licensed plumbers", "24/7 emergency service" or "Get a Free Estimate") is replaced with the client's own words or removed. The client's own about text, tagline, services (with prices), differences (shown as "Why choose us" cards) and FAQ always win.
- With no client FAQ, the FAQ section is hidden until real answers exist. The submission page lists what the client left out and what was replaced.

Spelled-out claims the client did make (for example "Licensed and insured") are allowed.


## Section library and industry blueprints

`library/` is a set of 52 ready-made sections (heroes, about, services, why-choose, numbers, reviews, pricing, FAQ, gallery, areas, calls to action, contact, logos), adapted from HyperUI (MIT) and styled with Tailwind v4. Every color, font, corner and shadow is read from the site's own theme variables (`--primary`, `--page-bg`, `--surface`, `--ink`, `--heading-font`, ...), so a section follows the site's style, brand color and dark styles instead of looking stock.

- **Use it:** in the editor, Home page layout -> "Industry blueprint". Each of the 45 industry templates maps to one of 9 blueprints (trades, professional, food, beauty, health, pets, events, fitness, general) that set which sections appear and in what order. Pick another blueprint, change any section's layout, leave sections out, or keep the original hero (needed for video and photo slides) in the "Industry blueprint" box below the layout menu.
- **Nothing invented:** a section is only drawn when the site has real content for it (`library/content.js`). No reviews yet means no reviews section; fewer than two stats means no numbers band; prices come from the service or its matching booking service.
- **Edit the templates:** change `library/src/*.ejs`, then `npm run build:library` (prefixes classes with `tw:`, lints out stock palette colors, rebuilds `public/sg-library.css`). The compiled CSS is committed, so running the site needs no build. `npm run build:css` rebuilds only the stylesheet.
- **Add a section:** write `library/src/<family>-<variant>.ejs` (first line `<%# Adapted from HyperUI (MIT) path %>` or `<%# Original %>`), register it in `library/index.js`, add it to a blueprint in `library/blueprints.js`, and a binder in `library/content.js` if it is a new family.
- **GrapesJS later:** `GET /library/blocks.json` (signed in) returns every section as a block with sample content; `library/grapes.js` builds it.
- **Licenses:** see `THIRD-PARTY-LICENSES.md`. Preline's code is not bundled (its extra license restricts resale); no paid blocks are used.

### Original variants (second round)

15 more layouts were added to the library: hero **Spotlight / Photo mosaic / Headline + numbers**, services **Bento / Hover reveal / Numbered rows**, reviews **Wall / Auto-scroll / Spotlight quote**, pricing **Rate card / Featured price**, FAQ **Side panel / Numbered**, call to action **Split panel**, contact **Contact cards**.

- **Where the designs come from:** they were drawn from scratch for SiteGen. 21st.dev has no blanket license (each author keeps ownership and terms vary per component), so no component code was copied or ported; it was used for design ideas only. Each template's first line says `Original`, and `tests/library.test.js` fails if a template mentions another library or framework.
- **Motion:** plain CSS or a few lines of vanilla JS in `public/sg-lib.js`. The review row scrolls with a CSS animation that pauses on hover or focus; the hover-reveal cards only hide the description on devices that can hover; the spotlight quote shows every quote until JavaScript adds the avatar buttons. `prefers-reduced-motion` turns the scrolling and transitions off.
- **Theme:** every variant uses the same theme variables as the rest of the library, so it follows all 20 styles, brand colors, fonts, corners and the dark styles. The test suite renders the blueprint home page in every style.
- **Picking variants:** on the dashboard's "generate a site" form, open "Section designs" to pick the hero, services, reviews, pricing, FAQ and contact layout (or leave Automatic) and tick "Build the home page from the industry blueprint". The editor's "Industry blueprint" box can change them later. Each industry blueprint has its own defaults, for example trades: Headline + numbers, Bento, Wall, Side-panel FAQ; food: Photo mosaic, Hover reveal, Auto-scroll, Contact cards; professional: Spotlight, Numbered rows, Spotlight quote, Numbered FAQ.
- **Not in a default blueprint:** Pricing layouts and the Split call to action are selectable (editor and `/library/blocks.json`) but not defaults, because services already show prices and every page already ends with a call-to-action band.

### Effects and per-section options

- **Site-wide effects now reach library sections.** The editor's emoji list, "Show the first emoji before section headings", "Hand-drawn touches" and "Cards lift on hover" apply to blueprint pages too (headings are marked `data-sg-head`; the rules live at the end of `library/tailwind.css`).
- **Per section:** in the editor's "Industry blueprint" box, open "Effects for this section" under any section to set its own heading text, an emoji before the heading, the hand-drawn underline (follow the site / on / off) and the background (default, alternate shade, or brand color). Brand backgrounds flip the section's text and cards to stay readable; they follow the theme in every style.
- **How it works:** choices are saved in `theme.bpSec` and cleaned by `cleanSectionOpts` in `library/blueprints.js` (real emoji only, known values only). `views/_lib-section.ejs` wraps each section and writes the data attributes the CSS reads.

### Parallax hero scenes and scrolling banner

- **Hero scenes:** three original, layered vector scenes (city skyline, rolling hills, palm shore) in the hero picker: "Parallax: city skyline / rolling hills / palm shore". Each has four depth layers that drift at different speeds as you scroll (`public/sg-lib.js`, one `requestAnimationFrame` loop, only while the hero is on screen). Sky and layer colors are mixed from the site's brand color and accent, so every brand color gives a different scene. With reduced motion the layers stay still. The artwork is inline SVG, so nothing is downloaded and static exports carry it.
- **Scrolling banner:** a new "Scrolling banner" section (brand ticker or quiet ticker). Its phrases come only from the client's own trust badges, service names and towns (at least three), never made-up slogans. Pauses on hover; stops with reduced motion.
- **Add a section:** the editor's "Industry blueprint" box now has "Add a section" checkboxes for any section the blueprint does not already include (banner, logos, pricing, numbers, and so on). Added sections slot in after a sensible neighbour and still disappear when the site has no content for them. Saved as `theme.bpAdd`.

### Your own sections (words, photos, or both)

In the editor, **Your own sections** lets you add as many sections as you like (up to 12) to the home page: a heading, words, up to four photos (upload, or choose from the free photo picker), an optional button, an optional emoji and a background (default, alternate shade, brand color).

- **Position:** each one is placed right after any section on the page (or under the top banner, or at the end). Several after the same section keep the order you set. If the chosen section is not on the page (no content), it goes at the end.
- **Layout is automatic:** words only gives a centered text column; one photo gives a big photo; words and one photo give a photo-and-text row (sides alternate); two or more photos give a grid. Or pick a layout yourself; a layout the content cannot fill (a photo grid with one photo) falls back sensibly.
- **Works on every home layout:** with the Industry blueprint the sections sit where you put them; with the older layouts they are added at the end of the home content, and the library stylesheet loads automatically.
- **Stored in** `sections.custom.items` (so they are versioned, backed up and exported with the site) and cleaned in `parseCustomFromBody` in `server.js`: image and button links must be safe URLs, empty rows are dropped.
- These sections are for the home page. For other pages (About, Services, FAQ and so on) keep using **Content blocks**.

## Motion levels (Standard, Premium, Showcase)

A second motion setting, in the editor under Colors and fonts → *Motion level*. **Motion style** (Subtle / Lively / None) is still the strength of the effects; **Motion level** says which effects exist. Motion style None turns every level off and no animation script is loaded.

| Level | What a visitor gets | What it loads |
|---|---|---|
| **Standard** (default for every site) | Sections fade or slide in as they scroll into view, number counters, a small lift on cards and buttons when hovered. | `sg-motion-lite.js`, about 6 KB, no library. Uses the Web Animations API and IntersectionObserver. |
| **Premium** | Everything in Standard, plus a hero that plays in order (headline, then subtext, then buttons), a thin scroll progress bar, gentle parallax on the hero, and small animated icons picked by industry. Lively keeps its word-by-word headline and slow photo zoom here. | The Motion library you already had, `sitegen-motion.js`, `sg-premium.js`. The icon player (lottie-web light, 168 KB, about 46 KB compressed) loads only when an icon is near the screen. |
| **Showcase** | Everything in Premium, plus a moving gradient behind the hero in your theme colours: Aurora, Mesh or Silk. | Adds `sg-shader.js` (about 9 KB). It starts after the page has loaded and fades in. |

- **GSAP was not added.** Motion already does staggers, scroll-linked effects and in-view triggers, and nothing here needed more. three.js was left out of Showcase on purpose: even trimmed it is several times heavier than everything else combined, and the shader presets give the same "wow" for far less. It can be added later as a lazy fourth preset.
- **Animated icons** (10, drawn for SiteGen and stored as Lottie JSON in `public/lottie/icons.js`, built by `node tools/build-lottie.js`): home, heart, bowl, cutlery, key, hammer, wrench, scissors, sparkle, scales. They are picked by industry (`ICONS_BY_TEMPLATE` in `motion-presets.js`): restaurants get a bowl and cutlery, home care a heart and house, real estate a house and key, contractors a hammer and wrench, salons and barbers scissors and a sparkle, law and accounting scales. The first is a badge above the hero headline, the second sits above the services heading. Their colours come from the site's theme, and fall back to the text colour if a theme colour would disappear into the badge.
- **LottieFiles:** nothing is taken from it. Their animations have per-animation licences (some need attribution or limit resale) and you sell sites to clients, so check the licence of each animation before ever adding one. See `THIRD-PARTY-LICENSES.md`. lottie-web itself is MIT and is bundled with its licence in `public/vendor/`.
- **Rules every level follows:** only `transform` and `opacity` are animated. Visitors with "reduce motion" on see the final state: no animation, no progress bar, no parallax, icons as a still picture, and the shader draws one still frame. Nothing starts hidden: items are hidden only after the script has started and are shown again if it fails, on print, or after 3 seconds if it never loads. Heavy scripts load late. The shader and icons pause when off screen (the shader also in a hidden tab). If WebGL is missing or lost, a plain gradient in the same colours is shown.
- **Theme colours:** the shader reads the site's colours and shifts them dark or light to match the hero text, so every style works, including Luxury dark.
- **Showcase uses the site's own hero.** A library hero design (Industry blueprint) is swapped for the native hero while Showcase is on, so the gradient has a place to go.
- **Existing sites:** a site with no saved level keeps its look: Lively becomes Premium, everything else Standard. New sites start on Standard.
- **Suggestions:** the editor shows a recommended level for the industry with a reason (law, accounting, insurance, dental, trades → Standard; real estate, home care, groomers, bakeries, photography → Premium; restaurants, salons and spas, weddings, fitness → Showcase). Showcase is never the default.
- **Preview:** the preview bar has Standard / Premium / Showcase buttons (the page reloads with `?tier=`, which only works in your logged-in preview) next to the strength buttons. "Use this" saves both. Nothing is saved until you press it, and the earlier version goes into history.
- **Quality check:** with Showcase on, the report warns when photos plus animation scripts come to over about 1.1 MB on the home page, and when the hero photo is over 350 KB (it is hidden by the animated background but still downloads). It suggests Premium or smaller photos.
- **Exports and Netlify publishes** include exactly the files the chosen level needs. Standard ships one small script; the others ship the Motion library, and the icon player and icons only when the page has an icon.
- **Tests:** `tests/motion-tiers.test.js` (levels, back-compat, suggestions, icon validity, script rules, quality rules) and the "motion levels" tests in `tests/api.test.js` (scripts per level, preview, editor, export, quality).

## Section size and photos

In the editor's Industry blueprint box, each section's "Size, photo and effects" panel now has:

- **Size:** *Height* (space above and below: Compact, Normal, Roomy, Extra tall), *Content width* (Narrow, Normal, Wide, Full width) and *Text size* (Smaller, Normal, Larger). Each has a box beside it for an exact number (pixels, pixels and percent); a number wins over the choice, and out-of-range numbers are limited (space 0 to 400 px, width 320 to 1920 px, text 70 to 160%). The text size scales every font size inside that section, so headings and body text move together.
- **Photo for this section:** upload or choose a photo, then pick where it goes: beside the text (left or right, small, medium or large), a band above or below the section, or behind the section as a background (Light, Medium or Dark overlay, and the section's text turns light). Side photos sit in a row on wide screens and stack on phones. They work best on text sections (FAQ, Why choose us, areas, call to action).
- **Your own sections** get the same size controls. Their photos are the ones you already add inside them.
- **Photos inside cards:** each *Why choose us* reason can have a photo (it replaces the check mark in the Industry blueprint), and each review can have a photo of the customer, shown as a round picture beside the name in all six review designs. Services already had photos on their cards.
- **Not on heroes or the scrolling banner.** Those have their own pictures and layouts.
- **Safe by design:** photo links must pass the same link check as every other photo (`javascript:` and similar are dropped), links are escaped, and quotes or brackets in a link cannot break out of the CSS. Sizes reach the page only as CSS variables (`--sg-pad`, `--sg-max`, `--sg-fs`).
- **Works with the Industry blueprint** (and on every layout for your own sections). The older home layouts keep their fixed spacing.
- **How it works:** `cleanSectionOpts` and `wrap` in `library/blueprints.js`, the wrapper `views/_lib-section.ejs`, the form `views/sections/_size-controls.ejs`, and the rules at the end of `library/tailwind.css`. Tests: the "round 6" tests in `tests/library.test.js` and "section size" tests in `tests/api.test.js`.

### Section colors and gradients

In the same per-section panel, **Background** now offers: Default, Alternate shade, Brand color, **Brand gradient** (your brand color fading to your accent color), **Your color** and **Your gradient**. Under it, pick Color 1 and Color 2 and a direction (diagonal, top to bottom, bottom to top, left to right, or a glow from the top). A gradient uses both colors; a single color uses Color 1.

- **Readable text:** the section's text, cards and buttons recolor themselves, light or dark depending on which gives better contrast across your colors (for a gradient, the worse end decides). The brand gradient uses the site's own "text on brand color" setting.
- **Your own sections** have the same options.
- **Safe:** colors must be six-digit hex values (the color picker sends those), anything else is dropped; a color or gradient choice without its colors is ignored. The picker always sends a value, so colors are stored only when "Your color" or "Your gradient" is actually chosen.
- A background **photo** (see above) wins over a color if both are set. Tests: "round 7" in `tests/library.test.js` and "section colors" in `tests/api.test.js`.

## Approved client styles (style index 1 to 12)

The 12 styles from the project's style index (`00-style-index.md`) are built in as SiteGen styles, in `project-styles.js`: Café, Terracota, Barbershop, Wellness, Luxury, Japandi, Workbench, Flat corporate, Inclusive, Organic, Energetic and Pop studio. In the editor they sit in their own group, "Approved client styles", in the Style list.

- **Fixes applied:** each style's "Fixes" note from the index is built in, for example Caveat, Bebas Neue and DM Serif Display are used for headings only with a readable body font, the wellness and Japandi buttons are dark with white text, the corporate blue is darkened just enough for white button text, and the industrial yellow is used for buttons and highlights only (its links and labels use the text color, and the quality check knows this).
- **Brand colors:** "Use this style's own colors" (under the Style list) fills in the style's brand and accent colors. If the client has brand colors, keep theirs instead: they replace only those two colors. Fonts, spacing, corners and the rest stay with the style.
- **Credit:** sites using styles 1 to 11 (from designmd.app, CC BY 4.0) carry this comment in the `<head>` of every page, live, in the zip export and on Netlify: `<!-- Design system adapted from "<STYLE NAME>" by designmd.app, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) -->`. Also list the same credit in the handoff notes given to the client. Pop studio (12, Devault) adds no credit; never give clients the style file itself, and don't sell these styles as a theme pack.
- **Suggestions:** the "Suggested for …" panel puts the approved style for the industry first (roofing and other trades → Workbench, bakeries and coffee shops → Café, law, accounting and insurance → Flat corporate, home care → Inclusive, and so on; see `APPROVED` in `industry-design.js`).
- **Tests:** `tests/project-styles.test.js`, the "approved project styles" test in `tests/api.test.js`, plus the existing contrast and phone tap-target tests, which cover every style.

## Editor layout and "Show the client"

**Editor.** The left side has four tabs: **Content** (business name, logo, page sections, your own sections, content blocks, trust), **Design** (style, layout, colors, fonts, motion), **Features** (booking, chat, calculator, payments, members, announcement, AI) and **Settings** (search, privacy, client access, pitch screenshot, version history). Every field is still one form, so autosave works the same on every tab. The 12 approved styles show as cards at the top of Design; all other styles are in the "All styles" list.

- **Before you publish** bar (top of the left side): counts what to fix. **Next** jumps to the next box that needs work, switching tab and opening it. "Show list" lists everything; click a line to go there.
- **Click to edit**: click a heading, paragraph, phone number or photo in the preview and the matching box opens on the left. Turn it off with the tick box above the preview to click links in the preview instead.
- **Desktop / Phone** above the preview. The motion switcher no longer covers the editor preview; it is still on the full preview ("Open" or "Preview").
- Top bar: **Preview**, **Show the client**, **Check quality**, **Business** (leads, reviews, bookings, payments, report, billing) and **Publish** with a small menu for View live, Publish online, Export and Publish history.

**Pitch mode** (`/sites/:id/pitch`): the site full screen. "Start the show" plays the entrance animation, then scrolls section by section and ends on a card with the business name and phone number (only if one is entered). Space pauses, arrow keys move, Esc stops, F is full screen. Motion can be "Premium, lively", "Showcase" or "as the site is set now"; this is for the show only and saves nothing. Desktop or Phone frame. **Old site vs new**: add a screenshot of the client's current site under Settings → Pitch mode, and Pitch mode shows a line you drag from their old site to the new one.

**Compare 3 designs** (`/sites/:id/compare`): the same words and photos in three styles side by side, starting with the styles suggested for the business type. Change any of the three, show them in each style's own colors or the client's, and press **Use this design** (the old look goes to Version history).

**Share a preview link**: from Pitch mode. A private view-only link (`/look/...`) the client can open on their phone, even before publishing. It is not indexed, shows how many times it was opened, and stops working when replaced or turned off. Forms on the shared preview do not send anything.

**New on the sites**
- Before and after pairs (Gallery box) are now a drag slider, with a short sweep the first time it scrolls into view. Keyboard and screen readers use it as a slider.
- **Open now badge** (Hours box, off by default): "Open now, until 5 PM" or "Closed now, opens 9 AM", worked out in the business time zone you pick. It shows in the dark top bar when there is one, otherwise in the menu bar. If any hours row can't be read for sure (e.g. "By appointment"), the badge is hidden and the editor says so (see `openhours.js`).
- **Reviews: moving wall** (Reviews box → Display): two slow rows of the owner's real reviews moving in opposite directions, pausing on hover. Needs 4 or more reviews; with "reduce motion" it becomes a plain scrolling row.
- Number counters were already there: the numbers in Trust & credentials count up as they scroll into view.

## Section layouts: more arrangements, Flip, photo shapes, shuffle

The section library has 31 more layouts, so two sites in the same style can look quite different. All are originals, follow every style, color and font, and only fill from the client's real content.

- **About:** Overlap (a text card over the photo's edge), Offset photos, Photo collage, Sticky photo, Frosted band, Editorial (a big number from the first trust number, or a big heading), Magazine (columns, a drop cap, a pull-quote from a real review, a small photo), Photo strip on top, Full photo with panel. Extra photos come from the client's own gallery.
- **Why choose us:** Zig-zag rows, Editorial numbers, Photo cards, Photo-background cards. **Services:** Zig-zag rows, Photo-background cards, Icon cards.
- **Gallery:** Masonry, Big plus small, Filmstrip (sideways scroll with arrows), Carousel with thumbnails. These show up to 12 photos.
- **Contact:** Map and details, Map with a floating card. The map is the client's own address; no address means no map.
- **Your own sections:** the nine About arrangements are also layouts for your own sections. A layout the photos can't fill (a collage needs 3) falls back to one that fits.
- **Flip:** a "Flip" tick box beside each blueprint section (and "Flipped" on your own sections) mirrors the layout, photo left becomes photo right.
- **Photo sides (auto-alternate):** on by default. When two sections with a photo on one side follow each other, the second is mirrored so the page zig-zags. Flip still works on top. Turn it off with "Photo sides: Keep each layout's own side".
- **Photo shape:** Normal, Arch, Circle or Soft blob, per section ("Size, photo and effects") or per own section.
- **Next layout:** the › button beside each section's layout list steps to the next one. In the editor preview, hover any section for ‹ Layout › and Flip buttons; the preview keeps its scroll position after it reloads.
- **Shuffle layouts:** in "Industry blueprint sections". Picks a new layout for every section (leaving out the parallax scenes), sets random flips and switches the home page to the blueprint. "Undo shuffle" puts everything back.
- **How it works:** templates in `library/src` (build with `npm run build:library`), sides and flippable layouts in `library/index.js` (`SIDES`), auto-alternate and the flip/shape options in `library/blueprints.js`, CSS at the end of `library/tailwind.css`, the carousel thumbnails in `public/sg-lib.js`. Tests: "round 8" in `tests/library.test.js` and "section layouts" in `tests/api.test.js`.
- These layouts are for the Industry blueprint home layout and your own sections. The older fixed home layouts are unchanged.

## Finishing touches: transitions, texture, dark mode, stickers, bento, timeline

All of these are off until you turn them on in **Design > Finishing touches** (code in `lookfeel.js`,
`views/_lookfeel-head.ejs` and `views/_lookfeel-foot.ejs`). Every moving part is switched off for visitors
who ask their device for less motion.

- **Moving between pages**: Fade, Slide or Morph. Uses the browser's built-in page transitions (Chrome, Edge,
  Safari 18.2+). Other browsers change pages as normal. Morph grows the photo or title the visitor clicked
  into the next page's heading.
- **Texture pack**: film grain, a floating frosted-glass header, soft shadows and stacked sections (each
  section slides over the last with rounded top corners). Each is a separate tick box.
- **Dark mode for visitors**: a moon/sun button in the menu (remembers the visitor's choice) or "follow the
  device setting". The dark colors are worked out from the brand color and checked for contrast. Styles
  that are already dark (Midnight, Luxury dark) skip it.
- **Hero stickers** (Hero section): up to three short phrases shown as tilted stickers on the hero, such as
  "Family owned". Only phrases you type; nothing is filled in for the client.
- **Timeline steps**: a "Steps" content block can use the Timeline look, where a line draws itself down
  the steps as the visitor scrolls.
- **Bento overview** (section library family `bento`, layout `tiles`, and the **Bento (modern tiles)**
  home layout): one grid of mixed tiles built only from the client's real content: a big photo, their
  numbers, top services, a review, a second photo and the phone number. It is skipped when there is a
  photo but fewer than two other kinds of content.

## Motion extras

Design > Motion extras (code in `motionfx.js`, `views/_motionfx-head.ejs` and `public/sg-fx.js`). Visitors who
ask their device for less motion (or a site with Motion style "None") always get a still, complete page.

- **Motion personality**: Glide, Bounce, Snap or Standard. "Automatic" picks one from the style (Luxury and
  Japandi glide, Pop studio and Energetic bounce, Workbench snaps). **Speed** and **bounciness** sliders fine-tune
  it. Both motion scripts read the result from `<body data-mtune>`.
- **Buttons**: shine sweep, arrow nudge on hover, press-in on tap, magnetic lean (computers only).
- **Headline movement**: grows bolder, stretches out, or letters settle in one by one. Bolder and stretch look
  smoothest with the new **Variable** font group (Roboto Flex, Bricolage Grotesque, Anybody, Fraunces, Unbounded,
  Big Shoulders Display, Inter Tight).
- **Scroll reveals**: photos unmask as they scroll in (CSS scroll-driven, no script).
- **Hand-drawn circle** around trust numbers, and a **highlighter** under a phrase you choose in the hero
  headline (Hero section).
- **Rotating word** under the hero headline (Hero section), cycling only through the client's own service names.
- **Photo hovers**: 3D tilt, black-and-white to color, or zoom. A service can also have a **Hover photo** (for
  example the finished job) that shows when the mouse is over its card.
- **Ken Burns** pan and zoom on hero photos, a **spotlight** that follows the mouse across the hero, town chips
  that **pop in** one by one, an animated **check mark** on thank-you and booking messages (on by default) and
  optional **confetti** when a booking is confirmed.
- New moving layouts in the section library: Services **Pinned story** (the photo stays pinned and changes as
  each service scrolls past) and **Stacking cards**, Gallery **Film reel** (the photo row glides sideways on its own, with a pause button)
  and a **Stacking cards** look for the Steps block.

## More effects

Design > Motion extras > **More effects**: twelve switches, each its own choice per site (code in `extrafx.js`; theme.xfx is the
list of ones that are on, body class `xfxon-<id>`). The CSS and a small script go into the page only when one is on,
so they also go out with the download. The ideas come from Codrops, Awwwards and CodePen demos and from what GSAP and
Motion One are used for, but the code is our own: GSAP's free license does not allow site-builder tools and
Animate.css's license is not MIT, so neither is bundled. Everything uses only the client's own words, name and photos.
Visitors who ask for less motion, or a site with Motion style "None", get the page as it was (the photo strip still
scrolls sideways, without the glide).

- **Text scramble**: the hero headline's letters shuffle like code, then settle (screen readers get the real words).
- **Sideways scroll**: services and gallery cards (4 or more) slide across while the section holds still. Only on
  screens 768px and wider, and only when the section fits on one screen; otherwise the section is left as it was.
- **Custom cursor**: a ring follows the mouse, grows over buttons and shows "View" over photos that open (mouse only).
- **Self-drawing icons**: line icons outside the hero draw their outlines as they scroll in.
- **Hover photo reveal**: pointing at a service name that has no photo beside it floats that service's own photo
  next to the mouse (mouse only).
- **Glowing border**: a light runs around the hero's and each call to action's first button and the featured price card.
- **Flip cards**: service cards with a photo and a description turn over to the description on the brand color
  (hover or keyboard focus; on touch screens a tap, except cards that are links, which open as before).
- **Nudging call button**: after 6 idle seconds the visible call button wiggles, at most three times per visit.
- **Rolling digits**: counters roll like an odometer instead of counting up (replaces the count-up for those numbers).
- **Speed-reactive banner**: scrolling banners speed up and lean while the visitor scrolls, then settle.
- **Photo-through-letters opener** (home page, needs a hero photo): the business name fills the screen in huge letters
  cut from the hero photo; scrolling zooms through the letters into the photo, then the page carries on.
- **Draggable photo strip**: the gallery becomes one row to grab and fling with the mouse (or swipe, or scroll with
  the keyboard). With both this and Sideways scroll on, the gallery is the strip.

Layouts that already move on their own (tickers, pinned stories, stacks, fans, reels, carousels, pinned blocks) are
left alone by Sideways scroll, the strip and the flip cards.

## Designer tools: Design lab, Brand kit, Device wall, Speed and polish score

All four are in the editor's top bar under **Design tools** (the score is on the **Check quality** page).

- **Design lab** (`/sites/:id/lab`, `designlab.js`): one Shuffle button rolls a new mix of style, font pair, colors, button and corner shape, and home-page section layouts. Lock any part to keep it while the rest changes; Back and Forward step through the last 40 mixes; the space bar shuffles. Colors come from the client's own brand color (matching sets) unless you choose "Anything that reads well"; every palette passes the white-text readability check. Styles are the recommended and approved ones unless you choose all styles, and styles the industry data says to avoid are never offered. Each mix is a live preview (`?lab=` on the preview URL, checked on the server); nothing is saved until **Keep this design**, which saves the old look in Version history first. Section layouts switch the home page to the industry blueprint (lock them to keep your home layout).
- **Scroll and text motion** (Design lab card, not shuffled): Scroll Smoother and Split text. Changes show on the preview at once (`?fx=` on the preview URL, nothing saved); **Save scroll and text motion** (`POST /sites/:id/lab/motion`) saves just these, with the old look in Version history, and Keep this design saves them too. The editor no longer has these controls, and an editor save keeps them as they are.
- **Brand kit** (`/sites/:id/brand`, `brandkit.js`, needs the optional `sharp` package): reads the logo (the site's own, or a file you choose) and suggests the logo's colors as a palette, a font pairing picked for the logo (plus the industry data's pairings), and a button shape from the logo's outline (square badge = sharp, round badge = pill, wordmark = gently rounded). It also makes a browser icon (32px, 180px home-screen icon, 512px) and a 1200 x 630 share picture (the home photo with the logo on a white card, or the brand colors with the logo; no words, so nothing is invented). Tick what to use and press Apply (Version history first). Kits can be saved and applied to any of your other sites; kits are private to your login. An SVG logo is stored as a PNG. New theme fields: `faviconUrl`, `touchIconUrl` (also editable under Business basics).
- **Device wall** (`/sites/:id/devices`): the live site on a wide screen (1920), laptop (1366), tablet (820) and phone (390) at once, as a showcase arrangement or side by side, with light, dark or brand-colored backgrounds. Scroll together keeps every screen at the same point of the page. **Download as image** uses the browser's tab sharing (choose "This tab") to save one PNG of the wall; Chrome and Edge support it.
- **Speed and polish score** (`score.js`): four 0-100 rings on the quality page (Speed, Accessibility, Search, Polish), worked out from the home page as served: page weight (photos, scripts, page, fonts), lazy photos, contrast, alt text, tap size, title and description length, structured data, placeholders still in [brackets], browser icon, share picture, tap-to-call and copyright year. It is an estimate, not a real-phone measurement. One-click fixes: brand color contrast, optimize photos, Motion level Showcase to Premium, browser icon from the logo, share picture; **Fix everything that takes one click** runs them all after saving the current version. Words, prices and contact details are never changed; those link to the editor.

## Image + Scrim hero (cosmic)

A hero layout (`library/src/hero-scrim.ejs`, colors in `scrimhero.js`, styles in `library/tailwind.css`, stars in `public/sg-fx.js`).

- **Where to choose it:** Content > Hero > **Hero design**. The choices are Classic, **Automatic**, or **Image + Scrim (cosmic)**. It is also a hero layout in the industry blueprint's section list (`hero/scrim`).
- **Automatic:** shows Image + Scrim for tech, education, creative and event businesses, and the classic hero for everything else. It matches the IT repair, tutoring, photography, wedding and party rental templates, plus business types such as "software", "coding school", "music lessons", "design studio" and "event planner". It keeps the classic hero when the hero has a video or photo slides. New sites start on Automatic. Sites saved before this round keep the classic hero until you change it.
- **Background:** the hero photo, whether uploaded, picked from Pexels with "Choose photo", or pasted as a URL. The focal point sets what stays in view. With no photo, a night-sky gradient in the brand colors is drawn instead.
- **Scrim:** a deep night color with a hint of the accent color. It sits behind the words (left, center or right, following Text position) and covers the whole hero on phones.
  - Its strength is never lighter than the opacity that keeps white text at 4.5:1 over a pure white photo, checked with `contrast.js`.
  - Medium and Heavy add more darkness on top of that minimum.
  - The gradient headline colors are checked against the same worst case. The button uses the brand color with the better of a light or dark label.
- **Feature cards:** the hero's own feature cards (up to 4, no invented text) show as frosted glass cards. Their tint is at least the readable scrim strength.
- **Layout:** Full width, which fades into the next section with `mask-image`, or Boxed, a rounded card.
- **Motion follows the Motion level:**
  - Standard: none.
  - Premium: a slow background zoom.
  - Showcase: the zoom plus twinkling stars on a canvas, paused off screen and in background tabs.
  - Visitors who ask for reduced motion get a still hero, as does the motion style None.

## Style Library (44 styles, 8 page blueprints)

Built from Leo's `sitegen-style-library.html` reference. Styles and blueprints are in `stylelib.js`, the home page renderer in `stylelib-page.js`, and the stylesheet in `public/sg-stylelib.css`.

- **What a style is:** each of the 44 styles is a normal SiteGen style with the id `sl-<name>`, so every page takes its fonts, colors, corners and buttons. On the home page it also draws its own hero and sections in the shape of its blueprint.
- **Blueprints:**
  - A Classic: features, quote, closing band.
  - B Cover: stats, features, gallery, closing band.
  - C Lead-gen: a quote form in the hero, then stats, features, quote, FAQ, closing band.
  - D Editorial: quote, features, stats, closing band.
  - E Showcase: photo mosaic, features, quote, service areas, closing band.
  - F Split screen: features, story, FAQ, closing band.
  - G Product: features, pricing, quote, FAQ, closing band.
  - H Magazine: a masthead, gallery, features, quote, closing band.
- **Only real content:** every section comes from the site's own fields. A section with nothing to show is left out. With no photos, the style shows a colored tile with an icon and no caption. None of the reference file's sample businesses, phone numbers, prices, quotes or captions are used.
- **Headline emphasis:** put words in [square brackets] in the hero headline to choose what gets the italic, color or underline. Without brackets, the last short phrase is used. Brackets never show on the page.
- **Colors:** the client's brand color replaces the style's accent. Accent colors used as text get a darker or lighter "ink" version that reaches 4.5:1. Button labels that miss 4.5:1 switch to whichever of light or dark text reads better.
- **Where to choose it:**
  - **Design tools > Style Library** (`/sites/:id/styles`) shows every style with this site's own hero. Filter by blueprint, light or dark, or "Suits this business". Click a style for the full home page, switch between desktop and phone, try another blueprint, keep the client's colors or use the style's, then **Use this style**. The current design is saved in Version history first ("Before Style Library").
  - Design > **All styles** has a "Style Library (44 styles)" group. When one is picked, a **Style Library blueprint** menu appears.
  - Home page layout **Automatic** or **Style Library page** uses the library home. Any other home layout keeps that layout with the style's look.
- **Contact form in the hero (Lead-gen):** it posts to the site's normal contact form, with the spam trap and the Netlify form attributes when needed. It only shows when the site accepts messages and the form mode is not a custom form. Otherwise the hero shows a panel or photo.
- **Motion:** sections use the site's motion level. The motion style None and reduced-motion visitors get a still page.
- **Static export** includes `sg-stylelib.css` when the home page uses it.
- **Tests:** `tests/stylelib.test.js` and the "style library" test in `tests/api.test.js`. The tap-target test also checks every library style.

## Atelier: Signature pieces (22, premium)

Built from Leo's `sitegen-atelier.html` reference. Each piece is one interactive home page made for one kind of business. The pieces are in `atelier/pieces/<id>.{css,js,html}` (the artwork's stylesheet, script and hero), the list and renderer in `atelier.js`, and the section layouts in `public/sg-atelier.css`.

- **The 22 pieces:** Undertow (surf school), Bloom (florist), Thermal (coffee roaster), Pressure (boxing gym), Firefly (wedding venue), Paper Cut (kids dentist), Prism (optometrist), Ink (tattoo studio), Vinyl (record shop), Radar (hurricane shutters), Dough (sourdough bakery), Foil (jeweler), Bubbles (car wash), Constellation (glamping), Letterpress (stationery and print), Ripple (pool builder), Terrain (land surveyor), Gears (watch repair), Paint (house painter), Kaleidoscope (kids art studio), Sand (landscape supply), Split-Flap (travel agency).
- **What a piece is:** a SiteGen style with the id `at-<id>`, labelled "Signature (premium)". The home page shows the piece's live artwork with the client's headline, intro and buttons, then the client's services, about, stats, reviews, gallery, FAQ, service areas and a closing band, in the piece's own fonts, colors and headings. Other pages use the style's normal look.
- **Own colors:** the pieces are art-directed, so they keep their colors on the home page. The client's brand color is not applied there.
- **Only real content:** the hero panels and boards are filled from the site's own fields. Thermal's panel shows priced services (or contact details), Split-Flap's board shows the services and prices (with no prices, it shows one service column), Radar labels its map with the site's city and service areas, Vinyl's label and Letterpress's phrases use the business name and headline. The reference file's price calculators (Foil, Paint, Sand), sample boards, cities, storm label, prices and claims were left out because they were made up.
- **Industry default:** a new site generated for one of these 22 kinds of business starts on its piece, with the template's content. Older sites are not changed. Other businesses keep the normal defaults.
- **Where to choose it:**
  - **Design tools > Signature pieces** (`/sites/:id/signature`) shows every piece, with the one made for this business first. Filter by light, dark or "Made for this business". Click a piece for the full home page on desktop or phone, then **Use this piece**. The current design is saved in Version history first ("Before Signature piece").
  - Design > **All styles** has a "Signature pieces, premium (22)" group.
  - Home page layout **Signature page** (or Automatic) uses the artwork home. Any other home layout keeps that layout with the style's look.
- **"Premium"** is a label for now. The app has no paid tiers for styles.
- **Motion:** the artwork runs in the browser. Reduced-motion visitors and the motion style None get a still frame.
- **Static export** includes `sg-atelier.css` when the home page uses it.
- **Tests:** `tests/atelier.test.js` and the "atelier" test in `tests/api.test.js`. The tap-target test also checks every piece.

## Faster editor: type on the page, undo, section list, quick search

- **Instant preview:** a change saves after 0.7 seconds and the preview updates in about a second. The new page loads hidden behind the current one, at the same scroll spot, then takes its place, so there is no blank flash. Entrance motion is skipped in that refresh (the preview URL gets `calm=1`, which only the editor preview reads).
- **Undo and redo:** the arrow buttons next to the site name, or Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y also redoes). Inside a text box the browser's own undo for that box comes first. Every change is a step: saves made while you keep typing (less than 2.5 seconds apart) count as one, and named changes (a Style Library pick, an AI rewrite, a restore) are always their own step. A new change clears redo. The last 50 steps each way are kept per site (table `site_undo`). Version history still holds the bigger snapshots.
- **Type on the page:** with Click to edit on, click a headline, heading, short text or button label in the preview and type right there. The matching box in the panel updates as you type. Enter (for one-line boxes) or Done finishes, Escape cancels. Text that the design draws differently (split into lines, repeated, or several paragraphs) opens its box in the panel instead.
- **Highlight words:** while typing the home headline on the page, select words and press **Highlight words**. They are stored in [square brackets], which every hero now shows as italic highlighted words (the brackets never show).
- **Section list:** on the Content tab each page section is one row with move up, move down and Hidden. Click a row to open it; the others close. Clicking something in the preview opens its section. **Open all sections** brings back the long view.
- **Quick search:** Ctrl+K (or the Search button by the tabs) finds any page section, box, settings group or Design tools page by name. Arrow keys and Enter open it.
- **Tests:** the "editor: undo and redo" and "editor: the refreshed preview" tests in `tests/api.test.js`.

## Blocks: mix and match sections from any style

- **Where:** Design tools > **Blocks** (`/sites/:id/blocks`), or Ctrl+K "Blocks". The home layout "Mix and match blocks" in the editor shows the saved blocks.
- **What a block is:** any section design SiteGen has, from three sources: the section library (drawn in the site's own style), any of the 44 Style Library styles (each section on its own), and the 22 Signature pieces (their artwork hero and their sections, always in the piece's own colors). Style Library blocks use the client's brand color unless "Use this style's accent color" is ticked.
- **The page:** the left column lists the home page's blocks in order. Click one (there or in the preview) to select it, drag or use the arrows to reorder, duplicate or remove it. Undo (or Ctrl+Z) steps back through changes on this page. The first time, the list starts from the home page the site has now.
- **The library:** the right column shows every design of one kind (Hero, Services, Reviews...) with a live thumbnail drawn from this site's content. **Add below** puts it after the selected block; **Swap in** replaces the selected block. Designs the site has no content for yet are hidden unless "Show designs this site has no content for" is ticked.
- **Saving:** nothing changes on the site until **Use on the home page**. That saves the old design to Version history ("Before blocks change") and switches the home layout to Mix and match. Up to 30 blocks. The other pages keep the site's style.
- **Saved blocks and recipes:** "Save selected block" and "Save page as a recipe" keep a block or a whole block list under your account (table `mix_saved`, 100 at most), for use on any site. Content always comes from the site it is used on.
- **Content rule:** a block only shows the site's real content. A block with nothing to show is left out of the page.
- **Code:** `mixpage.js` (clean, catalog, seed, render), `views/blocks.ejs`; the preview takes `?mix=<blocks JSON>` and `&bare=1` (no header or footer, for thumbnails). Tests: `tests/mixpage.test.js` and "blocks: mix and match" in `tests/api.test.js`.

## Arrange: resize and move on a snap grid

- **Where:** on the Blocks page, switch the top bar from **Pick** to **Arrange**, then click anything in the preview: a heading, text, photo, button, list, or (with "Select the box around it") a whole group or column.
- **Handles:** the blue bar on the right edge sets the width on a 12-column grid (columns show while you drag). The round **A** sets the text size. The cross moves the item among its neighbours (an orange line shows where it lands; in a row it moves sideways, so a photo and its text can swap sides). The two bars at the top and bottom of the section set its spacing in 8px steps. The left panel has the same changes as buttons, plus alignment, photo shape (square, tall, wide, circle), a focus point for photos, and hide on phones.
- **Phones:** widths only apply on tablets and computers; on phones everything stacks full width, and text sizes shrink with the screen (down to about 60%, never under 14px). In **Phone** view, moves change the order on phones only, and any item or whole block can be hidden on phones.
- **Saved as data:** each block keeps its arrangement (`lay` in `theme.mix`): the paths of the items it changed, written as tag and child number from the block down, with the settings. `mixpage.arrangeCss` turns them into one scoped stylesheet (`<style id="sg-arrange">`), so the live site, the download and Netlify all show it with no script. If an item is no longer there (the content changed), its setting simply doesn't apply. Swapping a block for another design starts its arrangement fresh; duplicating copies it. Reset buttons clear one item or the whole block. Undo covers every change.
- **Moving words:** type on the page in the editor (Click to edit) and use cut and paste to move a sentence within a box or to another box.
- **Not built:** free placement anywhere in the hero (the optional part of the plan). Everything snaps to the grid instead.
- **Tests:** "arrange" in `tests/mixpage.test.js` and "blocks: arranged sizes" in `tests/api.test.js`.

## Showcase strip hero

- **Where:** Hero setup, **Hero design: Showcase strip**, or the "Showcase strip" hero on the Blocks page.
- **Gliding photos:** the site's own photos (hero, service photos with the service name, About, gallery; each once, up to 10) glide past as tilted cards beside the headline. It needs at least 3 different photos; with fewer, the headline is centered with no strip. A pause button (44px) stops it, and it also stops on hover or keyboard focus. Visitors who turn motion off (or Motion style "None") get a still row they can swipe.
- **Proof bar:** underneath, up to three panels: the first trust number (or, with none, the average star rating from 3 or more rated reviews), the certification logos or badges one after another, and up to 5 real reviews one after another. Each panel only shows when the site has it; with none, there is no bar.
- **Code:** `library/src/hero-showcase.ejs`, `glidePhotos` and `proofBar` in `library/content.js`, the CSS at the end of `library/tailwind.css`, the pause button and `[data-sg-cycle]` rotators in `public/sg-lib.js`, `scrimhero.js` (`design: 'showcase'`). Tests: "showcase hero" in `tests/scrimhero.test.js` and "Showcase strip hero" in `tests/api.test.js`.

## Editor: always clear what you're editing

- **One section at a time:** click a section in the list (or click it on the page) and the panel shows only that section, under a dark header "Editing: Testimonials" with an **All sections** button back to the list. Clicking a tab (Design, Features, Settings) also goes back. "Open all sections" still shows everything at once.
- **Outlined on the page:** the section being edited gets a blue outline on the preview with an "Editing: ..." tag that stays below the site's sticky menu. Opened from the list, the preview scrolls to it; if it isn't on the page being previewed (a classic home page without reviews, say), the preview switches to that section's own page.
- **Settings in titled boxes:** each section's settings are grouped into boxes with a title (Words, Background photo, Button, Your reviews, Social links...). The boxes are set per section in `GROUPS` in `views/editor.ejs`; a section not listed stays as one run of fields.
- **Point to find it:** pointing at a box in the panel (or typing in it) lights up the words or photo it controls on the page in amber, and scrolls the preview to it when you click into the box.
- **Save label:** the top bar shows "All changes saved" (green), "Unsaved changes" (amber), "Saving…" (blue) or what went wrong (red).
- **Tests:** "editor clarity" in `tests/api.test.js`.

## Card arrangements and footer designs

- **Card arrangement:** Services, Why choose us, Testimonials and Gallery each have a **Card arrangement** box with picture tiles: As designed, Two across, Three across, Four across, One per row, Big first card, Staggered, Zigzag, Side-scrolling row and Scattered. (Gallery has no One per row or Zigzag.) It re-lays the cards on the classic home and pages and on section designs that show cards in a grid. Showpiece designs with their own layout (film reel, wall, spotlight, Signature pieces) keep theirs. On a phone every arrangement falls back to one column, except the side-scrolling row, which swipes.
- **Reorder:** the up and down arrows beside each service, review, reason, gallery photo, FAQ and hours row move it and save.
- **Footer design** (Design tab): Classic columns, Centered, Light, Brand color with button, Split panel and Giant name. Each uses only the site's own name, links, phone and main button; nothing is made up.
- **Saved as:** `theme.cards` (`{ services, why, testimonials, gallery }`) and `theme.footerStyle`. Grids are tagged with `data-sg-cards`; only the rules in use are printed in `<style id="sg-cards">`.
- **Code:** `cardlayouts.js`, `views/sections/_cards-pick.ejs`, the footer in `views/public-site.ejs`, the Footer design box and arrows in `views/editor.ejs`. Tests: `tests/cardlayouts.test.js` and "card arrangements and footer designs" in `tests/api.test.js`.

## Scroll-through photos hero

- **Where:** Hero setup, **Hero design: Scroll-through photos**, or the "Scroll-through photos" hero on the Blocks page.
- **What it does:** the hero photo and the extra hero photos (each once, up to 8) fill the screen. As visitors scroll down, the photos step forward one at a time, and they go back when visitors scroll up, while the headline and buttons stay pinned. Dots on the right show which photo is up and jump to it. Only the first photo loads up front; the next ones load as they come up.
- **One photo or none:** one photo makes a still hero; none shows the night-sky gradient in the site's colors. Visitors who turn motion off (or Motion style "None") get one photo and switch with the dots. The text side always gets the readable scrim from `scrimhero.js`.
- **Code:** `library/src/hero-scroll.ejs`, `scrubPhotos` in `library/content.js`, the CSS at the end of `library/tailwind.css`, the scroll script in `public/sg-fx.js`, `scrimhero.js` (`design: 'scroll'`). Tests: "scroll-through hero" in `tests/scrimhero.test.js` and "Scroll-through photos hero" in `tests/api.test.js`.

## Questionnaire as a PDF

- **Where:** Client questionnaires page (`/intake`), the **Questionnaire as a PDF** box.
- **Download the PDF:** a fillable PDF with the same questions as the online form (business, services, story, FAQ, contact details, look and feel, goals and extras, about you). The client's business name can be printed at the top. Clients fill it in on a computer (Adobe Reader, Mac Preview or a web browser), or print it and write by hand; the choices are printed under each pick-one question for that.
- **Upload a filled-out PDF:** the answers appear under "Answers received" and open on the usual review screen, where you check them and press **Build the website**.
  - Our fillable PDF is read from its form fields, exactly as typed, with no AI and no internet needed.
  - A scan, a handwritten copy or any other questionnaire PDF is read by the AI when `ANTHROPIC_API_KEY` is set. The review screen then says to check every answer against the PDF.
  - Either way the answers go through the same cleaning as the online form (`intake.clean`): only what the client wrote is kept, a bad email is dropped, and nothing is filled in by guessing.
- **The original PDF** is kept with the answers, beside the database in `data/intake-pdfs/` (never in the public uploads folder). Only the owner can open it from the review screen, and deleting the answers deletes it.
- **Code:** `intakepdf.js` (writing the form, reading form fields including compressed object streams, the AI reading), the routes after `/intake` in `server.js`, `views/intake.ejs`, `views/intake-view.ejs`. Tests: `tests/intakepdf.test.js` and "questionnaire PDF" in `tests/api.test.js`.

## Scroll effects: ink-in headings, card fan, grid zoom, word ticker, fanned prices, floating tags

- **Ink-in headings** (Design, Motion extras, "Section headings fill in word by word"): `theme.inkFx`, body class
  `fx-ink`. `public/sg-fx.js` wraps the words of each section `h2` (not the hero, header, nav or footer) and lights them
  as the heading moves up the screen. With reduced motion or the motion style set to None the words are never wrapped.
- **Card fan** (`gallery/fan`): up to 5 gallery photos start as one stack and fan out as the section scrolls into view.
- **Grid zoom** (`gallery/zoom`): a 3, 5 or 7 photo collage (whole columns) whose middle photo grows to fill the screen
  while the side photos slide away, pinned while the visitor scrolls through it.
- **Word ticker** (`services/ticker`): the service names in huge letters on the brand color, sliding past with a small
  photo of each service between them. Pauses on hover or focus and has a pause button; with motion off it wraps, still.
- **Fanned cards** (`pricing/fan`): the 2 or 3 priced services like a hand of cards, the middle one raised on the brand
  color. Stacks straight on phones.
- **Floating tags** (Motion extras, `theme.floatTags`, body class `fx-tags`): speech-bubble labels beside the Card fan
  and Grid zoom photos. They only ever show the client's own service names (up to 3), never made-up text.
- The scroll-linked layouts carry `data-sg-progress` ("pin" for Grid zoom); `sg-fx.js` sets `--p` from 0 to 1. Without
  the script or with motion off `--p` is never set and the CSS shows the finished, still layout.

## Number cards with moving objects (`stats/objects`)

Home layout list, Stats "Moving objects": the trust numbers as big figures in soft cards, each with a small object
drawn in the site's brand colors that loops in the corner. The object comes from the number's own label
(`statKind` in `library/content.js`): years -> ticking clock, reviews/ratings -> popping stars, towns/miles -> bouncing
map pin, homes/customers -> a house whose window lights up, jobs/projects/roofs -> turning gear, anything else -> a
soft pulse. Only the site's real numbers are used. Still for visitors who ask for reduced motion or with motion set to None.

## Floating 3D shapes hero (`hero.design = 'shapes'`, library `hero/shapes`)

Hero, then Hero design, "Floating 3D shapes": glassy shapes drawn by the page in the site's brand colors (a glass
sphere, a turning CSS 3D cube, a tilted ring, shards, a small accent ball and two cable lines) behind a big headline on
a brand-tinted light background. With motion allowed (`.on`, added by `sg-fx.js`) they drift, lean toward the mouse
(`--mx`/`--my`) and spread apart as the visitor scrolls (`--sy`). A typing cursor blinks after the headline. A ring of
text spins around a round button: with a background video file (.mp4/.webm) it plays that video in a dialog, otherwise
it links to the main button and spells its words. The first trust number shows as a pill beside it. No video or photo
is needed, and everything is still for visitors who turn motion off.

## Company name colors (`theme.nameFx`, `theme.nameColor`, `namefx.js`)

Design, then Colors, "Company name color": the business name in the header and the footer can be one color of the
owner's choice (or the Primary color), a shine of the brand colors that sweeps across it (`shimmer`), or a slow change
from one brand color to the next (`cycle`). `namefx.backgrounds` works out what the name sits on for the style (the
page or the style's own header color, the footer band, the visitor dark mode page) and `namefx.palette` moves each
color just far enough toward black or white to reach 4.5:1 there; a brand with one color gets a second shade of it.
Brand colors too close to tell apart count as one, so the name always visibly changes. The shine blends in OKLCH where
the browser supports it. Over a hero photo (see-through header at the top) the name uses light tints with a soft
shadow, and visitors who turn motion off see it still.

## Brand wall block (`blocks.items[].type = 'wall'`, `brandwall.js`)

Blocks, "+ Brand wall (moving cards)": a tilted wall of cards in five columns that drift up and down in turn, inspired
by brand-board reels but drawn from the site's own content only: the name or logo, the hero headline and short
subheadline, service names (with their icons), photos (gallery, services, hero), reviews of 120 characters or less,
trust numbers and badges, the brand colors as swatches and an "Aa 123" sample in the heading font, plus any short
photos and lines the owner adds to the block (their photos come first). The block's `side` holds
`size:tilt:speed:content` (Short/Medium/Tall/Full screen, Straight/Gentle/Strong, Slow/Normal/Fast, and `all` or `mine`;
`mine` shows only the owner's photos and lines with the name and brand colors). The body holds the owner's lines and
photo links one per line (`brandwall.ownContent` tells them apart); the editor shows them as a text box and photo rows. The heading and button sit on a frosted card in the middle; with neither
the wall stands alone. Like every block it goes on any page, near the top or lower down. Phones get three columns,
visitors can pause it (`[data-sg-wall-pause]` in `sg-fx.js`), and it is still for anyone who turns motion off.

## Photo hero with the header blended in (`hero.design = 'blend'`, library `hero/blend`)

Hero, then Hero design, "Photo with the header blended in": the background photo fills the top of the page and the
header sits on it see-through (the page adds `hdr-transparent` on the home page while this hero shows; it turns solid
on scroll as before). A dark fade tinted from the brand (scrimhero.js `--sc-rgb`) runs from the left and over the top,
so white words stay readable on any photo; phones get an even fade. A small letter-spaced label (`hero.eyebrow`, or the
kind of business and the city) sits over a big headline whose [bracketed] words are set in an italic serif (Instrument
Serif, loaded only with this hero), then the subheadline and a round pill button in the brand color, the accent color
or a bright lime (`hero.pill`), each with readable words. With no photo a deep brand gradient takes its place.

## Added sections and extra pages (fix)

- Sections ticked under **Add a section** (in Industry blueprint sections) now show on every home layout. With the Industry blueprint layout they take their place in the order; with any other layout they go near the end of the home page, before your own sections. A section already in a Mix-and-match page is not drawn twice, and a section still shows only when the site has real content for it.
- An extra page with only a title (or only text) is now kept when saving instead of disappearing. It says "Not on the site yet" until it has both, then it goes in the menu.
- Extra pages are listed under **Previewing** above the preview, and the list updates as you save.

## Blended photo hero on a Blocks page (fix)

- A Blocks page (home layout "Mix and match") draws its own first block as the hero, so a hero design picked in hero setup used to be ignored there. Now the two stay the same: picking a hero design (scrim, showcase, scroll-through, 3D shapes or blended) in hero setup changes the Blocks page's hero block, and picking a hero block on the Blocks page changes the hero setup to match.
- When the blended photo hero is the first block, the header goes see-through over the photo, just as it does with the hero setup.
- With the blended hero, the phone strip above the header also sits on the photo instead of a dark band.

## Header color

- Design tab, next to the header options: **Header color** can be the style's own, White, Dark, Brand color, Accent color, a color of your choice, or **Clear** (no bar: the page shows through, and it turns the page's own color once a visitor scrolls so the menu stays readable).
- The menu links, the company name and the button change to stay easy to read on the bar. A button that would be the same color as the bar takes the bar's text color instead, and company name colors are checked against the header color.
- With a see-through header over a hero photo (including the blended photo hero), the header stays clear at the top of the page and takes the chosen color once the visitor scrolls.
- Code: headercolor.js (theme.headerBg, theme.headerColor).

## Card cascade block

- Content tab, Blocks: **+ Card cascade (cards deal into a stack)**. Slide-shaped cards deal in one after another into an overlapping zig-zag stack, hold, then clear and deal again.
- The cards are the brand wall's cards: the site's own name or logo, headline, services, photos, short reviews, numbers, badges and colors, plus the owner's own photos and lines (or only those). Up to 10 cards.
- Choose the height (short, medium, tall, full screen), the speed, and the page and place (top or bottom) like any block. A heading and button sit beside the cards. Visitors can pause it, and it shows the finished stack, still, for anyone who turns motion off.
- Code: cardcascade.js; the card markup is shared with the brand wall in views/_wall-card.ejs.

## Photo banner block

- Content tab, Blocks: **+ Photo banner (rounded photo, words on a fade)**. A rounded photo card set into the page, with the heading, a sentence or two and a pill button on a soft fade in the brand's dark tone, so white words read on any photo.
- [Square brackets] around words in the heading set them in an italic serif. Without a photo of its own it uses the hero photo.
- Choose the words side (left or right), the height and the button color (brand, accent or lime), and the page and place like any block. On phones the words sit at the bottom of the photo.
- Code: photobanner.js.

## Moving your own sections, blocks and extra pages (fix)

- Moving, copying or deleting a content block now saves straight away (before, the change waited for the next typed edit).
- Your own sections: ↑ ↓ move the section on the page. Past another of your sections in the same spot, otherwise one step through "Where it goes". On a Blocks home page, "Where it goes" lists the page's blocks in their order and is followed on the page (before, your sections always sat at the end), and steps skip sections the page doesn't show.
- Content blocks: ↑ ↓ move past the next block in the same part of the same page, otherwise between "Lower on the page" and "Near the top of the page". On a Blocks home page, "Near the top" means right under the top banner.
- In the preview, pointing at one of your sections or a block shows ↑ ↓ on the dark bar, and clicking any part of it opens its row. A photo banner without a heading shows a note in your preview only.
- Extra pages have ▲ ▼ to set their order in the menu.
- Code: views/sections/_custom.ejs, views/editor.ejs (moveBlock, the preview bar), views/_blocks.ejs (data-sg-blk), views/public-site.ejs (Blocks page placement), mixpage.js (data-mix-f).

## Content blocks in Page sections and on the Blocks screen

- Each content block has a fixed id (`block_id`; older blocks get one the first time the editor or the Blocks screen opens).
- Page sections: every content block has its own entry (Content block · kind: heading) holding its editor. Drag it or use the arrows to reorder it in the list, tick Hidden to keep it off the site, or delete it. New blocks made in the Content blocks box open in a new entry. The list order is saved as `layout.items` (with `blk:<id>` keys); `layout.order` keeps only the page sections.
- Blocks screen: on a Blocks home page, the home page's content blocks are blocks of the page (`{ k: 'blk', v: id }` in `theme.mix`). A new one joins right under the top banner if set near the top, otherwise at the end. Move or arrange it like any block. Taking it off the page hides it (it stays in the editor), and adding it back from "Your content blocks" shows it again. "Edit this block's words and photos" opens its entry in the editor (`?open=blk:<id>`).
- In the editor, a home block's ↑ ↓ (and the preview bar's) move it among the Blocks page's blocks.
- Code: server.js (ensureBlockIds, syncMixBlocks, safeParseLayout items), mixpage.js (k 'blk', ownBlocks), views/_blocks.ejs (only, skipIds, hidden), views/editor.ejs (block entries), views/blocks.ejs.

## Scroll Smoother

- Design lab, **Scroll and text motion** card: **Scroll Smoother**. "Section links glide" eases a same-page link (menu, button) to its section and stops just under the header. "Whole page" also turns each turn of the mouse wheel into a short glide. **How it feels**: quick, normal, or soft and slow.
- Touch screens keep their own scrolling, boxes that scroll by themselves are left alone, and visitors with reduced motion get plain scrolling. Inline script, so it works in the download.
- Code: smoothscroll.js (theme.smoothScroll ''|links|page, theme.smoothFeel).

## Split text animation

- Design lab, **Scroll and text motion** card: **Split text animation** on the main headline or on every heading. Split into letters, words or lines; effect slide, fade, grow (scale), flip over (invert) or uncover; plays once when it comes into view or follows the scroll. Set the duration per piece, the delay between pieces, and the start X and Y in px.
- Screen readers read the whole heading (aria-label); visitors with reduced motion see still headings; headings on moving card walls and Signature/Style Library blocks are left as they are.
- Code: splittext.js (theme.splitText ''|hero|headings, splitBy, splitFx, splitPlay, splitDur, splitGap, splitX, splitY).

## Pin elements

- Each content block (last row of its settings) and each block on the Blocks screen (Pin, under its name) can be pinned on its own: held in place for half, one, two or three screens of scrolling, or kept in place while the next sections slide over it.
- **Its cards stack over each other as you scroll**: the repeated cards in a block or section (services, features, prices, team) line up in one column and each one stops a little below the one before, so the next card slides over it and the earlier ones peek out at the top. On a wide screen a card's photo sits beside its words, and photos are kept under about half a screen tall.
- **One side (the photo) stays put while the other side scrolls**: in a two-sided block or section, the shorter side holds while the longer side scrolls past. On a phone, where the sides sit one above the other, it scrolls as normal.
- **Its cards make a pile** (deck): the cards sit stacked like a deck, a little fanned behind each other. Swipe or drag the top card away, press the arrows under the pile, or use the arrow keys to deal the next card; the count shows where you are.
- **Its cards fan out** (fan): the cards overlap in a row; pointing at one (or tapping it, or tabbing to it) lifts it to the front. On a narrow screen the fan becomes a pile.
- A pinned part stops just under a header that stays at the top; one taller than the screen scrolls to its bottom first. Plain CSS sticky positioning with a small script for where it stops; works in the download.
- Code: pinfx.js (block.pin and mix item pin: ''|hold:50|hold:100|hold:200|hold:300|cover|stack|side|deck|fan). Stack, side, deck and fan find the cards (the box with the most look-alike children) and the two sides in the browser, so they work with any block or library section.

## Color film

- A see-through layer of color over a whole block or section: each content block (last row of its settings: strength 10 to 80%, in the brand color or a color you pick) and each block on the Blocks screen (Color film, under Pin).
- "Brand color" is the site's main color (the Brand kit takes it from the logo), so the film follows a brand change. Clicks still reach buttons and links under the film.
- Code: filmfx.js (block.film and mix item film: "brand:<n>" or "#rrggbb:<n>").

## Section height

- Any block can be drawn shorter or taller than its design: **Height** on each block of the Blocks screen (built-in sections, content blocks, your own sections and the hero) and in each content block's settings in the editor. Choices: Normal, Shortest, Shorter, Taller, Much taller, Full screen (at least one screen tall, content centered).
- It changes the space above and below the content (a little less on phones); the hero on a Blocks page changes its height instead. Sections on a blueprint home and your own sections also keep their exact pixel Height under "Size, photo and effects".
- Code: heightfx.js (block.height and mix item height: ''|tight|compact|roomy|tall|screen).

## Photo words

- Each content block (Photo words, under Pin and cards) and each block on the Blocks screen can lay its words over its photos, on a dark fade so they stay readable: **shown when pointed at** (the words rise and the photo zooms a little; on a touch screen they show from the start) or **sliding in as you scroll** (one card after another).
- Works on cards with photos (services, team, features) and on a single photo beside words. Visitors who turn motion off see the words in place.
- Code: imgfx.js (block.imgfx and mix item imgfx: ''|hover|scroll).

## Scroll elements

- Design lab, **Scroll and text motion** card: sections fade, slide up, slide in from the sides, zoom, blur into focus or flip up as they scroll into view. Choose whole sections or each heading, text, photo and card one after another; the speed (quick, normal, slow); and whether it plays once or every time.
- The top section (hero) is left alone, and the motion style's own reveals stand down while this is on so nothing moves twice. Everything shows without the script, and visitors who turn motion off see the page still.
- Code: scrollfx.js (theme.scrollEl, scrollElWhat, scrollElSpeed, scrollElPlay; fields theme_scrollEl...).

## Video mask

- A video block with a direct .mp4 or .webm file can play its video through a shape instead of a plain player (Look, in the block's settings): through the heading's letters, in a circle, arch, soft blob or diamond, or opening from a small window to full width as you scroll.
- A masked video plays muted, on a loop, without controls; visitors who turn motion off see its first frame. YouTube and Vimeo videos stay a plain player. With the letters look the heading is still read out by screen readers.
- Code: videomask.js (block.side on a video block: auto|text|circle|arch|blob|diamond|grow).

## Word styling

- In any text box in the editor, select some words (or click inside words already styled) and press **Aa Style words**: size (smaller, big, bigger, huge), font (any font on the font list), color (brand, accent or one you pick), bold, italic. **Remove styling** puts the words back to plain.
- In the box the words look like `{{best pizza|bigger|Playfair Display|#e11d48|bold}}`, which can also be typed by hand. Typing on the preview keeps the styling.
- The page is rewritten once after it is drawn (`wordstyle.apply`, also in the download): in the page's text the words get a styled `<span class="sg-w">`; in the tab title, photo descriptions, share and search details the markers come off. Fonts used this way are loaded with one extra Google Fonts link.

## Shared site styles (lighter pages)

- The styles every site shares (about 100 KB) live in `public/sg-site.css` instead of being written into each page. A page links it as `/sg-site.css?v=<version>`; the version changes when the file does, so browsers keep it for a year and fetch it once for the whole site. Pages are about 100 KB smaller (the Colr x WaVe home went from about 250 KB to 145 KB).
- What differs per site (colors, fonts, corner and button shapes, the style's own rules) stays inline as CSS variables at the top of the page. The button roundness is the `--btn-r` variable.
- A download (Export) carries `sg-site.css` next to the pages.
- To change a shared style, edit `public/sg-site.css` (not public-site.ejs).
- One shared scroll listener: the page head defines `sgOnScroll(fn)`, and every scroll effect (sticky header shadow, pins, video grow, split text, ink headings, progress bars, scroll-through hero, hero parallax) hands it its work, so they all run together once a frame instead of each listening on its own. Each keeps a plain listener as a fallback.

## Backups

- Before each change is saved to this folder, the files it replaces are copied to `_backups\before-<change>\` (older changes used `_backup-before-<change>\` folders next to the app).
- `tools\tidy-backups.bat` (double-click) packs every old `_backup-before-*` folder into one zip in `_backups\`, checks the zip holds every file, and only then removes the folders. Version history in the app is separate and is not touched.

## Where the code is

- `server.js` sets up the app (sessions, uploads, shared helpers, the editor, preview and publishing) and hands each group of routes the helpers it uses. The groups live in `routes/`:
  - `payments-booking-members.js`: payment links, online booking, members-only pages
  - `visitor.js`: what visitors send (events, chat, estimates, buy buttons, reviews, contact forms)
  - `account.js`: sign up, log in, dashboard, new sites (import, generate, drafts), AI copy, photo search
  - `clients.js`: client edit links, client logins, the client portal
  - `admin-export-hosting.js`: billing, admin and backups, block library, export, hosting, payment requests
  - `intake.js`: intake questionnaires (start links, PDF intake, submissions)
  - `design-tools.js`: compare, Design lab, Style Library, Signature, Blocks screen, Brand kit, devices, share links
  - `site-and-followup.js`: the published site, leads, bookings, reviews, reports, follow-ups, robots.txt, sitemap
- Each group is called at its old place in the route order, so which route answers a request has not changed.

## Blocks screen: Effects, look packs, Surprise me

- Each block's Pin and cards, Color film, Photo words and Height sit under one **Effects** button on its row; the button says how many are on.
- **Copy effects** (in the Effects box) remembers a block's effects in this browser; **Paste** gives them to another block and **Paste to all** to every block (also on another site). Saved blocks and page recipes keep their effects too.
- **Look packs** (top of the list) give every block a matching set of effects: Bold trades, Calm wellness, Showcase portfolio, Story scroll, Clean and quick. **Surprise me** picks random effects that still go together (the hero is never pinned, each card effect is used once, no two pinned blocks in a row, at most two color films). Both only change effects, and Undo puts them back. Code: lookpacks.js (the same functions run on the Blocks screen).

## Before / after block

- A content block that shows the Gallery's before and after photo pairs (up to 6) as sliders visitors drag, anywhere on the site and on the Blocks screen (add it in the editor: "+ Before / after sliders"). The pairs are edited in one place, under Gallery. Numbers that count up as they scroll into view are the Numbers block.

## Blocks and styles from free templates
Twelve section layouts and three styles are adapted from the free Start Bootstrap templates Agency, Creative and Grayscale (MIT, see THIRD-PARTY-LICENSES.md). Only the layout ideas and the look were taken, redrawn with the site's theme colors and fonts; none of the templates' code, words or photos are included, so every block is filled with the client's own content.

Eleven more layouts (two heroes, two services, a why-choose-us, two reviews, two calls to action and two FAQs) and two styles, Meraki clean and Meraki night, are adapted from Meraki UI's free Tailwind components (MIT, see THIRD-PARTY-LICENSES.md), redrawn the same way.
- **Blocks** (Blocks screen and section pickers; their source is listed in `library/index.js`): Agency masthead, icon circles, portfolio (captions are the owner's photo descriptions), timeline (Why choose us); Creative masthead, brand band (About), line icons, edge-to-edge gallery, dark call to action; Grayscale fade hero, panels (Services), contact cards.
- **Styles** (Theme > Style, group "From free templates"): `sb-agency`, `sb-creative`, `sb-grayscale` in `template-styles.js`. Each offers the template's own colors with "Use this style's own colors"; a client's brand colors replace them. On the light styles, small brand-color words in library sections switch to the readable version of the color.
- To add another template: check its license allows commercial use and resale without a visible credit (MIT is fine; CC BY needs a credit on the page), write the layouts in `library/src` with an "Adapted from <template> (MIT)" first line, register them with `SB()` (or a new helper) in `library/index.js`, and run `npm run build:library`.

## Editing on the page
- **Editor preview** ("Click to edit" ticked): click a headline, short text or button label and type on the page. Click a photo for a bar to **upload a new photo**, **use one of this site's photos** or **find a free photo**. When the same photo is in two places (the About photo also in the gallery), the box of the section you clicked is changed. Ctrl+Z undoes it.
- **Blocks screen**: switch the top bar from Pick to **Edit**. Click words to type on them (Enter to finish, Esc to cancel), or click a photo to change it. Changes save straight to the site (a version is kept first, and Undo puts them back). The page is matched back to the one box that holds those words (`inlineedit.js`, route `POST /sites/:id/blocks/edit`). Words the design writes itself (like "Talk to ..."), or the same words in two boxes, are changed in the editor instead, and the screen says so.
