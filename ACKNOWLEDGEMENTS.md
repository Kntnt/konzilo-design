# Acknowledgements

Konzilo Design stands on the work of others. This file names what it is built on, with thanks to those who made it, and says under which licence each part comes. [`THIRD-PARTY.md`](THIRD-PARTY.md) lists every package the repository installs, each with its licence.

## Typefaces

The library ships 47 variable typefaces in [`src/fonts/`](src/fonts/), each with its licence beside it as `LICENSE-<name>.txt`, which travels with the font into every export. `bin/design-fonts` fetches each from its source: the designers' own repository where that is better, and otherwise the family download from Google Fonts. The files are used as published. Two kinds of change are made: a TTF is recompressed to WOFF2, and Google Sans Flex, Noto Sans and Roboto Serif are cut to the Latin characters. Their licences reserve no font name, so a cut version may keep it.

| Typeface | By | Licence |
|---|---|---|
| Mona Sans, Hubot Sans and Mona Sans Mono | Tobias Bjerrome Ahlin and GitHub, with Degarism Studio and Sebastian Carewe | OFL-1.1 |
| Inter | Rasmus Andersson | OFL-1.1 |
| Source Sans 3 and Source Code Pro | Paul D. Hunt, for Adobe | OFL-1.1 |
| Source Serif 4 | Frank Grießhammer, for Adobe | OFL-1.1 |
| IBM Plex Sans and IBM Plex Mono | Mike Abbink and Bold Monday, for IBM | OFL-1.1 |
| Roboto | Christian Robertson, with ParaType and Font Bureau, for Google | OFL-1.1 |
| Roboto Mono | Christian Robertson, for Google | OFL-1.1 |
| Roboto Slab | Christian Robertson, for Google | Apache-2.0 |
| Roboto Flex | Font Bureau, David Berlow and others, for Google | OFL-1.1 |
| Roboto Serif | Commercial Type and Greg Gazdowicz, for Google | OFL-1.1 |
| Google Sans Flex | Google | OFL-1.1 |
| Noto Sans and Noto Serif | Google's Noto project | OFL-1.1 |
| Schibsted Grotesk | Bakken & Bæck and Henrik Kongsvoll, for Schibsted | OFL-1.1 |
| Archivo | Omnibus-Type | OFL-1.1 |
| Geist and Geist Mono | Vercel: Andrés Briganti, Mateo Zaragoza, Guillermo Rauch, Evil Rabbit, José Rago and Facundo Santana | OFL-1.1 |
| Instrument Sans | Rodrigo Fuenzalida and Jordan Egstad, for Instrument | OFL-1.1 |
| Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono | Braille Institute, with Applied Design Works, Elliott Scott, Megan Eiswerth and Letters From Sweden | OFL-1.1 |
| Josefin Sans and Josefin Slab | Santiago Orozco | OFL-1.1 |
| Bitter | Sol Matas, of Huerta Tipográfica | OFL-1.1 |
| Aleo | Alessio Laiso | OFL-1.1 |
| Rokkitt | Vernon Adams | OFL-1.1 |
| Lora | Cyreal | OFL-1.1 |
| Newsreader | Production Type | OFL-1.1 |
| Literata | TypeTogether, for Google | OFL-1.1 |
| Alegreya and Piazzolla | Juan Pablo del Peral, of Huerta Tipográfica | OFL-1.1 |
| Fraunces | Undercase Type: Phaedra Charles and Flavia Zimbardi | OFL-1.1 |
| Merriweather | Sorkin Type | OFL-1.1 |
| Crimson Pro | Jacques Le Bailly | OFL-1.1 |
| EB Garamond | Georg Duffner and Octavio Pardo | OFL-1.1 |
| Cormorant and Cormorant Garamond | Christian Thalmann, of Catharsis Fonts | OFL-1.1 |
| Playfair | Claus Eggers Sørensen | OFL-1.1 |
| Bodoni Moda | Owen Earl | OFL-1.1 |
| Red Hat Display, Red Hat Text and Red Hat Mono | MCKL, for Red Hat | OFL-1.1 |
| JetBrains Mono | JetBrains: Philipp Nurullin and Konstantin Bulenkov | OFL-1.1 |
| Recursive | Arrow Type and Stephen Nixon | OFL-1.1 |

## Icons and photos

| Part | Where | Licence |
|---|---|---|
| [Lucide](https://lucide.dev) icons, by Lucide Icons and its contributors | The components' icons, in `src/components/icons.js` | ISC ([`src/components/LICENSE-lucide.txt`](src/components/LICENSE-lucide.txt)) |
| [Tabler](https://tabler.io/icons) icons, by Paweł Kuna | The icons for social media and feeds | MIT ([`src/components/LICENSE-tabler.txt`](src/components/LICENSE-tabler.txt)) |
| Six sample photos from [Unsplash](https://unsplash.com) | The sample pages, in `presentation/pictures/`; [`presentation/pictures/README.md`](presentation/pictures/README.md) names each source | The [Unsplash License](https://unsplash.com/license) |

The export for AI and the presentation carry the icons' licences with them.

## Formats and tools

| Part | What it does for Konzilo Design | Licence |
|---|---|---|
| [`DESIGN.md`](https://github.com/google-labs-code/design.md), Google Labs' open format | The format of the export for AI agents | Apache-2.0 |
| [Astro](https://astro.build) (`astro`), by Fred K. Schott and Astro's contributors | Builds the component gallery, and runs the Astro components on a site that uses them | MIT |
| [CSSTree](https://github.com/csstree/csstree) (`css-tree`), by Roman Dvornov | Reads the stylesheets in the tests | MIT |
| [Playwright](https://playwright.dev) (`playwright-core`) | Runs the browser tests in Firefox, WebKit and Chromium | Apache-2.0 |
| [Node.js](https://nodejs.org) | Runs the generator, the design tool and the commands | MIT, with parts under licences of their own |

Each of these stands on many more. `THIRD-PARTY.md` names them all.

## How the licences fit

Konzilo Design's own files are under the GNU Affero General Public License, version 3 or later ([`LICENSE`](LICENSE)), with the site exception ([`SITE-EXCEPTION.md`](SITE-EXCEPTION.md)). The typefaces, icons and photos above are files of their own, keep the licences they came under, and bind no other file. The packages are used only to develop and test the design system, and none is published with it.
