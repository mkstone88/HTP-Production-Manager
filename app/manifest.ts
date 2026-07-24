import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hometown Painting — Production",
    short_name: "Hometown",
    description: "Schedule and manage painting jobs and subcontractors.",
    // "/" so every role lands right: the login redirect / role-based landing
    // picks the section (a Sales or Setter install must not boot into a
    // Production-only route).
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e3f86",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
