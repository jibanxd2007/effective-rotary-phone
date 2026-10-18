import { NextResponse } from "next/server";
import { desktopRequestDenied, DESKTOP_TOKEN_HEADER } from "@/lib/desktop-auth";

import { getFastApiEndpoint } from "@/lib/fastapi-internal";

export type ServerAuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
  role: "admin" | "user" | null;
};

export async function authStatusForRequest(
  request: Request
): Promise<ServerAuthStatus> {
  if (desktopRequestDenied(request)) {
    return { configured: true, authenticated: false, username: null, user_id: null, role: null };
  }
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkPubKey) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (userId) {
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress ?? userId;
        const isAdmin = user?.publicMetadata?.role === "admin";
        return {
          configured: true,
          authenticated: true,
          username: email,
          user_id: userId,
          role: isAdmin ? "admin" : "user",
        };
      }
    } catch {}
  }
  const cookie = request.headers.get("cookie") || "";
  try {
    const statusUrl = getFastApiEndpoint("api/v1/auth/status");
    const response = await fetch(statusUrl, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(request.headers.get(DESKTOP_TOKEN_HEADER) ? { [DESKTOP_TOKEN_HEADER]: request.headers.get(DESKTOP_TOKEN_HEADER)! } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        configured: true,
        authenticated: false,
        username: null,
        user_id: null,
        role: null,
      };
    }
    return (await response.json()) as ServerAuthStatus;
  } catch {
    return {
      configured: true,
      authenticated: false,
      username: null,
      user_id: null,
      role: null,
    };
  }
}

export async function requireAdminApi(
  request: Request
): Promise<NextResponse | null> {
  const status = await authStatusForRequest(request);
  if (!status.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  if (status.role !== "admin") {
    return NextResponse.json(
      { detail: "Admin access required" },
      { status: 403 }
    );
  }
  return null;
}
