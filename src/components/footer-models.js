// The footer's models: which cells stand where, whatever they hold. A site supplies its own content.
export const FOOTER_MODELS = ['one', 'two', 'utility', 'statement', 'tall-identity', 'tall-links'];
// Only these have a band in the second colour.
export const HAS_SECOND_SURFACE = ['utility', 'statement'];
// These have more than one row in one colour, where a line can part them.
export const HAS_ROWS = ['two', 'utility', 'tall-identity', 'tall-links'];

export function footerBands(settings, content) {
  const { model, surface, 'second-surface': second, 'horizontal-rules': rule, 'vertical-rule': verticalRule } = settings;
  if (!FOOTER_MODELS.includes(model)) throw new RangeError(`Unknown footer model: ${model}`);
  const { identity, about, explore, contact, statement, legal, legalLinks } = content;
  const band = (cells, more = {}) => ({ surface, cells, rule, verticalRule, ...more });
  const logo = (more = {}) => ({ id: 'identity', column: 'A', content: identity, ...more });
  const links = (more = {}) => ({ id: 'links', column: 'B', heading: explore.heading, links: explore.links, ...more });
  const talk = { id: 'contact', column: 'B', heading: contact.heading, text: contact.text, links: contact.links };
  const utility = { surface: second, compact: true, cells: [{ id: 'legal', column: 'A', text: legal }, { id: 'privacy', column: 'B', links: legalLinks }] };
  const opening = band([{ id: 'statement', column: 'A', columns: 2, heading: statement, level: 3 }]);
  const models = {
    one: () => [band([logo(), { id: 'links', column: 'B', links: explore.links }])],
    two: () => [band([logo({ rows: 2 }), links()]), band([talk])],
    utility: () => [band([logo({ rows: 2 }), links()]), band([talk]), utility],
    statement: () => [opening, band([logo(), links()]), utility],
    'tall-identity': () => [band([logo({ rows: 3, text: about }), links()]), band([talk]), band([{ id: 'privacy', column: 'B', links: legalLinks }])],
    'tall-links': () => [band([logo(), links({ rows: 3 })]), band([{ id: 'about', column: 'A', text: about }]), band([{ id: 'legal', column: 'A', text: legal }])],
  };
  return models[model]();
}
