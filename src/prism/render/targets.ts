import { target, type Gpu, type Target } from "vgpu";

export const HDR: GPUTextureFormat = "rgba16float";
export const BLOOM_LEVELS = 9;
export const MIRROR_LEVELS = 5;

type Size = readonly [number, number];

export interface Targets {
  readonly scene: Target;
  readonly lit: Target;
  readonly mirror: readonly Target[];
  readonly down: readonly Target[];
  readonly up: readonly Target[];
  resize(size: Size): void;
}

const mip = ([width, height]: Size, level: number): Size => [
  Math.max(1, width >> level),
  Math.max(1, height >> level),
];

export function createTargets(gpu: Gpu, size: Size): Targets {
  const chain = (name: string, length: number) =>
    Array.from({ length }, (_, i) =>
      target(gpu, { size: mip(size, i + 1), format: HDR, label: `${name}-${i}` }),
    );
  const scene = target(gpu, { size: mip(size, 0), format: HDR, label: "scene" });
  const lit = target(gpu, { size: mip(size, 0), format: HDR, msaa: true, label: "lit" });
  const mirror = chain("mirror", MIRROR_LEVELS);
  const down = chain("bloom-down", BLOOM_LEVELS);
  const up = chain("bloom-up", BLOOM_LEVELS - 1);
  return {
    scene,
    lit,
    mirror,
    down,
    up,
    resize(next) {
      scene.resize(mip(next, 0));
      lit.resize(mip(next, 0));
      [mirror, down, up].forEach((levels) => levels.forEach((level, i) => level.resize(mip(next, i + 1))));
    },
  };
}
