const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const pythonExe = path.join(__dirname, "servers", "fastapi", ".venv", "Scripts", "python.exe");
const fastapiDir = path.join(__dirname, "servers", "fastapi");
const appDataDir = path.join(__dirname, "app_data");
const tempDir = path.join(appDataDir, "temp");
const userConfigPath = path.join(appDataDir, "userConfig.json");

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(userConfigPath)) fs.writeFileSync(userConfigPath, "{}", "utf-8");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const env = {
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
  EXPORT_PACKAGE_ROOT: path.join(__dirname, "presentation-export"),
  NEXT_PUBLIC_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_FAST_API: "http://127.0.0.1:8000",
  FAST_API_INTERNAL_URL: "http://127.0.0.1:8000",
  PUPPETEER_CACHE_DIR: "D:\\.puppeteer-cache",
  ...(fs.existsSync(chromePath) ? { PUPPETEER_EXECUTABLE_PATH: chromePath } : {}),
  LLM: process.env.LLM || "openai",
  DISABLE_AUTH: process.env.DISABLE_AUTH !== undefined
    ? process.env.DISABLE_AUTH
    : ((process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) ? "false" : "true"),
  MIGRATE_DATABASE_ON_STARTUP: "true",
};

const logPath = path.join(appDataDir, "fastapi.log");
const logFd = fs.openSync(logPath, "a");
console.log(`Starting FastAPI supervisor on http://127.0.0.1:8000 (logging to ${logPath})...`);

function startFastApi() {
  const child = spawn(pythonExe, ["-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000", "--log-level", "info"], {
    cwd: fastapiDir,
    env,
    stdio: ["ignore", logFd, logFd],
  });

  child.on("error", (err) => {
    fs.writeSync(logFd, `FastAPI process error: ${err}\n`);
  });

  child.on("exit", (code) => {
    fs.writeSync(logFd, `FastAPI process exited with code ${code}. Restarting in 1s...\n`);
    setTimeout(startFastApi, 1000);
  });
}

startFastApi();
