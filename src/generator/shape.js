// The lower quarter preserves almost-square geometry before card and control radii diverge.
export function radii(profile) {
  const base = profile <= 25 ? profile * 3 / 25 : 3;
  const rest = Math.max(0, profile - 25) / 75;
  return { control: base + rest * 9, card: base + rest * 21 };
}
