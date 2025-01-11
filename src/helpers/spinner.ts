export type Spinner = {
  stop: () => void;
  fail: (errorMessage: string) => void;
};

export function createSpinner(message: string) {
  // Check if we're in piped mode
  //   const isPiped = !process.stdin.isTTY;

  //   if (isPiped) {
  //     // In piped mode, just log the message directly
  //     console.log(`${message}...`);
  //     return {
  //       stop: () => {
  //         // Do nothing in piped mode
  //       },
  //       fail: (errorMessage: string) => {
  //         console.error(`Failed: ${errorMessage}`);
  //       },
  //     };
  //   }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${message}`);
    i = (i + 1) % frames.length;
  }, 80);

  return {
    stop: () => {
      clearInterval(timer);
      process.stdout.write("\r\x1b[K");
    },
    fail: (errorMessage: string) => {
      clearInterval(timer);
      process.stdout.write(`\r❌ ${errorMessage}\n`);
    },
  };
}
