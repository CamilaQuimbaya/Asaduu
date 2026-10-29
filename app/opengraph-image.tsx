import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/config";

// Imagen que muestra WhatsApp/Instagram/iMessage cuando compartes el link.
export const alt = `${EVENT.title} · ¡Estás invitado!`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Trae la fuente de Google Fonts en formato TTF (el que entiende ImageResponse).
// Si falla (sin internet en el build), la imagen sale con la fuente por defecto.
async function font(family: string, weight: number, text?: string) {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}${text ? `&text=${encodeURIComponent(text)}` : ""}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OG() {
  const words = EVENT.title.split(" ");
  const last = words.pop() ?? "";
  const first = words.shift() ?? "";
  const mid = words.join(" ");
  const when = `${EVENT.ticketDate} · ${EVENT.arrival.toUpperCase()}`;
  const where = EVENT.placeSub.split(" · ")[0] + " · Zipaquirá";

  const [display, body, mono] = await Promise.all([
    font("Bricolage Grotesque", 800, EVENT.title),
    font("Instrument Sans", 500),
    font("DM Mono", 500),
  ]);
  const fonts = [
    display && { name: "Display", data: display, weight: 800 as const },
    body && { name: "Body", data: body, weight: 500 as const },
    mono && { name: "Mono", data: mono, weight: 500 as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 800 }[];

  const embers = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 137) % 1200,
    top: 80 + ((i * 251) % 520),
    s: 3 + (i % 4),
    o: 0.35 + (i % 5) * 0.12,
  }));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#18120e", color: "#f5ede1", fontFamily: "Body" }}>
        {/* brillo del carbón */}
        <div style={{ position: "absolute", right: -220, bottom: -320, width: 1000, height: 820, borderRadius: 9999, background: "radial-gradient(circle, rgba(255,90,31,.55) 0%, rgba(255,90,31,.18) 38%, rgba(24,18,14,0) 68%)", display: "flex" }} />
        {embers.map((e, i) => (
          <div key={i} style={{ position: "absolute", left: e.left, top: e.top, width: e.s, height: e.s, borderRadius: 9999, background: i % 4 ? "#ff7a3d" : "#ffd0a8", opacity: e.o, display: "flex" }} />
        ))}

        {/* llama */}
        <svg viewBox="0 0 400 400" width="380" height="380" style={{ position: "absolute", right: 70, top: 120 }}>
          <circle cx="200" cy="230" r="120" fill="#ff5a1f" opacity=".25" />
          <path d="M200 70c40 66 94 106 94 172a94 94 0 0 1-188 0c0-40 27-66 47-93 7 33 20 47 33 53-7-53 0-93 14-132z" fill="#ff5a1f" />
          <path d="M200 190c18 28 40 46 40 74a40 40 0 0 1-80 0c0-18 12-30 20-40 3 14 9 20 14 22-3-22 0-38 6-56z" fill="#ffb38a" />
        </svg>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "64px 72px" }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontWeight: 500, fontSize: 26, letterSpacing: 5, color: "#ffb38a" }}>ESTÁS INVITADO</div>

          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Display", fontWeight: 800, fontSize: 168, lineHeight: 0.86, letterSpacing: -7 }}>
            <span>{first}</span>
            <div style={{ display: "flex" }}>
              {mid && <span style={{ marginRight: 34 }}>{mid}</span>}
              <span style={{ color: "#ff5a1f" }}>{last}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", padding: "14px 24px", borderRadius: 999, background: "#ff5a1f", color: "#18120e", fontFamily: "Mono", fontWeight: 500, fontSize: 26, letterSpacing: 2 }}>{when}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "#d9ccbd" }}>{where}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
