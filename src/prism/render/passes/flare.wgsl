import { flareDot, flareGlow, streak } from "../shaders/glare.wgsl";

const STREAK_FOOTPRINT = vec2f(0.02, 0.7);
const TEXELS = 512.0;

struct Flare {
  viewProjection: mat4x4f,
  center: vec2f,
  angle: f32,
  scale: f32,
  time: f32,
  intensity: f32,
}

@group(0) @binding(0) var<uniform> flare: Flare;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) kind: f32,
  @location(2) opacity: f32,
}

fn orbit(size: f32, time: f32) -> vec2f {
  let wide = size > 1.0;
  let x = select(cos(time * size / 2.0), sin(time * size / 2.0), wide) * size / 8.0;
  let y = select(atan(time * size), cos(time * size), wide) * size / 5.0;
  return vec2f(x, y);
}

@vertex
fn vs_main(
  @location(0) corner: vec2f,
  @location(1) offset: vec2f,
  @location(2) size: vec2f,
  @location(3) kind: f32,
  @location(4) opacity: f32,
) -> VertexOut {
  let uv = corner * select(vec2f(1.0), STREAK_FOOTPRINT, kind > 1.5);
  let drift = select(vec2f(0.0), orbit(size.x, flare.time), kind < 0.5);
  let local = (uv * size + offset + drift) * flare.scale;
  let c = cos(flare.angle);
  let s = sin(flare.angle);
  let world = flare.center + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
  var out: VertexOut;
  out.position = flare.viewProjection * vec4f(world, 0.0, 1.0);
  out.uv = uv;
  out.kind = kind;
  out.opacity = opacity;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let radius = length(in.uv) * 2.0;
  var energy = flareGlow(radius);
  if (in.kind < 0.5) {
    energy = flareDot(radius);
  } else if (in.kind > 1.5) {
    energy = streak(abs(in.uv.y) * 2.0, abs(in.uv.x) * TEXELS);
  }
  return vec4f(vec3f(energy * in.opacity * flare.intensity), 0.0);
}
