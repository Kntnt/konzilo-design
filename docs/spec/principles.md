# Library principles

Records the library principles and the CSS framework decision, with their status and reasoning.

Each point is marked **owner** (his statement), **proposed** (put to him, not confirmed), *decided* or *confirmed* (he chose or approved it, usually after one question at a time) or **open**.

## The library

- **Owner:** a component library and a CSS framework of Kntnt's own for Konzilo/Blueprint.
- **Owner:** each recurring part has a default solution that a site starts from and may depart from ("Det är inte så att det alltid måste vara exakt på det här sättet").
- **Owner:** the header and the footer are components that, unlike the others, are only of use in exactly that position.
- **Owner:** the page itself may be a component, since it has properties of its own and the footer must work together with it (page.md and footer.md).
- **Owner, question:** should body text be a component of its own (page.md, The Reading Area, point 8)?

## HTML and CSS, not JavaScript

- ***Decided* by the owner (2026-11-10):** what the design system delivers to a site is HTML and CSS, with no JavaScript wherever that is possible. A script in the output counts as a failure, above all on an Astro site. A function that cannot exist without a script, such as remembering a visitor's consent, may have one, and the page must still work without it. This holds for the output, not for the design tool.
- ***Decided* by the owner (2026-11-10):** a site looks and behaves the same in Gecko, WebKit and Chromium. Where one engine lacks a native feature that the design needs, a script may stand in for it as a polyfill, but only where there is good reason to think the feature will be HTML and CSS in every engine within the next few years. Such a polyfill loads only where `CSS.supports` or a like test says the feature is missing, sets only what the CSS already reads, names the feature it stands in for, and is removed once every engine has it. A page without it still works.
- ***Decided* by the owner (2026-11-11):** never duplicate markup to avoid a script. Where HTML and CSS can only reach a behaviour by writing the same content twice, such as a hidden copy to measure, a small script is used instead. A copy doubles the page's elements, lets search engines read its links and texts twice, and binds every site to rules such as "no id in a copied slot". Such a script only shows, hides or moves; where it is missing the page shows a plain state that works, and only the decoration is lost.
- Acted on 2026-11-10 and 2026-11-11: the header and the footer are written once. Two small scripts measure what CSS cannot without a copy: `header-fit.js` picks the header's giving-way step, and `footer-fit.js` turns a footer's reveal on only while it fits in the window. Without them the header shows its narrowest step and the footer stands in the flow. Two polyfills stand in, each in a file of its own, for scroll-driven animations, which Firefox lacks, and scroll-state queries, which Firefox and WebKit lack, the second only for a header that slides away (header.md and footer.md, How it is built). Embed and consent keep their runtimes.

## The CSS framework and Lumos

- ***Decided* (2026-11-01):** no ties to Lumos at all; Kntnt builds its own framework.
- **Owner, leaning (2026-10-31):** drop the idea of using Lumos. Lumos may be a starting point and much may be reused from it, but Kntnt builds its own component library and CSS framework and does not depend on Lumos.
- Acted on 2026-11-01: Blueprint's Q367 and ADR 0035 now rule out ties to Lumos.
