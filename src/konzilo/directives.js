// The components a Konzilo site registers for this package's directives and post-list presentations, by name, each the
// package's own path, in the form konzilo({ directives, presentations }) takes them (docs/spec/konzilo.md, How a site takes
// its design). A site spreads them and adds its own, such as its form component; the core refuses a presentation its site
// description does not declare, so a site takes only those it declares.
const PACKAGE = '@kntnt/konzilo-design';

export const DESIGN_DIRECTIVES = Object.freeze({
  hero: `${PACKAGE}/directives/Hero.astro`,
  section: `${PACKAGE}/directives/Section.astro`,
  aside: `${PACKAGE}/directives/Aside.astro`,
  list: `${PACKAGE}/directives/List.astro`,
  cards: `${PACKAGE}/directives/Cards.astro`,
  accordion: `${PACKAGE}/directives/Accordion.astro`,
  tabs: `${PACKAGE}/directives/Tabs.astro`,
  toc: `${PACKAGE}/directives/Toc.astro`,
  choice: `${PACKAGE}/directives/Choice.astro`,
  eyebrow: `${PACKAGE}/directives/Eyebrow.astro`,
  small: `${PACKAGE}/directives/Small.astro`,
  breadcrumbs: `${PACKAGE}/directives/Breadcrumbs.astro`,
});

export const DESIGN_PRESENTATIONS = Object.freeze({
  cards: `${PACKAGE}/presentations/Cards.astro`,
  featured: `${PACKAGE}/presentations/Featured.astro`,
  filtered: `${PACKAGE}/presentations/Filtered.astro`,
});

// Where a site's description takes the declarations and the checks of the directives from.
export const DESIGN_COMPONENTS_FROM = `${PACKAGE}/directives/components.json`;
export const DESIGN_COMPONENT_CHECKS = `${PACKAGE}/directives/checks`;
