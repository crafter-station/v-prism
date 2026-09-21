"use client";

import { useEffect, useState } from "react";
import { prism } from "../state/prism";
import styles from "./hint.module.css";

const SHOW_AFTER = 3000;
const HIDE_AFTER = 9000;

export function Hint() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const alt = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌥" : "Alt";
    const show = setTimeout(() => {
      setText(
        touch
          ? "Drag to aim · two fingers to rotate or pinch"
          : `Drag to aim · scroll to rotate · ${alt} + scroll to spin · pinch to zoom`,
      );
      setVisible(true);
    }, SHOW_AFTER);
    const hide = setTimeout(() => setVisible(false), HIDE_AFTER);
    const initial = prism.get().rotation;
    const unsubscribe = prism.subscribe(() => {
      if (prism.get().rotation !== initial) setVisible(false);
    });
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      unsubscribe();
    };
  }, []);

  return (
    <p className={`${styles.hint} ${visible ? styles.visible : ""}`} aria-hidden="true">
      {text}
    </p>
  );
}
