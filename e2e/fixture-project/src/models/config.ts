/** Config model — dead exports (unused by anything) */
export interface AppConfig {
  port: number;
  debug: boolean;
  logLevel: "info" | "warn" | "error";
}

export const DEFAULT_CONFIG: AppConfig = {
  port: 3000,
  debug: false,
  logLevel: "info",
};

/** Completely unused function — dead export */
export function validateConfig(config: AppConfig): boolean {
  return config.port > 0 && config.port < 65536;
}

/** Another dead export */
export function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return { ...base, ...override };
}
