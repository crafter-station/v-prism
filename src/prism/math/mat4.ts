import type { Quat } from "./quat";
import type { Vec3 } from "./vec3";

export type Mat4 = Float32Array;

export function orthographic(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
): Mat4 {
  const m = new Float32Array(16);
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = -1 / (far - near);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = -near / (far - near);
  m[15] = 1;
  return m;
}

export function translation(v: Vec3): Mat4 {
  const m = identity();
  m[12] = v[0];
  m[13] = v[1];
  m[14] = v[2];
  return m;
}

export function compose(position: Vec3, [x, y, z, w]: Quat, scale: number): Mat4 {
  const m = new Float32Array(16);
  const [xx, xy, xz, yy, yz, zz, wx, wy, wz] = [
    x * x,
    x * y,
    x * z,
    y * y,
    y * z,
    z * z,
    w * x,
    w * y,
    w * z,
  ];
  m[0] = (1 - 2 * (yy + zz)) * scale;
  m[1] = 2 * (xy + wz) * scale;
  m[2] = 2 * (xz - wy) * scale;
  m[4] = 2 * (xy - wz) * scale;
  m[5] = (1 - 2 * (xx + zz)) * scale;
  m[6] = 2 * (yz + wx) * scale;
  m[8] = 2 * (xz + wy) * scale;
  m[9] = 2 * (yz - wx) * scale;
  m[10] = (1 - 2 * (xx + yy)) * scale;
  m[12] = position[0];
  m[13] = position[1];
  m[14] = position[2];
  m[15] = 1;
  return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      m[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return m;
}

export function transformPoint(m: Mat4, [x, y, z]: Vec3): Vec3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
