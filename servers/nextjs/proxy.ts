import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { desktopRequestDenied } from "@/lib/desktop-auth";

function getFastApiBaseUrl(): string {
  const internal =
    process.env.FAST_API_INTERNAL_URL?.trim() ||
    process.env.FASTAPI_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const configured = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

function isFastApiApiPath(pathname: string): boolean {
  return (
    pathname === "/api/v1" ||
    pathname.startsWith("/api/v1/") ||
    pathname === "/api/v2" ||
    pathname.startsWith("/api/v2/")
  );
}

function isFastApiAssetPath(pathname: string): boolean {
  return (
    pathname === "/app_data" ||
    pathname.startsWith("/app_data/") ||
    pathname === "/static" ||
    pathname.startsWith("/static/")
  );
}

function isApiAuthExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/api/v1/auth/") ||
    pathname === "/api/telemetry-status" ||
    pathname === "/api/update-svg" ||
    pathname.startsWith("/api/export-presentation-data/")
  );
}

function rewriteToFastApi(
  request: NextRequest,
  clerkUserId?: string | null,
  clerkUserEmail?: string | null
): NextResponse {
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `${getFastApiBaseUrl()}/`
  );
  const requestHeaders = new Headers(request.headers);

  // Security: Clean any untrusted client-supplied identity headers
  requestHeaders.delete("x-clerk-user-id");
  requestHeaders.delete("x-clerk-user-email");
  requestHeaders.delete("x-clerk-internal-secret");

  if (clerkUserId) {
    requestHeaders.set("x-clerk-user-id", clerkUserId);
    if (clerkUserEmail) {
      requestHeaders.set("x-clerk-user-email", clerkUserEmail);
    }
    const secret = process.env.CLERK_SECRET_KEY?.trim();
    if (secret) {
      requestHeaders.set("x-clerk-internal-secret", secret);
    }
  }

  return NextResponse.rewrite(destination, {
    request: {
      headers: requestHeaders,
    },
  });
}

function continueRequest(
  request: NextRequest,
  clerkUserId?: string | null,
  clerkUserEmail?: string | null
): NextResponse {
  return isFastApiApiPath(request.nextUrl.pathname)
    ? rewriteToFastApi(request, clerkUserId, clerkUserEmail)
    : NextResponse.next();
}

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/auth(.*)",
  "/api/telemetry-status",
  "/api/update-svg",
  "/api/export-presentation-data(.*)",
  "/pdf-maker(.*)",
]);

const hasClerkKeys = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
  process.env.CLERK_SECRET_KEY?.trim()
);

// Fallback proxy handler for when Clerk keys are not configured
function fallbackProxy(request: NextRequest) {
  const denied = desktopRequestDenied(request);
  if (denied) return denied;

  const { pathname } = request.nextUrl;
  if (isFastApiAssetPath(pathname)) {
    return rewriteToFastApi(request);
  }
  if (request.method === "OPTIONS" || isApiAuthExempt(pathname) || pathname === "/pdf-maker") {
    return continueRequest(request);
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer sk-presenton-")) {
    return isFastApiApiPath(pathname)
      ? rewriteToFastApi(request)
      : NextResponse.json(
          { detail: "API keys are only accepted by the Presenton API" },
          { status: 403 }
        );
  }

  return continueRequest(request);
}

// Full Clerk-integrated proxy middleware
const clerkProxyHandler = clerkMiddleware(async (auth, request) => {
  const denied = desktopRequestDenied(request);
  if (denied) return denied;

  const { pathname } = request.nextUrl;

  if (isFastApiAssetPath(pathname)) {
    return rewriteToFastApi(request);
  }

  if (pathname === "/pdf-maker") {
    return continueRequest(request);
  }

  if (request.method === "OPTIONS") {
    return continueRequest(request);
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer sk-presenton-")) {
    return isFastApiApiPath(pathname)
      ? rewriteToFastApi(request)
      : NextResponse.json(
          { detail: "API keys are only accepted by the Presenton API" },
          { status: 403 }
        );
  }

  const authObj = await auth();
  const userId = authObj?.userId;

  // If already authenticated and visiting sign-in / sign-up, redirect to destination
  if (userId && (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))) {
    const redirectUrl = request.nextUrl.searchParams.get("redirect_url") || "/";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Public route access
  if (isPublicRoute(request) || isApiAuthExempt(pathname)) {
    if (userId) {
      const email =
        (authObj.sessionClaims as Record<string, any>)?.email ||
        (authObj.sessionClaims as Record<string, any>)?.primary_email_address ||
        userId;
      return continueRequest(request, userId, email);
    }
    return continueRequest(request);
  }

  // Protected route access without authentication
  if (!userId) {
    if (isFastApiApiPath(pathname)) {
      return NextResponse.json(
        { detail: "Clerk authentication required" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const signInUrl = new URL("/sign-in", request.url);
    const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
    signInUrl.searchParams.set("redirect_url", returnUrl);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated user on protected route
  const email =
    (authObj.sessionClaims as Record<string, any>)?.email ||
    (authObj.sessionClaims as Record<string, any>)?.primary_email_address ||
    userId;

  return continueRequest(request, userId, email);
});

const activeHandler = hasClerkKeys ? clerkProxyHandler : fallbackProxy;

export { activeHandler as proxy };
export default activeHandler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
