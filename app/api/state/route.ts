import { getDb } from "@/lib/mongodb";
import { buildState, errorResponse } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const t = req.headers.get("x-guest-token");
    return Response.json(await buildState(await getDb(), t && /^[A-Za-z0-9-]{16,64}$/.test(t) ? t : null));
  } catch (e) {
    return errorResponse(e);
  }
}
