import { runTask } from "@presenton/export-core";
import fs from "node:fs/promises";
import path from "node:path";

async function run() {
  const loginRes = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "Password123!" }),
  });
  const cookie = loginRes.headers.get("set-cookie");
  const allRes = await fetch("http://127.0.0.1:8000/api/v1/ppt/presentation/all", {
    headers: { cookie },
  });
  const all = await allRes.json();
  const pres = all[0];
  console.log("Exporting presentation to PPTX:", pres.id);

  const res = await runTask(
    {
      type: "export",
      url: `http://127.0.0.1:3001/pdf-maker?id=${pres.id}`,
      format: "pptx",
      title: "Test PPTX Full Pipeline",
      cookieHeader: cookie,
    },
    {
      outputDirectory: "D:\\presenton-main\\app_data\\exports",
      browserLaunchOptions: {
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args: ["--no-sandbox", "--disable-gpu"],
      },
      urlConfigs: [
        {
          url: "http://127.0.0.1:3001",
          match: "origin",
          cookies: {
            presenton_session: cookie.split(";")[0].replace("presenton_session=", ""),
          },
        },
      ],
    }
  );

  console.log("PPTX Export Success:", JSON.stringify(res, null, 2));
}

run().catch((err) => {
  console.error("PPTX Export Failed:", err);
  process.exit(1);
});
