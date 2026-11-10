// Roles a Surface has in the generated CSS but that DESIGN.md and the presentation leave out. The owner's rule
// (2026-11-10): a role stays where it shows in the design tool, and goes where it does not. Every role shows today:
// the accent Surface's border roles came back the same day, when a hero and a section could take accent
// (docs/spec/plates.md). The emitted CSS always keeps every role.
export const UNSHOWN_ROLES = {};
export const shownRole = (kind, role) => !UNSHOWN_ROLES[kind]?.includes(role);
