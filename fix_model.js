const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch {}
const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured. Configure it in .env or your environment.");
  process.exit(1);
}

async function fix() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  // Update model configuration and name
  const res = await client.query(`
    UPDATE models 
    SET name = 'gemini-3.8-flash', 
        configuration = '{"apiModelName": "gemini-3.8-flash"}'::jsonb 
    WHERE name = 'gemini-1.5-flash' OR name = 'gemini-3.8-flash';
  `);
  console.log(`Updated ${res.rowCount} models`);
  
  await client.end();
}

fix().catch(console.error);
