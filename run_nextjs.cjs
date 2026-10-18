const { spawn } = require("child_process");
const path = require("path");

const nextjsDir = path.join(__dirname, "servers", "nextjs");
const nextjsCli = path.join(nextjsDir, "node_modules", "next", "dist", "bin", "next");

const port = process.env.PORT || "3001";
const env = {
  ...process.env,
  FAST_API_INTERNAL_URL: "http://127.0.0.1:8000",
  NEXT_PUBLIC_FAST_API: "http://127.0.0.1:8000",
  HOSTNAME: "127.0.0.1",
  PORT: port,
};

const fs = require("fs");
const logPath = path.join(__dirname, "app_data", "nextjs.log");
const logFd = fs.openSync(logPath, "a");
console.log(`Starting Next.js dev server on http://127.0.0.1:${port} (logging to ${logPath})...`);

function startNextJs() {
  const child = spawn(process.execPath, [nextjsCli, "dev", "-H", "127.0.0.1", "-p", port], {
    cwd: nextjsDir,
    env,
    stdio: ["ignore", logFd, logFd],
  });

  child.on("error", (err) => {
    fs.writeSync(logFd, `Next.js process error: ${err}\n`);
  });

  child.on("exit", (code) => {
    fs.writeSync(logFd, `Next.js process exited with code ${code}. Restarting in 1s...\n`);
    setTimeout(startNextJs, 1000);
  });
}

startNextJs();
