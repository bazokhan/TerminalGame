import blessed from "blessed";
import type { BlessedScreen } from "./screen";
import {
  getAllSlotMetadata,
  type SaveMetadata,
} from "../saves/saveManager";

// ANSI: 6=cyan, 8=gray
const BORDER_STYLE: { type: "line"; fg: number } = { type: "line", fg: 6 };
const BORDER_GREY: { type: "line"; fg: number } = { type: "line", fg: 8 };

const TITLE_ART = `
   __  __ _       _   ____                        
  |  \\/  (_)_ __ (_) |  _ \\ ___   __ _ _   _  ___ 
  | |\\/| | | '_ \\| | | |_) / _ \\ / _\` | | | |/ _ \\
  | |  | | | | | | | |  _ < (_) | (_| | |_| |  __/
  |_|  |_|_|_| |_|_| |_| \\_\\___/ \\__, |\\__,_|\\___|
                                     |_|           
`;

export type MainMenuChoice = "new" | "load" | "scores" | "quit" | null;

export function showMainMenu(screen: BlessedScreen): Promise<MainMenuChoice> {
  return new Promise((resolve) => {
    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 50,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      style: {
        fg: "white",
        border: BORDER_STYLE,
        focus: { border: { fg: "yellow" } },
      },
    });

    const title = blessed.box({
      parent: container,
      top: 0,
      left: 0,
      width: "100%",
      height: "shrink",
      content: TITLE_ART,
      tags: true,
      style: { fg: "cyan" },
    });

    const list = blessed.list({
      parent: container,
      top: 10,
      left: 2,
      width: "100%-4",
      height: 8,
      keys: true,
      vi: true,
      mouse: true,
      items: ["New Game", "Load Game", "High Scores", "Quit"],
      style: {
        fg: "white",
        selected: { fg: "black", bg: "cyan" },
        item: { fg: "white" },
        border: { fg: "black" },
      },
      border: BORDER_GREY,
    });

    list.on("select", (_, index) => {
      const choices: MainMenuChoice[] = ["new", "load", "scores", "quit"];
      resolve(choices[index] ?? null);
      container.destroy();
      screen.render();
    });

    list.focus();
    list.select(0);
    screen.render();
  });
}

export type DifficultyChoice = "easy" | "normal" | "hard" | "quick" | null;

export function showDifficultyMenu(screen: BlessedScreen): Promise<DifficultyChoice> {
  return new Promise((resolve) => {
    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 60,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      label: " Select Difficulty ",
      style: {
        fg: "white",
        border: BORDER_STYLE,
      },
    });

    const list = blessed.list({
      parent: container,
      top: 1,
      left: 2,
      width: "100%-4",
      height: 6,
      keys: true,
      vi: true,
      mouse: true,
      items: [
        "Easy - 3 levels, 3 rooms each, weaker enemies",
        "Normal - 3 levels, 4 rooms each",
        "Hard - 4 levels, stronger enemies",
        "Quick Play - 1 level, 3 rooms (~5-8 min)",
      ],
      style: {
        fg: "white",
        selected: { fg: "black", bg: "green" },
      },
      border: BORDER_GREY,
    });

    list.on("select", (_, index) => {
      const choices: DifficultyChoice[] = ["easy", "normal", "hard", "quick"];
      resolve(index < 4 ? choices[index] : null);
      container.destroy();
      screen.render();
    });

    list.focus();
    list.select(0);
    screen.render();
  });
}

export type ClassChoice = "warrior" | "rogue" | "mage" | null;

export function showClassMenu(screen: BlessedScreen): Promise<ClassChoice> {
  return new Promise((resolve) => {
    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 58,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      label: " Choose Your Class ",
      style: {
        fg: "white",
        border: BORDER_STYLE,
      },
    });

    const list = blessed.list({
      parent: container,
      top: 1,
      left: 2,
      width: "100%-4",
      height: 5,
      keys: true,
      vi: true,
      mouse: true,
      items: [
        "Warrior - High HP & defense",
        "Rogue - High dodge & critical hits",
        "Mage - Magic Missile, ignores defense",
      ],
      style: {
        fg: "white",
        selected: { fg: "black", bg: "yellow" },
      },
      border: BORDER_GREY,
    });

    list.on("select", (_, index) => {
      const choices: ClassChoice[] = ["warrior", "rogue", "mage"];
      resolve(index < 3 ? choices[index] : null);
      container.destroy();
      screen.render();
    });

    list.focus();
    list.select(0);
    screen.render();
  });
}

function formatSlotLabel(meta: SaveMetadata | null, index: number): string {
  if (!meta) return `Slot ${index} - Empty`;
  const date = new Date(meta.timestamp).toLocaleString();
  return `Slot ${index}: ${meta.character} | Lv${meta.level} | ${meta.score} pts | ${date}`;
}

export function showLoadMenu(screen: BlessedScreen): Promise<1 | 2 | 3 | null> {
  return new Promise((resolve) => {
    const allMeta = getAllSlotMetadata();
    const items = [
      formatSlotLabel(allMeta[0], 1),
      formatSlotLabel(allMeta[1], 2),
      formatSlotLabel(allMeta[2], 3),
      "Back",
    ];

    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 72,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      label: " Load Game ",
      style: {
        fg: "white",
        border: BORDER_STYLE,
      },
    });

    const list = blessed.list({
      parent: container,
      top: 1,
      left: 2,
      width: "100%-4",
      height: 6,
      keys: true,
      vi: true,
      mouse: true,
      items,
      style: {
        fg: "white",
        selected: { fg: "black", bg: "green" },
      },
      border: BORDER_GREY,
    });

    list.on("select", (_, index) => {
      if (index === 3) {
        resolve(null);
      } else if (allMeta[index] !== null) {
        resolve((index + 1) as 1 | 2 | 3);
      } else {
        resolve(null);
      }
      container.destroy();
      screen.render();
    });

    list.focus();
    list.select(0);
    screen.render();
  });
}

export function showSaveMenu(
  screen: BlessedScreen,
  currentSummary: string
): Promise<1 | 2 | 3 | null> {
  return new Promise((resolve) => {
    const allMeta = getAllSlotMetadata();
    const items = [
      formatSlotLabel(allMeta[0], 1),
      formatSlotLabel(allMeta[1], 2),
      formatSlotLabel(allMeta[2], 3),
      "Cancel",
    ];

    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 72,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      label: " Save Game ",
      style: {
        fg: "white",
        border: BORDER_STYLE,
      },
    });

    blessed.box({
      parent: container,
      top: 1,
      left: 2,
      width: "100%-4",
      height: 1,
      content: `Saving: ${currentSummary}`,
      tags: true,
      style: { fg: "yellow" },
    });

    const list = blessed.list({
      parent: container,
      top: 3,
      left: 2,
      width: "100%-4",
      height: 6,
      keys: true,
      vi: true,
      mouse: true,
      items,
      style: {
        fg: "white",
        selected: { fg: "black", bg: "cyan" },
      },
      border: BORDER_GREY,
    });

    list.on("select", (_, index) => {
      if (index === 3) {
        resolve(null);
      } else {
        resolve((index + 1) as 1 | 2 | 3);
      }
      container.destroy();
      screen.render();
    });

    list.focus();
    list.select(0);
    screen.render();
  });
}

export function showHighScores(screen: BlessedScreen): Promise<void> {
  return new Promise((resolve) => {
    const fs = require("fs");
    const path = require("path");
    const HIGH_SCORE_FILE = path.join(process.cwd(), "high_scores.json");

    let content = "  No high scores yet.\n";
    try {
      if (fs.existsSync(HIGH_SCORE_FILE)) {
        const scores = JSON.parse(fs.readFileSync(HIGH_SCORE_FILE, "utf8"));
        if (scores.length > 0) {
          content =
            "  RANK  NAME           SCORE\n  " +
            "─".repeat(30) +
            "\n  ";
          content += scores
            .slice(0, 10)
            .map(
              (s: { name: string; score: number }, i: number) =>
                `${(i + 1).toString().padEnd(5)} ${s.name.slice(0, 14).padEnd(15)} ${s.score}`
            )
            .join("\n  ");
        }
      }
    } catch {
      // ignore
    }

    const container = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 50,
      height: "shrink",
      tags: true,
      padding: { left: 2, right: 2, top: 1, bottom: 2 },
      label: " High Scores ",
      content,
      style: {
        fg: "white",
        border: BORDER_STYLE,
      },
    });

    const handler = () => {
      screen.removeListener("keypress", handler);
      container.destroy();
      screen.render();
      resolve();
    };
    screen.on("keypress", handler);
    screen.render();
  });
}
