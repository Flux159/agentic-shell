import { getGenericLLMResponse } from "@/helpers/getGenericLLMResponse";
import { execInContainer } from "@/helpers/docker";
import { exec } from "child_process";
import { promisify } from "util";
import { Spinner, createSpinner } from "@/helpers/spinner";
import { spawn } from "child_process";
import path from "path";
import * as fs from "fs";
import { BLUE, GREEN, RESET } from "@/helpers/constants";

// Helper to log commands
function logCommand(command: string, currentPath: string) {
  console.log(`${BLUE}${currentPath}${RESET}${GREEN}> ${command}${RESET}`);
}

const execPromise = promisify(exec);

async function handleDirectoryChange(
  targetPath: string,
  currentPath: string
): Promise<CommandResult> {
  try {
    let resolvedPath: string;

    // Handle 'cd' with no args - go to home directory
    if (!targetPath || targetPath.trim() === "") {
      resolvedPath = process.env.HOME || "";
    }
    // Resolve ~ to HOME directory
    else if (targetPath.startsWith("~")) {
      resolvedPath = targetPath.replace(/^~/, process.env.HOME || "");
    } else if (targetPath.startsWith("/")) {
      resolvedPath = targetPath;
    } else {
      resolvedPath = path.resolve(currentPath, targetPath);
    }

    await fs.promises.access(resolvedPath);
    return {
      command: `cd ${targetPath || ""}`,
      output: "",
      exitCode: 0,
      newPath: resolvedPath,
    };
  } catch (error) {
    return {
      command: `cd ${targetPath}`,
      output: "",
      error: `cd: ${targetPath}: No such file or directory`,
      exitCode: 1,
    };
  }
}

const SHELL_SYSTEM_PROMPT = `You are an expert shell command generator. Convert natural language requests into executable shell commands.

You will be provided with the current context including:
- Current working directory
- Home directory location
- Current time
- Any previous command failures

Please consider this context when generating commands, especially:
1. Use relative paths when appropriate
2. For complex operations that need variable sharing, write them as a single command, for example:
   {
     "command": "counter=1; zipname=\\"\${HOME}/Downloads/file.zip\\"; echo \\"Created: $zipname\\""
   }
3. For home directory paths:
   - Use ~ for direct path references (e.g., 'cd ~/Documents')
   - Use \${HOME} when the path is part of a variable or needs expansion in quotes
   (e.g., 'file="\${HOME}/Documents/file.txt"')
4. Consider time-based operations in relation to current time

Please provide all responses in the following JSON format:

{
  "title": "Command Generation",
  "explanation": "Brief explanation of what the commands will do",
  "fileOperations": [
    {
      "operation": "RUN_COMMAND",
      "command": "The exact shell command to execute",
      "changeDescription": "What this command will do"
    },
    {
      "operation": "RUN_COMMAND",
      "command": "Another command if needed",
      "changeDescription": "What this command will do"
    }
  ]
}

Examples:

User: "Create a new directory called test and move all log files into it"
{
  "title": "Create Directory and Move Logs",
  "explanation": "Creating a test directory and moving log files",
  "fileOperations": [
    {
      "operation": "RUN_COMMAND",
      "command": "mkdir -p test",
      "changeDescription": "Creates the test directory"
    },
    {
      "operation": "RUN_COMMAND",
      "command": "find . -name '*.log' -type f -exec mv {} test/ \\;",
      "changeDescription": "Moves all .log files to test directory"
    }
  ]
}

Example with context:
Current Context:
- Current Directory: /home/user/projects/myapp
- Home Directory (~): /home/user
- Current Time: 2024-03-15 14:30:00

User: "show me javascript files modified today"
{
  "title": "Find Recent JS Files",
  "explanation": "Finding JavaScript files modified since midnight",
  "fileOperations": [
    {
      "operation": "RUN_COMMAND",
      "command": "find . -name '*.js' -type f -newermt '2024-03-15 00:00:00'",
      "changeDescription": "Lists .js files modified today"
    }
  ]
}

If a command fails, I will provide the error message and you should fix that specific command.

When handling file operations:
1. If a command fails because a file already exists, either:
   - Add a numbered suffix to create a new file (e.g., file(2).txt)
   - Or ask for confirmation before overwriting - make sure that the command generated asks for confirmation with (y/n) prompt from the user or potentially asks if they want to rename as well.
2. Choose the appropriate approach based on the context and potential data loss risk

If a command fails with a "file exists" error, modify the command accordingly.

It is very important that you:
1. Return only valid JSON
2. Break complex tasks into separate RUN_COMMAND operations
3. Ensure commands are safe and won't cause data loss. If they do then make a command that requests a (y/n) confirmation from the user before proceeding.
4. Never attempt to create directories automatically for cd commands
5. If a cd command fails, report the error and don't try to fix by creating directories
6. Use proper escaping for special characters in commands
7. Consider the current working directory context
8. Don't include any explanatory text outside the JSON structure`;

interface RunAgentOptions {
  task: string;
  currentPath: string;
  spinner?: Spinner;
  docker?: boolean;
  safe?: boolean;
  containerName?: string;
  provider?: "openai" | "anthropic" | "google";
}

interface CommandResult {
  command: string;
  output: string;
  error?: string;
  exitCode: number;
  isInteractive?: boolean;
  newPath?: string; // Add new path if directory changed
}

interface CommandOperation {
  operation: "RUN_COMMAND";
  command: string;
  changeDescription: string;
}

async function generateCommands(
  task: string,
  currentPath: string,
  error?: string,
  failedCommand?: string
): Promise<CommandOperation[]> {
  const contextPrompt = `
    Current Context:
    - Current Directory: ${currentPath}
    - Home Directory (~): ${process.env.HOME}
    - Current Time: ${new Date().toLocaleString()}
    - Failed Command: ${failedCommand || "None"}
    - Error: ${error || "None"}
    
    Task: ${task}
    `;

  const response = await getGenericLLMResponse(contextPrompt, {
    system: SHELL_SYSTEM_PROMPT,
    provider: "anthropic",
  });

  try {
    const parsed = JSON.parse(response);
    return parsed.fileOperations.filter(
      (op: any) => op.operation === "RUN_COMMAND"
    );
  } catch (error) {
    // If JSON parsing fails, try to fix it with OpenAI
    const fixPrompt =
      "Can you fix this json so that it will parse properly with json.parse? " +
      "Please only return the json in your response and do NOT format with markdown backticks:\n\n" +
      response;

    const fixedResponse = await getGenericLLMResponse(fixPrompt, {
      provider: "openai",
      model: "gpt-4",
      system:
        "You are a JSON repair expert. Fix the provided JSON to be valid and parseable. Only return the fixed JSON with no additional text or formatting.",
    });

    try {
      const parsed = JSON.parse(fixedResponse);
      return parsed.fileOperations.filter(
        (op: any) => op.operation === "RUN_COMMAND"
      );
    } catch (secondError) {
      // If even the fixed JSON fails, try one more time with a simpler format
      const emergencyFixPrompt =
        "Convert this into a simple JSON array of commands. Format:\n" +
        '{ "fileOperations": [{ "operation": "RUN_COMMAND", "command": "actual command here" }] }\n\n' +
        response;

      // TODO: Just use the same provider for now - and then user can specify this when they start the app or in their ~/.agishrc file
      const emergencyResponse = await getGenericLLMResponse(
        emergencyFixPrompt,
        {
          provider: "openai",
          model: "gpt-4o",
          system: "Return only valid JSON in the specified format.",
        }
      );

      try {
        const parsed = JSON.parse(emergencyResponse);
        return parsed.fileOperations.filter(
          (op: any) => op.operation === "RUN_COMMAND"
        );
      } catch (finalError) {
        throw new Error(
          "Failed to parse LLM response as JSON after multiple attempts"
        );
      }
    }
  }
}

async function executeCommand(
  command: string,
  options: RunAgentOptions
): Promise<CommandResult> {
  logCommand(command, options.currentPath);

  try {
    if (options.docker) {
      const result = await execInContainer(command, {
        containerName: options.containerName || "agish",
        repoDir: options.currentPath,
      });

      return {
        command,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode,
        isInteractive: false,
      };
    } else {
      // Split command into parts for spawn
      // Special handling for cd command
      if (command.startsWith("cd")) {
        const targetPath = command.slice(2).trim();
        return handleDirectoryChange(targetPath, options.currentPath);
      }

      const [cmd, ...args] = command.split(" ");

      return new Promise((resolve, reject) => {
        const proc = spawn("sh", ["-c", command], {
          cwd: options.currentPath,
          stdio: "inherit",
          // shell: true,
          detached: false,
        });

        proc.on("close", async (code) => {
          // Check if this was a cd command and get new path

          let stderr = "";
          let newPath: string | undefined;
          if (cmd === "cd") {
            try {
              const targetPath = args[0];
              if (targetPath) {
                // Resolve the new path
                if (targetPath.startsWith("/")) {
                  newPath = targetPath;
                } else if (targetPath.startsWith("~")) {
                  newPath = targetPath.replace("~", process.env.HOME || "");
                } else {
                  newPath = path.resolve(options.currentPath, targetPath);
                }
                // Verify the path exists
                await fs.promises.access(newPath);
              } else {
                // 'cd' without args goes to home directory
                newPath = process.env.HOME;
              }
            } catch (error) {
              // If path doesn't exist or isn't accessible, don't update
              stderr = `cd: ${args[0]}: No such file or directory`;
              code = 1;
            }
          }

          resolve({
            command,
            output: "", // We won't have output since it went directly to terminal
            exitCode: code || 0,
            isInteractive: false,
            newPath,
          });
        });

        proc.on("error", (error) => {
          reject(error);
        });
      });
    }
  } catch (error: any) {
    return {
      command,
      output: "",
      error: error.message,
      exitCode: error.code || 1,
      isInteractive: false,
    };
  }
}

export async function runAgent(
  options: RunAgentOptions
): Promise<{ results: CommandResult[]; newPath?: string }> {
  const { task, currentPath } = options;
  let spinner = options.spinner;
  let finalPath = options.currentPath;

  let commands = await generateCommands(task, currentPath);

  if (process.env.DEBUG) {
    console.log(commands);
  }

  const results: CommandResult[] = [];
  let maxRetries = 3;

  // Execute commands sequentially
  for (let i = 0; i < commands.length; i++) {
    let currentCommand = commands[i].command;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      if (spinner) {
        spinner = createSpinner(
          `Executing command ${i + 1}/${commands.length}...`
        );
      }

      const result = await executeCommand(currentCommand, {
        ...options,
        currentPath: finalPath,
      });

      if (result.isInteractive || result.exitCode === 0) {
        if (spinner) {
          spinner.stop();
        }
        if (result.newPath) {
          finalPath = result.newPath;
          // Important: Update options.currentPath for next commands
          //   options.currentPath = finalPath;
        }
        results.push(result);
        success = true;
        continue;
      }

      // Let the LLM try to fix the command
      attempt++;
      if (spinner) {
        spinner.stop();
        spinner = createSpinner(
          `Command ${i + 1}/${commands.length} failed, generating fix...`
        );
      }

      const fixedCommands = await generateCommands(
        task,
        finalPath,
        result.error,
        currentCommand
      );

      // Try each fixed command in sequence until one works
      let fixSuccess = false;
      for (const fixedOp of fixedCommands) {
        try {
          const fixResult = await executeCommand(fixedOp.command, {
            ...options,
            currentPath: finalPath,
          });

          if (fixResult.exitCode === 0) {
            results.push(fixResult);
            if (fixResult.newPath) {
              finalPath = fixResult.newPath;
              options.currentPath = finalPath;
            }
            success = true;
            fixSuccess = true;
            break;
          }
        } catch (error) {
          continue; // Try next command if available
        }
      }

      if (!fixSuccess) {
        // Only increment attempt if none of the fixed commands worked
        currentCommand = fixedCommands[0].command; // Fall back to first command for next retry
      }
    }

    if (!success) {
      throw new Error(
        `Failed to execute command ${i + 1} after multiple attempts`
      );
    }
  }

  return {
    results,
    newPath: finalPath !== options.currentPath ? finalPath : undefined,
  };
}
