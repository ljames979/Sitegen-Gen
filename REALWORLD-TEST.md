# Real-world test (about 30 minutes)

Until now, Stripe, Netlify and the AI were only tested against pretend servers. This checks the real ones. Use **Stripe TEST mode** only: no real money moves.

## 0. Add your keys to `.env`
```
STRIPE_TEST_KEY=sk_test_...          # dashboard.stripe.com/test/apikeys  (must be a TEST key)
NETLIFY_AUTH_TOKEN=...               # Netlify > User settings > Applications > New access token
ANTHROPIC_API_KEY=sk-ant-...         # console.anthropic.com
# optional: PEXELS_API_KEY, SMTP_HOST / SMTP_USER / SMTP_PASS
```

## 1. Run the check
Double-click **realworld-check.bat** (or `npm run realworld`). Each line says PASS / FAIL / SKIP, with a fix for each FAIL. It also prints a $1.00 test checkout link: open it, pay with `4242 4242 4242 4242`, any future date, any CVC. **If anything FAILs, send me the output** and stop here.

## 2. Walkthrough in the app (restart with start.bat first)
Tick each as you go. Note what looked wrong and send it to me.

**AI**
- [ ] Generate a site from a business description. Copy reads naturally, nothing says "undefined".
- [ ] Chat-to-edit: "make the headline shorter" works, and you can undo it from version history.
- [ ] Questionnaire/design options: pick a style, the preview changes.

**Stripe**
- [ ] Editor > Card payments: paste your test key, turn payments on, save.
- [ ] On the live site, pay a $1 test amount with 4242. You land on the thank-you page.
- [ ] The Payments page shows it as **paid** (this depends on Stripe calling back or on the page re-checking; tell me if it stays "pending").
- [ ] Try card `4000 0000 0000 0002` (declined): the site shows the payment as not paid.

**Netlify**
- [ ] Hosting > Publish to Netlify. You get a working https address; open it on your phone.
- [ ] Change the headline, publish again: the same address updates.
- [ ] Publish history > roll back: the Netlify address shows the older version.
- [ ] Delete the test site in Netlify afterwards.

**Quality gate and motion**
- [ ] Publish a site with a missing image or tiny text: you are warned before it goes live.
- [ ] On your phone, scroll a published page: animations are smooth, and nothing is hidden if you switch Motion to None.

**Members area**
- [ ] Turn it on, sign up with a second email, approve it, log in, see the pages, log out.
- [ ] "Forgot password": without email set up, use **Make a reset link** on the Members page.
- [ ] Confirm the members page does not appear in a downloaded copy of the site.

**Phone and browsers**
- [ ] Open a published site on a real phone and in a second browser. Check the menu, contact form and booking.

## What to send back
The output of step 1, plus the checklist items that failed or felt off (a screenshot is ideal).
