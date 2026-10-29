import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { buildState, claims, errorResponse, HttpError, parseRsvp, releaseRiders, rsvps, tokenFrom } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

// Crea o actualiza la respuesta del invitado (identificado por el token de su celular).
export async function PUT(req: Request) {
  try {
    const token = tokenFrom(req);
    const data = parseRsvp(await req.json().catch(() => ({})));
    const db = await getDb();
    const col = rsvps(db);
    const prev = await col.findOne({ token });
    const myId = prev?._id.toHexString();

    // Pasajero: el carro debe existir y tener puesto libre.
    if (data.ride === "rider" && data.carId) {
      if (data.carId === myId) throw new HttpError(400, "No puedes ir en tu propio carro");
      const driver = await col.findOne({ _id: new ObjectId(data.carId), attending: "si", ride: "driver" });
      if (!driver) throw new HttpError(409, "Ese carro ya no está disponible. Elige otro.");
      const taken = await col.countDocuments({ carId: data.carId, attending: "si", ride: "rider", token: { $ne: token } });
      if (taken >= driver.seats) throw new HttpError(409, `El carro de ${driver.name} se acaba de llenar. Elige otro.`);
    }

    // Conductor: no puede ofrecer menos puestos de los que ya están ocupados.
    if (data.ride === "driver" && myId) {
      const riders = await col.countDocuments({ carId: myId, attending: "si", ride: "rider" });
      if (data.seats < riders) throw new HttpError(409, `Ya llevas ${riders} pasajeros: no puedes ofrecer menos cupos.`);
    }

    const now = new Date();
    const res = await col.findOneAndUpdate(
      { token },
      {
        $set: { ...data, updatedAt: now },
        $setOnInsert: { token, paid: false, paidConfirmed: false, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    // Si dejó de ser conductor (o ya no va), sus pasajeros quedan buscando cupo.
    if (prev?.ride === "driver" && data.ride !== "driver") await releaseRiders(col, myId!);
    // Si ya no va, libera lo que había apartado.
    if (data.attending === "no" && res) await claims(db).deleteMany({ rsvpId: res._id.toHexString() });

    return Response.json(await buildState(db, token));
  } catch (e) {
    return errorResponse(e);
  }
}

// Borra por completo la respuesta del invitado.
export async function DELETE(req: Request) {
  try {
    const token = tokenFrom(req);
    const db = await getDb();
    const col = rsvps(db);
    const prev = await col.findOneAndDelete({ token });
    if (prev) {
      const id = prev._id.toHexString();
      await releaseRiders(col, id);
      await claims(db).deleteMany({ rsvpId: id });
    }
    return Response.json(await buildState(db, token));
  } catch (e) {
    return errorResponse(e);
  }
}
