import type { MetadataRoute } from "next";
import { EVENT } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: EVENT.title,
    short_name: "Asado",
    description: `${EVENT.dateLabel} · ${EVENT.place}`,
    start_url: "/",
    display: "standalone",
    background_color: "#18120e",
    theme_color: "#18120e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
