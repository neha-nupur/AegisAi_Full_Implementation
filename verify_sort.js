const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const http = require("http");

async function getRequests(token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 4000,
      path: "/v1/ai-requests?limit=10",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@aegisai.local";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.error("SEED_ADMIN_PASSWORD is not set. Configure it in .env or your environment.");
    process.exit(1);
  }

  const loginRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: "localhost",
      port: 4000,
      path: "/v1/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ email, password }));
    req.end();
  });

  const token = loginRes.token;

  const list = await getRequests(token);
  console.log(JSON.stringify(list, null, 2));
}

run().catch(console.error);
