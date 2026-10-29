import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/mongodb";
import { claims, errorResponse, HttpError, releaseRiders, rsvps, toMine, total } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

async function list() {
  const db = await getDb();
  const all = await rsvps(db).find({}).sort({ createdAt: 1 }).toArray();
  const claimDocs = await claims(db).find({}).toArray();
  return {
    rsvps: all.map((r) => ({
      ...toMine(r),
      total: r.attending === "si" ? total(r) : 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      items: claimDocs.filter((c) => c.rsvpId === r._id.toHexString()).map((c) => c._id),
    })),
  };
}

const idOf = (v: unknown) => {
  if (typeof v !== "string" || !ObjectId.isValid(v)) throw new HttpError(400, "Id inválido");
  return new ObjectId(v);
};

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    return Response.json(await list());
  } catch (e) {
    return errorResponse(e);
  }
}

// Marcar pago confirmado
export async function PATCH(req: Request) {
  try {
    requireAdmin(req);
    const { id, paidConfirmed } = await req.json().catch(() => ({}));
    await rsvps(await getDb()).updateOne({ _id: idOf(id) }, { $set: { paidConfirmed: !!paidConfirmed } });
    return Response.json(await list());
  } catch (e) {
    return errorResponse(e);
  }
}

// Borrar una respuesta (duplicados, pruebas, alguien que se arrepintió)
export async function DELETE(req: Request) {
  try {
    requireAdmin(req);
    const { id } = await req.json().catch(() => ({}));
    const db = await getDb();
    const _id = idOf(id);
    await rsvps(db).deleteOne({ _id });
    await releaseRiders(rsvps(db), _id.toHexString());
    await claims(db).deleteMany({ rsvpId: _id.toHexString() });
    return Response.json(await list());
  } catch (e) {
    return errorResponse(e);
  }
}
