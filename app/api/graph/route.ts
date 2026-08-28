import { graphPayload } from "@/lib/graph";
import { probeInfona, infonaUrl } from "@/lib/infona";

export const runtime = "nodejs";

export async function GET() {
  const mode = infonaUrl() && (await probeInfona()) ? "infona" : "fixture";
  return Response.json(graphPayload(mode));
}
