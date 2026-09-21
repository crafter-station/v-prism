"use client";

import { useEffect, type ReactNode } from "react";
import type { Vec3 } from "../math/vec3";
import { prism, resetView, setDrawerOpen, setRotation, setZoom } from "../state/prism";
import { DARK, LIGHT, settings, type Settings } from "../state/settings";
import { useStore } from "../state/store";
import styles from "./drawer.module.css";

type Numeric = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

interface Slider {
  readonly id: Numeric;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const LIGHT_SLIDERS: readonly Slider[] = [
  { id: "rainbow", label: "Rainbow", min: 0, max: 10, step: 0.1 },
  { id: "bloom", label: "Bloom", min: 0, max: 5, step: 0.05 },
  { id: "ambient", label: "Ambient", min: 0, max: 0.2, step: 0.001 },
];

const GLASS_SLIDERS: readonly Slider[] = [
  { id: "reflections", label: "Reflections", min: 0, max: 3, step: 0.05 },
  { id: "roughness", label: "Roughness", min: 0, max: 1, step: 0.01 },
  { id: "ior", label: "Refraction", min: 1, max: 2.33, step: 0.01 },
  { id: "thickness", label: "Thickness", min: 0, max: 3, step: 0.05 },
];

const AXES = ["Tilt", "Turn", "Spin"];

export function Drawer() {
  const open = useStore(prism, (s) => s.drawerOpen);
  const rotation = useStore(prism, (s) => s.rotation);
  const zoom = useStore(prism, (s) => s.zoom);
  const tuning = useStore(settings, (s) => s);
  const light = tuning.background === LIGHT.background;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const patch = (key: Numeric, value: number) => settings.set({ [key]: value } as Partial<Settings>);

  return (
    <>
      <button
        type="button"
        className={styles.handle}
        aria-label="Open scene controls"
        aria-expanded={open}
        onClick={() => setDrawerOpen(true)}
      />
      {open && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} />}
      <aside
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        aria-label="Scene controls"
        inert={!open}
      >
        <div className={styles.top}>
          <span className={styles.title}>Scene</span>
          <button type="button" onClick={() => setDrawerOpen(false)}>
            Close
          </button>
        </div>

        <div className={styles.segments} role="group" aria-label="Preset">
          <button type="button" aria-pressed={!light} onClick={() => settings.set(DARK)}>
            Dark
          </button>
          <button type="button" aria-pressed={light} onClick={() => settings.set(LIGHT)}>
            Light
          </button>
        </div>

        <Section title="Light">
          {LIGHT_SLIDERS.map(({ id, ...s }) => (
            <Range key={id} {...s} value={tuning[id]} onChange={(v) => patch(id, v)} />
          ))}
        </Section>

        <Section title="Glass">
          {GLASS_SLIDERS.map(({ id, ...s }) => (
            <Range key={id} {...s} value={tuning[id]} onChange={(v) => patch(id, v)} />
          ))}
          <div className={styles.swatches}>
            <Swatch label="Tint" value={tuning.tint} onChange={(tint) => settings.set({ tint })} />
            <Swatch
              label="Background"
              value={tuning.background}
              onChange={(background) => settings.set({ background })}
            />
          </div>
        </Section>

        <Section title="Motion">
          {AXES.map((label, axis) => (
            <Range
              key={label}
              label={label}
              min={-180}
              max={180}
              step={1}
              value={rotation[axis]}
              onChange={(v) => {
                const next = [...rotation] as [number, number, number];
                next[axis] = v;
                setRotation(next as Vec3);
              }}
              unit="°"
            />
          ))}
          <Range label="Zoom" min={0.4} max={4} step={0.05} value={zoom} onChange={setZoom} unit="×" />
          <Range
            label="Drift"
            min={0}
            max={3}
            step={0.05}
            value={tuning.drift}
            onChange={(v) => patch("drift", v)}
          />
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              settings.set(light ? LIGHT : DARK);
              resetView();
            }}
          >
            Reset
          </button>
        </Section>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  unit = "",
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return (
    <label className={styles.row}>
      <span>{label}</span>
      <span>
        {value.toFixed(decimals)}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.swatch}>
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span>{label}</span>
    </label>
  );
}
