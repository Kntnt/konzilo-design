// The frame in DESIGN.md: what this design chose for the header, footer, page, trail and hero, and the recipe of each,
// written so an agent with nothing but the file can build it. The order and groups come from the components themselves.
import { GIVING_WAY_ORDER, arrangementGroups } from '../components/header.js';
import { TRANSLUCENT_LEAST, translucentOpacity } from '../generator/surface.js';

const ITEM_NAMES = { identity: 'identity', links: 'link menu', search: 'search icon', language: 'globe', menu: 'menu button', cta: 'CTA' };
const ALL_ITEMS = { links: true, search: true, language: true, menu: true, cta: true };
const groupWords = (groups) => groups.map((group, i) => `${i ? 'end' : 'start'}: ${group.length ? group.map((item) => ITEM_NAMES[item]).join(', ') : 'nothing'}`).join('; ');
const GIVE = {
  slogan: 'the slogan goes',
  name: 'the name goes, where a logo stands beside it',
  links: 'the link menu goes, and a menu button appears if the bar had none',
  word: 'the menu button\'s word goes, and its chevron becomes a hamburger',
  language: 'the globe moves into the megamenu',
  cta: 'the CTA moves into the megamenu',
  search: 'the search icon moves into the megamenu, as a search field',
};

const SHOWS = { 'link-menu': 'a link menu', language: 'a language switcher', search: 'a search icon', cta: 'a call-to-action button' };
const PLACEHOLDERS = { none: 'nothing', word: 'the site\'s word for Search as its placeholder', icon: 'a magnifier where the words begin, which goes as the visitor types' };
const TRAIL_MARKS = { slash: '/', chevron: '›', arrow: '→', dot: '·' };
const TRAIL_PHONE = {
  trail: 'On a phone the whole trail wraps.',
  parent: 'On a phone (a window of 40rem or less) only the link one level up shows, with ← before it.',
  fit: 'On a phone (a window of 40rem or less) it keeps to one line and to its end: as many whole steps as fit, counted from the last, stand at the start, and an ellipsis (…) at the start edge says that earlier steps are hidden before them; a trail that fits shows whole, as on a wider screen. Build it with no script: the list is a wrapping flex row, reversed, with the steps in reverse `order` so the last comes first and `justify-content: flex-end`, one line tall (`1lh`, no row gap) with its overflow hidden, so the steps that do not fit wrap out of sight; each step keeps to one line, and one longer than the line is cut at its end with an ellipsis. The row keeps 1em free at its start for the ellipsis, and the first step takes it back with a margin of -1em, so a trail that fits starts at the edge. The ellipsis is the list\'s `::after`, ordered after the first step, 1em wide with a margin of -1em, sticky with `bottom: -1lh` and moved up by 1lh: it follows the first step\'s line, so it shows exactly while that step is hidden. It is not read aloud, and the hidden steps stay in the page for screen readers. While a link in the trail has keyboard focus, the whole trail shows and wraps.',
};
function trailWords(b) {
  if (!b?.show) return '- **Breadcrumb Navigation:** none on this design\'s pages.';
  const first = { word: 'the word Home', name: 'the site\'s name', icon: 'a house icon' }[b.home];
  return `- **Breadcrumb Navigation:** on every page but the start page, directly above the page's H1, wherever that is, so above the eyebrow when the H1 stands in a hero, and directly above the first heading on a page without a hero. Wherever the H1 has an eyebrow, in a hero or not, the trail stands above the eyebrow: from the top always trail, eyebrow, heading, deck, buttons. It is quiet: links, marks and current page in muted text, a little under small text, and on hover a link takes the normal text colour and an underline. It begins with ${first}, its steps are parted by ${TRAIL_MARKS[b.separator]}, and it ${b.current ? 'ends with the current page as plain text' : 'ends with the page above'}. ${TRAIL_PHONE[b.narrow]} Its size is exactly \`max(label size, 0.92 × small size)\`, in the small style's typeface and line height; each mark has 0.65em on either side${b.home === 'icon' ? ', the house is 1.15em square,' : ''} and wrapped rows stand 0.35em apart. The component gap parts it from the heading below. A trail with no step left to show but the start page shows nothing.`;
}
const HERO_SHARES = { third: 'a third', half: 'half', 'two-thirds': 'two thirds', full: 'all' };
const HERO_PLACES = { top: 'at the top', center: 'in the middle', bottom: 'at the bottom' };
const HERO_ALIGNS = { start: 'at the start of the content width', center: 'in the centre of the content width', end: 'at the end of the content width' };
function heroGround(h) {
  const colour = h.surface === 'none' ? 'no background of its own' : `the ${h.surface} Surface`;
  if (h.picture === 'none') return colour;
  if (h.picture === 'behind') return `a picture behind the text, under a ${h.overlay} overlay`;
  const [side, bleed] = h.picture.split('-');
  return bleed
    ? `a picture at the inline ${side}, bleeding to the window's edge and the hero's top and bottom, with the text opposite, on ${colour}`
    : `a picture at the inline ${side}, inside the content width, with the text opposite, on ${colour}`;
}
function heroWords(h) {
  if (!h) return '';
  const beside = h.picture !== 'none' && h.picture !== 'behind';
  const text = beside ? HERO_PLACES[h.place] : `${HERO_PLACES[h.place]}, ${HERO_ALIGNS[h.align]}`;
  const h1 = h.h1 === 'below'
    ? 'The page\'s H1 stands under the hero: first in the next section, with the trail directly above it, in the first heading style. The hero\'s text keeps its look as a plain paragraph, not a heading, since a lower heading before the H1 reads as the wrong order.'
    : 'The page\'s H1 is the hero\'s heading, with the trail first in its text, above the eyebrow, and the next section\'s heading is an H2.';
  return `\n- **Hero:** by default ${heroGround(h)}, taking ${HERO_SHARES[h.height]} of the screen, with its text ${text} and its heading in the ${h.type === 'display' ? 'display' : 'first heading'} style. ${h1} A Hero further down a page is an ordinary section, with an H2 for its heading. A page may depart from this.`;
}
const onCells = (band) => Object.keys(band.cells).filter((cell) => band.cells[cell]).map((cell) => cell.toUpperCase()).join(', ');
function footerWords(f) {
  const band = (name, words) => (onCells(f[name]) ? `${words} on the ${f[name].surface} Surface, with cells ${onCells(f[name])}` : '');
  const bands = [band('upper', 'an upper band'), band('lower', 'a thin lower band')].filter(Boolean).join(' and ') || 'no bands, so no footer';
  const rules = f['horizontal-rules'] || f['vertical-rule'] ? ` The lines ${f['rule-extent'] === 'full' ? 'run to the window\'s edges' : 'stop at the content'}.` : '';
  return `${bands}. ${f.attachment === 'reveal' ? 'It lies at the edge of the screen, revealed under the page as that scrolls' : 'It sits at the end of the page'}. An empty cell whose neighbours could both take its room gives way to the cell ${f.fill === 'row' ? 'beside it' : 'above or below it'}. Text in column B is ${f['b-align'] === 'end' ? 'end-aligned on a wide screen, its lines ending at the column\'s end edge as its box does, and start-aligned on a phone' : 'start-aligned, as in column A'}. Lines between rows: ${f['horizontal-rules'] ? 'yes' : 'no'}; between columns: ${f['vertical-rule'] ? 'yes' : 'no'}.${rules}`;
}
// How far a translucent layer on a Surface shows the page, in each mode, as a percentage of its opacity.
const opacityWords = (surfaces, kind) => {
  const [light, dark] = ['light', 'dark'].map((mode) => Math.round((surfaces[kind][mode].translucent ?? translucentOpacity(surfaces[kind][mode])) * 100));
  return light === dark ? `${light}%` : `${light}% in light mode and ${dark}% in dark mode`;
};
function frameWords({ header: h, footer: f, page: p, breadcrumbs: b, hero, surfaces }) {
  const items = Object.keys(SHOWS).filter((key) => h[key]).map((key) => SHOWS[key]);
  const button = { word: 'a menu button with the word and a chevron', icon: 'a menu button with a hamburger icon', off: 'a menu button only when items give way' }[h['menu-button']];
  const attached = h.attachment === 'flow' ? 'It scrolls away with the page.' : `It sticks to the top of the window${h.autohide ? ' and slides away while scrolling down, back at the first scroll up' : ''}.${h.start === 'under' ? ' The page starts under it, and it is transparent at the top, taking its own Surface 1.5rem (24 px) down, and while its megamenu is open.' : ''}${h.translucent ? ` It is translucent: where its bar is not clear, the bar shows its Surface's background at an opacity of ${opacityWords(surfaces, h.surface)}, and the megamenu and the language list theirs at ${opacityWords(surfaces, 'page')}, each over the page blurred by 1rem (\`backdrop-filter: blur(1rem)\`), so the page under it is sensed, not read (Header, A hint of the page).` : ''}`;
  const brand = { logo: 'the logo', name: 'the name', both: `the logo and the name, ${h['brand-axis'] === 'column' ? 'stacked from one start edge' : 'side by side'}` }[h.identity];
  const slogan = h['slogan-place'] === 'below' ? 'below the name, or below the logo without one, from the same start edge' : 'beside the brand, after a hairline';
  const bar = groupWords(arrangementGroups(h.arrangement, { links: h['link-menu'], search: h.search, language: h.language, menu: h['menu-button'] !== 'off', cta: h.cta }));
  const rows = [h['menu-above'] && 'a row above the menu', h['menu-below'] && 'a row below it'].filter(Boolean);
  return `### This design's frame

- **Header:** arrangement ${h.arrangement}, on the ${h.surface} Surface, showing ${[...items, button].join(', ')}. So the bar reads, ${bar}. ${attached} The megamenu's level-1 headings are ${h.numbered ? 'numbered' : 'not numbered'}${rows.length ? `, and it has ${rows.join(' and ')}` : ''}. The search box is on the ${h['search-surface']} Surface${h['search-blur'] ? ', over a blurred page' : ''}${h['search-heading'] ? ', with its heading' : ', with no heading'}${h['search-links'] ? ' and starting links' : ''}, ${h['search-close'] === false ? 'with no close button, so Esc or a click beside the box closes it' : 'with its close button'}; its empty field shows ${PLACEHOLDERS[h['search-placeholder'] ?? 'word']}.
- **Brand:** ${brand}, in the header and in the footer alike. Text and logo are optically centred: a line of words counts from its baseline to its cap height. A slogan stands ${slogan}, and only in the header.
- **Footer:** ${footerWords(f)}
- **Page:** ${p.shadow ? 'it casts a shadow on the footer, the `page` shadow at its bottom edge, wherever the footer is attached' : 'no shadow on the footer of its own choosing'}${p['edge-line'] ? ', with a 1 px `border` line at its bottom edge' : ''}. How page and footer meet is under Footer.
${trailWords(b)}${heroWords(hero)}`;
}

function headerRecipe(r) {
  const arrangements = ['A', 'B', 'C'].map((name) => `- **${name}:** ${groupWords(arrangementGroups(name, ALL_ITEMS))}.`).join('\n');
  const steps = GIVING_WAY_ORDER.map((step, i) => `${i + 1}. ${GIVE[step]}`).join('\n');
  return `### Header

**The bar.** One line, never wrapping: a start group and an end group, every item centred on the bar's middle line, the component gap between items and at least that between the groups. Its background runs edge to edge on its Surface, \`page\` or \`brand\`, and its content stays in the content area. It is at least 4rem high, with 0.75rem above and below its tallest item, plus its 1 px hairline. That height is the design's, worked out in CSS rather than measured, counting a line of words in the identity as 0.66 of its size, from baseline to cap height; the bar keeps it when items give way, and the rest of the page reads the same value as the header's height.

**Arrangements.** A design chooses one of three, which fix each item's group and order. An item that is off leaves no gap, and the identity is always there.

${arrangements}

**Items.**

- **Identity:** the brand, with an optional slogan, as one link to the start page. The logo is 2.25rem tall at its natural width. The name is in the heading typeface at the h5 size and letter spacing, in the emphasis weight, line height 1.15. Logo and name stand side by side, 0.625rem apart, or stacked from one start edge, 0.5rem apart. The slogan is in the small size, line height 1.3, \`text-muted\`: beside the brand it follows a 1 px hairline in \`border\`, one line tall, with 0.875rem on either side; below, it stands 0.5rem under the name, from the name's start edge, and with logo and name side by side the logo stands beside both lines, centred on them. Optical centring: give a line of words a box from its baseline to its cap height, and centre that. \`text-box: trim-both cap alphabetic\` does it, but not in every browser (not in Firefox); what works everywhere is to make the line a flex row aligned on the baseline, with an empty \`::before\` one \`1cap\` tall, and the words in an inner element with a margin of \`-0.5lh\` above and below.
- **Link menu:** level 1 of the main menu as a row of links, the component gap apart, in the small size and letter spacing and the emphasis weight, in \`text\` with no underline; a 1 px underline 0.25em below the baseline on hover and on the current page.
- **Menu button:** the word "Menu" and a chevron that turns 180° while the megamenu is open, in the link menu's type, with no box; on hover the word is underlined. Or a hamburger icon in an icon control.
- **Globe:** the language switcher is always a globe icon, never a language's name, however many languages there are. It opens the language list.
- **Search icon:** a magnifier; it opens the search box.
- **CTA:** a filled button (see Button and Link Group).
- **Icon controls** (globe, magnifier, hamburger, close): 2.5rem square, the icon 1.25rem, transparent, control radius, in \`text\`. On hover a 1 px inset ring in \`border\` appears, and no fill.
- **Skip link:** "Skip to content" comes first, hidden until it has keyboard focus, then shown at the top start on the header's background with 0.5rem 0.75rem padding and control radius.

**Giving way.** When the bar would not fit on one line, it takes these steps in order until it fits, and takes them back as the window widens. A step that frees no width is skipped, and a slogan never outlasts the name.

${steps}

Moved items stand at the top of the megamenu, in the bar's order, in a wrapping row with 0.75rem 1.5rem gaps and a hairline in \`border\` 1.25rem below: the search field with its button, the globe followed by every language inline, and the CTA as a button. Nothing with a function is lost. A logo is at most 14rem wide, keeping its shape, so even a 20rem (320 px) window has room for it beside the menu button. If even the identity and the menu button do not fit, the identity scales down one step, to 0.8 of its size, and if that is not enough, a logo shrinks within its box and the name wraps to two balanced lines, centred in the bar, so the menu button always shows. The name is never cut.

How it is measured: write the bar once, with the steps it can take in order, and let a small script try them one after another in a single task, before the browser paints, so nothing flickers: it sets a state on the header naming the step, measures the groups and the gaps between them, and keeps the first step at which they are no wider than the bar's room, compared exactly, never letting the bar overflow; if none fits, it takes the last resort. Write it inline, right after the header, so it runs while the page is still being parsed and the right step is there before the first paint; loaded as a file it runs too late, and a wide page first shows its narrowest step. A ResizeObserver on the bar and its groups and the window's resize event, which a change of text size also fires, run it again. Without the script, show the narrowest step: the identity and the menu button, with everything else in the megamenu. A step whose item a page has taken away takes nothing. Do not write a hidden copy of the bar to measure by CSS: it doubles the markup, and search engines read its links twice.

**Shadow and line.** A sticky header casts the \`header\` shadow only once page content has scrolled under it, never at the top of the page, and the \`header-panel\` shadow while a panel is open. Where it casts none and the first band has the header's colour, at the top of the page too, a 1 px hairline in \`border\` parts them. In dark mode, where a shadow does not show on the dark page, the hairline stands beside the shadow too, wherever the header casts one. While a sticky header shows, the page's scroll padding at the top equals its height, so no anchor or focused element hides under it.

**Scrolling, without a script.** \`position: sticky\` holds the header. Its look follows three flags on the root element, each a discrete scroll-driven animation (\`animation-timeline: scroll(root)\`) of a custom property from 0 to 1 over a range twice as long as where it turns: content under the header (from 1 px), past T (1.5rem) and past the header's own height. Container style queries read them: the header is transparent with the first band's Surface roles while it is under the page's start and short of T, unless its megamenu is open (\`:has()\` of the megamenu's \`:modal\`), when it takes its own Surface as past T, and casts its shadow once content is under it. Sliding away reads the root scroller's last scroll direction with a scroll-state container query (\`scroll-state(scrolled: block-end)\`), together with the third flag, and keeps the header while a panel is open or the keyboard is in it (\`:has(:modal, :popover-open, :focus-visible)\`). Where a browser lacks scroll-driven animations (Firefox as of 2026-11), a small polyfill sets the same three flags on the root as the page scrolls; where it lacks scroll-state queries (Firefox and WebKit), another writes the last relative scroll direction on the root as an attribute that parallel selectors read. Each loads only where \`CSS.supports\` says the feature is missing, the second only for a header that slides away, and both set only what the CSS reads. Without them the header is opaque with its shadow from the start, and does not slide away.

**Megamenu.** The menu button opens a panel under the bar, a modal \`<dialog>\` the button opens with no script (\`commandfor\` and \`command="show-modal"\`, \`closedby="any"\`), placed absolutely in the top layer by the bar as its anchor (\`anchor()\`), its background edge to edge on the header's Surface and its content in the content area, with a 1 px hairline in \`border\` at its top and the \`panel\` shadow, and in dark mode a hairline at its bottom as well, since the shadow does not show there. Its rows stand 2rem apart, with 2rem above and 2.5rem below. Each level-1 item is a column, 2rem 1.5rem apart, headed by a link to its hub page in the h6 style, optionally numbered "01 /" in the label typeface in \`link\`, with 0.875rem below it. Its level-2 links stand under it, 0.875rem apart, in the body style in \`text\`, with no underline until hovered; each may have a description under it at 0.75 times the body size, in \`text-muted\`. In a window of 60rem or less the columns are two, and at 37.5rem or less one. An optional row above holds three columns of content, and an optional row below holds small links in \`text-muted\` under a hairline, 1.25rem above them; both go once the columns fall to two. The panel comes in with a fade and a 0.625rem slide down. It locks the page's scroll (\`overflow: hidden\` on the root while it is open) and scrolls inside when taller than the window; Esc or a click outside, the bar included, closes it, focus stays inside it while it is open and returns to the button. Only one panel is open at a time.

**Language list.** The globe opens a small list under it, a native popover (\`popovertarget\`), placed absolutely in the top layer by the globe as its anchor, 0.625rem below it, its end edge on the globe's end edge (\`position-area: block-end span-inline-start\`). It stands on the \`page\` Surface, at least 9.5rem wide, with 0.375rem padding, a 1 px \`border\`, control radius and the \`panel\` shadow. Each language stands in its own name, with 0.4375rem 0.625rem padding, the current one in the emphasis weight, and leads to the same page in that language.

**Search box.** The magnifier opens it under the header. The whole window, the header and the footer included, is covered by the \`page\` background at 62% opacity, over the page blurred by 0.75rem when the design says so: the blur is the dialog's \`::backdrop\` (\`backdrop-filter\`), and the fade a layer fixed to the window inside the dialog, which clicks pass through; both come in with a fade while the box slides down 0.625rem, and the dialog itself does not move, since a moved dialog would hold its fixed layer within itself. On it, 1.5rem below the header (0.75rem in a window of 37.5rem or less), a box is centred, as wide as the content area allows up to 36rem, on the Surface the design chose: 1.5rem padding (1.25rem in a window of 37.5rem or less), card radius, a 1 px \`border\` and the \`panel\` shadow, its parts 0.875rem apart. It holds an optional "Search" heading in the h5 style; a row with the field, which takes what the button leaves, and a filled Search button 0.625rem after it; and optional starting links in small type, in \`link\`, underlined, 0.375rem 1.125rem apart. In a window of 22.5rem or less the button goes under the field at full width. The field stands on the \`page\` Surface: \`border-strong\` 1 px, control radius, 0.625rem 0.75rem padding. Empty, it shows what the design chose: nothing, the site's own word for Search as its placeholder (in \`text-muted\`), or a magnifier at the icon size in \`text-muted\`, centred on the field's height where the words begin, which goes as soon as the visitor types, as a placeholder does (give the field a placeholder of one space, and hide the icon while \`:placeholder-shown\` does not match). A close icon control sits 0.75rem from the box's top end corner where the design has one; with no heading, the box keeps 3.75rem above the field for it. It is a modal \`<dialog>\` like the megamenu: focus moves to the field (\`autofocus\`), Esc closes the box, a click on the header lands on the backdrop and closes it by the dialog's light dismiss (\`closedby="any"\`), and a click beside the box lands on a transparent close button behind it, so a pointer closes it with no close button too; focus returns to the magnifier.

**A hint of the page** (where the design makes the header translucent). Where the bar is not clear, its background is its Surface's at an opacity of its own, and so is the megamenu's and the open language list's, each over the page blurred by 1rem (\`backdrop-filter: blur(1rem)\`), so what lies under it shows only as a hint. The opacity is the least at which every role the layer draws on its background keeps its contrast over any page, from black to white: \`text\`, \`text-muted\` and \`link\` at 4.5:1, and \`border-strong\`, \`focus\` and \`button-background\` at 3:1, the background laid over the page as CSS lays a colour of that opacity over another; and never under ${Math.round(TRANSLUCENT_LEAST * 100)}%, so the page is only sensed. For the \`page\` Surface that is ${opacityWords(r.surfaces, 'page')}, for \`brand\` ${opacityWords(r.surfaces, 'brand')}. Clear over the page's start, the bar stays clear, with no blur. In print the bar is opaque.

**Motion.** The header's colours change over the feedback duration, and its slide away and back over the movement duration (see Shared rules).`;
}

function footerRecipe(r) {
  const end = r.footer?.['b-align'] === 'end';
  return `### Footer

**Type.** All of the footer is in the small size and line height. The lower band takes the label size only: its typeface, weight, case and letter spacing stay the footer's. Text is \`text\`, quieter text \`text-muted\` at most 30em wide, and a cell's heading takes the h5 style.

**Bands.** An upper band and a thin lower band, each on its own Surface, edge to edge, with its content in the content area. The upper band has the \`band\` space above and below and \`band-run\` between its rows; the lower band has 1.25rem above and below and 0.5rem between its rows. Two bands on one Surface close up as any two Bands do: the upper loses its end space, and the lower starts with \`band-run\`.

**Cells.** Each band is a grid of two columns and two rows, cells A1, B1, A2 and B2. Column A takes a third of the content area less the column gap, \`(content area − column gap) / 3\`, and column B the rest, after the column gap. A row is as tall as it needs, and an empty row or column takes no room. One filled cell spans all four; two in one column each span their row; two in one row keep their columns; for the rest, the design's fill rule says which neighbour an empty cell gives way to. A cell's content box is as small as its content allows, at the top of the cell, against its start edge in column A and its end edge in column B, whatever the cell has come to cover; its parts stand in a column the component gap apart. ${end ? 'Text in column A is start-aligned, and in column B, as this design has it, end-aligned: a box\'s parts and every line in it end at its end edge (`text-align: end`, its parts placed at the end), and a row of links or icons there wraps from the end.' : 'Its text is start-aligned, in column B too, where the box stands at the end.'}

**Content.** What stands in the cells is the site's own: typically the brand, social icons, a short text and links in the upper band, and address, registration and legal links in the lower. Links stand inline, parted by a • in \`text-muted\` with 0.7em on either side, and no line starts with a •.${end ? ' In column B, where the text is end-aligned, the • follows each link instead, and no line ends with one.' : ''} A link is \`text\`, underlined 0.22em below the baseline only on hover and on the current page. Icon links stand in a wrapping row 1rem apart, each icon 1.75rem. The brand is the header's (logo, name, as the header shows them, without the slogan), its logo at most 14rem wide; on a Surface dark in both modes use the dark logo, elsewhere the one for the mode.

**Lines.** Hairlines in \`border\`, only where the design asks for them: one between the rows, one between the columns. A line never parts two colours or crosses a merged cell, and stops at the content unless the design says otherwise.

**On a phone.** Where the footer is 37.5rem wide or less, each band is one column with the side margin as its inline padding: the upper band column by column (A1, A2, B1, B2) and the lower band row by row (A1, B1, A2, B2), every box and its text at the start edge, and no lines. Write each band's cells in that order in the document, so reading and stacking orders agree, and place them on the wide grid by their own column and row.

**Attachment.** At the end of the page, it scrolls in after the last Band. At the edge of the screen, it lies still at the window's bottom under the page, which slides off it as the reader reaches the end. This holds only while the whole footer fits in the window, a footer exactly as tall included; a footer taller than the window is at the end of the page, in the flow. A small script, loaded only by a footer at the edge of the screen, compares the footer's height with the window's, with a ResizeObserver on the footer and the window's resize event, which a change of text size also fires, and sets one state on the footer saying whether it fits. While it fits, the footer is \`position: sticky\` at the window's bottom edge (\`inset-block-end: 0\`), under the page's main, which is opaque, \`position: relative\` and above it. Without the script the footer simply stands at the end of the page. While keyboard focus is in the footer (\`:has(:focus-visible)\`) it is \`position: relative\`, where the browser shows what has focus.

**Where page and footer meet.** The page lies over the footer, so any shadow falls from the page's bottom edge onto the footer, under either attachment. Where the design gives the page its shadow, the \`page\` shadow always shows there. Where it does not, and the footer is at the edge of the screen, the page casts the \`page\` shadow anyway when its last colour (its last Band's Surface, or the page Surface where the last child has none) is the same as the footer's first band, since its edge must show; one rule per Surface kind compares the two in CSS. Wherever the two colours are the same and no shadow results (the design has no shadows, or the page's shadow is off and the footer is at the end of the page), a 1 px hairline in \`border\` parts them; a design may also ask for that line always. In dark mode the hairline also stands wherever the page casts its shadow on the footer, since a shadow does not show on dark colours. Different colours need nothing more.`;
}

function heroRecipe(r) {
  const scrim = (kind) => {
    const s = r.surfaces[`picture-${kind}`]?.light.scrim;
    return s ? `${s.color} at ${s.opacity} opacity` : null;
  };
  const dark = scrim('dark'), light = scrim('light');
  return `### Hero

**What a hero can be.** The design sets the default and a page may depart from it: the picture none, behind the text under an overlay, or beside it at the inline start or end, inside the content width or bleeding to the window's edge; for no picture or one beside, the background none or a Surface; for a picture behind, a dark or a light overlay; a height of a third, half, two thirds or all of the screen; the text at the top, in the middle or at the bottom, and, with no picture beside it, at the start, centre or end of the content width; the heading in the h1 or the display style; and the page's H1 in the hero or first in the next section. This design's choices are under This design's frame.

**The band.** A hero is a Band with the \`band\` space above and below its text, and it keeps its end space even where the next Band has its Surface, so the middle is the true middle. Its height is at least its share of what the header leaves of the window, \`100svh\` less the header's height, or of all \`100svh\` when the page starts under the header; taller content makes it taller.

**The text.** From the top: the trail, when the H1 is here; a logo, where a picture stands before the text, at its own proportions, at most 16rem wide and 4rem tall, the column gap below it; the eyebrow in the label style, \`text-muted\`; the heading in the chosen style, and an article's subheadline under it; the deck in the lead style, \`text-muted\`; then the actions (Actions), the column gap below the deck, with fine print under them as their note, the component gap apart. The last picture a hero holds is its picture; where the design has no picture but the hero holds one, it stands beside the text at the end. Heading, subheadline and deck are at most the Narrow measure wide, a display heading at most 14em. With no picture beside it, the text block is as wide as its words and moves across the content width; its lines stay start-aligned.

**A picture behind.** It covers the hero, centred, on the \`picture-dark\` Surface (or \`picture-light\` for a light overlay), whose roles colour everything on it, such as \`picture-dark-text\`, \`picture-dark-text-muted\`, \`picture-dark-link\`, \`picture-dark-border-strong\` and \`picture-dark-button-background\`. The overlay is one layer of ${dark || 'the scrim colour'}${light ? ` (light: ${light})` : ''}, the strength at which the text on it passes its contrast check over any picture, from black to white. So wherever text stands the layer has exactly that strength, and nowhere is it stronger: where fades overlap they never add up past it, so the picture is never covered more than the check needs. With the text at the bottom, the layer has its full strength from the hero's bottom edge up to the top edge of the text block. Above that it fades out over \`clamp(6rem, 24svh, 16rem)\`: going up from the text's top edge it has 84% of its strength a quarter of the way, 50% halfway, 16% at three quarters and nothing at the end, and the picture is clear above. With the text at the top it is the mirror: full strength from the hero's top edge down to the text's last line, then the same fade going down. In the middle the layer lies evenly over the whole picture. Under a transparent header the header's words keep the full strength behind them.

**A picture beside.** The content area is split into two equal halves with the column gap between them; the text stands in one half at the chosen place, and the picture fills the other half's height, cropped to cover, with the card radius. A bleeding picture runs to the window's edge on its side and through the hero's top and bottom space, with no radius. In a window of 40rem or less the picture stands above the text, at least 16:9 of its own width, with the column gap below it, and the hero grows when the two need more than its share.`;
}

export function frameSections(resolved) {
  if (!resolved.header) return '';
  return [frameWords(resolved), headerRecipe(resolved), footerRecipe(resolved), heroRecipe(resolved)].join('\n\n');
}
