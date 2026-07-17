import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Handler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response>;

const wrap = (fn: Handler): Handler => {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (e) {
      console.error("Auth handler error:", e);
      return NextResponse.json({ error: "Auth handler error" }, { status: 500 });
    }
  };
};

export const GET = wrap(handlers.GET as Handler);
export const POST = wrap(handlers.POST as Handler);
