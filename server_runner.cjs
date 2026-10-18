const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = __dirname;
const appDataDir = path.join(rootDir, "app_data");
const tempDir = path.join(appDataDir, "temp");
const userConfigPath = path.join(appDataDir, "userConfig.json");

// Load .env file if present
const envFilePath = path.join(rootDir, ".env");
if (fs.existsSync(envFilePath)) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envFilePath);
    } else {
      const content = fs.readFileSync(envFilePath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...rest] = trimmed.split("=");
          const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
          if (key && !(key in process.env)) {
            process.env[key] = val;
          }
        }
      });
    }
  } catch (e) {
    console.warn("[SUPERVISOR] Could not load .env file:", e);
  }
}

const userConfigEnv = require("./scripts/user-config-env.cjs");

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

let existingConfig = {};
if (fs.existsSync(userConfigPath)) {
  try {
    existingConfig = JSON.parse(fs.readFileSync(userConfigPath, "utf-8") || "{}");
  } catch {}
}
const mergedConfig = userConfigEnv.buildUserConfigFromEnv(existingConfig, process.env);
fs.writeFileSync(userConfigPath, JSON.stringify(mergedConfig, null, 2), "utf-8");

const pythonExe = path.join(rootDir, "servers", "fastapi", ".venv", "Scripts", "python.exe");
const fastapiDir = path.join(rootDir, "servers", "fastapi");
const nextjsDir = path.join(rootDir, "servers", "nextjs");
const nextjsCli = path.join(nextjsDir, "node_modules", "next", "dist", "bin", "next");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// --- FastAPI Environment ---
const fastapiEnv = {
  ...process.env,
  PYTHONUNBUFFERED: "1",
  OPENBLAS_NUM_THREADS: "1",
  OMP_NUM_THREADS: "1",
  MKL_NUM_THREADS: "1",
  VECLIB_MAXIMUM_THREADS: "1",
  NUMEXPR_NUM_THREADS: "1",
  APP_DATA_DIRECTORY: appDataDir,
  USER_CONFIG_PATH: userConfigPath,
  TEMP_DIRECTORY: tempDir,
  TEMP: tempDir,
  TMP: tempDir,
  EXPORT_PACKAGE_ROOT: path.join(rootDir, "presentation-export"),
  NEXT_PUBLIC_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_FAST_API: "http://127.0.0.1:8000",
  FAST_API_INTERNAL_URL: "http://127.0.0.1:8000",
  PUPPETEER_CACHE_DIR: "D:\\.puppeteer-cache",
  ...(fs.existsSync(chromePath) ? { PUPPETEER_EXECUTABLE_PATH: chromePath } : {}),
  LLM: process.env.LLM || "openai",
  DISABLE_AUTH: process.env.DISABLE_AUTH !== undefined
    ? process.env.DISABLE_AUTH
    : ((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) ? "false" : "true"),
  MIGRATE_DATABASE_ON_STARTUP: process.env.MIGRATE_DATABASE_ON_STARTUP || "true",
  ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
};

// --- Next.js Environment ---
const nextjsEnv = {
  ...process.env,
  DISABLE_AUTH: process.env.DISABLE_AUTH !== undefined
    ? process.env.DISABLE_AUTH
    : ((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) ? "false" : "true"),
  NEXT_PUBLIC_DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH !== undefined
    ? process.env.NEXT_PUBLIC_DISABLE_AUTH
    : ((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) ? "false" : "true"),
  FAST_API_INTERNAL_URL: "http://127.0.0.1:8000",
  NEXT_PUBLIC_FAST_API: "http://127.0.0.1:8000",
  HOSTNAME: "127.0.0.1",
  PORT: "3001",
};

let shuttingDown = false;

function spawnFastApi() {
  if (shuttingDown) return;
  console.log("[SUPERVISOR] Starting FastAPI on http://127.0.0.1:8000...");
  if (process.env.DATABASE_URL) {
    console.log("[SUPERVISOR] Supabase Database URL configured.");
  }
  const child = spawn(
    pythonExe,
    ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000", "--log-level", "info"],
    { cwd: fastapiDir, env: fastapiEnv, stdio: "inherit" }
  );

  child.on("error", (err) => console.error("[FASTAPI ERROR]", err));
  child.on("exit", (code) => {
    console.log(`[FASTAPI] Exited with code ${code}.`);
    if (!shuttingDown) {
      console.log("[FASTAPI] Restarting in 1s...");
      setTimeout(spawnFastApi, 1000);
    }
  });
}

function spawnNextJs() {
  if (shuttingDown) return;
  console.log("[SUPERVISOR] Starting Next.js on http://127.0.0.1:3001...");
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    console.log("[SUPERVISOR] Clerk Authentication enabled.");
  }
  const child = spawn(
    process.execPath,
    [nextjsCli, "dev", "-H", "127.0.0.1", "-p", "3001"],
    { cwd: nextjsDir, env: nextjsEnv, stdio: "inherit" }
  );

  child.on("error", (err) => console.error("[NEXTJS ERROR]", err));
  child.on("exit", (code) => {
    console.log(`[NEXTJS] Exited with code ${code}.`);
    if (!shuttingDown) {
      console.log("[NEXTJS] Restarting in 1s...");
      setTimeout(spawnNextJs, 1000);
    }
  });
}

process.on("SIGINT", () => {
  shuttingDown = true;
  process.exit(0);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  process.exit(0);
});

// Start both
spawnFastApi();
spawnNextJs();
