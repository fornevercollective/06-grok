export interface Plugin {
  name: string;
  version: string;
  init: (context: PluginContext) => void;
  destroy?: () => void;
}

export interface PluginContext {
  store: any; // Zustand store
  registerCommand: (name: string, handler: Function) => void;
  registerHook: (hookName: string, handler: Function) => void;
  emitHook: (hookName: string, ...args: any[]) => void;
  services: {
    collaboration: any;
    ml: any;
    offlineSync: any;
    performance: any;
  };
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    this.context.registerHook = (hookName: string, handler: Function) => {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      this.hooks.get(hookName)!.push(handler);
    };

    this.context.emitHook = (hookName: string, ...args: any[]) => {
      const handlers = this.hooks.get(hookName) || [];
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in hook ${hookName}:`, error);
        }
      });
    };
  }

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} already registered`);
      return;
    }
    this.plugins.set(plugin.name, plugin);
    plugin.init(this.context);
  }

  unregister(name: string) {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.destroy) {
      plugin.destroy();
    }
    this.plugins.delete(name);
  }

  getPlugin(name: string) {
    return this.plugins.get(name);
  }

  listPlugins() {
    return Array.from(this.plugins.keys());
  }
}

export default PluginManager;