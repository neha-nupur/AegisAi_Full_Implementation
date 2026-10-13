import { resolve } from "path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: resolve(__dirname, "../../../.env") });
import { loadConfig } from "@aegisai/config";
import { createApp } from "./app";
import { logger } from "./logger";

// Reloaded with updated Gemini HTTPS provider adapter & passing test suite
const config = loadConfig();

async function startServer() {
  const app = await createApp(config);
  
  app.listen(config.port, () => {
    logger.info(`API Gateway listening on port ${config.port}`);
  });
}

startServer().catch(err => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
