import { askQuestion } from "@/lib/infona";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Ask a question." }, { status: 400 });
  }
  const answer = await askQuestion(question);
  return Response.json(answer);
}
