/** Apply an alpha (0–1) to a #rgb/#rrggbb color → rgba(). Passthrough otherwise. */
export function withAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(color);
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(color);
  let r = 0, g = 0, b = 0;
  if (m6) {
    r = parseInt(m6[1].slice(0, 2), 16); g = parseInt(m6[1].slice(2, 4), 16); b = parseInt(m6[1].slice(4, 6), 16);
  } else if (m3) {
    r = parseInt(m3[1][0] + m3[1][0], 16); g = parseInt(m3[1][1] + m3[1][1], 16); b = parseInt(m3[1][2] + m3[1][2], 16);
  } else {
    return color;
  }
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, alpha)})`;
}
