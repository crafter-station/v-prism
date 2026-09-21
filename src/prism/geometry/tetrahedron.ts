import * as quat from "../math/quat";
import type { Quat } from "../math/quat";
import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";
import { convexHull3 } from "./hull3";
import { icosphere } from "./icosphere";

export interface Mesh {
  readonly positions: Float32Array<ArrayBuffer>;
  readonly normals: Float32Array<ArrayBuffer>;
  readonly indices: Uint32Array<ArrayBuffer>;
  readonly vertices: readonly Vec3[];
}

export interface Symmetry {
  readonly rotations: readonly Quat[];
  readonly mirror: Vec3;
}

export function corners(edge: number): Vec3[] {
  const height = edge * Math.sqrt(2 / 3);
  const inradius = height / 4;
  const baseRadius = edge / Math.sqrt(3);
  return [
    [0, 0, height - inradius],
    ...[90, 210, 330].map((degrees): Vec3 => {
      const a = (degrees * Math.PI) / 180;
      return [Math.cos(a) * baseRadius, Math.sin(a) * baseRadius, -inradius];
    }),
  ];
}

export function symmetry(): Symmetry {
  const c = corners(1);
  const rotations: Quat[] = [quat.IDENTITY];
  for (const corner of c) {
    const axis = vec3.normalize(corner);
    rotations.push(quat.fromAxisAngle(axis, (2 * Math.PI) / 3), quat.fromAxisAngle(axis, -(2 * Math.PI) / 3));
  }
  for (const [a, b] of [
    [1, 2],
    [1, 3],
    [2, 3],
  ] as const) {
    rotations.push(quat.fromAxisAngle(vec3.normalize(vec3.add(c[a], c[b])), Math.PI));
  }
  return { rotations, mirror: [-1, 1, 1] };
}

export function roundedTetrahedron(edge: number, radius: number, detail = 4): Mesh {
  const inradius = (edge * Math.sqrt(2 / 3)) / 4;
  const c = corners(edge);
  const faceNormals = c.map((corner) => vec3.scale(vec3.normalize(corner), -1));
  const centres = c.map((corner) => vec3.scale(corner, (inradius - radius) / inradius));

  const points = new Map<string, Vec3>();
  const add = (p: Vec3) => points.set(p.map((v) => v.toFixed(6)).join(","), p);
  const sphere = icosphere(radius, detail);
  for (const rotation of symmetry().rotations) {
    for (const p of sphere) add(quat.rotate(rotation, vec3.add(p, centres[0])));
  }
  faceNormals.forEach((normal, opposite) => {
    centres.forEach((centre, i) => {
      if (i !== opposite) add(vec3.add(centre, vec3.scale(normal, radius)));
    });
  });

  const vertices = [...points.values()];
  const triangles = convexHull3(vertices);
  const positions = new Float32Array(vertices.length * 3);
  const normals = new Float32Array(vertices.length * 3);
  vertices.forEach((p, i) => {
    let nearest = centres[0];
    for (const centre of centres) {
      if (vec3.distance(p, centre) < vec3.distance(p, nearest)) nearest = centre;
    }
    const n = vec3.normalize(vec3.sub(p, nearest));
    positions.set(p, i * 3);
    normals.set(n, i * 3);
  });
  return { positions, normals, indices: new Uint32Array(triangles.flat()), vertices };
}
