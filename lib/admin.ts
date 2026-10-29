import { timingSafeEqual } from "crypto";
import { HttpError } from "./rsvp";

export function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_KEY || "";
  const given = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key") || "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Clave incorrecta");
}
