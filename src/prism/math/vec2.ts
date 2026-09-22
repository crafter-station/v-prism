export type Vec2 = readonly [number, number];

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const length = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const fromAngle = (radians: number): Vec2 => [Math.cos(radians), Math.sin(radians)];

export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  return l > 0 ? scale(a, 1 / l) : a;
}

export const reflect = (incident: Vec2, normal: Vec2): Vec2 =>
  sub(incident, scale(normal, 2 * dot(normal, incident)));

export function refract(incident: Vec2, normal: Vec2, eta: number): Vec2 | null {
  const cosine = dot(normal, incident);
  const k = 1 - eta * eta * (1 - cosine * cosine);
  return k < 0 ? null : sub(scale(incident, eta), scale(normal, eta * cosine + Math.sqrt(k)));
}
