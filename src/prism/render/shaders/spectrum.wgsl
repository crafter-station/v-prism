fn physhue2rgb(hue: f32, ratio: f32) -> vec3f {
  return smoothstep(vec3f(0.0), vec3f(1.0), abs(fract(hue + vec3f(0.0, 1.0, 2.0) * ratio) * 2.0 - 1.0));
}

export fn iridescence(angle: f32, thickness: f32) -> vec3f {
  let nxv = cos(angle);
  let lum = 0.05064;
  let luma = 0.01070;
  let tint = vec3f(0.49639, 0.78252, 0.8723);
  let interf0 = 2.4;
  let phase0 = 1.0 / 2.8;
  let interf1 = interf0 * 4.0 / 3.0;
  let phase1 = phase0;
  let f = (1.0 - nxv) * (1.0 - nxv);
  let dp = (nxv - 1.0) * 0.5;
  let hue = mix(
    physhue2rgb(thickness * interf0 + dp, thickness * phase0),
    physhue2rgb(thickness * interf1 + 0.1 + dp, thickness * phase1),
    f,
  );
  let film = hue * lum + vec3f(0.9639, 0.78252, 0.18723) * luma;
  return (film * 3.0 + pow(f, 12.0)) * tint;
}

fn bump3y(x: vec3f, yoffset: vec3f) -> vec3f {
  return clamp(vec3f(1.0) - x * x - yoffset, vec3f(0.0), vec3f(1.0));
}

export fn spectralZucconi6(wavelength: f32) -> vec3f {
  let x = clamp((wavelength - 400.0) / 300.0, 0.0, 1.0);
  let c1 = vec3f(3.54585104, 2.93225262, 2.41593945);
  let x1 = vec3f(0.69549072, 0.49228336, 0.27699880);
  let y1 = vec3f(0.02312639, 0.15225084, 0.52607955);
  let c2 = vec3f(3.90307140, 3.21182957, 3.96587128);
  let x2 = vec3f(0.11748627, 0.86755042, 0.66077860);
  let y2 = vec3f(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}
