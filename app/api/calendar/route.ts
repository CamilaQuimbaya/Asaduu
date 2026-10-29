import { EVENT } from "@/lib/config";

// Archivo .ics para agregar el evento a cualquier calendario (iPhone, Outlook, Google).
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");

export function GET() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Asado en Zipa//ES",
    "BEGIN:VEVENT",
    `UID:asado-${stamp(EVENT.startISO)}@asado-zipa`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(EVENT.startISO)}`,
    `DTEND:${stamp(EVENT.endISO)}`,
    `SUMMARY:${esc(EVENT.title)}`,
    `LOCATION:${esc(EVENT.place + ", " + EVENT.location)}`,
    `DESCRIPTION:${esc(EVENT.tipTitle + ". " + EVENT.tipText)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Mañana es el asado",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="asado-en-zipa.ics"' },
  });
}
