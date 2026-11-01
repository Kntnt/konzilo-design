# Konzilo Design System — agent guide

## Ground rules (authoritative)

Precedence over any conflicting skill, README, or other doc unless the user overrides in the moment.

- Authoritative: this file, the files it references, and the actual code/state.
- No file here, tracked or ignored, names, describes or points to a customer or a customer
  project. Customer projects refer to this repository, never the reverse.
- Every file in English.
- Commit, push or publish only when Thomas asks.

## Non-obvious

- Thomas dictates: `/[ck]on[csz]ilo/i` means Konzilo.
- Konzilo (`~/Projects/konzilo`) is the WordPress-to-Astro core that consumes this design
  system; it is not part of this repository.

## References

- `docs/spec/principles.md` — read when defining library defaults or choosing the CSS framework.
- `docs/spec/page.md` — read when working on the page surface, content widths, bands, layers or Reading Area.
- `docs/spec/footer.md` — read when working on footer layout, attachment or its cooperation with the page.
- `docs/spec/header.md` — read when working on header behaviour, responsive layout, identity, navigation or panels.
- `docs/spec/plates.md` — read when working on tokens, roles, Surfaces, colour generation or contrast checks.
- `docs/spec/tool.md` — read when working on the design tool, inputs, presentation, exports or design file consumption.
- `docs/spec/names.md` — read when naming a token, role, Surface kind, width or design-file key, or writing CSS that uses them.
- `docs/generator.md` — read when changing the generator, design-file schema, CSS emitter or CLI.
