# Third-party licenses (section library)

The section library (`library/src/`, built to `views/library/` and `public/sg-library.css`) uses these open-source projects.

## HyperUI: MIT
Section layouts are adapted from HyperUI (https://www.hyperui.dev, https://github.com/markmead/hyperui), rewritten so every color, font, corner and shadow comes from the site's theme variables. Each template names the HyperUI folder it was adapted from in its first line. Two layouts (`hero-card`, `areas-chips`) are original and say so.

MIT License. Copyright (c) HyperUI contributors. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of this copyright notice and permission notice in all copies or substantial portions of the software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Start Bootstrap templates (Agency, Creative, Grayscale): MIT
Twelve section layouts (`library/index.js`, source "Start Bootstrap ... (MIT)") and three styles (`template-styles.js`, ids `sb-agency`, `sb-creative`, `sb-grayscale`) are adapted from the free Start Bootstrap templates Agency, Creative and Grayscale (https://startbootstrap.com, https://github.com/StartBootstrap). Only the layout ideas and the look (colors, fonts, how headings and buttons are drawn) were taken and redrawn with the site's theme variables; none of the templates' Bootstrap CSS, JavaScript, sample words or photos are included. Each template names the Start Bootstrap template it was adapted from in its first line.

MIT License. Copyright (c) 2013-2023 Start Bootstrap LLC. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of this copyright notice and permission notice in all copies or substantial portions of the software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Meraki UI: MIT
Eleven section layouts (`library/index.js`, source "Meraki UI (MIT) marketing/...") and two styles (`template-styles.js`, ids `mk-clean`, `mk-night`) are adapted from Meraki UI's free Tailwind CSS components (https://merakiui.com, https://github.com/khatabwedaa/merakiui). The markup was redrawn with the site's theme variables and the library's own `tw:` classes; none of Meraki UI's sample words or photos are included. Each template names the Meraki UI folder it was adapted from in its first line.

MIT License. Copyright (c) 2021 Khatab Wedaa. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the inclusion of this copyright notice and permission notice in all copies or substantial portions of the software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## Tailwind CSS v4: MIT
Copyright (c) Tailwind Labs, Inc. Used at build time only (`npm run build:library`); the compiled `public/sg-library.css` is committed so running the site needs no build step.

## Motion: MIT
Copyright (c) Framer B.V. `public/vendor/motion.js` (v11.11.17) with its licence in `public/vendor/LICENSE-motion.txt`. Used by the Premium and Showcase motion levels.

## lottie-web: MIT
Copyright (c) 2015 Bodymovin. `public/vendor/lottie_light.min.js` (v5.13.0, SVG-only light player) with its licence in `public/vendor/LICENSE-lottie-web.txt`. Loaded lazily by Premium and Showcase sites that show an animated icon.

## Lottie icons: original
The ten animated icons in `public/lottie/icons.js` are drawn by `tools/build-lottie.js` and belong to this project. No file from LottieFiles or any other animation library is included, because LottieFiles animations carry per-animation licences (some require attribution or limit resale). Check a specific animation's licence before ever adding one.

## Shader backgrounds: original
`public/sg-shader.js` (aurora, mesh and silk gradients) is original code written for SiteGen; no shader code from other projects is included.

## Approved client styles: designmd.app (CC BY 4.0) and Devault
`project-styles.js` holds design tokens adapted from 11 designmd.app design systems (styles 1 to 11, CC BY 4.0, https://creativecommons.org/licenses/by/4.0/) and one Devault style (12, Pop Studio Modern, used under Devault's design-reference license). Every page built with a designmd.app style carries the credit comment in its `<head>`. Only tokens are included; no style file is bundled, and the Devault file must never be shared with clients or sold as part of a theme pack.

## Not used
- **Preline UI**: free components are MIT but carry an additional "Preline UI Fair Use License" (attribution, no competing product, the license must travel with redistributed copies). SiteGen is resold as generated sites, so none of Preline's code is bundled. The interactive pieces are plain `<details>`, CSS scroll-snap and our own `public/sg-lib.js`.
- **Flowbite** (MIT core): available as a fallback source; no markup from it is used yet.
- **Paid blocks** (Flowbite Blocks, Preline Pro, Tailwind Plus): never used. `tests/library.test.js` fails if their names appear in a template.

## Original layouts
The 15 layouts marked `Original` in `library/index.js` were written for SiteGen. 21st.dev was consulted for design direction only; none of its components or their authors' code is included, because components there carry author-chosen terms.
