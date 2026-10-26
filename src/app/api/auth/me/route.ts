import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ authenticated: true, user: "abbay", authRequired: false });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = await verifySessionToken(token);

  if (!result.valid) {
    return NextResponse.json({ authenticated: false, authRequired: true }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: result.user,
    authRequired: true,
  });
}
