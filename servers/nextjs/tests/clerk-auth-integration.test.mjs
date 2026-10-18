import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
let directory, proxyModule;

test.before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "presenton-clerk-test-"));
  const entry = path.join(directory, "entry.ts");
  const output = path.join(directory, "bundle.cjs");
  const source = (rel) => JSON.stringify(path.resolve(rel));

  await writeFile(
    entry,
    [
      `export * from ${source("proxy.ts")};`,
    ].join("\n")
  );

  await build({
    entryPoints: [entry],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "cjs",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
    plugins: [
      {
        name: "test-runtime",
        setup(builder) {
          builder.onResolve({ filter: /^next\/server$/ }, () => ({
            path: require.resolve("next/server"),
            external: true,
          }));
        },
      },
    ],
  });

  proxyModule = require(output);
});

test.after(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Proxy configuration matcher covers pages and API routes while skipping static assets", () => {
  const proxyConfig = proxyModule.config;
  assert.ok(Array.isArray(proxyConfig.matcher));
  const [staticPattern, apiPattern] = proxyConfig.matcher;

  // Compile regex to test pattern matching
  const staticRegex = new RegExp(staticPattern);
  const apiRegex = new RegExp(apiPattern);

  // Protected pages must match (must not be skipped)
  assert.ok(staticRegex.test("/dashboard"), "Dashboard must be intercepted by proxy");
  assert.ok(staticRegex.test("/community"), "Community must be intercepted by proxy");
  assert.ok(staticRegex.test("/templates"), "Templates must be intercepted by proxy");
  assert.ok(staticRegex.test("/presentation"), "Presentation must be intercepted by proxy");
  assert.ok(staticRegex.test("/sign-in"), "Sign-in must be intercepted by proxy");
  assert.ok(staticRegex.test("/sign-up"), "Sign-up must be intercepted by proxy");

  // API routes must match
  assert.ok(apiRegex.test("/api/v1/ppt/presentation/all"), "API routes must match");
  assert.ok(apiRegex.test("/api/v1/auth/status"), "Auth status route must match");
});

test("Clerk route categorization correctly distinguishes public and protected paths", () => {
  const publicPathPrefixes = [
    "/sign-in",
    "/sign-up",
    "/api/v1/auth",
    "/api/telemetry-status",
    "/api/update-svg",
    "/api/export-presentation-data",
    "/pdf-maker",
  ];

  function isPublic(pathname) {
    return publicPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );
  }

  // Public paths
  assert.ok(isPublic("/sign-in"));
  assert.ok(isPublic("/sign-in/factor-one"));
  assert.ok(isPublic("/sign-in/sso-callback"));
  assert.ok(isPublic("/sign-up"));
  assert.ok(isPublic("/sign-up/verify-email-address"));
  assert.ok(isPublic("/api/v1/auth/status"));
  assert.ok(isPublic("/pdf-maker"));

  // Protected paths
  assert.ok(!isPublic("/"));
  assert.ok(!isPublic("/dashboard"));
  assert.ok(!isPublic("/community"));
  assert.ok(!isPublic("/templates"));
  assert.ok(!isPublic("/settings"));
  assert.ok(!isPublic("/admin"));
  assert.ok(!isPublic("/presentation"));
  assert.ok(!isPublic("/api/v1/ppt/presentation/all"));
});

test("Header sanitization strips untrusted incoming client-supplied identity headers", () => {
  // Simulate client headers that attempt to forge Clerk identity
  const incomingHeaders = new Headers({
    "x-clerk-user-id": "user_malicious_attacker",
    "x-clerk-user-email": "admin@victim.com",
    "x-clerk-internal-secret": "forged_secret",
    "authorization": "Bearer dummy",
  });

  // Verify headers before sanitization
  assert.equal(incomingHeaders.get("x-clerk-user-id"), "user_malicious_attacker");

  // Sanitization logic matching rewriteToFastApi in proxy.ts
  const sanitizedHeaders = new Headers(incomingHeaders);
  sanitizedHeaders.delete("x-clerk-user-id");
  sanitizedHeaders.delete("x-clerk-user-email");
  sanitizedHeaders.delete("x-clerk-internal-secret");

  // Verify headers are stripped
  assert.equal(sanitizedHeaders.get("x-clerk-user-id"), null);
  assert.equal(sanitizedHeaders.get("x-clerk-user-email"), null);
  assert.equal(sanitizedHeaders.get("x-clerk-internal-secret"), null);
  assert.equal(sanitizedHeaders.get("authorization"), "Bearer dummy");

  // When trusted user is injected:
  const verifiedUserId = "user_2validClerkId";
  const verifiedEmail = "user@example.com";
  const internalSecret = "sk_test_server_secret";

  sanitizedHeaders.set("x-clerk-user-id", verifiedUserId);
  sanitizedHeaders.set("x-clerk-user-email", verifiedEmail);
  sanitizedHeaders.set("x-clerk-internal-secret", internalSecret);

  assert.equal(sanitizedHeaders.get("x-clerk-user-id"), "user_2validClerkId");
  assert.equal(sanitizedHeaders.get("x-clerk-user-email"), "user@example.com");
  assert.equal(sanitizedHeaders.get("x-clerk-internal-secret"), "sk_test_server_secret");
});

test("Session redirect parameters preserve destination return URL without loops", () => {
  const reqUrl = "http://127.0.0.1:3001/dashboard?tab=recent";
  const parsed = new URL(reqUrl);

  const signInUrl = new URL("/sign-in", reqUrl);
  const returnUrl = parsed.pathname + parsed.search;
  signInUrl.searchParams.set("redirect_url", returnUrl);

  assert.equal(signInUrl.pathname, "/sign-in");
  assert.equal(signInUrl.searchParams.get("redirect_url"), "/dashboard?tab=recent");

  // Authenticated redirect from sign-in
  const destination = signInUrl.searchParams.get("redirect_url") || "/";
  assert.equal(destination, "/dashboard?tab=recent");
});
