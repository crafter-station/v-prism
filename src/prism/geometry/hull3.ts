import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";

type Triangle = [number, number, number];

interface Face {
  readonly vertices: Triangle;
  readonly normal: Vec3;
  readonly offset: number;
}

export function convexHull3(points: readonly Vec3[]): Triangle[] {
  const centroid = vec3.scale(
    points.reduce((sum, p) => vec3.add(sum, p), [0, 0, 0] as Vec3),
    1 / points.length,
  );
  const face = (a: number, b: number, c: number): Face => {
    let normal = vec3.normalize(vec3.cross(vec3.sub(points[b], points[a]), vec3.sub(points[c], points[a])));
    let vertices: Triangle = [a, b, c];
    if (vec3.dot(normal, vec3.sub(centroid, points[a])) > 0) {
      normal = vec3.scale(normal, -1);
      vertices = [a, c, b];
    }
    return { vertices, normal, offset: vec3.dot(normal, points[a]) };
  };
  const seed = initialSimplex(points);
  let faces = [
    face(seed[0], seed[1], seed[2]),
    face(seed[0], seed[2], seed[3]),
    face(seed[0], seed[3], seed[1]),
    face(seed[1], seed[3], seed[2]),
  ];
  const epsilon = 1e-9;
  for (let i = 0; i < points.length; i++) {
    if (seed.includes(i)) continue;
    const p = points[i];
    const visible = faces.filter((f) => vec3.dot(f.normal, p) - f.offset > epsilon);
    if (!visible.length) continue;
    const edges = new Map<string, [number, number]>();
    for (const f of visible) {
      const [a, b, c] = f.vertices;
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        const key = `${Math.min(u, v)},${Math.max(u, v)}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    faces = faces.filter((f) => !visible.includes(f));
    for (const [u, v] of edges.values()) faces.push(face(u, v, i));
  }
  return faces.map((f) => f.vertices);
}

function initialSimplex(points: readonly Vec3[]): [number, number, number, number] {
  const extreme = (pick: (p: Vec3) => number) =>
    points.reduce((best, p, i) => (pick(p) > pick(points[best]) ? i : best), 0);
  const a = extreme((p) => -p[0]);
  const b = extreme((p) => vec3.distance(p, points[a]));
  const ab = vec3.sub(points[b], points[a]);
  const c = extreme((p) => vec3.length(vec3.cross(ab, vec3.sub(p, points[a]))));
  const n = vec3.cross(ab, vec3.sub(points[c], points[a]));
  const d = extreme((p) => Math.abs(vec3.dot(n, vec3.sub(p, points[a]))));
  return [a, b, c, d];
}
