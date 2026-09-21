import { degToRad, lerp } from "../math/angle";
import * as quat from "../math/quat";
import type { Quat } from "../math/quat";

const SWAY: readonly (readonly [degrees: number, period: number])[] = [
  [14, 37],
  [24, 47],
  [5, 61],
];
const RESUME_AFTER = 3;

export function createDrift() {
  let envelope = 0;
  let speed = 0;
  let time = 0;
  let pausedUntil = 0;

  const interrupt = (now: number) => {
    pausedUntil = now + RESUME_AFTER;
  };

  const advance = (delta: number, now: number, free: boolean, strength: number): Quat => {
    envelope = lerp(envelope, free ? 1 : 0, 0.02);
    speed = lerp(speed, free && now > pausedUntil ? 1 : 0, 0.02);
    time += delta * speed;
    const [x, y, z] = SWAY.map(
      ([degrees, period]) =>
        degToRad(degrees * strength * envelope) * Math.sin((2 * Math.PI * time) / period),
    );
    return quat.fromEuler(x, y, z);
  };

  const moving = () => envelope * speed > 0.001;

  return { interrupt, advance, moving };
}
