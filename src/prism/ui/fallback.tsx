import { getImageProps } from "next/image";
import type { Failure } from "../render/support";
import styles from "./fallback.module.css";
import landscape from "./poster/landscape.jpg";
import portrait from "./poster/portrait.jpg";

type Platform = "ios" | "android" | "desktop";

const POSTER = {
  alt: "A glass prism splitting a beam of light into a rainbow",
  sizes: "100vw",
  className: styles.poster,
};

const REMEDY: Record<Platform, string> = {
  ios: "Update to iOS 26, or on iOS 18 turn on WebGPU in Safari’s Feature Flags.",
  android: "Open it in Chrome on Android 12 or later.",
  desktop: "Open it in a current Chrome, Edge or Safari.",
};

function platform(): Platform {
  const agent = navigator.userAgent;
  const tablet = /Macintosh/.test(agent) && navigator.maxTouchPoints > 1;
  if (tablet || /iPhone|iPad|iPod/.test(agent)) return "ios";
  return /Android/.test(agent) ? "android" : "desktop";
}

function explain(failure: Failure): readonly [string, string] {
  switch (failure.reason) {
    case "insecure":
      return ["WebGPU only runs on secure pages.", "Open it over HTTPS or on localhost."];
    case "missing":
      return ["This browser can’t run WebGPU yet.", REMEDY[platform()]];
    case "blocked":
      return [
        "WebGPU is switched off for this device’s graphics.",
        "A browser or system update may turn it on.",
      ];
    case "crashed":
      return ["The live render couldn’t start here.", failure.detail];
  }
}

export function Fallback({ failure }: { failure: Failure }) {
  const [message, remedy] = explain(failure);
  const { srcSet: wide } = getImageProps({ ...POSTER, src: landscape }).props;
  const { srcSet: tall, ...image } = getImageProps({ ...POSTER, src: portrait }).props;

  return (
    <div className={styles.fallback}>
      <picture>
        <source media="(orientation: landscape)" srcSet={wide} />
        <source srcSet={tall} />
        <img {...image} alt={POSTER.alt} />
      </picture>
      <p className={styles.caption} role="status">
        <span>{message}</span>
        <span className={styles.remedy}>{remedy}</span>
      </p>
    </div>
  );
}
