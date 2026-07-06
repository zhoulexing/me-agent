import { createApp } from "./app.js";
import { loadEnv } from "./config/index.js";
import { startHttpServer } from "./server/http.js";

const env = loadEnv();
const piAgent = createApp(env);

startHttpServer({
  app: piAgent.app,
  host: env.host,
  port: env.port
});

console.log(`pi-agent listening on http://${env.host}:${env.port}`);

await piAgent.start();

process.on("SIGINT", () => {
  void piAgent.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void piAgent.stop().finally(() => process.exit(0));
});
