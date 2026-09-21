import { draw, effect, geometry, sampler, type Draw, type Effect, type Gpu } from "vgpu";
import type { Texture } from "vgpu/core";
import type { Mesh } from "../../geometry/tetrahedron";
import { createQuad, createSprites, type Sprites } from "../sprites";
import { HDR, type Targets } from "../targets";
import beamWgsl from "./beam.wgsl";
import bloomDownWgsl from "./bloom-down.wgsl";
import bloomExtractWgsl from "./bloom-extract.wgsl";
import bloomUpWgsl from "./bloom-up.wgsl";
import copyWgsl from "./copy.wgsl";
import flareWgsl from "./flare.wgsl";
import glassWgsl from "./glass.wgsl";
import presentWgsl from "./present.wgsl";
import rainbowWgsl from "./rainbow.wgsl";

export const BEAM_CAPACITY = 24;
export const FLARE_CAPACITY = 8;
const BEAM_ATTRIBUTES = {
  center: "float32x2",
  size: "float32x2",
  angle: "float32",
  kind: "float32",
} as const;
const FLARE_ATTRIBUTES = {
  offset: "float32x2",
  size: "float32x2",
  kind: "float32",
  opacity: "float32",
} as const;

export interface Passes {
  readonly beam: Draw;
  readonly beamLine: Draw;
  readonly beamSprites: Sprites;
  readonly rainbows: readonly Draw[];
  readonly glass: Draw;
  readonly flare: Draw;
  readonly flareSprites: Sprites;
  readonly copy: Effect;
  readonly extract: Effect;
  readonly down: readonly Effect[];
  readonly up: readonly Effect[];
  readonly present: Effect;
  readonly linearSampler: GPUSampler;
  useLut(lut: Texture, size: number): void;
}

export function createPasses(gpu: Gpu, mesh: Mesh, levels: number): Passes {
  const linearSampler = sampler(gpu, {
    minFilter: "linear",
    magFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
  const beamSprites = createSprites(gpu, BEAM_CAPACITY, 6, BEAM_ATTRIBUTES);
  const flareSprites = createSprites(gpu, FLARE_CAPACITY, 6, FLARE_ATTRIBUTES);
  const quad = createQuad(gpu);
  const beamOptions = { shader: beamWgsl, geometry: beamSprites.geometry, depth: false } as const;
  const present = effect(gpu, presentWgsl, { label: "present" });

  return {
    beam: draw(gpu, { ...beamOptions, blend: "additive", label: "beam" }),
    beamLine: draw(gpu, { ...beamOptions, blend: "premultiplied", label: "beam-line" }),
    beamSprites,
    rainbows: [0, 1].map((i) =>
      draw(gpu, {
        shader: rainbowWgsl,
        geometry: quad,
        blend: "premultiplied",
        depth: false,
        label: `rainbow-${i}`,
      }),
    ),
    glass: draw(gpu, {
      shader: glassWgsl,
      geometry: geometry(gpu, {
        buffers: [
          { data: mesh.positions, attributes: { position: "float32x3" } },
          { data: mesh.normals, attributes: { normal: "float32x3" } },
        ],
        indices: mesh.indices,
      }),
      cull: "back",
      depth: false,
      label: "glass",
    }),
    flare: draw(gpu, {
      shader: flareWgsl,
      geometry: flareSprites.geometry,
      blend: "additive",
      depth: false,
      label: "flare",
    }),
    flareSprites,
    copy: effect(gpu, copyWgsl, { label: "copy" }),
    extract: effect(gpu, bloomExtractWgsl, {
      label: "bloom-extract",
      set: { extract: { threshold: 1, smoothing: 1 } },
    }),
    down: Array.from({ length: Math.max(0, levels - 1) }, (_, i) =>
      effect(gpu, bloomDownWgsl, { label: `bloom-down-${i}` }),
    ),
    up: Array.from({ length: Math.max(0, levels - 1) }, (_, i) =>
      effect(gpu, bloomUpWgsl, { label: `bloom-up-${i}` }),
    ),
    present,
    linearSampler,
    useLut: (lut, size) =>
      present.set({ lut, lutSampler: linearSampler, present: { bloom: 0.9, lutSize: size } }),
  };
}

export function bindTargets(passes: Passes, targets: Targets, radius: number): void {
  const samp = passes.linearSampler;
  passes.copy.set({ src: targets.scene, srcSampler: samp });
  passes.glass.set({ scene: targets.scene, sceneSampler: samp });
  passes.extract.set({ src: targets.lit, srcSampler: samp });
  passes.down.forEach((down, i) => {
    const source = targets.down[i];
    down.set({ src: source, srcSampler: samp, down: { texel: source.texelSize } });
  });
  passes.up.forEach((up, i) => {
    const coarse = i === targets.up.length - 1 ? targets.down[i + 1] : targets.up[i + 1];
    up.set({ coarse, fine: targets.down[i], bloomSampler: samp, up: { texel: coarse.texelSize, radius } });
  });
  const bloom = targets.up[0] ?? targets.down[0];
  passes.present.set({ scene: targets.lit, bloom, presentSampler: samp });
}

export async function compilePasses(
  passes: Passes,
  targets: Targets,
  output: { format: GPUTextureFormat },
): Promise<void> {
  await Promise.all([
    passes.beam.compile(targets.scene),
    passes.beamLine.compile(targets.scene),
    ...passes.rainbows.map((r) => r.compile(targets.scene)),
    passes.glass.compile(targets.lit),
    passes.flare.compile(targets.lit),
    passes.copy.compile(targets.lit),
    passes.extract.compile({ colors: [HDR] }),
    ...passes.down.map((d) => d.compile({ colors: [HDR] })),
    ...passes.up.map((u) => u.compile({ colors: [HDR] })),
    passes.present.compile({ colors: [output.format] }),
  ]);
}
