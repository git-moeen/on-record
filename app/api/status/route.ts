import { status } from "@/lib/infona";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await status());
}
