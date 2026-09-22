const RAYS = 32;
const FANS = 3;
const BEAMS = 8;
const FAR = 1e4;
const HALO = 0.02;
const HALO_WIDTH = 5.0;

struct Beam {
  ray: vec4f,
  span: vec4f,
}

struct Fan {
  rays: array<vec4f, 32>,
  energy: array<vec4f, 8>,
  apex: vec4f,
  bounds: vec4f,
}

struct Light {
  view: vec4f,
  shape: vec4f,
  counts: vec4f,
  beams: array<Beam, 8>,
  fans: array<Fan, 3>,
}

struct Palette {
  colors: array<vec4f, 32>,
}

@group(0) @binding(0) var<uniform> light: Light;
@group(0) @binding(1) var<uniform> palette: Palette;

fn cross2(a: vec2f, b: vec2f) -> f32 {
  return a.x * b.y - a.y * b.x;
}

fn glow(p: vec2f, ray: vec4f, length: f32) -> f32 {
  let offset = p - ray.xy;
  let along = dot(offset, ray.zw);
  let width = light.shape.x + max(along, 0.0) * light.shape.y;
  let across = cross2(ray.zw, offset) / width;
  let ends = smoothstep(-width, width, along) * (1.0 - smoothstep(length - width, length + width, along));
  let profile = exp(-0.5 * across * across) + HALO * exp(-0.5 * across * across / (HALO_WIDTH * HALO_WIDTH));
  return profile * ends * light.shape.x / width;
}

fn spectrum(p: vec2f, f: i32) -> vec3f {
  let apex = light.fans[f].apex;
  let bounds = light.fans[f].bounds;
  let offset = p - apex.xy;
  if (cross2(bounds.xy, offset) < -apex.z || cross2(offset, bounds.zw) < -apex.z) {
    return vec3f(0.0);
  }
  var color = vec3f(0.0);
  for (var i = 0; i < RAYS; i++) {
    let energy = light.fans[f].energy[i / 4][i % 4];
    if (energy > 0.0) {
      color += palette.colors[i].rgb * energy * glow(p, light.fans[f].rays[i], FAR);
    }
  }
  return color;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = light.view.xy + vec2f(uv.x, -uv.y) * light.view.zw;
  var color = vec3f(0.0);
  for (var i = 0; i < BEAMS; i++) {
    if (f32(i) < light.counts.x) {
      let beam = light.beams[i];
      color += vec3f(beam.span.y * glow(p, beam.ray, beam.span.x));
    }
  }
  for (var i = 0; i < FANS; i++) {
    if (f32(i) < light.counts.y) {
      color += spectrum(p, i);
    }
  }
  return vec4f(color * light.shape.z, 0.0);
}
