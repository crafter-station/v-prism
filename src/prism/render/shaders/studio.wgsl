struct Panel {
  center: vec3f,
  size: vec2f,
  brightness: f32,
}

fn panel(direction: vec3f, p: Panel) -> f32 {
  let normal = -normalize(p.center);
  let facing = dot(direction, normal);
  if (facing <= 1e-4) {
    return 0.0;
  }
  let t = dot(p.center, normal) / facing;
  let hit = direction * t - p.center;
  let reference = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(normal.y) > 0.9);
  let u = normalize(cross(reference, normal));
  let v = cross(normal, u);
  let local = abs(vec2f(dot(hit, u), dot(hit, v)));
  let inside = smoothstep(p.size * 0.5 + 0.25, p.size * 0.5 - 0.25, local);
  return inside.x * inside.y * p.brightness;
}

fn dome(direction: vec3f) -> vec3f {
  let y = direction.y;
  let top = vec3f(0.30, 0.32, 0.36);
  let horizon = vec3f(0.05, 0.05, 0.06);
  let a = abs(y);
  return select(mix(horizon, vec3f(0.0), pow(a, 0.5)), mix(horizon, top, pow(a, 0.7)), y > 0.0);
}

export fn darkStudio(direction: vec3f) -> vec3f {
  let panels = panel(direction, Panel(vec3f(-3.5, 4.0, 5.0), vec2f(6.0, 4.0), 1.6))
    + panel(direction, Panel(vec3f(5.0, 0.0, -3.0), vec2f(1.0, 7.0), 2.5))
    + panel(direction, Panel(vec3f(0.0, 6.0, 0.0), vec2f(8.0, 1.0), 1.4));
  return dome(direction) + vec3f(panels);
}

export fn lightStudio(direction: vec3f) -> vec3f {
  let panels = panel(direction, Panel(vec3f(0.0, 4.0, 5.0), vec2f(6.0, 3.0), 2.5))
    + panel(direction, Panel(vec3f(-4.0, -1.0, 2.0), vec2f(6.0, 2.0), 2.0))
    + panel(direction, Panel(vec3f(4.0, -1.0, 2.0), vec2f(6.0, 2.0), 2.0));
  return vec3f(panels);
}

export fn studio(direction: vec3f, light: f32) -> vec3f {
  return mix(darkStudio(direction), lightStudio(direction), light);
}
