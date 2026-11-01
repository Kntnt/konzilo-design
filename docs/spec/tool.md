# The design system and its tool

Records the design system, tool inputs, outputs and design file, with their status and reasoning.

**Owner (2026-11-01):** Konzilo is a pre-prototype on the way to Blueprint; long term, Astro in front and WordPress or Sveltia CMS behind, switchable. The framework's foundations are the plates (plates.md) and the page, header and footer models (page.md, header.md and footer.md); two things remain, the components and a tool. The design system must serve any site, also one someone else implements in WordPress or elsewhere from it.

*Decided* 2026-11-01:

1. **A stand-alone design system**, its own repository with the tool, apart from the Konzilo core: download it, run it, tune colours and type, send the client the presentation, adjust, and export. Konzilo sites consume it; how is the assistant's proposal (below). Each site holds only its inputs and the components only it needs; Konzilo's plan, which gives each site its own design and components, changes by an ADR there. The generic decisions in this file move to the design system's repository.
2. **Inputs:**
   - one to three brand colours, ranked primary, secondary, tertiary, and always a grey scale;
   - typefaces for body, display/headings, eyebrow and, for sites with code, monospace;
   - the body size, set as at the narrowest and widest window;
   - a type scale (ratio), and for each heading level how many steps it climbs from the one below, for a faster progression where wanted; not a switch between two scales;
   - shadows, from none through barely visible and very diffuse to a hard, solid outline, with the light's angle, the elevation (how far the shadow is cast) and the intensity; the fine sliders matter less than that range. Four sliders, each mapping straight onto CSS `box-shadow` values: hardness (solid outline to diffuse), angle (the light's direction), elevation (offset, and blur at the diffuse end) and strength (zero is off). Off by default; switching on starts from the reference design's tuned shadow, which the model must reproduce exactly. Every elevation (card, the layer shadow between header, page and footer, the megamenu) takes its shadow from the same four; at strength zero the hairline rule for layers takes over;
   - one corner slider, from square through almost square (a few pixels) and discreet to clearly rounded;
   - one density slider, from very compact to very loose, with the default towards the looser side.
   Type and space are always fluid (`clamp()`); everything else follows from the inputs.
3. **Lengths:** owner's belief, for the assistant to settle: rem wherever possible, pixels at most for the base font size.
4. **Two outputs:**
   - **For people:** a live site, or a PDF, that explains the whole (colours, scales, typefaces, shadows) and shows it applied to every component; personalised with the client's name and logo; delivered before any design sketch, to get approval of colours and style.
   - **For code:** the components, HTML and CSS, all of them with all their CSS, in a form a Konzilo site takes in simply and gets exactly what was decided.
5. **The design file** (owner's idea; the assistant decided its form, 2026-11-01): the tool's settings produce one JSON file, the source, which is what is handed on; everything else is made from it.
   - `inputs`: what the tool's controls set, the only part a person changes, through the tool.
   - `project`: the client's name and logo, for the presentation.
   - `resolved`: every value the generator derived (ramps, each plate kind's roles in light and dark mode, type and space steps as min and max, radii, shadows as finished CSS values), with the generator's version, a fingerprint of `inputs` and the contrast check's result.
   - Consumers read `resolved` and need no generator, so a consumer in another language (a future WordPress plugin setting a theme's values) never reimplements the colour maths, and every consumer gets the same values. A file whose `inputs` no longer match the fingerprint is refused. Consumers: the Konzilo package, the presentation, the export, later others. Its own plain format; a DTCG export only when something needs one.
6. **Where:** the repository `Kntnt/konzilo-design` (private, created 2026-11-01), locally `~/Projects/konzilo-design`; Konzilo sites take it as a pinned package plus their design file, others take the export.
