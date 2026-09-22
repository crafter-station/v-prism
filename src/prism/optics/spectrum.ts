import type { Vec3 } from "../math/vec3";

export const SAMPLES = 32;
const VIOLET = 390;
const RED = 700;
const SUN = 6504;
const FLINT: readonly (readonly [number, number])[] = [
  [1.73759695, 0.013188707],
  [0.313747346, 0.0623068142],
  [1.89878101, 155.23629],
];

export const WAVELENGTHS: readonly number[] = Array.from(
  { length: SAMPLES },
  (_, i) => VIOLET + ((RED - VIOLET) * i) / (SAMPLES - 1),
);

export function flint(wavelength: number): number {
  const l2 = (wavelength / 1000) ** 2;
  return Math.sqrt(1 + FLINT.reduce((sum, [b, c]) => sum + (b * l2) / (l2 - c), 0));
}

export const FLINT_D = flint(587.56);

export const refractiveIndex = (wavelength: number, ior: number, dispersion: number): number =>
  ior + (flint(wavelength) - FLINT_D) * dispersion;

export const chromaticSpread = (dispersion: number): number => ((flint(460) - flint(620)) / 2) * dispersion;

const lobe = (x: number, mean: number, below: number, above: number): number =>
  Math.exp(-0.5 * ((x - mean) / (x < mean ? below : above)) ** 2);

const observer = (w: number): Vec3 => [
  1.056 * lobe(w, 599.8, 37.9, 31.0) +
    0.362 * lobe(w, 442.0, 16.0, 26.7) -
    0.065 * lobe(w, 501.1, 20.4, 26.2),
  0.821 * lobe(w, 568.8, 46.9, 40.5) + 0.286 * lobe(w, 530.9, 16.3, 31.1),
  1.217 * lobe(w, 437.0, 11.8, 36.0) + 0.681 * lobe(w, 459.0, 26.0, 13.8),
];

const toRec709 = ([x, y, z]: Vec3): Vec3 => [
  3.2406 * x - 1.5372 * y - 0.4986 * z,
  -0.9689 * x + 1.8758 * y + 0.0415 * z,
  0.0557 * x - 0.204 * y + 1.057 * z,
];

const daylight = (w: number): number => (w / 560) ** -5 / (Math.exp(1.4388e7 / (w * SUN)) - 1);

function balance(colors: readonly Vec3[]): Vec3[] {
  const total = colors.reduce<Vec3>((sum, c) => [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]], [0, 0, 0]);
  return colors.map(([r, g, b]) => [r / total[0], g / total[1], b / total[2]]);
}

export const PALETTE: readonly Vec3[] = balance(
  WAVELENGTHS.map((w) => {
    const [r, g, b] = toRec709(observer(w));
    const power = daylight(w);
    return [r * power, g * power, b * power];
  }),
);
