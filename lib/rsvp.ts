import { ObjectId, type Collection, type Db } from "mongodb";
import { EVENT } from "./config";

export type Ride = "driver" | "rider" | "own";

export interface RsvpDoc {
  _id: ObjectId;
  token: string;
  name: string;
  attending: "si" | "no";
  guests: number;
  diet: string[];
  ride: Ride | null;
  from: string;
  time: string;
  seats: number;
  carModel: string;
  carId: string | null; // _id (hex) del conductor
  extra: number;
  method: string;
  paid: boolean; // el invitado dice que pagó
  paidConfirmed: boolean; // quien organiza lo confirmó
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimDoc {
  _id: string; // el nombre del ítem: así cada cosa solo la aparta una persona
  rsvpId: string;
  at: Date;
}

export type MyRsvp = Omit<RsvpDoc, "_id" | "token" | "createdAt" | "updatedAt"> & { id: string };

export interface PublicState {
  confirmed: number;
  avatars: string[];
  cars: { id: string; driver: string; model: string; from: string; time: string; seats: number; mine: boolean; riders: { n: string; mine: boolean }[] }[];
  seekers: string[];
  fund: { pledged: number; paid: number };
  contribs: { n: string; v: number; paid: boolean; extra: boolean; mine: boolean }[];
  claims: Record<string, { name: string; mine: boolean }>;
  me: MyRsvp | null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const rsvps = (db: Db) => db.collection<RsvpDoc>("rsvps");
export const claims = (db: Db) => db.collection<ClaimDoc>("claims");

export function tokenFrom(req: Request): string {
  const t = req.headers.get("x-guest-token") || "";
  if (!/^[A-Za-z0-9-]{16,64}$/.test(t)) throw new HttpError(400, "Token de invitado inválido");
  return t;
}

export const total = (r: Pick<RsvpDoc, "guests" | "extra">) => (1 + r.guests) * EVENT.fee + r.extra;

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const pick = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  opts.includes(v as T) ? (v as T) : fallback;

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Valida y normaliza lo que manda el navegador: nunca confiamos en el cliente. */
export function parseRsvp(body: Record<string, unknown>) {
  const attending = pick(body.attending, ["si", "no"] as const, "no");
  const name = clean(body.name, 40);
  if (attending === "si" && !name) throw new HttpError(400, "Escribe tu nombre");

  const methods = Object.keys(EVENT.payments);
  const diet = Array.isArray(body.diet) ? body.diet.filter((d) => EVENT.diets.includes(String(d))).map(String) : [];
  const ride = attending === "si" ? (pick(body.ride, ["driver", "rider", "own"] as const, "own") as Ride) : null;

  return {
    name,
    attending,
    guests: attending === "si" ? int(body.guests, 0, EVENT.maxGuests, 0) : 0,
    diet: diet.length ? [...new Set(diet)] : ["Ninguna"],
    ride,
    from: pick(String(body.from), EVENT.fromOptions, EVENT.fromOptions[0]),
    time: pick(String(body.time), EVENT.timeOptions, EVENT.timeOptions[0]),
    seats: int(body.seats, 1, EVENT.maxSeats, 3),
    carModel: clean(body.carModel, 40),
    carId: ride === "rider" && typeof body.carId === "string" && ObjectId.isValid(body.carId) ? body.carId : null,
    extra: attending === "si" ? int(body.extra, 0, 1_000_000, 0) : 0,
    method: pick(String(body.method), methods, methods[0]),
  };
}

/** Saca a los pasajeros de un carro (cuando el conductor cancela o deja de llevar gente). */
export async function releaseRiders(col: Collection<RsvpDoc>, driverId: string) {
  await col.updateMany({ carId: driverId }, { $set: { carId: null, updatedAt: new Date() } });
}

export async function buildState(db: Db, token: string | null): Promise<PublicState> {
  const all = await rsvps(db).find({}).sort({ createdAt: 1 }).toArray();
  const going = all.filter((r) => r.attending === "si");
  const me = token ? all.find((r) => r.token === token) ?? null : null;
  const meId = me?._id.toHexString();

  const drivers = going.filter((r) => r.ride === "driver");
  const driverIds = new Set(drivers.map((d) => d._id.toHexString()));
  const cars = drivers.map((d) => {
    const id = d._id.toHexString();
    return {
      id,
      driver: d.name,
      model: d.carModel,
      from: d.from,
      time: d.time,
      seats: d.seats,
      mine: id === meId,
      riders: going
        .filter((r) => r.ride === "rider" && r.carId === id)
        .map((r) => ({ n: r.name, mine: r._id.toHexString() === meId })),
    };
  });
  const seekers = going
    .filter((r) => r.ride === "rider" && (!r.carId || !driverIds.has(r.carId)))
    .map((r) => r.name);

  const claimDocs = await claims(db).find({}).toArray();
  const byId = new Map(all.map((r) => [r._id.toHexString(), r]));
  const claimMap: PublicState["claims"] = {};
  for (const c of claimDocs) {
    const owner = byId.get(c.rsvpId);
    if (owner) claimMap[c._id] = { name: owner.name, mine: c.rsvpId === meId };
  }

  const isPaid = (r: RsvpDoc) => r.paidConfirmed || r.paid;
  return {
    confirmed: going.reduce((a, r) => a + 1 + r.guests, 0),
    avatars: going.slice(-5).map((r) => r.name[0]?.toUpperCase() || "?"),
    cars,
    seekers,
    fund: {
      pledged: going.reduce((a, r) => a + total(r), 0),
      paid: going.filter(isPaid).reduce((a, r) => a + total(r), 0),
    },
    contribs: [...going]
      .sort((a, b) => +b.updatedAt - +a.updatedAt)
      .slice(0, 8)
      .map((r) => ({ n: r.name, v: total(r), paid: isPaid(r), extra: r.extra > 0, mine: r._id.toHexString() === meId })),
    claims: claimMap,
    me: me ? toMine(me) : null,
  };
}

export function toMine(r: RsvpDoc): MyRsvp {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, token, createdAt, updatedAt, ...rest } = r;
  return { ...rest, id: _id.toHexString() };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "No pudimos conectar con el servidor. Intenta de nuevo." }, { status: 500 });
}
