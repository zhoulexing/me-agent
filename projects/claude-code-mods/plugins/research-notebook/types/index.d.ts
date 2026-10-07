declare module 'claude-code' {
  interface PluginState {
    'research-notebook': {
      progress: { steps: number; calls: number; status: string; changed: boolean };
    };
  }
}
