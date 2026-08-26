import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dr. Nida's MCCQE1 Journey",
    short_name: "MCCQE1 Journey",
    description: "From MBBS to Canadian Physician 🇨🇦",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F4EE",
    theme_color: "#1F4A52",
    categories: ["education", "medical"],
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }
}
