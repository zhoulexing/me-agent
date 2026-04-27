import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";

const { setRuntime: setZlxChannelRuntime, getRuntime: getZlxChannelRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "zlx",
    errorMessage: "zlx-channel runtime not initialized",
  });

export { getZlxChannelRuntime, setZlxChannelRuntime };