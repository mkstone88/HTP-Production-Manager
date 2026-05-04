import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hometown Painting — Production",
    short_name: "Hometown",
    description: "Schedule and manage painting jobs and subcontractors.",
    start_url: "/schedule",
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
