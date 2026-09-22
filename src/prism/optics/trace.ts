import type { Outline } from "../geometry/silhouette";
import * as vec2 from "../math/vec2";
import type { Vec2 } from "../math/vec2";
import { SAMPLES, WAVELENGTHS } from "./spectrum";

export const FANS = 3;
const BOUNCES = 4;
const FAINT = 0.01;
const SCATTER = 0.3;
const D_LINE = 587.56;

export interface Beam {
  readonly origin: Vec2;
  readonly direction: Vec2;
  readonly length: number;
  readonly energy: number;
}

export interface Fan {
  readonly rays: readonly (readonly [number, number, number, number])[];
  readonly energy: readonly number[];
  readonly links: readonly number[];
}

export interface Light {
  readonly beams: readonly Beam[];
  readonly fans: readonly Fan[];
}

export interface Contact {
  readonly point: Vec2;
  readonly normal: Vec2;
}

interface Exit {
  readonly point: Vec2;
  readonly direction: Vec2;
  readonly energy: number;
  readonly bounce: number;
}

export function fresnel(cosine: number, from: number, to: number): number {
  const c = Math.abs(cosine);
  const sine = (from / to) * Math.sqrt(Math.max(0, 1 - c * c));
  if (sine >= 1) return 1;
  const t = Math.sqrt(1 - sine * sine);
  const s = (from * c - to * t) / (from * c + to * t);
  const p = (from * t - to * c) / (from * t + to * c);
  return (s * s + p * p) / 2;
}

export function traceLight(
  outline: Outline,
  start: Vec2,
  direction: Vec2,
  entry: Contact | null,
  reach: number,
  index: (wavelength: number) => number,
): Light {
  if (!entry) return { beams: [{ origin: start, direction, length: reach, energy: 1 }], fans: [] };
  const incoming: Beam = {
    origin: start,
    direction,
    length: vec2.length(vec2.sub(entry.point, start)),
    energy: 1,
  };
  const reflection: Beam = {
    origin: entry.point,
    direction: vec2.reflect(direction, entry.normal),
    length: reach,
    energy: fresnel(vec2.dot(direction, entry.normal), 1, index(D_LINE)),
  };
  const paths = WAVELENGTHS.map((w) => walk(outline, entry, direction, index(w)));
  const inside = paths[SAMPLES >> 1].segments.map((s) => ({ ...s, energy: s.energy * SCATTER }));
  return { beams: [incoming, reflection, ...inside], fans: gather(paths.map((p) => p.exits)) };
}

function walk(outline: Outline, entry: Contact, direction: Vec2, n: number) {
  const exits: Exit[] = [];
  const segments: Beam[] = [];
  let point = entry.point;
  let ray = vec2.refract(direction, entry.normal, 1 / n);
  let energy = 1 - fresnel(vec2.dot(direction, entry.normal), 1, n);
  for (let bounce = 0; ray && bounce < BOUNCES && energy > FAINT; bounce++) {
    const hit = leave(outline, point, ray);
    if (!hit) break;
    segments.push({ origin: point, direction: ray, length: vec2.length(vec2.sub(hit.point, point)), energy });
    const out = vec2.refract(ray, vec2.scale(hit.normal, -1), n);
    if (out) {
      const reflected = fresnel(vec2.dot(ray, hit.normal), n, 1);
      exits.push({ point: hit.point, direction: out, energy: energy * (1 - reflected), bounce });
      energy *= reflected;
    }
    point = hit.point;
    ray = vec2.reflect(ray, hit.normal);
  }
  return { exits, segments };
}

function leave(outline: Outline, point: Vec2, direction: Vec2): Contact | null {
  const { points } = outline;
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const edge = vec2.normalize([b[1] - a[1], a[0] - b[0]]);
    const facing = vec2.dot(direction, edge);
    if (facing <= 1e-9) continue;
    const t = vec2.dot(vec2.sub(a, point), edge) / facing;
    if (t > 1e-6 && t < nearest) nearest = t;
  }
  if (nearest === Infinity) return null;
  const exit = vec2.add(point, vec2.scale(direction, nearest));
  return { point: exit, normal: outline.normal(exit) };
}

function gather(exits: readonly (readonly Exit[])[]): Fan[] {
  const fans: Fan[] = [];
  for (let order = 0; order < FANS; order++) {
    const nth = exits.map((path) => path[order]);
    if (!nth.some(Boolean)) break;
    const nearest = (i: number): Exit => {
      for (let step = 1; ; step++) {
        const exit = nth[i - step] ?? nth[i + step];
        if (exit) return exit;
      }
    };
    fans.push({
      rays: nth.map((exit, i) => {
        const { point, direction } = exit ?? nearest(i);
        return [point[0], point[1], direction[0], direction[1]];
      }),
      energy: nth.map((exit) => exit?.energy ?? 0),
      links: nth.map((exit, i) => {
        const next = nth[i + 1];
        return exit && next && exit.bounce === next.bounce ? 1 : 0;
      }),
    });
  }
  return fans;
}
