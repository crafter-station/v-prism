import { degToRad, wrap } from "../math/angle";
import * as quat from "../math/quat";
import type { Quat } from "../math/quat";
import type { Vec3 } from "../math/vec3";
import type { Symmetry } from "../geometry/tetrahedron";

const EXAGGERATION = 6;
const GLASS_IOR = 2.5;
const AIR_IOR = 1.000293;
const BLEND = degToRad(3);
const SAME_BEAM = degToRad(12);
const MIN_SHARE = 0.05;

export interface RainbowBeam {
  readonly angle: number;
  readonly visibility: number;
  readonly share: number;
}

interface Answer {
  readonly angle: number;
  readonly visibility: number;
  readonly weight: number;
}

export function rainbowBeams(
  direction: Vec3,
  entryNormal: Vec3,
  rotation: Quat,
  symmetry: Symmetry,
): RainbowBeam[] {
  const flipped = (v: Vec3): Vec3 => [v[0], -v[1], v[2]];
  const candidates = symmetry.rotations.flatMap((s) => {
    const proper = quat.multiply(rotation, s);
    const mirrored = mirrorRotation(proper, symmetry.mirror);
    return [
      { rotation: proper, mirrored: false, angle: quat.angle(proper) },
      { rotation: mirrored, mirrored: true, angle: quat.angle(mirrored) },
    ];
  });
  const nearest = Math.min(...candidates.map((c) => c.angle));
  const answers: Answer[] = candidates
    .map((c) => ({ c, weight: Math.exp(-(c.angle - nearest) / BLEND) }))
    .filter(({ weight }) => weight >= 1e-4)
    .map(({ c, weight }) => {
      const bent = c.mirrored
        ? bend(flipped(direction), flipped(entryNormal), c.rotation)
        : bend(direction, entryNormal, c.rotation);
      return { weight, angle: c.mirrored ? -bent.angle : bent.angle, visibility: bent.visibility };
    })
    .sort((a, b) => round(b.weight - a.weight) || round(a.angle - b.angle));

  const clusters: { x: number; y: number; visibility: number; weight: number }[] = [];
  for (const { weight, angle, visibility } of answers) {
    let cluster = clusters.find((k) => Math.abs(wrap(angle - Math.atan2(k.y, k.x))) < SAME_BEAM);
    if (!cluster) clusters.push((cluster = { x: 0, y: 0, visibility: 0, weight: 0 }));
    cluster.x += weight * Math.cos(angle);
    cluster.y += weight * Math.sin(angle);
    cluster.visibility += weight * visibility;
    cluster.weight += weight;
  }
  const total = clusters.reduce((sum, k) => sum + k.weight, 0);
  const kept = clusters.filter((k) => k.weight / total >= MIN_SHARE);
  const keptTotal = kept.reduce((sum, k) => sum + k.weight, 0);
  return kept
    .map((k) => ({
      angle: Math.atan2(k.y, k.x),
      visibility: k.visibility / k.weight,
      share: k.weight / keptTotal,
    }))
    .sort((a, b) => round(b.share - a.share) || round(a.angle - b.angle));
}

function bend(direction: Vec3, entryNormal: Vec3, rotation: Quat) {
  const inverse = quat.invert(rotation);
  const local = quat.rotate(inverse, direction);
  const normal = quat.rotate(inverse, entryNormal);
  const reference = normal[0] > 0.1 ? Math.PI : 0;
  const inPlane = Math.hypot(local[0], local[1]);
  let angle = Math.atan2(local[1], local[0]);
  angle += refraction(angle - reference) * EXAGGERATION;
  const exit = quat.rotate(rotation, [Math.cos(angle) * inPlane, Math.sin(angle) * inPlane, local[2]]);
  return { angle: Math.atan2(exit[1], exit[0]), visibility: Math.hypot(exit[0], exit[1]) };
}

function mirrorRotation([x, y, z, w]: Quat, mirror: Vec3): Quat {
  const screen: Vec3 = [1, -1, 1];
  const m = [
    1 - 2 * (y * y + z * z),
    2 * (x * y + w * z),
    2 * (x * z - w * y),
    2 * (x * y - w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z + w * x),
    2 * (x * z + w * y),
    2 * (y * z - w * x),
    1 - 2 * (x * x + y * y),
  ];
  const r = m.map((v, i) => v * screen[i % 3] * mirror[Math.floor(i / 3)]);
  return fromMatrix(r);
}

function fromMatrix(m: number[]): Quat {
  const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = m;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

const refraction = (incident: number): number => Math.asin((AIR_IOR * Math.sin(incident)) / GLASS_IOR) || 0;

const round = (value: number): number => Math.round(value * 1e9) / 1e9;
