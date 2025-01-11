import * as fs from "fs";
import * as path from "path";
import { HOME_DIR } from "./constants";
import { AgishConfig } from "./config";

export function getPathExecutables(): string[] {
  try {
    const pathDirs = process.env.PATH?.split(":") || [];
    const executables: string[] = [];

    for (const dir of pathDirs) {
      try {
        const files = fs.readdirSync(dir);
        executables.push(...files);
      } catch (error) {
        // Silently skip inaccessible directories
      }
    }

    return [...new Set(executables)]; // Remove duplicates
  } catch (error) {
    return [];
  }
}

export function getFileCompletions(
  partial: string,
  config: AgishConfig,
  currentPath: string
): string[] {
  try {
    // Keep track of original path style
    const hasRelativePrefix = partial.startsWith("./");
    const hasTildePrefix = partial.startsWith("~");

    // If no path indicators (/, ~, or .), treat as relative to current directory
    const checkPath = (() => {
      if (hasTildePrefix) {
        return partial.replace("~", HOME_DIR);
      }
      if (partial.startsWith("/")) {
        return partial;
      }
      // Handle both "./foo" and "foo" as relative paths
      return path.join(currentPath, partial);
    })();

    // If the partial path ends with '/', use it as the dir and empty base
    const isDir = partial.endsWith("/");
    const searchDir = isDir ? checkPath : path.dirname(checkPath);
    const searchBase = isDir ? "" : path.basename(partial);

    const files = fs.readdirSync(searchDir);
    return files
      .filter((file) => {
        if (!config.showHidden && file.startsWith(".")) {
          return false;
        }
        return file.startsWith(searchBase);
      })
      .map((file) => {
        // If we're listing directory contents (ends with /), just return the basenames
        if (isDir) {
          try {
            const stats = fs.statSync(path.join(searchDir, file));
            const result = stats.isDirectory() ? `${file}/` : file;
            // Preserve ./ prefix if it was in the original input
            return hasRelativePrefix ? `./${result}` : result;
          } catch (error) {
            return hasRelativePrefix ? `./${file}` : file;
          }
        }

        // For partial completions, preserve the original path style
        let completedPath = path.join(path.dirname(partial), file);
        if (hasRelativePrefix && !completedPath.startsWith("./")) {
          completedPath = `./${completedPath}`;
        }

        try {
          const stats = fs.statSync(path.join(searchDir, file));
          return stats.isDirectory() ? `${completedPath}/` : completedPath;
        } catch (error) {
          return completedPath;
        }
      });
  } catch (error) {
    return [];
  }
}
