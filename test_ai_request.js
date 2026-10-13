const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const http = require("http");

async function testAIRequest(prompt) {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@aegisai.local";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.error("SEED_ADMIN_PASSWORD is not set. Configure it in .env or your environment.");
    process.exit(1);
  }

  // Login
  const loginRes = await fetch("http://localhost:4000/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;

  // AI Request
  const res = await fetch('http://localhost:4000/v1/ai-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Idempotency-Key': 'test-1234'
    },
    body: JSON.stringify({
      input: prompt
    })
  });
  const json = await res.json();
  console.log(`Prompt: ${prompt}`);
  console.log(`Status: ${res.status}`);
  if (json.data && json.data.output) {
      console.log(`Response: ${json.data.output}`);
  } else if (json.data) {
      console.log(`Data:`, JSON.stringify(json.data, null, 2));
  } else {
      console.log(`Error:`, JSON.stringify(json, null, 2));
  }
  console.log('---');
}

async function run() {
  await testAIRequest('What is the capital of France?');
  await testAIRequest('Explain what AegisAI does in one sentence.');
}

run().catch(console.error);
