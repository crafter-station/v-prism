import * as quat from "../math/quat";
import type { Quat } from "../math/quat";
import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";

export interface Mesh {
  readonly positions: Float32Array<ArrayBuffer>;
  readonly normals: Float32Array<ArrayBuffer>;
  readonly indices: Uint32Array<ArrayBuffer>;
  readonly vertices: readonly Vec3[];
  readonly centres: readonly Vec3[];
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

export function roundedTetrahedron(edge: number, radius: number, segments = 16): Mesh {
  const inradius = (edge * Math.sqrt(2 / 3)) / 4;
  const c = corners(edge);
  const faces = c.map((corner) => vec3.scale(vec3.normalize(corner), -1));
  const centres = c.map((corner) => vec3.scale(corner, (inradius - radius) / inradius));
  const vertices: Vec3[] = [];
  const normals: Vec3[] = [];
  const indices: number[] = [];

  const vertex = (centre: Vec3, normal: Vec3) => {
    vertices.push(vec3.add(centre, vec3.scale(normal, radius)));
    normals.push(normal);
    return vertices.length - 1;
  };
  const triangle = (a: number, b: number, d: number) => {
    const facing = vec3.cross(vec3.sub(vertices[b], vertices[a]), vec3.sub(vertices[d], vertices[a]));
    const outward = vec3.add(vec3.add(normals[a], normals[b]), normals[d]);
    indices.push(...(vec3.dot(facing, outward) >= 0 ? [a, b, d] : [a, d, b]));
  };
  const blend = (directions: readonly Vec3[], weights: readonly number[]) =>
    vec3.normalize(
      directions.reduce<Vec3>((sum, n, i) => vec3.add(sum, vec3.scale(n, weights[i])), [0, 0, 0]),
    );
  const others = (...skip: number[]) => [0, 1, 2, 3].filter((i) => !skip.includes(i));
  const pairs = [0, 1, 2, 3].flatMap((a) =>
    others(a)
      .filter((b) => b > a)
      .map((b) => [a, b] as const),
  );

  faces.forEach((normal, face) => {
    const [a, b, d] = others(face).map((i) => vertex(centres[i], normal));
    triangle(a, b, d);
  });

  for (const [k, l] of pairs) {
    const [i, j] = others(k, l);
    const rails = Array.from({ length: segments + 1 }, (_, t) => {
      const normal = blend([faces[k], faces[l]], [segments - t, t]);
      return [vertex(centres[i], normal), vertex(centres[j], normal)] as const;
    });
    rails.slice(1).forEach(([a, b], t) => {
      const [previousA, previousB] = rails[t];
      triangle(previousA, previousB, b);
      triangle(previousA, b, a);
    });
  }

  centres.forEach((centre, corner) => {
    const around = others(corner).map((face) => faces[face]);
    const grid = Array.from({ length: segments + 1 }, (_, u) =>
      Array.from({ length: segments + 1 - u }, (_, v) =>
        vertex(centre, blend(around, [segments - u - v, u, v])),
      ),
    );
    grid.forEach((row, u) =>
      row.forEach((index, v) => {
        if (u + v >= segments) return;
        triangle(index, grid[u + 1][v], row[v + 1]);
        if (u + v + 1 < segments) triangle(grid[u + 1][v], grid[u + 1][v + 1], row[v + 1]);
      }),
    );
  });

  return {
    positions: new Float32Array(vertices.flat()),
    normals: new Float32Array(normals.flat()),
    indices: new Uint32Array(indices),
    vertices,
    centres,
  };
}
