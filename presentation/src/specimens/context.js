import { pictures, items } from '../samples.js';

export function context(project, resolved, ownPictures) {
  const images = pictures(resolved.ramps, ownPictures);
  const logo = project.logo || project['logo-dark'];
  return {
    ...images,
    list: items(images.landscapes),
    identity: {
      name: logo ? undefined : project.name,
      label: project.name,
      href: '#home',
      logo: logo
        ? { light: logo, dark: project['logo-dark'] || logo }
        : undefined,
    },
  };
}
