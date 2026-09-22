import { convexHull, type Point } from "../math/hull";
import { transformPoint, type Mat4 } from "../math/mat4";
import type { Vec3 } from "../math/vec3";

export interface OutlineHit {
  readonly distance: number;
  readonly point: Vec3;
  readonly normal: Vec3;
}

export function createSilhouette(vertices: readonly Vec3[]) {
  let hull: Point[] = [];
  let signature = "";

  const update = (world: Mat4) => {
    const next = Array.from(world).join(",");
    if (next === signature) return;
    signature = next;
    hull = convexHull(vertices.map((v) => transformPoint(world, v)).map(([x, y]) => [x, y]));
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

  return { update, intersect, outline: (): readonly Point[] => hull };
}
