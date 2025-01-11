import * as os from "os";

// ANSII escape codes
export const BLUE = "\x1b[34m";
export const GREEN = "\x1b[32m";
export const BOLD = "\x1b[1m";
export const RESET = "\x1b[0m";

export const HELP_TEXT = `
Available commands:
/help         - Show this help message
/exit, /quit  - Exit the shell
/history      - Show command history
${GREEN}${BOLD}<task>${RESET}        - Task to complete in the current directory (default)

Type any text at the prompt to run it as a task on the current repo.
`;

export const HOME_DIR = os.homedir();
export const USERNAME = os.userInfo().username;
export const HOSTNAME = os.hostname();

export const CONTAINER_NAME = "ubuntuforai";
export const DEFAULT_IMAGE_NAME = "ubuntuforai";
export const LOCAL_HOME_DIR = HOME_DIR;
export const CONTAINER_HOME_DIR = "/home/ubuntu/";
