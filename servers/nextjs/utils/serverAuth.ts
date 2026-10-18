import { redirect } from "next/navigation";

export type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
  available: boolean;
  role: "admin" | "user" | null;
};

/**
 * Resolves current authentication status using Clerk.
 * Legacy admin password system has been completely removed.
 */
export async function getServerAuthStatus(): Promise<AuthStatus> {
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (clerkPubKey) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (userId) {
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress ?? userId;
        return {
          configured: true,
          authenticated: true,
          username: email,
          user_id: userId,
          available: true,
          role: "user",
        };
      }
      return {
        configured: true,
        authenticated: false,
        username: null,
        user_id: null,
        available: true,
        role: null,
      };
    } catch {
      // In case Clerk throws during initialization
    }
  }

  // When Clerk publishable key is not yet set
  return {
    configured: false,
    authenticated: false,
    username: null,
    user_id: null,
    available: true,
    role: null,
  };
}

/**
 * Protects pages using Clerk authentication.
 * If user is not signed in to Clerk, redirects to /sign-in.
 * Legacy admin password auth and /?reason=unauthorized redirects have been removed.
 */
export async function requireAppSession() {
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkPubKey) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const { userId } = await auth();
      if (!userId) {
        redirect("/sign-in");
      }
      return;
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e) throw e;
      redirect("/sign-in");
    }
  }

  // When Clerk keys are not yet configured, allow access without any legacy admin password gate
  return;
}

/**
 * Protects admin pages using Clerk authentication.
 */
export async function requireAdminSession() {
  await requireAppSession();
}
