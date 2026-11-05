// No colour fails the contrast check any more, yet the tool must still cope if one ever does. So a test
// gets a colour that fails: the tool's own copy of the generator treats this one as failing link-hover.
export const failingColour = '#00be58';

export async function failContrastOn(page) {
  await page.route('**/src/generator/surface.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace('export function surfacePairs(surface, page = surface) {', `export function surfacePairs(surface, page = surface) {
  const pairs = actualPairs(surface, page);
  if (globalThis.failingColourChosen && pairs['link-hover']) pairs['link-hover'] = { ...pairs['link-hover'], passed: false };
  return pairs;
}
function actualPairs(surface, page = surface) {`)
      .replace('export function surfaces(settings, palette) {', `export function surfaces(settings, palette) {
  globalThis.failingColourChosen = settings['brand-colors'].primary === '${failingColour}';`);
    await route.fulfill({ response, body });
  });
}
