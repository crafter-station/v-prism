const BEAM_GLOW = array<f32, 17>(
  1.0, 1.0, 0.7373, 0.3529, 0.2078, 0.1216, 0.0745, 0.0353, 0.0078,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
);

const FLARE_GLOW = array<f32, 17>(
  1.0, 0.9961, 0.7577, 0.4157, 0.2784, 0.2039, 0.1569, 0.1255, 0.102,
  0.0863, 0.0706, 0.0588, 0.051, 0.0431, 0.0353, 0.0275, 0.0,
);

const FLARE_DOT = array<f32, 17>(
  0.1412, 0.1412, 0.1412, 0.1412, 0.1372, 0.1294, 0.114, 0.0944, 0.0751,
  0.0574, 0.0389, 0.0272, 0.0193, 0.0118, 0.0039, 0.0, 0.0,
);

const STREAK_ALONG = array<f32, 17>(
  0.201, 0.201, 0.201, 0.201, 0.197, 0.164, 0.114, 0.067, 0.039,
  0.019, 0.004, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
);

const STREAK_ACROSS = array<f32, 6>(1.0, 0.88, 0.49, 0.12, 0.015, 0.0);

fn curve(table: array<f32, 17>, x: f32) -> f32 {
  let t = clamp(x, 0.0, 1.0) * 16.0;
  let i = min(u32(t), 15u);
  return mix(table[i], table[i + 1u], t - f32(i));
}

export fn beamGlow(radius: f32) -> f32 {
  return curve(BEAM_GLOW, radius);
}

export fn flareGlow(radius: f32) -> f32 {
  return curve(FLARE_GLOW, radius);
}

export fn flareDot(radius: f32) -> f32 {
  return curve(FLARE_DOT, radius);
}

export fn streak(along: f32, texels: f32) -> f32 {
  let t = clamp(texels, 0.0, 5.0);
  let i = min(u32(t), 4u);
  let across = mix(STREAK_ACROSS[i], STREAK_ACROSS[i + 1u], t - f32(i));
  return curve(STREAK_ALONG, along * 2.0) * across;
}
