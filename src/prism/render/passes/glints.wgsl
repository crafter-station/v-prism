const SAMPLES = 8;
const REACH = 0.5;
const SPREAD = 0.7;
const IOR = 2.09;
const SETTLE = 0.654;
const HAZE = 0.25;
const TAU = 6.2831853;
const GOLDEN = 0.618034;

struct Glints {
  viewProjection: mat4x4f,
  model: mat4x4f,
  strength: f32,
}

@group(0) @binding(0) var<uniform> glints: Glints;
@group(0) @binding(1) var mirror: texture_2d<f32>;
@group(0) @binding(2) var haze: texture_2d<f32>;
@group(0) @binding(3) var mirrorSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
}

@vertex
fn vs_main(@location(0) position: vec3f, @location(1) normal: vec3f) -> VertexOut {
  let world = glints.model * vec4f(position, 1.0);
  var out: VertexOut;
  out.position = glints.viewProjection * world;
  out.world = world.xyz;
  out.normal = normalize((glints.model * vec4f(normal, 0.0)).xyz);
  return out;
}

fn screenUv(world: vec3f) -> vec2f {
  let clip = glints.viewProjection * vec4f(world, 1.0);
  let ndc = clip.xy / clip.w;
  return clamp(vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5), vec2f(0.001), vec2f(0.999));
}

fn hash(p: vec3f) -> vec2f {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

fn sphere(random: vec2f) -> vec3f {
  let ring = 2.0 * sqrt(random.y * (1.0 - random.y));
  let angle = TAU * random.x;
  return vec3f(cos(angle) * ring, sin(angle) * ring, 1.0 - 2.0 * random.y);
}

fn dielectric(cosine: f32, eta: f32) -> f32 {
  let c = abs(cosine);
  let g = eta * eta - 1.0 + c * c;
  if (g <= 0.0) {
    return 1.0;
  }
  let root = sqrt(g);
  let a = (root - c) / (root + c);
  let b = (c * (root + c) - 1.0) / (c * (root - c) + 1.0);
  return 0.5 * a * a * (1.0 + b * b);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let incident = vec3f(0.0, 0.0, -1.0);
  let offset = hash(vec3f(floor(in.position.xy), 0.0));
  var seen = vec3f(0.0);
  for (var i = 0; i < SAMPLES; i++) {
    let stratum = vec2f(fract(offset.x + f32(i) * GOLDEN), (f32(i) + offset.y) / f32(SAMPLES));
    let bent = normal + sphere(stratum) * SPREAD;
    let fresnel = min(1.0, 5.0 * dielectric(dot(incident, bent), IOR));
    let uv = screenUv(in.world + normalize(reflect(incident, bent)) * REACH);
    let color = textureSampleLevel(mirror, mirrorSampler, uv, 0.0).rgb
      + textureSampleLevel(haze, mirrorSampler, uv, 0.0).rgb * HAZE;
    seen += min(color * fresnel, vec3f(1.0));
  }
  let reflection = seen / f32(SAMPLES) * SETTLE * glints.strength;
  return vec4f(reflection * reflection, 0.0);
}
