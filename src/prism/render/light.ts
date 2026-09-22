import * as vec2 from "../math/vec2";
import type { Vec2 } from "../math/vec2";
import { PALETTE } from "../optics/spectrum";
import type { Fan, Light } from "../optics/trace";
import type { Camera } from "../scene/camera";

const BEAMS = 8;
const FANS = 3;
const WIDTH = 0.03;
const DIVERGENCE = 0.003;
const HALO_REACH = 16;
const OPEN = 1e6;

type Vec4 = readonly [number, number, number, number];

const quads = (values: readonly number[]): Vec4[] =>
  Array.from({ length: values.length / 4 }, (_, i) => [
    values[i * 4],
    values[i * 4 + 1],
    values[i * 4 + 2],
    values[i * 4 + 3],
  ]);

const EMPTY_FAN = {
  rays: Array.from({ length: PALETTE.length }, (): Vec4 => [0, 0, 1, 0]),
  energy: quads(PALETTE.map(() => 0)),
  links: quads(PALETTE.map(() => 0)),
  apex: [0, 0, 0, 0] as Vec4,
  bounds: [1, 0, 1, 0] as Vec4,
};

export const palette = { colors: PALETTE.map(([r, g, b]): Vec4 => [r, g, b, 0]) };

export function packLight(light: Light, camera: Camera, power: number) {
  const halfWidth = camera.width / (2 * camera.zoom);
  const halfHeight = camera.height / (2 * camera.zoom);
  return {
    view: [-halfWidth, halfHeight, halfWidth * 2, halfHeight * 2],
    shape: [WIDTH, DIVERGENCE, power, 0],
    counts: [Math.min(BEAMS, light.beams.length), Math.min(FANS, light.fans.length), 0, 0],
    beams: Array.from({ length: BEAMS }, (_, i) => {
      const beam = light.beams[i];
      return beam
        ? { ray: [...beam.origin, ...beam.direction], span: [beam.length, beam.energy, 0, 0] }
        : { ray: [0, 0, 1, 0], span: [0, 0, 0, 0] };
    }),
    fans: Array.from({ length: FANS }, (_, i) => {
      const fan = light.fans[i];
      return fan ? packFan(fan, Math.hypot(halfWidth, halfHeight) * 2) : EMPTY_FAN;
    }),
  };
}

function packFan(fan: Fan, reach: number) {
  const origins = fan.rays.map(([x, y]): Vec2 => [x, y]);
  const apex = vec2.scale(
    origins.reduce((sum, o) => vec2.add(sum, o), [0, 0]),
    1 / origins.length,
  );
  const directions = fan.rays.map(([, , x, y]): Vec2 => [x, y]);
  const middle = vec2.normalize(directions.reduce((sum, d) => vec2.add(sum, d), [0, 0]));
  const turn = (d: Vec2) => Math.atan2(vec2.cross(middle, d), vec2.dot(middle, d));
  const [low, high] = directions.reduce<[Vec2, Vec2]>(
    ([lo, hi], d) => [turn(d) < turn(lo) ? d : lo, turn(d) > turn(hi) ? d : hi],
    [middle, middle],
  );
  const spread = Math.max(...origins.map((o) => vec2.length(vec2.sub(o, apex))));
  const open = turn(high) - turn(low) >= Math.PI;
  const margin = open ? OPEN : spread + HALO_REACH * (WIDTH + reach * DIVERGENCE);
  return {
    rays: fan.rays,
    energy: quads(fan.energy),
    links: quads(fan.links),
    apex: [...apex, margin, 0],
    bounds: [...low, ...high],
  };
}
