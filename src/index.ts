import * as repl from "repl";
import { Command } from "commander";
import { runAgent } from "./agent";
import { createSpinner } from "./helpers/spinner";
import { HistoryManager } from "./helpers/history";
import { initializeConfig } from "./helpers/config";
import {
  BLUE,
  BOLD,
  GREEN,
  HELP_TEXT,
  HOME_DIR,
  HOSTNAME,
  RESET,
  USERNAME,
} from "./helpers/constants";
import { getFileCompletions, getPathExecutables } from "./helpers/completions";
import readline from "readline";

// const DETAILS_CLOSED = "▶";
// const DETAILS_OPEN = "▼";
// const VERTICAL_LINE = "│";
// const CORNER = "└";
// const HORIZONTAL_LINE = "─";

const program = new Command()
  // .option("--safe", "Run in safe mode")
  // .option("--docker", "Run in docker mode")
  //   .option("--config <path>", "Path to config file")
  //   .option("--verbose", "Enable verbose logging")
  .parse();

const options = program.opts();

// class CollapsibleLogs {
//   private logs: string[] = [];
//   private isExpanded: boolean = false;
//   private label: string;

//   constructor(label: string = "Details") {
//     this.label = label;
//   }

//   log(message: string) {
//     this.logs.push(message);
//     if (this.isExpanded) {
//       console.log(`${VERTICAL_LINE} ${message}`);
//     }
//   }

//   start() {
//     this.logs = [];
//     this.isExpanded = false;
//     console.log(
//       `${DETAILS_CLOSED} ${this.label} (use '/details' to expand)`
//       //   `${DETAILS_CLOSED} ${this.label} (${this.logs.length} lines, use '/details' to expand)`
//     );
//   }

//   toggle() {
//     this.isExpanded = !this.isExpanded;
//     // Clear previous output
//     process.stdout.write("\x1b[1A\x1b[2K");

//     if (this.isExpanded) {
//       console.log(`${DETAILS_OPEN} ${this.label} (${this.logs.length} lines)`);
//       this.logs.forEach((log) => {
//         console.log(`${VERTICAL_LINE} ${log}`);
//       });
//       console.log(`${CORNER}${HORIZONTAL_LINE}`);
//     } else {
//       console.log(
//         `${DETAILS_CLOSED} ${this.label} (${this.logs.length} lines, use '/details' to expand)`
//       );
//     }
//   }
// }

async function handlePipedInput() {
  let currentPath: string = process.cwd();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  for await (const line of rl) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const result = await runAgent({
        task: trimmedLine,
        currentPath,
        docker: options.docker,
        safe: options.safe,
      });

      if (result.newPath) {
        currentPath = result.newPath;
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  }

  process.exit(0);
}

async function startShell() {
  const config = initializeConfig();

  let currentPath: string = process.cwd();
  // Store the most recent details container
  //   let lastDetails: CollapsibleLogs | null = null;

  // Check if we're receiving piped input
  const isPiped = !process.stdin.isTTY;

  if (isPiped) {
    return handlePipedInput();
  }

  // Create a promise queue for piped input
  //   let pendingPromises: Promise<void>[] = [];

  const formatPath = (path: string): string => {
    // Replace home directory with ~
    if (path.startsWith(HOME_DIR)) {
      return path.replace(HOME_DIR, "~");
    }
    return path;
  };

  const getPrompt = () => {
    if (!isPiped) {
      const formattedPath = formatPath(currentPath);
      return `${GREEN}${USERNAME}${RESET}@${HOSTNAME}:${BLUE}${BOLD}${formattedPath}${RESET} > `;
    }
    return "";
  };

  // Initialize and setup history
  let historyManager: HistoryManager;

  const replServer = repl.start({
    prompt: getPrompt(),
    input: process.stdin,
    output: process.stdout,
    ignoreUndefined: true,
    completer: function (line: string) {
      try {
        let hits: string[] = [];

        // Don't complete special commands
        if (line.startsWith("/")) {
          const commands = ["/help", "/exit", "/quit", "/history"];
          hits = commands.filter((cmd) => cmd.startsWith(line));
          return [hits, line];
        }

        const words = line.split(" ");
        const lastWord = words[words.length - 1];

        // Check if the last word looks like a path
        if (
          lastWord.includes("/") ||
          lastWord.startsWith("~") ||
          lastWord.startsWith(".")
        ) {
          hits = getFileCompletions(lastWord, config, currentPath);
        } else {
          // Otherwise complete with executables
          const executables = getPathExecutables();
          hits = executables.filter((cmd) => cmd.startsWith(lastWord));
        }

        // Return the matches and the word being completed
        return [hits.length ? hits : [], lastWord];
      } catch (error) {
        return [[], line];
      }
    },
    eval: async (cmd, context, filename, callback) => {
      try {
        const line = cmd.trim();
        // Remove the newline characters that REPL adds
        if (line.startsWith(".")) return callback(null, undefined);

        const trimmedLine = line.replace(/^\(|\)$/g, "").trim();

        // Save non-empty commands to history
        if (
          trimmedLine &&
          !trimmedLine.startsWith("/history") &&
          historyManager
        ) {
          historyManager.saveCommand(trimmedLine);
        }

        // Create a promise for the command execution
        const commandPromise = (async () => {
          if (
            trimmedLine.startsWith("exit") ||
            trimmedLine.startsWith("quit")
          ) {
            process.exit(0);
          } else if (trimmedLine.startsWith("/")) {
            const [command, ...args] = trimmedLine.slice(1).split(" ");

            switch (command.toLowerCase()) {
              //   case "details":
              //     if (lastDetails) {
              //       lastDetails.toggle();
              //       replServer.displayPrompt();
              //     } else {
              //       console.log("No details available from last command");
              //     }
              //     break;
              case "history":
                historyManager.showHistory();
                break;

              case "help":
                console.log(HELP_TEXT);
                break;

              case "exit":
              case "quit":
                // await Promise.all(pendingPromises);
                process.exit(0);
                break;

              default:
                console.log(
                  "Unknown command. Type /help for available commands."
                );
            }
          } else if (trimmedLine) {
            const spinner = createSpinner("Generating code...");
            //   const details = new CollapsibleLogs("Generation Details");
            //   lastDetails = details; // Store the new details container
            //   details.start();

            // Intercept console.log
            //   const originalConsoleLog = console.log;

            //   if (!process.env.DEBUG) {
            //     console.log = (...args) => {
            //       const message = args.join(" ");
            //       details.log(message);
            //     };
            //   }

            try {
              if (!process.env.ANTHROPIC_API_KEY) {
                console.error(
                  "\nError: ANTHROPIC_API_KEY environment variable is not set"
                );
                console.log("\nTo get started:");
                console.log(
                  "1. Get an Anthropic API Key from https://console.anthropic.com/settings/keys"
                );
                console.log("2. Set the environment variable:");
                console.log(
                  '   export ANTHROPIC_API_KEY="your-api-key-here"\n'
                );
                throw new Error("ANTHROPIC_API_KEY not set");
              }

              const result = await runAgent({
                task: trimmedLine,
                currentPath,
                spinner,
                docker: options.docker,
                safe: options.safe,
              });

              if (result.newPath) {
                currentPath = result.newPath;
                replServer.setPrompt(getPrompt()); // Update the prompt
              }

              spinner.stop();
              // Restore original console.log

              // console.log = originalConsoleLog;
            } catch (error) {
              spinner.fail("Generation failed");
              // Restore original console.log
              // console.log = originalConsoleLog;
              throw error;
            }
          }
        })();

        await commandPromise;
        callback(null, undefined);
      } catch (error) {
        callback(error as Error, undefined);
      }
    },
  });

  historyManager = new HistoryManager(replServer);
  await historyManager.loadHistory();
  historyManager.addHistoryCommand();

  // Clear the screen and position cursor
  process.stdout.write("\x1Bc");
  console.log("AGIsh - The agentic shell");
  console.log(HELP_TEXT);

  //   if (isPiped) {
  //     // Wait for all commands to complete before exiting
  //     process.stdin.on("end", async () => {
  //       try {
  //         await Promise.all(pendingPromises);
  //         process.exit(0);
  //       } catch (error) {
  //         console.error("Error during execution:", error);
  //         process.exit(1);
  //       }
  //     });
  //   }

  replServer.displayPrompt();
}

// Suppress the punycode deprecation warning
process.removeAllListeners("warning");

startShell();
