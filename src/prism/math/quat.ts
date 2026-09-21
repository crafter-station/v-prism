import type { Vec3 } from "./vec3";

export type Quat = readonly [number, number, number, number];

export const IDENTITY: Quat = [0, 0, 0, 1];

export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

export function fromEuler(x: number, y: number, z: number): Quat {
  const [cx, sx, cy, sy, cz, sz] = [x, y, z].flatMap((a) => [Math.cos(a / 2), Math.sin(a / 2)]);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

export function toEuler([x, y, z, w]: Quat): Vec3 {
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - w * z);
  const m13 = 2 * (x * z + w * y);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - w * x);
  const m32 = 2 * (y * z + w * x);
  const m33 = 1 - 2 * (x * x + y * y);
  const pitch = Math.asin(Math.min(1, Math.max(-1, m13)));
  return Math.abs(m13) < 0.9999999
    ? [Math.atan2(-m23, m33), pitch, Math.atan2(-m12, m11)]
    : [Math.atan2(m32, m22), pitch, 0];
}

export function multiply(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + a[1] * b[3] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + a[2] * b[3] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export const invert = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export const angle = (q: Quat): number => 2 * Math.acos(Math.min(1, Math.abs(q[3])));

export function angleBetween(a: Quat, b: Quat): number {
  return angle(multiply(invert(a), b));
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let cosom = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const target: Quat = cosom < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  cosom = Math.abs(cosom);
  if (cosom > 0.9995) return normalize(lerp(a, target, t));
  const omega = Math.acos(cosom);
  const sinom = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinom;
  const wb = Math.sin(t * omega) / sinom;
  return [
    a[0] * wa + target[0] * wb,
    a[1] * wa + target[1] * wb,
    a[2] * wa + target[2] * wb,
    a[3] * wa + target[3] * wb,
  ];
}

function lerp(a: Quat, b: Quat, t: number): Quat {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function normalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
