"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthGate() {
  const router = useRouter();

  useEffect(() => {
    // Legacy admin password authentication is removed.
    // Redirect to Clerk sign-in.
    router.replace("/sign-in");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F8F8]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C51F8] border-t-transparent" />
        <p className="font-syne text-sm text-[#667085]">Redirecting to sign in...</p>
      </div>
    </div>
  );
}
