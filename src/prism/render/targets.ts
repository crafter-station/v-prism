import { target, type Gpu, type Target } from "vgpu";

export const HDR: GPUTextureFormat = "rgba16float";
export const BLOOM_LEVELS = 9;

type Size = readonly [number, number];

export interface Targets {
  readonly scene: Target;
  readonly lit: Target;
  readonly down: readonly Target[];
  readonly up: readonly Target[];
  resize(size: Size): void;
}

const mip = ([width, height]: Size, level: number): Size => [
  Math.max(1, width >> level),
  Math.max(1, height >> level),
];

export function createTargets(gpu: Gpu, size: Size): Targets {
  const scene = target(gpu, { size: mip(size, 0), format: HDR, label: "scene" });
  const lit = target(gpu, { size: mip(size, 0), format: HDR, msaa: true, label: "lit" });
  const down = Array.from({ length: BLOOM_LEVELS }, (_, i) =>
    target(gpu, { size: mip(size, i + 1), format: HDR, label: `bloom-down-${i}` }),
  );
  const up = Array.from({ length: BLOOM_LEVELS - 1 }, (_, i) =>
    target(gpu, { size: mip(size, i + 1), format: HDR, label: `bloom-up-${i}` }),
  );
  return {
    scene,
    lit,
    down,
    up,
    resize(next) {
      scene.resize(mip(next, 0));
      lit.resize(mip(next, 0));
      down.forEach((level, i) => level.resize(mip(next, i + 1)));
      up.forEach((level, i) => level.resize(mip(next, i + 1)));
    },
  };
}
