#!/usr/bin/env ts-node

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
import { loadFromSlot, loadAutosave, hasAutosave } from "./saves/saveManager";
import blessed from "blessed";

async function runGameLoop(screen: blessed.Widgets.Screen): Promise<void> {
  while (true) {
    const choice = await showMainMenu(screen);

    if (choice === "quit" || choice === null) {
      return;
    }

    if (choice === "scores") {
      await showHighScores(screen);
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

      const messages: Record<string, string> = {
        victory: "You conquered the dungeon!",
        defeat: "You have fallen...",
        saved: "Game saved.",
        quit: "You left the dungeon.",
      };
      const box = blessed.box({
        parent: screen,
        top: "center",
        left: "center",
        width: 50,
        height: 6,
        content: `  ${messages[result] || result}\n\n  Press any key to return to menu.`,
        tags: true,
        padding: 1,
        style: { fg: "white", border: { type: "line", fg: "cyan" } },
      });
      screen.render();
      await new Promise<void>((r) =>
        screen.once("keypress", () => {
          box.destroy();
          screen.render();
          r();
        })
      );
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

      const messages: Record<string, string> = {
        victory: "You conquered the dungeon! Well done!",
        defeat: "You have fallen in the dungeon...",
        saved: "Game saved. Come back anytime!",
        quit: "You left the dungeon.",
      };
      const box = blessed.box({
        parent: screen,
        top: "center",
        left: "center",
        width: 50,
        height: 6,
        content: `  ${messages[result] || result}\n\n  Press any key to return to menu.`,
        tags: true,
        padding: 1,
        style: { fg: "white", border: { type: "line", fg: "cyan" } },
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
