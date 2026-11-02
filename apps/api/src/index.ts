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
  
  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info(`API Gateway listening on port ${config.port} on 0.0.0.0`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(err => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
