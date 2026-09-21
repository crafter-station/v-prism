"use client";

import { useEffect, useRef, useState } from "react";
import { attachPointer } from "./pointer";
import { createRenderer } from "./render/renderer";
import { diagnose, type Failure } from "./render/support";
import { Drawer } from "./ui/drawer";
import { Fallback } from "./ui/fallback";
import { Hint } from "./ui/hint";
import { Source } from "./ui/source";
import styles from "./prism.module.css";

export function Prism() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<Failure>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const renderer = createRenderer(canvas);
    renderer.ready.catch((error: unknown) => diagnose(error).then(setFailure));
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
      {failure ? (
        <Fallback failure={failure} />
      ) : (
        <>
          <Hint />
          <Drawer />
        </>
      )}
      <Source />
    </main>
  );
}
