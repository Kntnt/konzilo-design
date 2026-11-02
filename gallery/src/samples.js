// Self-contained, invented imagery; no asset requests or third-party content.
const image = (markup) => `data:image/svg+xml,${encodeURIComponent(markup)}`;
export const landscape = image('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="#c9dcd5"/><circle cx="600" cy="110" r="55" fill="#f3d28d"/><path d="M0 310 220 120 490 450H0Z" fill="#658b7d"/><path d="m230 450 320-260 250 140v120Z" fill="#35645c"/><path d="M0 380q220-80 430 20t370-20v70H0Z" fill="#a2bca4"/></svg>');
export const portrait = image('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450"><rect width="450" height="450" fill="#dfddd4"/><circle cx="225" cy="160" r="75" fill="#818e88"/><path d="M70 450v-40a155 155 0 0 1 310 0v40Z" fill="#596c64"/></svg>');
