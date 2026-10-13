const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Hello" }] }]
  })
}).then(async res => {
  console.log(`[NO KEY] ${res.status}`);
  console.log(await res.text());
}).catch(console.error);
