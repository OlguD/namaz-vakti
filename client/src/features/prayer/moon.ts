/** Moon phase from the hijri day (1–30): an SVG path for a 14×14 icon and a name. */
export function moonPath(hijriDay: number): string {
  const th = 2 * Math.PI * (hijriDay / 29.53);
  const r = 5.5;
  const top = (7 - r).toFixed(2);
  const bot = (7 + r).toFixed(2);
  const rx = (r * Math.abs(Math.cos(th))).toFixed(2);
  if (th < Math.PI) {
    return `M7 ${top}A${r} ${r} 0 0 1 7 ${bot}A${rx} ${r} 0 0 ${th < Math.PI / 2 ? 0 : 1} 7 ${top}Z`;
  }
  return `M7 ${top}A${r} ${r} 0 0 0 7 ${bot}A${rx} ${r} 0 0 ${th < 1.5 * Math.PI ? 0 : 1} 7 ${top}Z`;
}

export function moonName(hijriDay: number): string {
  const d = hijriDay;
  if (d <= 2 || d >= 28) return 'Yeni ay';
  if (d < 7) return 'Hilal';
  if (d < 9) return 'İlk dördün';
  if (d < 14) return 'Büyüyen ay';
  if (d <= 16) return 'Dolunay';
  if (d < 21) return 'Küçülen ay';
  if (d < 23) return 'Son dördün';
  return 'Küçülen hilal';
}
