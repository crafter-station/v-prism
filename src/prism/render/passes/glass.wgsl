import { studio } from "../shaders/studio.wgsl";

struct Glass {
  viewProjection: mat4x4f,
  model: mat4x4f,
  tint: vec3f,
  ior: f32,
  roughness: f32,
  thickness: f32,
  reflections: f32,
  light: f32,
  lightDirection: vec3f,
  lightIntensity: f32,
  ambient: vec3f,
  dispersion: f32,
}

@group(0) @binding(0) var<uniform> glass: Glass;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var sceneSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
}

@vertex
fn vs_main(@location(0) position: vec3f, @location(1) normal: vec3f) -> VertexOut {
  let world = glass.model * vec4f(position, 1.0);
  var out: VertexOut;
  out.position = glass.viewProjection * world;
  out.world = world.xyz;
  out.normal = normalize((glass.model * vec4f(normal, 0.0)).xyz);
  return out;
}

fn screenUv(world: vec3f) -> vec2f {
  let clip = glass.viewProjection * vec4f(world, 1.0);
  let ndc = clip.xy / clip.w;
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

fn transmitted(world: vec3f, normal: vec3f, incident: vec3f, eta: f32, blur: f32, seed: f32) -> vec3f {
  let inside = refract(incident, normal, eta);
  let exit = world + inside * glass.thickness;
  let uv = screenUv(exit);
  var sum = vec3f(0.0);
  for (var i = 0; i < 5; i++) {
    let t = f32(i) / 5.0;
    let a = t * 6.2831853 + seed;
    let offset = vec2f(cos(a), sin(a)) * sqrt(t) * blur;
    sum += textureSampleLevel(scene, sceneSampler, clamp(uv + offset, vec2f(0.001), vec2f(0.999)), 0.0).rgb;
  }
  return sum / 5.0;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let view = vec3f(0.0, 0.0, 1.0);
  let facing = clamp(dot(normal, view), 0.0, 1.0);
  let incident = -view;

  let f0 = pow((glass.ior - 1.0) / (glass.ior + 1.0), 2.0);
  let fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
  let clearcoat = 0.04 + 0.96 * pow(1.0 - facing, 5.0);

  let reflected = reflect(incident, normal);
  let environment = studio(reflected, glass.light) * glass.reflections;

  let blur = glass.roughness * glass.roughness * 0.08;
  let seed = fract(sin(dot(floor(in.position.xy), vec2f(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  let spread = glass.dispersion * (glass.ior - 1.0);
  let refracted = vec3f(
    transmitted(in.world, normal, incident, 1.0 / (glass.ior - spread), blur, seed).r,
    transmitted(in.world, normal, incident, 1.0 / glass.ior, blur, seed).g,
    transmitted(in.world, normal, incident, 1.0 / (glass.ior + spread), blur, seed).b,
  ) * glass.tint;

  let lightDirection = normalize(glass.lightDirection);
  let halfway = normalize(lightDirection + view);
  let specular = pow(max(dot(normal, halfway), 0.0), 64.0) * glass.lightIntensity * 0.25;

  let color = mix(refracted, environment, fresnel)
    + environment * clearcoat * 0.3
    + vec3f(specular)
    + glass.ambient;
  return vec4f(color, 1.0);
}
