read when changing the HTML presentation, its copy, specimens, offline packaging or browser checks

# Approval presentation

`node bin/konzilo-design.js presentation examples/example.design.json -o presentation/dist/example-presentation.zip` writes a ZIP with one file, `example-design-system.html`. Without `-o`, the archive is beside the design file as `<stem>-presentation-<YYYY-MM-DD>.zip`, with `.design` stripped from the stem. The HTML filename uses the project's name as a slug and the `document.filename` copy key. The CLI resolves inputs afresh without rewriting the source. The tool saves first, creates the archive and offers the HTML through its local server.

The HTML opens directly from `file://`. CSS, all three shipped font files (the two recommended families, including Mona Sans italic), generated SVG pictures and scripts are inline. There are no imports, external assets or runtime dependencies. A content security policy refuses network access and form submission. External media uses the real Embed component's local explanation option; it never loads a provider. Custom typefaces use the reader's installed fonts and the declared fallbacks. No browser is used to build the document or ZIP. `tool/archive.js` uses raw DEFLATE from `node:zlib`, CRC32 and standard UTF-8 ZIP headers.

`src/catalog.js` defines 23 pages and component coverage. Hash navigation, previous/next links, back/forward history and arrow keys open one page at a time, reset scrolling and focus its heading. Fields, buttons and disclosures keep their own arrow keys. The sidebar shows the chapters, expands only the current chapter's pages and pins Comments to its foot, so it fits a 700 px tall window. Below 900 px, a menu in the top bar replaces it. Without JavaScript, all pages remain visible in order; interactive specimens explain that they need JavaScript.

Colour and typography lead into space and shape, then components grouped by purpose. Reference tables and licences are collapsed at the end. The presentation uses generated roles for its own type, colours, corners and shadows. All prose has the Narrow measure; specimens use the full column. Owner explanations appear only on their assigned first page, as paragraphs and a byline separated by a rule. Introduction and explanations accept plain text only; blank lines make paragraphs and all text is escaped.

## Copy and project metadata

`copy.json` holds every presentation label, title, lead, instruction, toolbar word and comment-export label. Flat string keys support `{placeholders}`. A sibling `<stem>.copy.json` overrides any subset. For `example.design.json`, use `example.design.copy.json`. Unknown keys, non-string values and non-object overrides fail the build. Missing values fall back to English. `lang` sets `<html lang>` and `Intl` number/date formatting. Sample content belongs to `src/samples.js` and `src/specimens/` and is intentionally not translated.

`project.version` defaults to `1.0`. `introduction`, `contact.name`, `contact.email` and `explanations` are optional, outside the input fingerprint. Explanation keys are `colour`, `typefaces`, `type-scale`, `space-shape`, `shadow` and `components`. Their pages are respectively the colour scale, main typeface, type scale, space, shadow and header. Logos are embedded from data URIs or SVG/PNG paths relative to the design file. The supplied identity is used nowhere in repository configuration.

## Real specimens

The Astro build renders the unchanged library components in `src/specimens/`, reusing the generated pictures. `inline.mjs` pools specimen styles and bundled controllers. The common core, component CSS, fonts and forced-state rules are stored once. The reader inserts these into `srcdoc` only when a page or variants disclosure opens. Controller bundles have private function scopes, avoiding collisions between classic scripts on file URLs.

Each iframe has a real responsive viewport. Wide fills its column; Tablet is 768 px and Phone is 390 px. Each page has one toolbar for all its specimens, with Wide, Tablet and Phone and Light and Dark as segmented buttons; sizes wider than the column are not offered. Nothing is scaled. Each specimen keeps only its name and a small Comment button. Frames fit their content; the whole-page example has a 560 px scrolling viewport for sticky navigation and footer reveal. Header and consent compositions reserve at least 560 px for their overlays. Once a width/mode control is used, the surrounding stage keeps its height and scrolls internally so following content stays still. Resize observers continue to fit the iframe inside it. Component appearance stays in `src/components`; presentation composition alone lives here.

## Comments

Comments and drafts save as typed under a localStorage key formed from project name, document filename key and version. The same identity/version shares comments across regenerated copies in a browser; a changed version starts a new review. Storage failure falls back to memory and displays a reminder to send or save before closing. A separate page lists comments by page and includes the reader's name. Editing saves immediately; removing affects one comment. Clearing all comments and drafts requires confirmation.

Mail, Save as a file and Copy export readable UTF-8 plain text, including any unsent drafts. The text names the document, version, date, reader, pages and components. Mail uses `project.contact.email`; above 1800 encoded characters it uses a short note and asks the reader to attach the saved file. No email address means Save and Copy remain available and the mail action explains the missing address. Sending never clears comments. Clipboard access falls back to browser copy support, then offers the file action if copying is unavailable.

## Verification

`npm test` checks the generator's unchanged output, schema, component coverage, copy usage, ZIP integrity and the tool flow. Browser tests use only `playwright-core` with the installed Chromium revision 1248, with no download. They open extracted HTML through `file://`, exercise every page at 1440, 1024, 768, 390 and 320 px, test routing and history, real specimen widths, fonts, shadows, menus, disclosures, consent and comments, and reject console errors or network requests. Normal, primary-only and stress designs are covered. Safari, Firefox and Edge require separate manual verification.

For visual review, take screenshots of every page at 1440 and 390 px and inspect them. Keep `dist/example-presentation.zip`; remove scratch design copies, extracted HTML and screenshots, and close all test browsers and servers.
