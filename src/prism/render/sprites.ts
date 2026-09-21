import { geometry, type Geometry, type Gpu } from "vgpu";

export const QUAD = new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
export const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

export interface Sprites {
  readonly geometry: Geometry;
  readonly data: Float32Array;
  write(count: number): void;
}

export function createQuad(gpu: Gpu): Geometry {
  return geometry(gpu, {
    buffers: [{ data: QUAD, attributes: { corner: "float32x2" } }],
    indices: QUAD_INDICES,
  });
}

export function createSprites(
  gpu: Gpu,
  capacity: number,
  stride: number,
  attributes: Record<string, GPUVertexFormat>,
): Sprites {
  const data = new Float32Array(capacity * stride);
  const instances = geometry(gpu, {
    buffers: [
      { data: QUAD, attributes: { corner: "float32x2" } },
      { stepMode: "instance", data, attributes },
    ],
    indices: QUAD_INDICES,
  });
  return {
    geometry: instances,
    data,
    write: (count) => instances.buffers[1].write(data.subarray(0, count * stride)),
  };
}
