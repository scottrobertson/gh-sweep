import { setBar, clearBar } from "./tui.js";

export interface Action {
  key: string;
  label: string;
  run: () => Promise<void>;
  advances: boolean;
}

export async function promptAction(actions: Action[]): Promise<string> {
  const keys = actions.map((a) => a.key);
  const prompt = actions.map((a) => `(${a.key})${a.label}`).join("  ");

  while (true) {
    setBar(prompt);
    const key = await readKey(keys);
    const action = actions.find((a) => a.key === key)!;

    await action.run();
    if (action.advances) {
      clearBar();
      return action.key + action.label;
    }
  }
}

function readKey(validKeys: string[]): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      if (key === "\x03") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.exit(0);
      }

      const lower = key.toLowerCase();
      if (validKeys.includes(lower)) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(lower);
      }
    };

    process.stdin.on("data", onData);
  });
}
