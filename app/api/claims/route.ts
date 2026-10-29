import { MongoServerError } from "mongodb";
import { EVENT } from "@/lib/config";
import { getDb } from "@/lib/mongodb";
import { buildState, claims, errorResponse, HttpError, rsvps, tokenFrom } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

// Aparta o suelta una cosa de la lista "Llevar".
export async function POST(req: Request) {
  try {
    const token = tokenFrom(req);
    const { item } = await req.json().catch(() => ({}));
    if (!EVENT.items.includes(item)) throw new HttpError(400, "Ese ítem no está en la lista");
    const db = await getDb();
    const me = await rsvps(db).findOne({ token, attending: "si" });
    if (!me) throw new HttpError(403, "Confirma tu asistencia para apartar cosas");
    const myId = me._id.toHexString();

    const current = await claims(db).findOne({ _id: item });
    if (current?.rsvpId === myId) {
      await claims(db).deleteOne({ _id: item, rsvpId: myId });
    } else if (current) {
      throw new HttpError(409, "Alguien ya apartó eso");
    } else {
      try {
        await claims(db).insertOne({ _id: item, rsvpId: myId, at: new Date() });
      } catch (e) {
        if (e instanceof MongoServerError && e.code === 11000) throw new HttpError(409, "Alguien lo apartó justo ahora");
        throw e;
      }
    }
    return Response.json(await buildState(db, token));
  } catch (e) {
    return errorResponse(e);
  }
}
