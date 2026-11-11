# Konzilo Design

A design system generator with a visual tool. You set a handful of inputs, such as brand colours,
typefaces, type scale, corners, shadows and density, and it produces a complete, checked design
system: colours for every surface in light and dark mode, a fluid type scale, spacing, and styled
components.

Everything is saved in one JSON file, the design file. Every output is made from it.

## Why use it

- **One source, many outputs.** A presentation for the client, CSS for any website, a package for
  Konzilo sites, and a `DESIGN.md` for AI agents all come from the same design file.
- **Colours that pass contrast checks.** You pick the brand colours, and the generator derives
  every background, text, link, border and button colour for each surface, in both modes. It
  refuses a design whose text would fail WCAG contrast.
- **Built for real sites.** All lengths are in rem, so a visitor's larger text size is respected.
  Components cover what a normal website needs, such as header, footer, hero, cards, lists, forms,
  tabs and accordions, and the styles work with any design the tool makes.
- **Approval before sketches.** The presentation is one self-contained HTML file. The client opens
  it offline and sees the colours, type and every component in the real design, and can comment.
- **Works with any platform.** It is made for Konzilo, but the output is plain CSS, HTML and
  Markdown:

  | Platform | What to use |
  |---|---|
  | Konzilo | The package, which reads the design file directly |
  | Astro | The package's Astro components and CSS |
  | WordPress, Drupal, any CMS | The generated CSS in the theme |
  | Static sites | The generated CSS, or the components' HTML from the gallery |
  | AI agents and other tools | The `DESIGN.md` export, with logos, fonts and icons |

## What you get

| Output | What it is | How to get it |
|---|---|---|
| Design file | `name.design.json`: your inputs and every computed value | Saved by the tool as you work |
| Presentation | A ZIP with one offline HTML file, for client approval | **Create presentation** in the tool, or `design-presentation` |
| AI export | A ZIP with `DESIGN.md`, logos, font files and icons | **Export for AI** in the tool, or `design-md` |
| Design CSS | Custom properties for every colour, size and space | `konzilo-design css` |
| Component CSS | The styles of every component | `konzilo-design components-css` |
| Konzilo package | CSS, Astro components and helpers for a Konzilo site | `npm pack`; see `docs/spec/konzilo.md` |

## Requirements

- Node.js 22 or later, and npm.
- A modern browser for the tool. Firefox is the reference; the engines behind Safari and Edge are
  tested too.
- For running the tests: Playwright's browsers.
- For fetching the typefaces again (rarely needed): [uv](https://docs.astral.sh/uv/).

## Install

```sh
git clone git@github.com:Kntnt/konzilo-design.git
cd konzilo-design
npm install
```

The commands are in `bin/`. Each runs from any folder. To run them without typing the path, add
`bin/` to your `PATH`.

## Quick start

```sh
bin/design-tool ~/designs/acme.design.json
```

1. If the file does not exist, it is created as a new design. The tool opens in your browser.
2. Work through the chapters: Start, Colour, Typography, Shape, Frame and Components. Every change
   is saved at once.
3. Click **Create presentation** to send the client a ZIP, or **Export for AI** to give an agent
   the design.

Stop the tool with Ctrl-C.

## The design tool

```sh
bin/design-tool <design-file> [--port N] [--no-open]
```

- The tool runs on `http://127.0.0.1:4174` by default, and only on your own machine. `--port`
  picks another port. `--no-open` starts it without opening a browser.
- **Saving.** Changes are saved automatically. There is no Save button. Before the first change in
  a session, the file is copied to `name.design.bak.json`. `bin/design-restore <design-file>` puts
  that copy back after asking.
- **Controls on the left, preview on the right.** The preview shows a real sample page at mobile
  and desktop width.
  - **Both, Mobile and Desktop** choose which preview to show.
  - The desktop width can be 1440, 1024 or 768. The percentage shows the zoom; click it for real
    size.
  - **Pictures and None** turn the sample photos on and off.
  - **Light and Dark** switch mode.
  - **Full window** gives the preview the whole window. **Own window** moves it to a second window,
    for example on another screen.
- **Undo and Redo** are in the menu, and on Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z.
- **Contrast.** If a change would make text fail its contrast check, the tool keeps the last good
  design. It turns off the presentation and the export until you fix it.

The tool does not remember anything between runs. Everything is in the design file.

## Exporting

### Presentation for the client

```sh
bin/design-presentation <design-file> [-o out.zip]
```

The command writes `name-presentation-YYYY-MM-DD.zip` beside the design file. It holds one HTML
file that works offline, with fonts, pictures and scripts inside it. The client can leave comments
in it and send them back.

### For AI agents

```sh
bin/design-md <design-file> [-o out.zip | -o out.md]
```

The command writes `name-design-md.zip` beside the design file. It holds:

- `DESIGN.md`, in Google Labs' open format: every token, every surface in both modes, and a recipe
  for every component;
- the logos;
- the font files, with their licences and `fonts.css`;
- the icons the components use, with their licences.

An agent can build a site from it with any technique. With `-o out.md` you get `DESIGN.md` alone.

### CSS for any site

```sh
bin/konzilo-design.js css <design-file> -o design.css
bin/konzilo-design.js components-css -o components.css
bin/konzilo-design.js fonts <design-file> -o fonts
bin/konzilo-design.js logos <design-file> -o logos
```

- `design.css` holds the design's values as `--kn-*` custom properties, for each surface and mode.
- `components.css` styles the components' `kn-*` classes. It is the same for every design and
  reads its values from `design.css`.
- `fonts` copies the typefaces the design uses, with licences and `fonts.css`.
- `logos` writes the logo files.

Load the stylesheets in a theme or page. The markup each component expects is shown in the
gallery (see Development) and described in `docs/spec/components.md`.

## Using it with Konzilo

A Konzilo site installs this package as a tarball and reads its design file at build:

```js
konzilo({ ...await fromDesign('./design/site.design.json'), /* … */ })
```

`docs/spec/konzilo.md` gives the full setup. `docs/spec/directives.md` gives the HTML for Konzilo's
content directives.

## Commands

| Command | What it does |
|---|---|
| `design-tool <file> [--port N] [--no-open]` | Starts the tool on the design file, creating it if needed |
| `design-presentation <file> [-o out.zip]` | Makes the client presentation |
| `design-md <file> [-o out.zip\|out.md]` | Makes the AI export |
| `design-check <file>` | Checks the file: format, that the values match the inputs, and contrast |
| `design-restore <file>` | Puts back the backup from before the last session's first change |
| `design-gallery` | Builds the component gallery and opens it |
| `design-test` | Runs the tests |
| `design-fonts` | Fetches the typefaces again into `src/fonts/` (needs uv) |
| `konzilo-design.js <command>` | The underlying command. Besides the above: `resolve`, `css`, `components-css`, `fonts`, `logos` |

Every command that takes a design file needs one, and keeps no hidden state. Only `design-tool`
and `konzilo-design.js resolve` change the design file, and they back it up first;
`design-restore` puts that backup back.

## The design file

One JSON file holds the whole design:

- `inputs`: what you set in the tool;
- `project`: the client's name, logos, slogan and contact;
- `resolved`: every value computed from the inputs, so a consumer never has to recompute colours.

`schema/design-file.schema.json` defines it, and `examples/example.design.json` is an example. A
file whose values no longer match its inputs is refused. `design-check` tells you why.

## Repository layout

```text
bin/            the commands
src/            the generator, CSS, components, directive helpers, DESIGN.md writer, fonts
tool/           the design tool
presentation/   the client presentation
gallery/        the live component gallery
schema/         the design file's JSON schema
examples/       an example design file
docs/           specifications and decisions
scripts/        the script that writes THIRD-PARTY.md
test/           the tests
```

## Development

```sh
npm test               # all tests; browser tests need Playwright's browsers
npm run gallery        # builds gallery/dist/index.html, every component in one page
```

Install the browsers once with `npx playwright-core install firefox webkit chromium`.

The specifications in `docs/spec/` record every decision and are the reference when you change
something. `AGENTS.md` lists which one to read for what, and [`GLOSSARY.md`](GLOSSARY.md) says what
the project's words mean.

[`CONTRIBUTING.md`](CONTRIBUTING.md) says how to report a fault, propose a change and send a pull
request. [`CHANGELOG.md`](CHANGELOG.md) lists what has changed.

## Licence

Konzilo Design is free software under the GNU Affero General Public License, version 3 or later
([`LICENSE`](LICENSE)), the same licence as the rest of Konzilo.

[`SITE-EXCEPTION.md`](SITE-EXCEPTION.md) adds one permission. Design files, everything the tool
makes from them, and the stylesheets, components and page scripts a website uses may be used in any
site or theme, on any platform, on any terms. The tool itself stays under the AGPL: if you change it
and offer it to others over a network, you share your changes.

The typefaces, icons and sample photos are the work of others and keep their own licences, which
are copied with every export. [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md) names them, and
[`THIRD-PARTY.md`](THIRD-PARTY.md) lists every package the repository installs for its development.

A contribution to this repository needs the contributor agreement
([`CONTRIBUTOR-AGREEMENT.md`](CONTRIBUTOR-AGREEMENT.md)), the same as the Konzilo core's. The name
Konzilo is a trademark, and [`TRADEMARKS.md`](TRADEMARKS.md) says how it may be used.
