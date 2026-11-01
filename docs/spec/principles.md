# Library principles

Records the library principles and the CSS framework decision, with their status and reasoning.

Each point is marked **owner** (his statement), **proposed** (put to him, not confirmed), *decided* or *confirmed* (he chose or approved it, usually after one question at a time) or **open**.

## The library

- **Owner:** a component library and a CSS framework of Kntnt's own for Konzilo/Blueprint; the reference design is an instance of it.
- **Owner:** each recurring part has a default solution that a site starts from and may depart from ("Det är inte så att det alltid måste vara exakt på det här sättet").
- **Owner:** the header and the footer are components that, unlike the others, are only of use in exactly that position.
- **Owner:** the page itself may be a component, since it has properties of its own and the footer must work together with it (page.md and footer.md).
- **Owner, question:** should body text be a component of its own (page.md, The Reading Area, point 8)?

## The CSS framework and Lumos

- ***Decided* (2026-11-01):** no ties to Lumos at all; Kntnt builds its own framework.
- **Owner, leaning (2026-10-31):** drop the idea of using Lumos. Lumos may be a starting point and much may be reused from it, but Kntnt builds its own component library and CSS framework and does not depend on Lumos.
- Not yet acted on. It touches Blueprint's uncommitted ADR 0035 (allowing Lumos as a base), whose three points the owner deferred.
