import { linearToSrgb3, luminance } from "@vgpu/wgsl-std/color";

const AGX_MIN_EV = -12.47393;
const AGX_MAX_EV = 4.026069;

struct Present {
  bloom: f32,
  lutSize: f32,
  agx: f32,
  exposure: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var bloom: texture_2d<f32>;
@group(0) @binding(2) var presentSampler: sampler;
@group(0) @binding(3) var lut: texture_3d<f32>;
@group(0) @binding(4) var lutSampler: sampler;
@group(0) @binding(5) var<uniform> present: Present;

fn agxContrast(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx(color: vec3f) -> vec3f {
  let inset = mat3x3f(
    0.842479062253094, 0.0423282422610123, 0.0423756549057051,
    0.0784335999999992, 0.878468636469772, 0.0784336,
    0.0792237451477643, 0.0791661274605434, 0.879142973793104,
  );
  let outset = mat3x3f(
    1.19687900512017, -0.0528968517574562, -0.0529716355144438,
    -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
    -0.0990297440797205, -0.0989611768448433, 1.15107367264116,
  );
  let encoded = clamp(log2(max(inset * color, vec3f(1e-10))), vec3f(AGX_MIN_EV), vec3f(AGX_MAX_EV));
  let curve = agxContrast((encoded - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV));
  return pow(max(outset * curve, vec3f(0.0)), vec3f(2.2));
}

fn inGamut(color: vec3f) -> vec3f {
  let clipped = max(color, vec3f(0.0));
  return clipped * sqrt(clamp(luminance(color) / max(luminance(clipped), 1e-6), 0.0, 1.0));
}

fn film(color: vec3f) -> vec3f {
  let display = linearToSrgb3(clamp(color, vec3f(0.0), vec3f(1.0)));
  let cell = display * (present.lutSize - 1.0) / present.lutSize + 0.5 / present.lutSize;
  return textureSampleLevel(lut, lutSampler, cell, 0.0).rgb;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let base = textureSampleLevel(scene, presentSampler, uv, 0.0).rgb;
  let glow = textureSampleLevel(bloom, presentSampler, uv, 0.0).rgb;
  let color = base + glow * present.bloom;
  if (present.agx > 0.5) {
    return vec4f(linearToSrgb3(clamp(agx(inGamut(color) * present.exposure), vec3f(0.0), vec3f(1.0))), 1.0);
  }
  return vec4f(film(color), 1.0);
}
