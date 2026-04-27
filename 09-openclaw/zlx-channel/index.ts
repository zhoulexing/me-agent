import { defineBundledChannelEntry } from "openclaw/plugin-sdk/channel-entry-contract";
import { zlxChannelPluginConfigSchema } from "./src/config-schema.js";

export default defineBundledChannelEntry({
  id: "zlx",
  name: "Zlx Channel",
  description: "Zlx webhook channel plugin for OpenClaw",
  importMetaUrl: import.meta.url,
  plugin: { specifier: "./channel-plugin-api.js", exportName: "zlxChannelPlugin" },
  configSchema: zlxChannelPluginConfigSchema,
  runtime: { specifier: "./api.js", exportName: "setZlxChannelRuntime" },
});
