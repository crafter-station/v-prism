import { beamGlow, streak } from "../shaders/glare.wgsl";

override LINE: bool = false;

const JOINT_FOOTPRINT = 0.5625;
const LINE_TEXELS = 10.0;
const LIGHT_LINE_TEXELS = 1.92;

struct Beam {
  viewProjection: mat4x4f,
  color: vec3f,
  streak: f32,
  glow: f32,
  glare: f32,
}

@group(0) @binding(0) var<uniform> beam: Beam;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) kind: f32,
}

@vertex
fn vs_main(
  @location(0) corner: vec2f,
  @location(1) center: vec2f,
  @location(2) size: vec2f,
  @location(3) angle: f32,
  @location(4) kind: f32,
) -> VertexOut {
  let joint = kind > 0.5;
  let uv = corner * select(1.0, JOINT_FOOTPRINT, joint);
  let extent = select(vec2f(size.x, size.y * beam.glare), size * beam.glare, joint);
  let local = uv * extent;
  let c = cos(angle);
  let s = sin(angle);
  let world = center + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
  var out: VertexOut;
  out.position = beam.viewProjection * vec4f(world, 0.0, 1.0);
  out.uv = uv;
  out.kind = kind;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let joint = in.kind > 0.5;
  let texels = abs(in.uv.y) * LINE_TEXELS;
  if (LINE) {
    let edge = fwidth(texels);
    let coverage = select(1.0 - smoothstep(LIGHT_LINE_TEXELS - edge, LIGHT_LINE_TEXELS + edge, texels), 0.0, joint);
    let alpha = coverage * 0.7;
    return vec4f(beam.color * alpha, alpha);
  }
  let energy = select(
    streak(abs(in.uv.x) * 0.5, texels) * beam.streak,
    beamGlow(length(in.uv) * 2.0) * beam.glow,
    joint,
  );
  return vec4f(beam.color * energy, 0.0);
}
