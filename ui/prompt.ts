import blessed from "blessed";
import type { BlessedScreen } from "./screen";

export function askText(
  screen: BlessedScreen,
  question: string,
  defaultValue = ""
): Promise<string> {
  return new Promise((resolve) => {
    const prompt = blessed.prompt({
      parent: screen,
      top: "center",
      left: "center",
      width: "80%",
      height: "shrink",
      tags: true,
      keys: true,
      vi: true,
      label: " {bold}Input{/} ",
      border: { type: "line" as const, fg: 6 },
      style: {
        fg: "white",
        border: { fg: 6 },
      },
    });

    prompt.input(question, defaultValue, (err: unknown, value: string) => {
      prompt.destroy();
      screen.render();
      resolve(err ? "" : (value ?? ""));
    });

    screen.render();
  });
}
