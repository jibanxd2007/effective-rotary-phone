import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { Toaster } from "@/components/ui/sonner";
import TailwindBrowserRuntime from "@/components/runtime/TailwindBrowserRuntime";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  metadataBase: new URL("https://aultrixdigital.com"),
  title: "Aultrix Digital - AI Presentation Generator",
  description:
    "Aultrix Digital - Next-generation AI presentation generator with custom layouts, multi-model AI, and export capabilities.",
  keywords: [
    "Aultrix Digital",
    "AI presentation generator",
    "data storytelling",
    "data visualization tool",
    "AI data presentation",
    "presentation generator",
    "interactive presentations",
    "professional slides",
  ],
  openGraph: {
    title: "Aultrix Digital - AI Presentation Generator",
    description:
      "Aultrix Digital - Next-generation AI presentation generator with custom layouts, multi-model AI, and export capabilities.",
    url: "https://aultrixdigital.com",
    siteName: "Aultrix Digital",
    images: [
      {
        url: "/logo-with-bg.png",
        width: 1200,
        height: 630,
        alt: "Aultrix Digital Logo",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  alternates: {
    canonical: "https://aultrixdigital.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aultrix Digital - AI Presentation Generator",
    description:
      "Aultrix Digital - Next-generation AI presentation generator with custom layouts, multi-model AI, and export capabilities.",
    images: ["/logo-with-bg.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const content = (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <MixpanelInitializer>
            {children}
          </MixpanelInitializer>
        </Providers>
        <TailwindBrowserRuntime />
        <Toaster position="top-center" />
      </body>
    </html>
  );

  if (clerkPubKey) {
    return (
      <ClerkProvider
        publishableKey={clerkPubKey}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      >
        {content}
      </ClerkProvider>
    );
  }

  return content;
}
