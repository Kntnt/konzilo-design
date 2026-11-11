# Contributing to Konzilo Design

Contributions are welcome, of every kind: a fault you report, an idea, a correction to a document, a test, a fix, a component, or something of your own that builds on Konzilo Design.

There are two kinds, and they differ in whose the work is afterwards.

| | Stand-alone work | Work in this repository |
|---|---|---|
| What it is | Something of your own that uses Konzilo Design from outside: a site, a theme, a design file, a program | A change to the files of this repository |
| Whose it is | Yours alone | Yours, with a licence to Kntnt Sweden AB |
| Its licence | As the site exception says, below | Konzilo Design's, when it is released |
| What you agree to | Nothing | The contributor agreement, once |

## Stand-alone work

Stand-alone work stays in a repository or a package of its own, and Konzilo Design's files stay as they are. It is yours. You choose its name and where it is published, and Kntnt asks for no rights in it and for no agreement.

Konzilo Design is under the AGPL, version 3 or later ([`LICENSE`](LICENSE)). Its site exception ([`SITE-EXCEPTION.md`](SITE-EXCEPTION.md)) draws the line for what you build with it:

- **A site, a theme or a design, on any platform:** license it as you like, or keep it to yourself. That holds for a design file, everything the tool makes from it, and the stylesheets, components, page scripts and icons a site copies in and changes.
- **A program that only reads design files or the CSS:** it takes no part of Konzilo Design, and the AGPL does not reach it. License it as you like.
- **Software that takes part of Konzilo Design and is no site,** such as another design tool, a page builder or a plugin that computes colours with the generator: the AGPL holds for it. Give it terms that go together with the AGPL, version 3. Whoever runs it for others over a network offers them its source.

For its name, [`TRADEMARKS.md`](TRADEMARKS.md) holds: *for Konzilo* is free to say, and Konzilo in the work's own name takes permission.

## Work in this repository

Everything that is to become part of this repository is a contribution: a pull request, a patch, or code or text in an issue that is meant to be used.

You keep the copyright in what you contribute. Before it goes in, you agree once to [Konzilo's contributor agreement](CONTRIBUTOR-AGREEMENT.md). It gives Kntnt Sweden AB a licence to release your contribution with Konzilo Design and to license it on other terms. The agreement keeps the project's terms in one hand, so that Kntnt can give the site exception a later version or license Konzilo Design otherwise. It takes nothing from you: your contribution stays yours to use as you like.

### How to agree

In your first pull request, add a line about yourself to [`CONTRIBUTORS.md`](CONTRIBUTORS.md). The commit that adds it is your agreement, and it covers what you contribute from then on.

The agreement is the one the Konzilo core uses. If your line is already in the core's `CONTRIBUTORS.md`, you have agreed, and need not add one here, but may.

If you contribute as part of your work, or someone else has rights in what you write, name them on your line. The agreement's section 4 says what you assure about them.

### What is checked before a contribution goes in

1. **Its author has agreed,** by a line in `CONTRIBUTORS.md` here or in the core's.
2. **It is its author's own work.** Where a part is someone else's, the pull request says whose it is and under which licence. Such a part comes in only under a permissive licence, such as MIT, BSD, ISC or Apache-2.0, or as a file of its own that keeps its licence and binds no other file, as the typefaces, icons and photos do. [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md) then names it.
3. **A new package has a licence on the list** in `test/third-party.test.js`, and the published package still needs no runtime dependency. `node scripts/third-party.js` writes the package's line in [`THIRD-PARTY.md`](THIRD-PARTY.md), and one that `package.json` names is named in `ACKNOWLEDGEMENTS.md` by hand. The test fails until both are done.
4. **It comes with tests, and `npm test` passes.**

Work by Kntnt's own people is Kntnt's, and needs no line.

## Reporting a fault, or proposing something

Open an issue in the repository on GitHub, `Kntnt/konzilo-design`.

- **A fault:** say what you did, what you expected and what happened. Attach the design file, or the part of it that shows the fault, and name the browser and its version.
- **A proposal:** say what you need and why. For anything larger than a fix, open an issue before you start, so that the work fits where Konzilo Design is going.

## Sending a pull request

1. Branch from `main`, and keep one change to a pull request.
2. Write or change the tests with the code, and run `npm test`.
3. Update the specification the change touches, in the same pull request (below).
4. Say in the pull request what it changes and why, and name any part that is someone else's work.
5. In your first pull request, add your line to `CONTRIBUTORS.md`.

## Setting up and running the tests

You need Node.js 22 or later and npm.

```sh
git clone git@github.com:Kntnt/konzilo-design.git
cd konzilo-design
npm install
npx playwright-core install firefox webkit chromium
npm test
```

The browser tests run in Firefox, WebKit and Chromium, which Playwright installs once. `npm run gallery` builds `gallery/dist/index.html`, every component on one page. `bin/design-tool <design-file>` opens the design tool; [`README.md`](README.md) describes the other commands.

## The project's rules

- **Every file is in English,** code, comments, documents and tests alike.
- **Every length is in rem.** That lets a visitor's larger text size take effect. px is only for what is drawn rather than read, such as hairlines, the frame, focus rings and shadows. `test/lengths.test.js` holds this, and `docs/spec/tool.md`, point 3, gives the reasons.
- **No client traces.** No file names, describes or points to a client or a client's project, not even through a colour, a name or a wording in a test fixture. Use made-up content. Client projects refer to this repository, never the reverse.
- **The specifications record every decision.** `docs/spec/` says what was decided and why, and is the reference when you change something. A change that departs from a specification updates it in the same pull request. A word means what [`GLOSSARY.md`](GLOSSARY.md) says, and a name in code is spelled as `docs/spec/names.md` says.

## Files shared with the Konzilo core

[`CONTRIBUTOR-AGREEMENT.md`](CONTRIBUTOR-AGREEMENT.md) and [`TRADEMARKS.md`](TRADEMARKS.md) are copies of the core's, byte for byte. The core's, in `Kntnt/konzilo`, are the master. A change is made there first and then copied here unchanged, and this repository follows the master's versions.
