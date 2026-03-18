import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { parseStatementCSV } from "@/lib/statement-parser";
import { parseStatementPDF } from "@/lib/statement-pdf-parser";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  const name = (file.name || "").toLowerCase();
  const isPdf = name.endsWith(".pdf");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (isPdf) {
      const parsed = await parseStatementPDF(buffer);
      return NextResponse.json(parsed);
    }

    const text = buffer.toString("utf-8");
    const parsed = parseStatementCSV(text);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Parse error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse statement" },
      { status: 400 }
    );
  }
}
