import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/config";

// Imagen que muestra WhatsApp/Instagram cuando compartes el link.
export const alt = EVENT.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  const words = EVENT.title.split(" ");
  const last = words.pop();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "radial-gradient(ellipse at 70% 80%, #6b2a10 0%, #18120e 60%)", color: "#f5ede1", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, letterSpacing: 4, color: "#ffb38a" }}>
          <span>ESTÁS INVITADO</span>
          <span style={{ color: "#a8988a" }}>{EVENT.dateShort}</span>
        </div>
        <div style={{ display: "flex", fontSize: 170, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>
          {words.join(" ")}&nbsp;<span style={{ color: "#ff5a1f" }}>{last}</span>
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#d9ccbd" }}>
          {EVENT.dateLabel} · {EVENT.place}
        </div>
      </div>
    ),
    size,
  );
}
