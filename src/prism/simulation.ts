import { createSilhouette } from "./geometry/silhouette";
import { roundedTetrahedron, symmetry, type Mesh } from "./geometry/tetrahedron";
import { clamp, gap, lerp } from "./math/angle";
import { compose, type Mat4 } from "./math/mat4";
import * as quat from "./math/quat";
import type { Quat } from "./math/quat";
import type { Vec2 } from "./math/vec2";
import * as vec3 from "./math/vec3";
import type { Vec3 } from "./math/vec3";
import { createDrift } from "./optics/drift";
import { rainbowBeams } from "./optics/rainbow";
import { refractiveIndex } from "./optics/spectrum";
import { traceLight, type Light } from "./optics/trace";
import { createCamera, MOBILE, toWorld, type Camera } from "./scene/camera";
import { orientation, prism } from "./state/prism";
import { isLight, linear, settings } from "./state/settings";

export const EDGE = Math.sqrt(3);
const BEVEL = 0.035;
const SCALE = 2;
const BASE_Z = 0.1;
const BEAM_LENGTH = 10;
const INRADIUS = (EDGE * Math.sqrt(2 / 3)) / 4;
const DEFAULT_RAY = { start: [-10, -0.05, 0] as Vec3, end: [0, 0, 0] as Vec3 };
const APEX = Math.PI / 3;

const flat = ([x, y]: Vec3): Vec2 => [x, y];

export interface RainbowFrame {
  readonly angle: number;
  readonly intensity: number;
}

export interface FrameState {
  readonly camera: Camera;
  readonly model: Mat4;
  readonly path: readonly Vec3[];
  readonly hit: boolean;
  readonly entry: Vec3;
  readonly entryDirection: Vec3;
  readonly center: Vec3;
  readonly rainbows: readonly RainbowFrame[];
  readonly lightDirection: Vec3;
  readonly lightIntensity: number;
  readonly ambient: number;
  readonly time: number;
  readonly light: boolean;
  readonly optics: Light | null;
}

export interface Simulation {
  readonly mesh: Mesh;
  resize(width: number, height: number): void;
  readonly size: readonly [number, number];
  step(delta: number, now: number, reducedMotion: boolean): FrameState;
  settled(): boolean;
}

export function createSimulation(width: number, height: number): Simulation {
  const mesh = roundedTetrahedron(EDGE, BEVEL);
  const silhouette = createSilhouette(mesh.vertices, mesh.centres);
  const glassSymmetry = symmetry();
  const drift = createDrift();

  let size: readonly [number, number] = [width, height];
  let zoomFactor = prism.get().zoom;
  let camera = createCamera(width, height, zoomFactor);
  let pose: Quat = orientation();
  let ray = { ...DEFAULT_RAY, active: false };
  let lastAim = prism.get().aim;
  let lastRotation = prism.get().rotation;
  let physical = settings.get().physical;
  let hit = false;
  let hasBeenHit = false;
  let rainbowTime = 0;
  let rainbowSpeed = 1;
  let ambient = 0;
  let spotTarget: Vec3 = [1, 0, 0];
  let armedAt = -1;
  const emissive = [0, 0];
  const shares = [1, 0];
  const angles = [0, 0];
  let restless = true;
  let settled = false;

  const groupPosition = (): Vec3 => [0, camera.width <= MOBILE ? -0.5 : 0, 0];
  const centerOf = (): Vec3 => {
    const [x, y] = groupPosition();
    return [x, y, 0];
  };

  const reach = () => Math.max(BEAM_LENGTH, Math.hypot(camera.width, camera.height) / camera.zoom);

  const resting = (length = reach()) => {
    if (!physical) return { ...DEFAULT_RAY, start: vec3.scale(vec3.normalize(DEFAULT_RAY.start), length) };
    const incidence = Math.asin(Math.min(0.99, settings.get().ior * Math.sin(APEX / 2)));
    const angle = incidence - APEX / 2;
    const end = centerOf();
    return { start: vec3.sub(end, vec3.scale([Math.cos(angle), Math.sin(angle), 0], length)), end };
  };

  const aim = (x: number, y: number) => {
    const [wx, wy] = toWorld(camera, x, y);
    const [cx, cy] = centerOf();
    const dx = cx - wx;
    const dy = cy - wy;
    const l = Math.hypot(dx, dy);
    if (l < 0.01) return;
    const length = reach();
    ray = {
      start: [cx - (dx / l) * length, cy - (dy / l) * length, 0],
      end: [cx, cy, 0],
      active: true,
    };
  };

  const reframe = () => {
    camera = createCamera(size[0], size[1], zoomFactor);
    const a = prism.get().aim;
    if (a) aim(a.x, a.y);
    else if (ray.active) ray = { ...resting(), active: true };
    restless = true;
  };

  const resize = (w: number, h: number) => {
    size = [w, h];
    reframe();
  };

  const step = (delta: number, now: number, reducedMotion: boolean): FrameState => {
    const state = prism.get();
    const tuning = settings.get();
    if (armedAt < 0) armedAt = now + 1;
    if (!ray.active && now >= armedAt) {
      ray = { ...resting(physical ? reach() : BEAM_LENGTH), active: true };
      restless = true;
    }
    if (tuning.physical !== physical) {
      physical = tuning.physical;
      if (!state.aim && ray.active) ray = { ...resting(), active: true };
      restless = true;
    }
    if (state.aim !== lastAim && state.aim) {
      lastAim = state.aim;
      aim(state.aim.x, state.aim.y);
    }
    if (state.rotation !== lastRotation) {
      lastRotation = state.rotation;
      drift.interrupt(now);
    }
    if (state.zoom !== zoomFactor) {
      zoomFactor = state.zoom;
      reframe();
    }

    const free = hasBeenHit && !reducedMotion && !state.held && tuning.drift > 0;
    const sway = drift.advance(delta, now, free, tuning.drift);
    const target = quat.multiply(sway, orientation());
    pose = quat.angleBetween(pose, target) > 1e-4 ? quat.slerp(pose, target, 0.2) : target;

    const center = centerOf();
    const pivot: Vec3 = vec3.add(center, [0, 0, BASE_Z + INRADIUS * SCALE]);
    const model = compose(pivot, pose, SCALE);
    silhouette.update(model);

    const direction = vec3.normalize(vec3.sub(ray.end, ray.start));
    const entry = ray.active ? silhouette.intersect(ray.start, direction) : null;
    const wasHit = hit;
    hit = Boolean(entry);
    const path: Vec3[] = entry
      ? [ray.start, entry.point, center]
      : [ray.start, vec3.add(ray.start, vec3.scale(direction, reach() * 2))];
    const outline = silhouette.outline();
    const optics = physical
      ? traceLight(
          outline,
          flat(ray.start),
          flat(direction),
          entry && { point: flat(entry.point), normal: outline.normal(flat(entry.point)) },
          reach() * 2,
          (wavelength) => refractiveIndex(wavelength, tuning.ior, tuning.dispersion),
        )
      : null;

    if (entry && optics) {
      hasBeenHit = true;
      shares[0] = 1;
      shares[1] = 0;
      const [, , x, y] = optics.fans[0]?.rays[optics.fans[0].rays.length >> 1] ?? [0, 0, 1, 0];
      spotTarget = vec3.lerp(spotTarget, [x, y, 0], 0.05);
    } else if (entry) {
      if (!wasHit) {
        rainbowSpeed = 1;
        emissive[0] = hasBeenHit ? 3 : 2.5 * (reducedMotion ? 1 : 20);
        hasBeenHit = true;
      }
      const beams = rainbowBeams(direction, entry.normal, pose, glassSymmetry).slice(0, 2);
      if (
        beams.length === 2 &&
        gap(angles[0], beams[1].angle) + gap(angles[1], beams[0].angle) <
          gap(angles[0], beams[0].angle) + gap(angles[1], beams[1].angle)
      ) {
        beams.reverse();
      }
      for (let i = 0; i < 2; i++) {
        const beam = beams[i];
        if (beam) angles[i] = beam.angle;
        shares[i] = beam ? (0.35 + 0.65 * beam.visibility) * beam.share : 0;
      }
      const main = beams[0].angle;
      spotTarget = vec3.lerp(spotTarget, [Math.cos(main), Math.sin(main), 0], 0.05);
    }

    rainbowSpeed = lerp(rainbowSpeed, reducedMotion ? 0 : 1, 0.0025);
    rainbowTime += delta * rainbowSpeed;
    let emitted = 0;
    for (let i = 0; i < 2; i++) {
      emissive[i] = lerp(emissive[i], hit ? tuning.rainbow * shares[i] : 0, 0.1);
      emitted += emissive[i];
    }
    ambient = lerp(ambient, ray.active ? tuning.ambient : 0, 0.025);

    const animating =
      restless ||
      drift.moving() ||
      (hit && !physical && rainbowSpeed > 0.001) ||
      quat.angleBetween(pose, target) > 1e-4 ||
      Math.abs(emissive[0] - (hit ? tuning.rainbow * shares[0] : 0)) > 0.001 ||
      Math.abs(ambient - (ray.active ? tuning.ambient : 0)) > 0.001 ||
      !ray.active;
    restless = false;
    settled = !animating;

    return {
      camera,
      model,
      path,
      hit,
      entry: entry?.point ?? center,
      entryDirection: direction,
      center,
      rainbows: [0, 1].map((i) => ({ angle: angles[i], intensity: clamp(emissive[i], 0, 1e3) })),
      lightDirection: [spotTarget[0], spotTarget[1], 0.6],
      lightIntensity: emitted,
      ambient,
      time: rainbowTime,
      light: isLight(tuning.background),
      optics,
    };
  };

  return {
    mesh,
    resize,
    step,
    settled: () => settled,
    get size() {
      return size;
    },
  };
}

export const backgroundColor = (): Vec3 => linear(settings.get().background);
export const tintColor = (): Vec3 => linear(settings.get().tint);
