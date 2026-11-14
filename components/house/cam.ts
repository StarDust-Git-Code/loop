import type { Rect } from "@/lib/house";

/** A camera is just where a picture sits on screen: its top-left corner and its scale. */
export interface Cam {
  x: number;
  y: number;
  scale: number;
}

/** A box on screen, in CSS pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const vw = () => window.innerWidth;
export const vh = () => window.innerHeight;

/** Text beside the picture, or text under it. Same test as the CSS media query in globals.css. */
export const isWide = () => vw() >= 900 && vw() / vh() >= 1.05;

/** A box given as fractions of the viewport. */
export const box = (x: number, y: number, w: number, h: number): Box => ({
  x: x * vw(),
  y: y * vh(),
  w: w * vw(),
  h: h * vh(),
});

export const fullBox = () => box(0, 0, 1, 1);

/** Frame a rectangle of the picture inside a box on screen. */
export function fit(
  t: Rect,
  f: Box,
  o: { cover?: boolean; pad?: number; max?: number; min?: number } = {}
): Cam {
  const pad = o.pad ?? 0;
  const tw = (t[2] - t[0]) * (1 + pad * 2);
  const th = (t[3] - t[1]) * (1 + pad * 2);
  let s = o.cover ? Math.max(f.w / tw, f.h / th) : Math.min(f.w / tw, f.h / th);
  if (o.max) s = Math.min(s, o.max);
  if (o.min) s = Math.max(s, o.min);
  const cx = (t[0] + t[2]) / 2;
  const cy = (t[1] + t[3]) / 2;
  return { scale: s, x: f.x + f.w / 2 - cx * s, y: f.y + f.h / 2 - cy * s };
}

/** Put one point of the picture in the middle of a box, at a given scale. */
export function zoomAt(px: number, py: number, scale: number, f: Box = fullBox()): Cam {
  return { scale, x: f.x + f.w / 2 - px * scale, y: f.y + f.h / 2 - py * scale };
}

/**
 * Nudge a camera so a w × h picture still fills the box: no empty edges.
 * With `openBottom` the picture may rise off the bottom edge (phones, where the words sit on plain night there).
 */
export function cover(c: Cam, w: number, h: number, f: Box = fullBox(), openBottom = false): Cam {
  const s = Math.max(c.scale, f.w / w, openBottom ? 0 : f.h / h);
  // keep the same picture point in the middle when the scale has to grow
  const cx = (f.x + f.w / 2 - c.x) / c.scale;
  const cy = (f.y + f.h / 2 - c.y) / c.scale;
  let x = f.x + f.w / 2 - cx * s;
  let y = f.y + f.h / 2 - cy * s;
  x = Math.min(f.x, Math.max(f.x + f.w - w * s, x));
  y = openBottom ? Math.min(f.y, y) : Math.min(f.y, Math.max(f.y + f.h - h * s, y));
  return { x, y, scale: s };
}

/** GSAP vars that re-measure on every refresh, so resizing keeps every shot framed. */
export const camVars = (get: () => Cam) => ({
  x: () => get().x,
  y: () => get().y,
  scale: () => get().scale,
});
