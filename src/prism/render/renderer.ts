import { frame, init, surface, type FramePass, type Gpu, type Surface } from "vgpu";
import * as vec3 from "../math/vec3";
import type { Vec3 } from "../math/vec3";
import {
  backgroundColor,
  createSimulation,
  tintColor,
  type FrameState,
  type Simulation,
} from "../simulation";
import { prism } from "../state/prism";
import { settings } from "../state/settings";
import { loadLut } from "./lut";
import { bindGlints, bindTargets, compilePasses, createPasses, type Passes } from "./passes";
import { BLOOM_LEVELS, createTargets, MIRROR_LEVELS, type Targets } from "./targets";

const LINE_WIDTH = 10 / 64;
const JOINT_SIZE = 0.75;
const FLARE_SCALE = 1.25;
const FLARE_DOTS = [0.5, 1.25, 0.75, 1.5, 2];
const DARK_STREAK = 0.209;
const LIGHT_LINE: Vec3 = [0.133, 0.133, 0.133];
const LUT_URL = "/lut/F-6800-STD.ktx2";
const LUT_SIZE = 33;
const BLOOM_RADIUS = 0.85;

export interface Renderer {
  readonly ready: Promise<void>;
  dispose(): void;
  invalidate(): void;
}

interface Stage {
  readonly gpu: Gpu;
  readonly output: Surface;
  readonly targets: Targets;
  readonly passes: Passes;
  readonly simulation: Simulation;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  let disposed = false;
  let gpu: Gpu | undefined;
  let stage: Stage | undefined;
  let animationFrame = 0;
  let previous = 0;
  let needsFrame = true;
  const unsubscribers: (() => void)[] = [];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const invalidate = () => {
    needsFrame = true;
    if (!animationFrame && !disposed) animationFrame = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    animationFrame = 0;
    if (disposed || !stage) return;
    const delta = Math.max(0, Math.min((now - previous) / 1000, 0.1));
    previous = now;
    needsFrame = false;
    render(stage, stage.simulation.step(delta, now / 1000, motion.matches));
    if (!stage.simulation.settled() || needsFrame) animationFrame = requestAnimationFrame(tick);
  };

  const start = async () => {
    gpu = await init();
    if (disposed) return gpu.dispose();
    const output = surface(gpu, canvas, { dpr: [1, 2] });
    const simulation = createSimulation(canvas.clientWidth, canvas.clientHeight);
    const targets = createTargets(gpu, output.size);
    const passes = createPasses(gpu, simulation.mesh, BLOOM_LEVELS, MIRROR_LEVELS);
    bindTargets(passes, targets, BLOOM_RADIUS);
    passes.useLut(await loadLut(gpu, LUT_URL), LUT_SIZE);
    await compilePasses(passes, targets, output);
    if (disposed) return;
    writeFlare(passes);
    stage = { gpu, output, targets, passes, simulation };
    unsubscribers.push(
      output.onResize(({ width, height, dpr }) => {
        simulation.resize(width / dpr, height / dpr);
        targets.resize([width, height]);
        bindTargets(passes, targets, BLOOM_RADIUS);
        invalidate();
      }),
      settings.subscribe(invalidate),
      prism.subscribe(invalidate),
      listen(motion, "change", invalidate),
    );
    previous = performance.now();
    invalidate();
  };

  const ready = start().catch((error: unknown) => {
    if (!disposed) throw error;
  });

  const dispose = () => {
    disposed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    stage?.output.dispose();
    gpu?.dispose();
  };

  return { ready, dispose, invalidate };
}

function listen(target: EventTarget, type: string, handler: () => void): () => void {
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}

function render({ gpu, output, targets, passes }: Stage, state: FrameState): void {
  const tuning = settings.get();
  const viewProjection = state.camera.viewProjection;
  const background = backgroundColor();
  const beam = writeBeam(passes, state);
  const beamDraw = state.light ? passes.beamLine : passes.beam;
  const glints = tuning.glints * (1 - tuning.roughness);
  const glare = 1 / state.camera.factor;
  beamDraw.set({
    beam: {
      viewProjection,
      color: state.light ? LIGHT_LINE : [1, 1, 1],
      streak: DARK_STREAK,
      glow: 1,
      glare,
      line: state.light ? 1 : 0,
    },
  });
  const diagonal = Math.hypot(state.camera.width, state.camera.height) / state.camera.zoom + 1.5;
  state.rainbows.forEach((rainbow, i) => {
    passes.rainbows[i].set({
      rainbow: {
        viewProjection,
        center: [state.center[0], state.center[1]],
        angle: rainbow.angle,
        scale: diagonal,
        time: state.time,
        intensity: rainbow.intensity,
        startRadius: 0,
        endRadius: 0.5,
        background,
        fade: 0,
      },
    });
  });
  passes.glass.set({
    glass: {
      viewProjection,
      model: state.model,
      tint: tintColor(),
      ior: tuning.ior,
      roughness: tuning.roughness,
      thickness: tuning.thickness * 2,
      reflections: tuning.reflections,
      light: state.light ? 1 : 0,
      lightDirection: state.lightDirection,
      lightIntensity: state.lightIntensity,
      ambient: vec3.scale([1, 1, 1], state.ambient * 0.5),
      dispersion: 0.012,
    },
  });
  passes.glints.set({ glints: { viewProjection, model: state.model, strength: glints } });
  bindGlints(passes, targets, (state.camera.zoom * targets.scene.size[0]) / state.camera.width);
  passes.flare.set({
    flare: {
      viewProjection,
      center: [state.entry[0], state.entry[1]],
      angle: -Math.atan2(state.entryDirection[0], state.entryDirection[1]),
      scale: FLARE_SCALE * glare,
      time: state.time,
      intensity: state.hit ? 1 : 0,
    },
  });
  passes.present.set({ present: { bloom: tuning.bloom } });

  const view = (pass: FramePass) => {
    pass.draw(passes.copy);
    if (state.light) pass.draw(passes.beamLine, { instances: beam.streaks });
    else pass.draw(passes.beam, { firstInstance: beam.streaks, instances: beam.glows });
    if (state.hit) pass.draw(passes.flare);
    pass.draw(passes.glass);
  };

  frame(gpu, (current) => {
    current.pass({ target: targets.scene, clear: [...background, 1] }, (pass) => {
      state.rainbows.forEach((rainbow, i) => {
        if (rainbow.intensity > 0.001) pass.draw(passes.rainbows[i]);
      });
      if (!state.light) pass.draw(passes.beam, { instances: beam.streaks });
    });
    if (glints > 0) {
      current.pass({ target: targets.mirror[0], clear: [...background, 1] }, view);
      passes.mirror.forEach((down, i) => {
        current.pass({ target: targets.mirror[i + 1] }, (pass) => pass.draw(down));
      });
    }
    current.pass({ target: targets.lit, clear: [...background, 1] }, (pass) => {
      view(pass);
      if (glints > 0) pass.draw(passes.glints);
    });
    targets.down.forEach((level, i) => {
      current.pass({ target: level }, (pass) => pass.draw(i === 0 ? passes.extract : passes.down[i - 1]));
    });
    for (let i = targets.up.length - 1; i >= 0; i--) {
      current.pass({ target: targets.up[i] }, (pass) => pass.draw(passes.up[i]));
    }
    current.pass({ target: output }, (pass) => pass.draw(passes.present));
  });
}

function writeBeam(passes: Passes, state: FrameState): { readonly streaks: number; readonly glows: number } {
  const { data } = passes.beamSprites;
  let count = 0;
  const put = (center: Vec3, size: readonly [number, number], angle: number, kind: number) => {
    data.set([center[0], center[1], size[0], size[1], angle, kind], count * 6);
    count++;
  };
  for (let i = 0; i + 1 < state.path.length; i++) {
    const a = state.path[i];
    const b = state.path[i + 1];
    const d = vec3.sub(b, a);
    put(vec3.scale(vec3.add(a, b), 0.5), [vec3.length(d), LINE_WIDTH], Math.atan2(d[1], d[0]), 0);
  }
  const streaks = count;
  for (let i = 1; i + 1 < state.path.length; i++) put(state.path[i], [JOINT_SIZE, JOINT_SIZE], 0, 1);
  passes.beamSprites.write(count);
  return { streaks, glows: count - streaks };
}

function writeFlare(passes: Passes): void {
  const { data } = passes.flareSprites;
  const sprites: number[][] = [
    ...FLARE_DOTS.map((s) => [0, 0, s, s, 0, 0.12]),
    [0, 0, 0.12, 0.12, 1, 0.75],
    [0, 0, 1, 1, 1, 0.1],
    [0, 0, 20, 12.5, 2, 0.08],
  ];
  sprites.forEach((sprite, i) => data.set(sprite, i * 6));
  passes.flareSprites.write(sprites.length);
}
