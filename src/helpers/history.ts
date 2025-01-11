import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type * as repl from "repl";

const HISTORY_FILE = path.join(os.homedir(), ".agish_history");
const MAX_HISTORY = 1000;

// Add this interface to properly type the REPL server with history
interface REPLServerWithHistory extends repl.REPLServer {
  history: string[];
}

export class HistoryManager {
  private replServer: REPLServerWithHistory;

  constructor(replServer: repl.REPLServer) {
    this.replServer = replServer as REPLServerWithHistory;
  }

  async loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const history = fs
          .readFileSync(HISTORY_FILE, "utf8")
          .split("\n")
          .filter((line) => line.trim());

        // Load history into REPL
        history.reverse().forEach((line) => {
          this.replServer.history.push(line);
        });
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }

  saveCommand(command: string) {
    try {
      // Don't save empty commands or commands that start with spaces
      if (!command.trim() || command.startsWith(" ")) return;

      // Append to history file
      fs.appendFileSync(HISTORY_FILE, command + "\n");

      // Trim history file if it gets too long
      const history = fs
        .readFileSync(HISTORY_FILE, "utf8")
        .split("\n")
        .filter((line) => line.trim());

      if (history.length > MAX_HISTORY) {
        fs.writeFileSync(
          HISTORY_FILE,
          history.slice(-MAX_HISTORY).join("\n") + "\n"
        );
      }
    } catch (error) {
      console.error("Failed to save to history:", error);
    }
  }

  showHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const history = fs
          .readFileSync(HISTORY_FILE, "utf8")
          .split("\n")
          .filter((line) => line.trim());

        console.log("\nCommand History:");
        history.forEach((cmd, i) => {
          console.log(`${i + 1}: ${cmd}`);
        });
      } else {
        console.log("No history found");
      }
    } catch (error) {
      console.error("Failed to read history:", error);
    }
  }

  addHistoryCommand() {
    this.replServer.defineCommand("history", {
      help: "Show command history",
      action: () => {
        this.showHistory();
        this.replServer.displayPrompt();
      },
    });
  }
}
