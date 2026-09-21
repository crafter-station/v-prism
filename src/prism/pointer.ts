import { aimAt, rotateBy, zoomBy } from "./state/prism";

const ROTATE_SPEED = 0.004;
const ZOOM_SPEED = 0.0025;
const LINE_HEIGHT = 16;

interface Point {
  readonly x: number;
  readonly y: number;
}

export function attachPointer(element: HTMLElement): () => void {
  const pointers = new Map<number, Point>();
  let aiming = false;

  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    aiming = pointers.size === 1 && event.isPrimary;
    if (aiming) aimAt({ x: event.clientX, y: event.clientY });
  };

  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
      const dx = (next.x - previous.x) / 2;
      const dy = (next.y - previous.y) / 2;
      const twist = wrap(angle(other, next) - angle(other, previous));
      rotateBy(dy * ROTATE_SPEED, dx * ROTATE_SPEED, -twist);
      zoomBy(distance(other, next) / Math.max(1, distance(other, previous)));
    } else if (aiming) {
      aimAt(next);
    }
    pointers.set(event.pointerId, next);
  };

  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) aiming = false;
  };

  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_HEIGHT
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    let dx = event.deltaX * unit;
    let dy = event.deltaY * unit;
    if (event.shiftKey && dx === 0) [dx, dy] = [dy, 0];
    if (event.ctrlKey || event.metaKey) zoomBy(Math.exp(-dy * ZOOM_SPEED));
    else if (event.altKey) rotateBy(0, 0, -(dx + dy) * ROTATE_SPEED);
    else rotateBy(-dy * ROTATE_SPEED, -dx * ROTATE_SPEED, 0);
  };

  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  element.addEventListener("wheel", wheel, { passive: false });
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", up);
    element.removeEventListener("wheel", wheel);
  };
}

const angle = (from: Point, to: Point): number => Math.atan2(to.y - from.y, to.x - from.x);
const distance = (from: Point, to: Point): number => Math.hypot(to.x - from.x, to.y - from.y);
const wrap = (radians: number): number => Math.atan2(Math.sin(radians), Math.cos(radians));
