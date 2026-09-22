import { createStore } from "./store";

export interface Settings {
  readonly background: string;
  readonly tint: string;
  readonly ambient: number;
  readonly rainbow: number;
  readonly bloom: number;
  readonly reflections: number;
  readonly glints: number;
  readonly roughness: number;
  readonly ior: number;
  readonly thickness: number;
  readonly drift: number;
}

export const DARK: Settings = {
  background: "#000000",
  tint: "#ffffff",
  ambient: 0.015,
  rainbow: 2.5,
  bloom: 0.9,
  reflections: 1,
  glints: 2.5,
  roughness: 0,
  ior: 1.5,
  thickness: 0.9,
  drift: 1,
};

export const LIGHT: Settings = { ...DARK, background: "#ffffff", reflections: 1, glints: 0 };

export const settings = createStore<Settings>(DARK);

export function isLight(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

export function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => c / 255) as [
    number,
    number,
    number,
  ];
}

export function linear(hex: string): [number, number, number] {
  return rgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
}
