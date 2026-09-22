import {
  draw,
  effect,
  geometry,
  sampler,
  type Draw,
  type Effect,
  type Gpu,
  type Surface,
  type Target,
} from "vgpu";
import type { Texture } from "vgpu/core";
import type { Mesh } from "../../geometry/tetrahedron";
import { createQuad, createSprites, type Sprites } from "../sprites";
import type { Targets } from "../targets";
import beamWgsl from "./beam.wgsl";
import bloomDownWgsl from "./bloom-down.wgsl";
import bloomExtractWgsl from "./bloom-extract.wgsl";
import bloomUpWgsl from "./bloom-up.wgsl";
import copyWgsl from "./copy.wgsl";
import flareWgsl from "./flare.wgsl";
import glassWgsl from "./glass.wgsl";
import glintsWgsl from "./glints.wgsl";
import presentWgsl from "./present.wgsl";
import rainbowWgsl from "./rainbow.wgsl";

export const BEAM_CAPACITY = 24;
export const FLARE_CAPACITY = 8;
const GLINT_TEXEL = 0.08;
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
  readonly glints: Draw;
  readonly flare: Draw;
  readonly flareSprites: Sprites;
  readonly copy: Effect;
  readonly mirror: readonly Effect[];
  readonly extract: Effect;
  readonly down: readonly Effect[];
  readonly up: readonly Effect[];
  readonly present: Effect;
  readonly linearSampler: GPUSampler;
  useLut(lut: Texture, size: number): void;
}

export function createPasses(gpu: Gpu, mesh: Mesh, levels: number, mirrorLevels: number): Passes {
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
  const glassGeometry = geometry(gpu, {
    buffers: [
      { data: mesh.positions, attributes: { position: "float32x3" } },
      { data: mesh.normals, attributes: { normal: "float32x3" } },
    ],
    indices: mesh.indices,
  });
  const glassOptions = { geometry: glassGeometry, cull: "back", depth: false } as const;
  const downs = (name: string, length: number) =>
    Array.from({ length }, (_, i) => effect(gpu, bloomDownWgsl, { label: `${name}-${i}` }));
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
    glass: draw(gpu, { ...glassOptions, shader: glassWgsl, label: "glass" }),
    glints: draw(gpu, { ...glassOptions, shader: glintsWgsl, blend: "additive", label: "glints" }),
    flare: draw(gpu, {
      shader: flareWgsl,
      geometry: flareSprites.geometry,
      blend: "additive",
      depth: false,
      label: "flare",
    }),
    flareSprites,
    copy: effect(gpu, copyWgsl, { label: "copy" }),
    mirror: downs("mirror-down", Math.max(0, mirrorLevels - 1)),
    extract: effect(gpu, bloomExtractWgsl, {
      label: "bloom-extract",
      set: { extract: { threshold: 1, smoothing: 1 } },
    }),
    down: downs("bloom-down", Math.max(0, levels - 1)),
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
  const chain = (effects: readonly Effect[], levels: readonly Target[]) =>
    effects.forEach((down, i) =>
      down.set({ src: levels[i], srcSampler: samp, down: { texel: levels[i].texelSize } }),
    );
  chain(passes.mirror, targets.mirror);
  chain(passes.down, targets.down);
  passes.up.forEach((up, i) => {
    const coarse = i === targets.up.length - 1 ? targets.down[i + 1] : targets.up[i + 1];
    up.set({ coarse, fine: targets.down[i], bloomSampler: samp, up: { texel: coarse.texelSize, radius } });
  });
  const bloom = targets.up[0] ?? targets.down[0];
  passes.present.set({ scene: targets.lit, bloom, presentSampler: samp });
}

export function bindGlints(passes: Passes, targets: Targets, pixelsPerUnit: number): void {
  const finest = Math.round(Math.log2(GLINT_TEXEL * pixelsPerUnit)) - 1;
  const level = Math.min(targets.mirror.length - 2, Math.max(0, finest));
  passes.glints.set({
    mirror: targets.mirror[level],
    haze: targets.mirror[level + 1],
    mirrorSampler: passes.linearSampler,
  });
}

export async function compilePasses(passes: Passes, targets: Targets, output: Surface): Promise<void> {
  const reflected = [passes.copy, passes.beam, passes.flare, passes.glass];
  await Promise.all([
    ...[...passes.rainbows, passes.beam].map((pass) => pass.compile(targets.scene)),
    ...reflected.map((pass) => pass.compile(targets.mirror[0])),
    ...[...reflected, passes.beamLine, passes.glints].map((pass) => pass.compile(targets.lit)),
    ...passes.mirror.map((down, i) => down.compile(targets.mirror[i + 1])),
    passes.extract.compile(targets.down[0]),
    ...passes.down.map((down, i) => down.compile(targets.down[i + 1])),
    ...passes.up.map((up, i) => up.compile(targets.up[i])),
    passes.present.compile({ colors: [output.format] }),
  ]);
}
