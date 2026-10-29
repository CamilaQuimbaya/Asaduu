import { getDb } from "@/lib/mongodb";
import { buildState, errorResponse, HttpError, rsvps, tokenFrom } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const token = tokenFrom(req);
    const { paid } = await req.json().catch(() => ({}));
    const db = await getDb();
    const r = await rsvps(db).updateOne({ token, attending: "si" }, { $set: { paid: !!paid, updatedAt: new Date() } });
    if (!r.matchedCount) throw new HttpError(404, "Primero confirma tu asistencia");
    return Response.json(await buildState(db, token));
  } catch (e) {
    return errorResponse(e);
  }
}
