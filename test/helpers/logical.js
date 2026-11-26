// What names a physical side or axis, where the library's CSS writes logical properties for a right-to-left page
// (components.md, How a component is built): a property of a width or a height, or of a side, an inset, a margin, a
// padding or a border, or a corner's radius.
export const PHYSICAL = /^(?:(?:min-|max-)?(?:width|height)|left|right|top|bottom|(?:margin|padding|inset)-(?:left|right|top|bottom)|border-(?:left|right|top|bottom)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius)$/;
