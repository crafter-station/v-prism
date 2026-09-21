import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "v-prism";
const description = "A glass prism splitting light into a rainbow, rendered on WebGPU with vgpu.";

export const metadata: Metadata = {
  metadataBase: new URL("https://v-prism.crafter.run"),
  title,
  description,
  openGraph: { title, description, url: "/", siteName: title, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
