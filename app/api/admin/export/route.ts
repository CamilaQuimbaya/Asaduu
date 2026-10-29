import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/mongodb";
import { claims, errorResponse, rsvps, total } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

const RIDE: Record<string, string> = { driver: "Lleva carro", rider: "Pasajero", own: "Por su cuenta" };

// CSV con ; y BOM para que Excel en español lo abra bien con tildes.
export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const db = await getDb();
    const all = await rsvps(db).find({}).sort({ createdAt: 1 }).toArray();
    const claimDocs = await claims(db).find({}).toArray();
    const names = new Map(all.map((r) => [r._id.toHexString(), r.name]));
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[;"\n]|^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
    };
    const header = ["Nombre", "Asiste", "Acompañantes", "Personas", "Comida", "Transporte", "Carro / va con", "Sale de", "Hora", "Cupos", "Extra", "Total", "Método", "Dice que pagó", "Pago confirmado", "Lleva", "Respondió"];
    const rows = all.map((r) => {
      const yes = r.attending === "si";
      return [
        r.name, yes ? "Sí" : "No", r.guests, yes ? 1 + r.guests : 0, r.diet.join(", "),
        yes && r.ride ? RIDE[r.ride] : "", r.ride === "driver" ? r.carModel : r.carId ? names.get(r.carId) || "" : "",
        r.ride === "driver" ? r.from : "", r.ride === "driver" ? r.time : "", r.ride === "driver" ? r.seats : "",
        r.extra, yes ? total(r) : 0, r.method, r.paid ? "Sí" : "No", r.paidConfirmed ? "Sí" : "No",
        claimDocs.filter((c) => c.rsvpId === r._id.toHexString()).map((c) => c._id).join(", "),
        r.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      ].map(cell).join(";");
    });
    return new Response("﻿" + [header.join(";"), ...rows].join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="invitados-asado.csv"' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
