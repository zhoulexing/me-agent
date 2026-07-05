import { createApp } from "./app.js";
import { loadEnv } from "./config/index.js";
import { startHttpServer } from "./server/http.js";

const env = loadEnv();
const ccAgent = createApp(env);

startHttpServer({
  app: ccAgent.app,
  host: env.host,
  port: env.port
});

console.log(`cc-agent listening on http://${env.host}:${env.port}`);

await ccAgent.start();

process.on("SIGINT", () => {
  void ccAgent.stop().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void ccAgent.stop().finally(() => process.exit(0));
});
