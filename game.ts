#!/usr/bin/env ts-node

import * as childProcess from "child_process";
import * as path from "path";
import { createScreen } from "./ui/screen";
import {
  showMainMenu,
  showDifficultyMenu,
  showClassMenu,
  showLoadMenu,
  showHighScores,
  type MainMenuChoice,
  type DifficultyChoice,
  type ClassChoice,
} from "./ui/menus";
import { playCutscene, INTRO_FRAMES } from "./ui/cutscene";
import {
  loadFromSlot,
  loadAutosave,
  hasAutosave,
} from "./saves/saveManager";
import blessed from "blessed";

async function showMessage(
  screen: blessed.Widgets.Screen,
  text: string
): Promise<void> {
  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 50,
    height: 5,
    content: `  ${text}\n\n  Press any key to continue.`,
    tags: true,
    padding: 1,
    style: { fg: "white", bg: 0, border: { type: "line", fg: 6 } },
  });
  screen.render();
  await new Promise<void>((r) =>
    screen.once("keypress", () => {
      box.destroy();
      screen.render();
      r();
    })
  );
}

async function showResultMessage(
  screen: blessed.Widgets.Screen,
  result: string
): Promise<void> {
  const messages: Record<string, string> = {
    victory: "You conquered the dungeon!",
    defeat: "You have fallen...",
    saved: "Game saved.",
    quit: "You left the dungeon.",
  };
  await showMessage(screen, messages[result] ?? result);
}

async function runGameLoop(screen: blessed.Widgets.Screen): Promise<void> {
  while (true) {
    const choice = await showMainMenu(screen, hasAutosave());

    if (choice === "quit" || choice === null) {
      return;
    }

    if (choice === "scores") {
      await showHighScores(screen);
      continue;
    }

    if (choice === "openworld") {
      screen.destroy();
      screen.render();
      const openWorldPath = path.join(__dirname, "openWorld.ts");
      await new Promise<void>((resolve) => {
        const child = childProcess.spawn("npx", ["ts-node", openWorldPath], {
          stdio: "inherit",
          cwd: process.cwd(),
          shell: true,
        });
        child.on("exit", () => resolve());
      });
      const newScreen = createScreen();
      await runGameLoop(newScreen);
      return;
    }

    if (choice === "continue") {
      const saveData = loadAutosave();
      if (saveData && saveData.metadata.mode === "dungeon") {
        const { runDungeon } = await import("./dungeonGame");
        const diffMap: Record<string, string> = {
          easy: "easy",
          normal: "normal",
          hard: "hard",
          "quick play": "quick",
        };
        const diffKey =
          diffMap[saveData.metadata.difficulty.toLowerCase()] ?? "normal";
        const classKey = saveData.metadata.character.toLowerCase();
        const result = await runDungeon(screen, diffKey, classKey, saveData);
        await showResultMessage(screen, result);
      } else {
        await showMessage(screen, "No autosave found.");
      }
      continue;
    }

    if (choice === "load") {
      const slot = await showLoadMenu(screen);
      if (slot === null) continue;

      const saveData = loadFromSlot(slot);
      if (!saveData || saveData.metadata.mode !== "dungeon") {
        const msg = blessed.box({
          parent: screen,
          top: "center",
          left: "center",
          width: 50,
          height: 5,
          content: "  Failed to load or not a dungeon save.",
          tags: true,
          padding: 1,
          style: { fg: "red", border: { type: "line", fg: "red" } },
        });
        screen.render();
        await new Promise<void>((r) =>
          screen.once("keypress", () => {
            msg.destroy();
            screen.render();
            r();
          })
        );
        continue;
      }

      const { runDungeon } = await import("./dungeonGame");
      const result = await runDungeon(screen, "normal", "warrior", saveData);
      await showResultMessage(screen, result);
      continue;
    }

    if (choice === "new") {
      const difficulty = await showDifficultyMenu(screen);
      if (difficulty === null) continue;

      const charClass = await showClassMenu(screen);
      if (charClass === null) continue;

      await playCutscene(screen, INTRO_FRAMES);

      const { runDungeon } = await import("./dungeonGame");
      const result = await runDungeon(screen, difficulty, charClass);
      await showResultMessage(screen, result);
    }
  }
}

async function main(): Promise<void> {
  const screen = createScreen();
  screen.render();

  try {
    await runGameLoop(screen);
  } finally {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
