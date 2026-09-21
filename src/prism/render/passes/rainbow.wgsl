import { iridescence, spectralZucconi6 } from "../shaders/spectrum.wgsl";

struct Rainbow {
  viewProjection: mat4x4f,
  center: vec2f,
  angle: f32,
  scale: f32,
  time: f32,
  intensity: f32,
  startRadius: f32,
  endRadius: f32,
  background: vec3f,
  fade: f32,
}

@group(0) @binding(0) var<uniform> rainbow: Rainbow;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) corner: vec2f) -> VertexOut {
  let c = cos(rainbow.angle);
  let s = sin(rainbow.angle);
  let local = corner * rainbow.scale;
  let world = rainbow.center + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
  var out: VertexOut;
  out.position = rainbow.viewProjection * vec4f(world, 0.0, 1.0);
  out.uv = corner + 0.5;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let vstart = vec2f(0.5, 0.5);
  let vend = vec2f(1.0, 0.5);
  let dir = vstart - vend;
  let len = length(dir);
  let cosR = dir.y / len;
  let sinR = dir.x / len;
  let uv = (mat2x2f(cosR, -sinR, sinR, cosR) * (in.uv - vec2f(0.0, 1.0) - vstart * vec2f(1.0, -1.0))) / len;

  let a = atan2(uv.x, uv.y) * 10.0;
  let s = uv.y * (rainbow.endRadius - rainbow.startRadius) + rainbow.startRadius;
  let w = (uv.x / s + 0.5) * 300.0 + 400.0 + a;
  let c = spectralZucconi6(w);
  let l = 1.0 - smoothstep(rainbow.fade, 1.0, uv.y);
  let area = select(1.0, 0.0, uv.y < 0.0);
  let brightness = smoothstep(0.0, 0.5, c.x + c.y + c.z);
  let co = c / iridescence(uv.x * 0.5 * 3.14159, 1.0 - uv.y + rainbow.time / 10.0) / 20.0;
  let col = area * co * l * brightness * rainbow.intensity;
  let intensity = col.r + col.g + col.b;
  if (intensity < 0.05) {
    discard;
  }
  let edge = smoothstep(0.05, 1.0, intensity);
  return vec4f(mix(rainbow.background, col, edge) * edge, edge);
}
