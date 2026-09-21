import { linearToSrgb3 } from "@vgpu/wgsl-std/color";

struct Present {
  bloom: f32,
  lutSize: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var bloom: texture_2d<f32>;
@group(0) @binding(2) var presentSampler: sampler;
@group(0) @binding(3) var lut: texture_3d<f32>;
@group(0) @binding(4) var lutSampler: sampler;
@group(0) @binding(5) var<uniform> present: Present;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let base = textureSampleLevel(scene, presentSampler, uv, 0.0).rgb;
  let glow = textureSampleLevel(bloom, presentSampler, uv, 0.0).rgb;
  let display = linearToSrgb3(clamp(base + glow * present.bloom, vec3f(0.0), vec3f(1.0)));
  let cell = display * (present.lutSize - 1.0) / present.lutSize + 0.5 / present.lutSize;
  return vec4f(textureSampleLevel(lut, lutSampler, cell, 0.0).rgb, 1.0);
}
