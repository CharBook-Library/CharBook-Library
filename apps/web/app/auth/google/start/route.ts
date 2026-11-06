import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_RETURN_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/auth";
import { safeLocalReturnPath } from "@/lib/server/oauth-policy";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const OAUTH_MAX_AGE = 10 * 60;

export function GET(request: NextRequest) {
  const state = randomBytes(32).toString("base64url");
  const destination = new URL("/auth/google", API_URL);
  destination.searchParams.set("client_state", state);

  const response = NextResponse.redirect(destination);
  const secure = process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_MAX_AGE,
  };

  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(
    OAUTH_RETURN_COOKIE,
    safeLocalReturnPath(request.nextUrl.searchParams.get("next")),
    cookieOptions,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}
