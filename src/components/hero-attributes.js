// What a Hero's choices write on its section. The component and the design tool's live sample both write these, so
// they cannot drift apart. The default of a choice has no attribute, and side is absent when no picture stands beside the text.
export const heroAttributes = ({ side, height, place = 'center', align = 'start' }) => ({
  'data-kn-picture': side,
  'data-kn-height': height,
  'data-kn-place': place === 'center' ? undefined : place,
  'data-kn-align': align === 'start' ? undefined : align,
});
