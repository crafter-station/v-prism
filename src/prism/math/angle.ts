export const TAU = Math.PI * 2;

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;
export const radToDeg = (radians: number): number => (radians * 180) / Math.PI;

export const wrap = (radians: number): number => Math.atan2(Math.sin(radians), Math.cos(radians));

export const gap = (a: number, b: number): number => Math.abs(wrap(a - b));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
