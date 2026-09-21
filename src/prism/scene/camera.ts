import { multiply, orthographic, translation, type Mat4 } from "../math/mat4";

export const MOBILE = 600;
const TABLET = 960;
const DISTANCE = 100;

export interface Camera {
  readonly viewProjection: Mat4;
  readonly zoom: number;
  readonly factor: number;
  readonly width: number;
  readonly height: number;
}

export const zoomFor = (width: number): number => (width <= MOBILE ? 50 : width <= TABLET ? 70 : 100);

export const ZOOM_RANGE: readonly [number, number] = [0.4, 4];

export function createCamera(width: number, height: number, factor = 1): Camera {
  const zoom = zoomFor(width) * factor;
  const halfWidth = width / (2 * zoom);
  const halfHeight = height / (2 * zoom);
  const projection = orthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, 0.1, 1000);
  const view = translation([0, 0, -DISTANCE]);
  return { viewProjection: multiply(projection, view), zoom, factor, width, height };
}

export function toWorld(camera: Camera, x: number, y: number): readonly [number, number] {
  return [(x - camera.width / 2) / camera.zoom, (camera.height / 2 - y) / camera.zoom];
}
