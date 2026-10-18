import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F9F8F8] p-6 font-syne">
      <div className="flex flex-col items-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C51F8] p-2 shadow-sm">
            <img src="/logo-with-bg.png" alt="Aultrix Digital" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#101828]">Aultrix Digital</h1>
            <p className="text-xs text-[#667085]">Sign in to your account</p>
          </div>
        </div>

        {clerkPubKey ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full max-w-md",
                card: "shadow-md rounded-[20px] border border-[#EDEEEF] bg-white p-6",
                headerTitle: "font-syne text-xl text-[#101828]",
                headerSubtitle: "text-sm text-[#667085]",
                formButtonPrimary:
                  "bg-[#7C51F8] hover:bg-[#683fe0] text-white font-medium rounded-xl py-2.5 transition-all text-sm",
              },
            }}
          />
        ) : (
          <div className="w-full max-w-md rounded-[20px] border border-[#EDEEEF] bg-white p-8 text-center shadow-md">
            <h2 className="mb-2 text-xl font-semibold text-[#101828]">Clerk Key Required</h2>
            <p className="mb-6 text-sm text-[#667085]">
              Please add your <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-[#7C51F8]">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-[#7C51F8]">CLERK_SECRET_KEY</code> to your <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">.env</code> file.
            </p>
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl bg-[#7C51F8] px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-[#683fe0] transition-all"
            >
              Open Clerk Dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
