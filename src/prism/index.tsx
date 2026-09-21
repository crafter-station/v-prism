"use client";

import { useEffect, useRef, useState } from "react";
import { attachPointer } from "./pointer";
import { createRenderer } from "./render/renderer";
import { Drawer } from "./ui/drawer";
import { Hint } from "./ui/hint";
import styles from "./prism.module.css";

export function Prism() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const renderer = createRenderer(canvas);
    renderer.ready.catch(() => setUnsupported(true));
    const detach = attachPointer(overlay);
    return () => {
      detach();
      renderer.dispose();
    };
  }, []);

  return (
    <main className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={overlayRef} className={styles.overlay}>
        <p className="visually-hidden">
          Click or drag anywhere to aim the light beam at the prism. Scroll to rotate the prism.
        </p>
      </div>
      {unsupported ? (
        <p className={styles.notice}>
          This page needs WebGPU. Try a current version of Chrome, Edge or Safari.
        </p>
      ) : (
        <Hint />
      )}
      <Drawer />
    </main>
  );
}
