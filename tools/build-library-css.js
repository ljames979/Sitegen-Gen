#!/usr/bin/env node
// Rebuilds public/sg-library.css from the section templates in views/library (needs the dev dependency
// @tailwindcss/cli: `npm install`, then `npm run build:css`). The compiled file is committed, so you only run
// this after editing a section.
const { execFileSync } = require('child_process'); const path = require('path');
const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', path.join(root, 'library/tailwind.css'), '-o', path.join(root, 'public/sg-library.css'), '--minify'], { stdio: 'inherit', cwd: root });
console.log('wrote public/sg-library.css');
