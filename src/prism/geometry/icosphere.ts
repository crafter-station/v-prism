import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";

export function icosphere(radius: number, detail: number): Vec3[] {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: Vec3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const points = new Map<string, Vec3>();
  const add = (p: Vec3) => {
    const n = vec3.scale(vec3.normalize(p), radius);
    points.set(n.map((v) => v.toFixed(7)).join(","), n);
  };
  for (const [a, b, c] of faces) {
    for (let i = 0; i <= detail; i++) {
      for (let j = 0; j <= detail - i; j++) {
        const k = detail - i - j;
        add(vec3.add(vec3.add(vec3.scale(base[a], i), vec3.scale(base[b], j)), vec3.scale(base[c], k)));
      }
    }
  }
  return [...points.values()];
}
