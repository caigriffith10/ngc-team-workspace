import type { MetadataRoute } from "next"

// Lets Android (and other browsers) install the site to the home screen with the NextGen Coders icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NextGen Coders Team Workspace",
    short_name: "NGC Workspace",
    description: "Training courses for NextGen Coders volunteers and instructors.",
    start_url: "/",
    display: "standalone",
    background_color: "#08142a",
    theme_color: "#08142a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
