# The header

Records the header behaviour, layout and items, with their status and reasoning.

**Owner (2026-10-31)**, his description in short:

- **Attachment.** The header is either fixed at the page's top and scrolls out of the window, or *sticky*, his word: always at the window's top, its look and behaviour depending on where the reader is and which way they scrolled.
- **Page start.** At the top, the page's top edge meets a sticky header's bottom edge, like a non-sticky header, or lies under the header and meets the window's top edge. Then the header may be transparent at the top and turn opaque, by a transition, a few pixels down, and stay so; its content colour may change with it, dark to light or light to dark.
- **Sliding away.** A sticky header may slide up out of the window a little way down, and come back when the reader starts scrolling up.
- **Not wanted:** switching to another header, or shrinking it.
- **Layout.** A start-aligned left column and an end-aligned right column; the items in each are laid out horizontally, with one gap common to the header.
- **Items:** identity, menu, language switcher, search icon, CTA button.
- **Identity:** brand plus an optional slogan; the brand is a logo (an image, preferably SVG) and/or a name. Logo and name, and brand and slogan, are each aligned side by side (top, middle, bottom) or stacked (left, centre, right).
- **Menu:** a link menu, a horizontal row of links that cannot show submenus, or a menu button, a word and/or an icon. The default button is "Menu" with a down arrow; a hamburger icon must be possible.
- **Giving way.** When the columns cannot keep the gap between them without wrapping, the link menu is replaced entirely by the menu button; if that is not enough, the word before the icon goes.
- **Megamenu.** The menu button opens and closes a responsive megamenu, exactly the reference design's model: level 1 on top as a heading, level 2 in columns under each, optional descriptions. Static or dynamic content may sit in a row above or below the menu (the reference design: three cards above, for the latest press release, the latest report and the next event; a contact link and a line of text below). These rows go when the screen gets too small.
- **Language switcher:** looks like a link of the link menu. With two languages it shows the other; with more, a submenu of languages. Later the same day he replaced this: always a globe, no language named.
- **Search icon:** a magnifier that opens and closes a search box. He recalled a good solution in the reference implementation: a centred dark box under the header, over a blurred page.
- **CTA button:** a button with a call to action, linking to a popup or a page.
- **Arrangements** (his later word, 2026-10-31, replacing the two "common combinations" of his first description): there are only three, and each may show any one or more of its items:
  - A: left identity; right search, language, link menu, menu button, CTA.
  - B: left identity, link menu; right search, language, menu button, CTA.
  - C: left identity, link menu, search; right language, menu button, CTA.

**Proposed definition** (put to the owner 2026-10-31; the reference implementation shows it). The owner settled the open points the same day, marked *decided*: the link menu, the hamburger, T, the globe, the giving-way steps and where moved items go. The rest he has seen but not confirmed point by point.

*Behaviour*

1. **Attachment:** `flow` or `sticky`.
   - `flow`: the header is the page's first part; it leaves the window as the reader scrolls down and returns at the top.
   - `sticky`: the header's top edge is at the window's top edge at every scroll position, except while it has slid away.
2. **Page start** (sticky only): `below` or `under`.
   - `below`: at the top, the page begins at the header's bottom edge, the same picture as `flow`.
   - `under`: the page begins at the window's top edge, behind the header. The first band's content then starts below the header, and the first band declares its polarity, light or dark, which the header's top appearance follows. An opaque header over the page's start would only hide it, so `under` always means transparent at the top.
3. **Two appearances** (`under` only). At the top the header is transparent, with content in the first band's foreground. Past a threshold T it takes its own opaque surface and foreground. Background and content colour change together, in one short transition, and change back above T.
   - Everything follows the content colour: the logo must be a one-colour SVG that follows it, or come in two versions. The CTA keeps a button surface that suits each appearance.
   - Opening a panel does not change the appearance, which follows the scroll position only (proposed 2026-10-31, replacing "an open panel shows the opaque appearance": the owner found the switch to white disturbing, worst for the globe's small list). Over a dark first band the open megamenu then hangs under a dark bar, as under a brand-coloured header.
   - The opaque surface is the header's own setting, the page's colour or the brand colour; with the brand colour over a dark first band, only the background fades in and the content stays light.
   - T is a small fixed distance, reached before any of the first band's content reaches the header: 24px (*decided*).
4. **Sliding away** (`autohide`, sticky, with either page start):
   - Scrolling down past the header's own height slides it up out of the window. The first scroll up of more than a few pixels brings it back; a few pixels of jitter are ignored.
   - At the top it always shows. It stays while a panel is open or the keyboard is in it (`:focus-visible`, so a button clicked with the mouse does not hold it), and focus entering it brings it back.
   - With `under`, it keeps its transparent appearance on the way down until it has slid out of sight, changes while hidden, and comes back opaque; at the top it turns transparent again (*decided* 2026-11-01: the owner found the switch from transparent to opaque just before it slid away flickering and disturbing). While it cannot slide away, it turns opaque at T as usual.
5. **Not supported:** switching to another header; shrinking.
6. **Reduced motion:** the slide and the switch happen without movement.
7. **Nothing hidden behind it:** while a sticky header shows, the page's scroll padding equals its height, so neither focus nor an anchor target ends up under it (WCAG 2.2, 2.4.11).
8. **Shadow and line:** the upper layer casts the shadow, as for the page and the footer (page.md, point 4; footer.md, Attachment). A sticky header casts its shadow only when page content lies under it. A hairline parts header and page only when nothing else does: same colour as the first band, and no shadow. This is a proposal mirroring the footer.
9. **Print:** `flow`, without the interactive parts.

*Layout*

10. **Width:** the background runs edge to edge; the content lies in the page's content area (page.md, point 2).
11. **Groups and arrangement:** a start group and an end group, in one of the owner's three arrangements A, B or C (above). The arrangement fixes each item's group and place; the header shows any of them, and those left out leave no gap. Each group holds its items in a row with one gap G common to the header, and the groups keep at least G between them. Everything is centred vertically on the bar's centre line, and the bar's height follows its tallest item plus padding.
    - **Read as two choices:** the link menu's side and the search icon's side, where the search icon sits at the start only with the link menu. Without a link menu A and B coincide; without the search icon too, all three do.
    - **What holds in all three:** the identity comes first and the CTA last; the menu button stands just before the CTA; the language switcher is in the end group. In A the link menu stands beside the menu button, so the button takes over where the links were.
    - **Moved items:** search, language and CTA have the same order in all three, so the megamenu's top always reads search field, languages, CTA.
12. **Giving way.** The content never wraps. When it would, the header takes steps in order until it fits, re-evaluated at every width. A step either drops something that is only looks or moves something with a function into the megamenu, so nothing with a function is lost. A step that frees no width, such as a slogan stacked under a wider brand, is skipped.
    1. (*decided*) the slogan goes, before the link menu, so that navigation stays visible longer;
    2. (*decided*) the name goes, where there is a logo beside it. Without a logo the name never goes; a logotype that contains the name has no separate name, so the step does not apply;
    3. (owner) the link menu is replaced by the menu button;
    4. (owner) the button's word goes, and the chevron becomes a hamburger (*decided*: a lone chevron does not read as a menu);
    5. (*decided*) the language switcher moves into the megamenu;
    6. (*decided*) the CTA moves into the megamenu. With the name gone, a short CTA often stays even at 375;
    7. (*decided*) the search icon moves into the megamenu, as a search field among the moved items.

    Left are the identity and the menu button. If even they do not fit at 320px, the narrowest width WCAG 1.4.10 requires, the identity scales down until the row fits, the last resort (*decided*). This happens only with a long name and no logo, or a wide logotype. It is not the shrinking he rejected: the size follows the width, never the scroll position. The name never wraps and is never cut.

    The steps are measured by a script. The panels may use the native popover, so they open without one.

*Items*

13. **Identity:** brand plus optional slogan, the brand being logo and/or name. It is required in every arrangement, with at least a logo or a name (*decided*); every other item is optional.
    - Two nested pairs, logo with name and brand with slogan. Each pair is a `row`, aligned `start`, `center` or `end` (top, middle, bottom), or a `column`, aligned the same way (left, centre, right). The order is fixed: logo before name, brand before slogan.
    - The whole identity is one link to the start page of the page's language. Its accessible name is the brand's name: the logo's alt text when no name shows, otherwise empty.
14. **Link menu:** a horizontal list of links with no submenus. The current page is marked (`aria-current`).
    - Its links are level 1 of the main menu (*decided*), so the megamenu always holds them and nothing is lost when it gives way.
    - A header with a link menu and no menu button gets one when the link menu gives way.
15. **Menu button:** a word and/or an icon; the default is "Menu" with a chevron that turns when open, the alternative a hamburger. When the word goes, the icon is always the hamburger (*decided*). It carries `aria-expanded` and `aria-controls`, and an accessible name when the word has gone.
16. **Megamenu:**
    - **Panel:** under the header, background edge to edge, content in the content area, casting its shadow on the page.
    - **Menu:** level 1 as headings, which link to their hub pages and may be numbered ("01 /"). Level 2 sits as links in a column under each heading, each with an optional description.
    - **Rows:** optional rows above and below, static or dynamic, which go on narrow screens.
    - **Columns:** one per level-1 item, up to five; then two; then one.
    - **Behaviour:** it locks the page's scroll and scrolls inside when taller than the window. Esc, the button or a click outside closes it, and focus returns to the button. Only one panel is open at a time, and the header stays while it is open.
    - **Moved items:** items moved from the bar show at its top (*decided*), before level 1 and before any row above, in the bar's order, in a row that wraps. There the switcher shows the globe followed by every language inline, so no list opens inside the panel; the search icon becomes a search field; the CTA keeps its button look.
17. **Language switcher:** always a globe icon, with no language named, however many languages there are (*decided*), so that it reads as the switcher in every arrangement, also beside the link menu in A.
    - **The list:** the globe opens a small list of every language, each in its own name (`lang`, `hreflang`), with the current one marked (`aria-current`). Each leads to the same page in that language, or to that language's start page where the page is not translated.
    - **Two languages:** the globe opens the list too, with both (*decided*): a globe names no language, so a click straight to the other one would surprise.
    - **Accessible name:** the control and the current language, e.g. "Language: English" (proposed).
18. **Search icon:** a magnifier that toggles the search panel, as in the reference implementation.
    - **Panel:** a centred box under the header, over a blurred page, with the field, a button and a few starting links.
    - **Responsive** (the owner required it, 2026-10-31): the box is as wide as the content area allows, up to 36rem, and never wider than the window. Field and button share a row, the field taking what the button leaves; where the box is too narrow for both (the reference implementation: a window of 360px or less), the button goes under the field at full width. Narrow screens get less padding.
    - **Behaviour:** focus moves into the field. Esc, the close button or the icon closes the panel and returns focus to the icon. A search goes to the site's search page with `q`, and without a script the icon is a link to that page.
19. **CTA button:** a button-styled link to a page, or one that opens a dialog. It is a complete surface of its own in both appearances.
20. **Skip link:** the header begins with "Skip to content", which shows on focus (proposed; the reference design has one).

**Open with the owner:** nothing on the header (2026-10-31). For each question he needs the problem stated and a drawn example.
