import { convexHull, type Point } from "../math/hull";
import { transformPoint, type Mat4 } from "../math/mat4";
import * as vec2 from "../math/vec2";
import type { Vec3 } from "../math/vec3";

export interface OutlineHit {
  readonly distance: number;
  readonly point: Vec3;
  readonly normal: Vec3;
}

export interface Outline {
  readonly points: readonly Point[];
  normal(point: Point): Point;
}

export function createSilhouette(vertices: readonly Vec3[], centres: readonly Vec3[]) {
  let hull: Point[] = [];
  let core: Point[] = [];
  let signature = "";

  const project = (world: Mat4, points: readonly Vec3[]): Point[] =>
    convexHull(points.map((v) => transformPoint(world, v)).map(([x, y]) => [x, y]));

  const update = (world: Mat4) => {
    const next = Array.from(world).join(",");
    if (next === signature) return;
    signature = next;
    hull = project(world, vertices);
    core = project(world, centres);
  };

  const normal = (point: Point): Point => {
    let nearest = core[0] ?? point;
    let best = Infinity;
    core.forEach((a, i) => {
      const b = core[(i + 1) % core.length];
      const edge = vec2.sub(b, a);
      const t = Math.min(1, Math.max(0, vec2.dot(vec2.sub(point, a), edge) / (vec2.dot(edge, edge) || 1)));
      const candidate = vec2.add(a, vec2.scale(edge, t));
      const distance = vec2.length(vec2.sub(point, candidate));
      if (distance < best) {
        best = distance;
        nearest = candidate;
      }
    });
    return vec2.normalize(vec2.sub(point, nearest));
  };

  const intersect = (origin: Vec3, direction: Vec3): OutlineHit | null => {
    let best: OutlineHit | null = null;
    for (let i = 0; i < hull.length; i++) {
      const [ax, ay] = hull[i];
      const [bx, by] = hull[(i + 1) % hull.length];
      const ex = bx - ax;
      const ey = by - ay;
      if (ey * direction[0] - ex * direction[1] >= 0) continue;
      const denominator = direction[0] * ey - direction[1] * ex;
      if (Math.abs(denominator) < 1e-12) continue;
      const tx = ax - origin[0];
      const ty = ay - origin[1];
      const t = (tx * ey - ty * ex) / denominator;
      const u = (tx * direction[1] - ty * direction[0]) / denominator;
      if (t <= 1e-6 || u < 0 || u > 1 || (best && t >= best.distance)) continue;
      const l = Math.hypot(ex, ey);
      best = {
        distance: t,
        point: [origin[0] + direction[0] * t, origin[1] + direction[1] * t, 0],
        normal: [ey / l, -ex / l, 0],
      };
    }
    return best;
  };

  const outline = (): Outline => ({ points: hull, normal });

  return { update, intersect, outline };
}
