// The loader a following menu ends with (directives.md, `toc`): followingMenuLoader's text, with the scroll markers'
// polyfill's address as the build gives it. Every component that draws a following menu takes it from here, so all
// write one text, for which the Konzilo core's content security policy needs one hash. Only a component imports it,
// since only Vite resolves `?url`; a renderer in plain JavaScript takes it as its `loader` option.
import scrollMarkersPolyfill from './scroll-markers-polyfill.js?url&no-inline';
import { followingMenuLoader } from './table-of-contents.js';

export const scrollMarkersLoader = followingMenuLoader(scrollMarkersPolyfill);
