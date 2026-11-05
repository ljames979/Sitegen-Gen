// Used by start.bat. Makes sure a usable .env exists (creating it from
// .env.example with a freshly generated SESSION_SECRET if needed), keeps any
// values the user already set, and prints the port the server will use as the
// ONLY line on stdout so the launcher can read it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

let text;
if (fs.existsSync(envPath)) {
  text = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync(examplePath)) {
  text = fs.readFileSync(examplePath, 'utf8');
} else {
  text = 'SESSION_SECRET=\nPORT=3000\n';
}

const secretLine = /^SESSION_SECRET=(.*)$/m;
const m = text.match(secretLine);
const current = m ? m[1].trim() : '';
if (!current || current === 'change-me-to-a-long-random-string') {
  const secret = crypto.randomBytes(32).toString('hex');
  text = m ? text.replace(secretLine, `SESSION_SECRET=${secret}`) : `SESSION_SECRET=${secret}\n${text}`;
}

if (!fs.existsSync(envPath) || fs.readFileSync(envPath, 'utf8') !== text) {
  fs.writeFileSync(envPath, text);
}

const portMatch = text.match(/^PORT=(\d+)/m);
process.stdout.write(String(portMatch ? portMatch[1] : 3000));
