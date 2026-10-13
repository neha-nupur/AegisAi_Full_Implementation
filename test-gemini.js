const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Configure it in .env or your environment.");
  process.exit(1);
}
const testModel = (modelName) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    })
  }).then(async res => {
    console.log(`[${modelName}] ${res.status}`);
    console.log(await res.text());
  }).catch(console.error);
};

(async () => {
  await testModel("gemini-1.5-flash-latest");
  await testModel("gemini-1.5-flash-001");
  await testModel("gemini-pro");
})();
