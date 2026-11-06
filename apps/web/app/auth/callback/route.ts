import { type NextRequest, NextResponse } from "next/server";
import {
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  TOKEN_COOKIE,
  TOKEN_MAX_AGE,
} from "@/lib/auth";
import { safeLocalReturnPath } from "@/lib/server/oauth-policy";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface OAuthTokenResponse {
  token: string;
}

interface OAuthTwoFactorResponse {
  two_factor_required: true;
  challenge: string;
  methods: string[];
}

function clearOAuthCookies(response: NextResponse): void {
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_RETURN_COOKIE);
}

function failed(origin: string, error = "oauth_failed"): NextResponse {
  const response = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  clearOAuthCookies(response);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const clientState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const returnPath = request.cookies.get(OAUTH_RETURN_COOKIE)?.value ?? "/";

  if (!code || !clientState) return failed(origin);

  let result: OAuthTokenResponse | OAuthTwoFactorResponse;
  try {
    const exchange = await fetch(`${API_URL}/api/auth/oauth/exchange`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code, client_state: clientState }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!exchange.ok) return failed(origin);
    result = (await exchange.json()) as OAuthTokenResponse | OAuthTwoFactorResponse;
  } catch {
    return failed(origin);
  }

  if ("two_factor_required" in result) {
    const destination = new URL("/login", origin);
    destination.searchParams.set("oauth_challenge", result.challenge);
    destination.searchParams.set("oauth_methods", result.methods.join(","));
    destination.searchParams.set("next", returnPath);
    const response = NextResponse.redirect(destination);
    clearOAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  if (!result.token) return failed(origin);

  const destination = safeLocalReturnPath(returnPath);
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set({
    name: TOKEN_COOKIE,
    value: result.token,
    path: "/",
    maxAge: TOKEN_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:",
    priority: "high",
  });
  clearOAuthCookies(response);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}
