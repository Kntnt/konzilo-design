// Registrations own the recognised URL grammar, player address, format and consent.
// Offline build: no accepted URL form below was live-verified. Player addresses
// follow the supplied contract. In particular these less familiar forms remain
// unverified without network access: Screen9 /embed/ID and Speaker Deck /player/ID could not be verified.
// Offline: Acast share/embed, Apple Podcasts share/embed, Datawrapper share/embed
// and LinkedIn post/embed forms could not be verified. Only these explicit forms
// are accepted; authoring-time metadata must supply an embed URL where necessary.
const video = '16 / 9';
// `start` decides what a visitor who has consented sees. Heavy video players wait behind a
// thumbnail until clicked (owner, 2026-11-02); everything else simply shows its content.
const registration = (provider, hosts, format, recognise, { start = 'direct', autoplay = false } = {}) => ({ provider, hosts, format, category: 'external-media', recognise, start, autoplay });
const clickToPlay = { start: 'click', autoplay: true };
const token = '[A-Za-z0-9_-]+';
export const embedProviders = [
  registration('YouTube', ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'], video, (url) => {
    const id = url.hostname === 'youtu.be' ? url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]
      : url.pathname === '/watch' ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1];
    return /^[\w-]{11}$/.test(id ?? '') ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }, clickToPlay),
  registration('Vimeo', ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'], video, (url) => {
    const id = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1];
    return id && `https://player.vimeo.com/video/${id}?dnt=1`;
  }, clickToPlay),
  registration('Screen9', ['api.screen9.com'], video, (url) => /^\/embed\/[\w-]+\/?$/.test(url.pathname) ? `https://api.screen9.com${url.pathname}` : null, { start: 'click' }),
  registration('Loom', ['loom.com', 'www.loom.com'], video, (url) => {
    const id = url.pathname.match(new RegExp(`^/(?:share|embed)/(${token})/?$`))?.[1];
    return id && `https://www.loom.com/embed/${id}`;
  }, clickToPlay),
  registration('Spotify', ['open.spotify.com'], 'audio', (url) => {
    const found = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)\/?$/);
    return found && `https://open.spotify.com/embed/${found[1]}/${found[2]}`;
  }),
  registration('Acast', ['acast.com', 'www.acast.com', 'shows.acast.com', 'embed.acast.com'], 'audio', (url) => {
    const found = url.pathname.match(/^\/(?:shows\/)?([\w-]+)\/([\w-]+)\/?$/);
    return found && `https://embed.acast.com/${found[1]}/${found[2]}`;
  }),
  registration('Apple Podcasts', ['podcasts.apple.com', 'embed.podcasts.apple.com'], 'audio', (url) => {
    if (!/^\/[a-z]{2}\/podcast\/(?:[\w%-]+\/)?id\d+\/?$/i.test(url.pathname)) return null;
    const episode = url.searchParams.get('i');
    if (episode && !/^\d+$/.test(episode)) return null;
    return `https://embed.podcasts.apple.com${url.pathname}${episode ? `?i=${episode}` : ''}`;
  }),
  registration('Speaker Deck', ['speakerdeck.com'], '4 / 3', (url) => {
    const id = url.pathname.match(new RegExp(`^/player/(${token})/?$`))?.[1];
    return id && `https://speakerdeck.com/player/${id}`;
  }),
  registration('Datawrapper', ['datawrapper.dwcdn.net', 'www.datawrapper.de'], '4 / 3', (url) => {
    const found = url.hostname === 'www.datawrapper.de' ? url.pathname.match(/^\/_\/([A-Za-z0-9]+)\/?$/) : url.pathname.match(/^\/([A-Za-z0-9]+)\/(\d+)\/?$/);
    return found && `https://datawrapper.dwcdn.net/${found[1]}/${found[2] ?? '1'}/`;
  }),
  registration('CodePen', ['codepen.io'], '4 / 3', (url) => {
    const found = url.pathname.match(/^\/([\w-]+)\/(?:pen|embed)\/([A-Za-z0-9]+)\/?$/);
    return found && `https://codepen.io/${found[1]}/embed/${found[2]}?default-tab=result`;
  }),
  registration('LinkedIn', ['linkedin.com', 'www.linkedin.com'], 'square', (url) => {
    const id = url.pathname.match(/^\/embed\/feed\/update\/urn:li:activity:(\d+)\/?$/)?.[1]
      ?? url.pathname.match(/^\/posts\/[\w-]*activity-(\d+)-[\w-]+\/?$/)?.[1]
      ?? url.pathname.match(/^\/feed\/update\/urn:li:activity:(\d+)\/?$/)?.[1];
    return id && `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}`;
  }),
];

export function recogniseEmbed(address) {
  let url;
  try { url = new URL(address); } catch { throw new TypeError('Embed requires a recognised provider URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new TypeError('Embed requires a secure registered provider URL');
  const registration = embedProviders.find(({ hosts }) => hosts.includes(url.hostname));
  const playerUrl = registration?.recognise(url);
  if (!playerUrl) throw new TypeError(`Unrecognised Embed URL: ${url.hostname}`);
  const { provider, format, category, start, autoplay } = registration;
  return { provider, playerUrl, format, category, start, autoplay, title: `Content from ${provider}` };
}
