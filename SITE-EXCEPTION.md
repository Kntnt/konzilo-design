# Konzilo Design's site exception

Version 1, 10 November 2026

Konzilo Design is free software under the GNU Affero General Public License, version 3 or any later
version, called the License here ([`LICENSE`](LICENSE)). This exception is an additional permission
under section 7 of the License. Kntnt Sweden AB, of Gothenburg, Sweden, gives it for Konzilo
Design: for what it holds the copyright in, and for what others have contributed under the
contributor agreement ([`CONTRIBUTOR-AGREEMENT.md`](CONTRIBUTOR-AGREEMENT.md)).

It draws one line:

- **The tool that makes designs is under the License.** That covers its behaviour, its functions
  and its interfaces: the design tool, the generator, the writers of the presentation and the
  exports, and the commands.
- **What a design becomes on a website is outside the License.** That covers a design file,
  everything the tool makes from it, and the stylesheets, components, page scripts and icons that a
  website or theme uses to look as the design says. They may be kept private, or shared on any
  terms, on any platform, and no website owes its visitors their source.

The line is the one that Konzilo's own site exception draws for the Konzilo core: what changes what
the software does is under the License, and a site's look and the files it serves are not. The
terms say exactly where the line runs. The cases after them show it. Where a case and the terms
differ, the terms decide.

## Terms

### 1. Words

**The Design System** is Konzilo Design: every file of its repository, `Kntnt/konzilo-design`, and
of what is released from it, such as the package `@kntnt/konzilo-design`. It covers every form,
whole or in part, changed or not.

**The Tool** is the part of the Design System that makes designs and outputs:
- the design tool;
- the generator, which turns a design's inputs into its values;
- the writers of the presentation, of `DESIGN.md` and of the CSS;
- the commands;
- the tests.

**A Design File** is a file with a design's inputs and values, such as `name.design.json`, whoever
made it.

**Output** is every file the Tool writes from a Design File:
- the Design File's computed values;
- the presentation;
- the export for AI agents, with `DESIGN.md` and the logos, fonts and icons beside it;
- the CSS the commands write;
- the fonts and logos they copy.

**Site Parts** are the files of the Design System made for websites to use:
- the stylesheets;
- the components, and the HTML they describe;
- the page scripts that run in a visitor's browser, each of them one of these:
  - a script that only shows, hides or moves what is on the Site's own pages, such as a header
    that slides away, or one that stands in for a feature of HTML or CSS where a browser lacks it;
  - the embed script, which only loads what the page itself names, such as a video from another
    site, once the visitor allows it;
  - the consent script, which only asks for the visitor's consent and remembers the choice in the
    visitor's own browser;
- the helpers that a website calls to write that HTML;
- the icons.

**A Site** is a website, a theme, a template or a design for one, on any platform, together with the
files that make it. Konzilo, WordPress, Drupal, Astro and a static site are all examples. Software
that is not a website, a theme or a template, such as another design tool or a page builder, is not
a Site.

### 2. What this exception permits

**2.1 Design Files and Output.** You may use, change, copy, serve and share Design Files and Output
on any terms. You need not offer any source with them, nor keep any notice in them, although they
hold parts of the Design System. For example, the presentation holds the component stylesheets and
scripts, and the CSS holds the components' rules.

**2.2 Site Parts in a Site.** You may copy Site Parts into a Site, change them there as far as 3.3
allows, combine them with the Site's own files, and build, host and convey the result, and the
License does not apply to the Site because of it. In particular:

- you may keep the Site and the Site Parts in it private, or license them on any terms;
- a Site and its Site Parts are no part of the Corresponding Source of the Design System, so
  sections 6 and 13 of the License do not make you offer them;
- the same Site Parts may serve many Sites, or be sold as part of a theme or a design;
- a page that is not part of the Site may load a Site Part from it, such as the consent script,
  and does not come under the License by that.

Where a file is kept, who wrote it, and whether one Site uses it or many make no difference.

**2.3 What people write.** The License does not apply to the text, pictures and logos that people
put into a Design File or a Site.

### 3. What stays under the License

**3.1 The Tool.** The License holds for every copy of the Tool and every change to it. If you let
others use a changed Tool over a network, for example as a hosted design service, you offer them
its source, as section 13 says.

**3.2 Software that is not a Site.** This exception gives nothing to software that takes a part of
the Design System, by import or by copy, without being a Site. Examples are another design tool, a
theme generator, a page builder, or a plugin that computes designs with the generator. The License
alone decides for it. A program that only reads Design Files or Output takes no part of the Design
System, and the License does not reach it.

**3.3 What a page script does.** This exception does not permit changing what a page script of
the Design System does, in its source or in a built copy, such as making it send, fetch or store
more than its kind in section 1 says, nor taking a page script out of a Site or of Output to build
other software with it. Both are uses of the Design System, and the License holds for them. A page
script of a Site's own is not the Design System's and stays the Site's, whatever it does.

**3.4 The name.** This exception gives no right to the name Konzilo or to Konzilo's logos.
[`TRADEMARKS.md`](TRADEMARKS.md) says how they may be used.

**3.5 Everything else, and doubt.** What this exception does not name stays as the License has it.
Where it is not plain that a file is a Site Part or Output, it is not.

### 4. Reach and versions

This exception covers what Kntnt Sweden AB holds the copyright in, and what others have contributed
under the contributor agreement, which lets Kntnt release it with this exception. Some files of the
Design System are the work of others and remain under their own licences, which travel with them:
- the typefaces in `src/fonts/`, each with its licence beside it;
- the icons from Lucide (ISC) and Tabler (MIT), with their licences in `src/components/`;
- the sample photos in `presentation/pictures/`, under the Unsplash licence.

The exception goes with the Design System under any later version of the License as well. Kntnt
Sweden AB may give a later version of this exception with later releases. A release keeps the
version it was released with.

## Cases

**Outside the License, by this exception:**

| Case | By |
|---|---|
| A design file made with the tool, and the values in it | 2.1 |
| The presentation sent to a client, with its stylesheets and scripts inside it | 2.1 |
| The AI export, and a site or theme an agent builds from it | 2.1 |
| The CSS the commands write, used in a WordPress or Drupal theme or a static site | 2.1, 2.2 |
| The package's stylesheets, components and page scripts in a Konzilo or Astro site | 2.2 |
| The consent and embed scripts on a site, remembering a visitor's choice and loading a video | 2.2 |
| A visitor's browser receiving the site's pages, stylesheets and scripts | 2.1, 2.2 |
| A component's stylesheet, copied into a theme and changed to suit it | 2.2 |
| The same theme, built on Site Parts, sold to many clients | 2.2 |
| A client's name, slogan, logos and texts in a design file | 2.3 |

**Under the License, as without this exception:**

| Case | By |
|---|---|
| A change to the design tool, the generator, the exports or the commands | 3.1 |
| A changed design tool offered to others as a web service | 3.1 |
| A page builder or another design tool that uses the generator's code | 3.2 |
| A plugin that computes colours with the generator for sites that have no design file | 3.2 |
| The consent script changed to send what a visitor chooses to a server | 3.3 |
| The header's polyfill taken out of a site into another product | 3.3 |

**Not for this exception to say:**

| Case | Why |
|---|---|
| A program of its own that only reads design files or the CSS | It takes no part of the Design System (3.2) |
