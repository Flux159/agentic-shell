import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { HOME_DIR } from "./constants";

export interface AgishConfig {
  showHidden: boolean;
  caseSensitive: boolean;
  maxResults: number;
  // ... other JSON config options
}

// Load JSON config
function loadJsonConfig(): AgishConfig {
  const defaultConfig: AgishConfig = {
    showHidden: false,
    caseSensitive: true,
    maxResults: 100,
  };

  try {
    const configPath = path.join(HOME_DIR, ".agishrc");
    const configContent = fs.readFileSync(configPath, "utf-8");
    return { ...defaultConfig, ...JSON.parse(configContent) };
  } catch (error) {
    return defaultConfig;
  }
}

// Load shell profile
function loadProfile(): void {
  try {
    const profilePath = path.join(HOME_DIR, ".agish_profile");
    if (fs.existsSync(profilePath)) {
      // Source the profile file using a shell
      const output = execSync(`source ${profilePath} && env`, {
        encoding: "utf8",
      });

      // Parse and set environment variables
      const env = output.split("\n").reduce((acc, line) => {
        const [key, ...values] = line.split("=");
        if (key) acc[key] = values.join("=");
        return acc;
      }, {} as Record<string, string>);

      // Update process.env with new values
      Object.assign(process.env, env);
    }
  } catch (error) {
    console.error("Error loading profile:", error);
  }
}

export function initializeConfig() {
  loadProfile(); // Load shell profile first
  return loadJsonConfig(); // Then load JSON config
}
