import { exec } from "child_process";
import { promisify } from "util";
import {
  DEFAULT_IMAGE_NAME,
  LOCAL_HOME_DIR,
  CONTAINER_HOME_DIR,
} from "./constants";
import path from "path";

const execPromise = promisify(exec);

interface ExecInContainerOptions {
  containerName: string;
  repoDir?: string;
  imageName?: string;
}

export async function ensureContainerRunning(
  containerName: string,
  imageName: string = DEFAULT_IMAGE_NAME
): Promise<void> {
  try {
    const { stdout } = await execPromise(
      `docker ps -q -f name=${containerName}`
    );

    if (!stdout) {
      const { stdout: existingContainer } = await execPromise(
        `docker ps -aq -f name=${containerName}`
      );

      if (existingContainer) {
        await execPromise(`docker start ${containerName}`);
      } else {
        await execPromise(
          `docker run -d --privileged --name ${containerName} -v ${LOCAL_HOME_DIR}:${CONTAINER_HOME_DIR} ${imageName} tail -f /dev/null`
        );
      }
    }
  } catch (error) {
    console.error("Failed to ensure container is running:", error);
    throw error;
  }
}

interface ExecError extends Error {
  code?: number | string;
  killed?: boolean;
  signal?: string;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function execInContainer(
  command: string,
  options: ExecInContainerOptions,
  callback?: (error: Error | null) => void
): Promise<ExecResult> {
  try {
    await ensureContainerRunning(options.containerName);

    return new Promise<ExecResult>((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const containerCommand = options.repoDir
        ? `cd ${path.join(
            CONTAINER_HOME_DIR,
            path.basename(options.repoDir)
          )} && ${command}`
        : command;

      const dockerProcess = exec(
        `docker exec ${options.containerName} sh -c "${containerCommand}"`,
        (error: ExecError | null) => {
          if (callback) {
            callback(error);
          }

          if (error) {
            console.error(`Failed to run command ${command} in container`);
            console.error(error);
            console.warn("Continuing with the next operation...");
            resolve({
              stdout,
              stderr,
              exitCode: error.code ? Number(error.code) : 1,
            });
          } else {
            resolve({ stdout, stderr, exitCode: 0 });
          }
        }
      );

      // Collect output instead of just piping
      dockerProcess.stdout?.on("data", (data) => {
        stdout += data;
        process.stdout.write(data); // Still show output in console
      });

      dockerProcess.stderr?.on("data", (data) => {
        stderr += data;
        process.stderr.write(data); // Still show output in console
      });
    });
  } catch (error) {
    if (callback) {
      callback(error as Error);
    }
    throw error;
  }
}

export async function stopContainer(containerName: string): Promise<void> {
  try {
    await execPromise(`docker stop ${containerName}`);
  } catch (error) {
    console.error("Failed to stop container:", error);
    throw error;
  }
}
