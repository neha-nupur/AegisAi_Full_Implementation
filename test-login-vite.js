const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const http = require("http");

const email = process.env.SEED_ADMIN_EMAIL || "admin@aegisai.local";
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password) {
  console.error("SEED_ADMIN_PASSWORD is not set. Configure it in .env or your environment.");
  process.exit(1);
}

const data = JSON.stringify({
  email,
  password
});

const req = http.request({
  hostname: 'localhost',
  port: 5173,
  path: '/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(body);
  });
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
