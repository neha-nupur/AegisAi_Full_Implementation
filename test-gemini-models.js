const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Configure it in .env or your environment.");
  process.exit(1);
}

const url = "https://generativelanguage.googleapis.com/v1beta/models";

fetch(url, {
  method: "GET",
  headers: {
    "x-goog-api-key": apiKey
  }
}).then(async res => {
  console.log(res.status);
  console.log(await res.text());
}).catch(console.error);
