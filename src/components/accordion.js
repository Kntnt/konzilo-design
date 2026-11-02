// Astro renders slotted items first. Group their native details on the server,
// so callers can compose AccordionItem slots without passing an instance name.
export function groupAccordion(markup, name) {
  return markup.replace(/<details\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, (tag) => {
    if (!/\bclass=(?:"[^"]*\bkn-accordion-item\b[^"]*"|'[^']*\bkn-accordion-item\b[^']*')/.test(tag)) return tag;
    const clean = tag.replace(/\sname=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return name ? clean.replace(/>$/, ` name="${name}">`) : clean;
  });
}
