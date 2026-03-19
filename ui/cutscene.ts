import blessed from "blessed";
import type { BlessedScreen } from "./screen";

export interface CutsceneFrame {
  text: string;
  ascii?: string;
  durationMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function playCutscene(
  screen: BlessedScreen,
  frames: CutsceneFrame[],
  options?: { typewriterDelayMs?: number; skipOnKey?: boolean }
): Promise<void> {
  const typewriterDelay = options?.typewriterDelayMs ?? 35;
  const skipOnKey = options?.skipOnKey ?? true;

  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "90%",
    height: "90%",
    tags: true,
    padding: { left: 3, right: 3, top: 2, bottom: 2 },
    scrollable: true,
    alwaysScroll: true,
    content: "",
    style: {
      fg: "white",
      border: { type: "line" as const, fg: 6 },
    },
  });

  let skipped = false;

  if (skipOnKey) {
    box.key(["space", "enter", "escape"], () => {
      skipped = true;
    });
    box.focus();
  }

  for (const frame of frames) {
    skipped = false;
    const prefix = frame.ascii ? `{cyan-fg}${frame.ascii}{/}\n\n` : "";
    let displayed = "";

    if (typewriterDelay > 0) {
      for (const char of frame.text) {
        if (skipped) break;
        displayed += char;
        box.setContent(
          prefix + displayed + "\n\n{yellow-fg}(SPACE to skip){/}"
        );
        screen.render();
        await sleep(typewriterDelay);
      }
      if (skipped) displayed = frame.text;
    } else {
      displayed = frame.text;
    }

    box.setContent(
      prefix + displayed + "\n\n{yellow-fg}(SPACE to skip){/}"
    );
    screen.render();

    const start = Date.now();
    while (Date.now() - start < frame.durationMs && !skipped) {
      await sleep(50);
    }
  }

  box.destroy();
  screen.render();
}

const TITLE_ASCII = `
   __  __ _       _   ____                        
  |  \\/  (_)_ __ (_) |  _ \\ ___   __ _ _   _  ___ 
  | |\\/| | | '_ \\| | | |_) / _ \\ / _\` | | | |/ _ \\
  | |  | | | | | | | |  _ < (_) | (_| | |_| |  __/
  |_|  |_|_|_| |_|_| |_| \\_\\___/ \\__, |\\__,_|\\___|
                                     |_|           
`;

const DUNGEON_ASCII = `
    |     |     |
   / \\   / \\   / \\
  |   | |   | |   |
  | * | | * | | * |   <- torches
  |___| |___| |___|
    |     |     |
   _____ _____ _____
  |     |     |     |
  |  ?  |  @  |  ?  |   <- dungeon corridor
  |_____|_____|_____|
`;

const HERO_SILHOUETTE = `
     _|_
    / . \\
   |  *  |
   \\ -.- /
   /|   |\\
  / |___| \\
    /   \\
       Hero
`;

export const INTRO_FRAMES: CutsceneFrame[] = [
  {
    ascii: TITLE_ASCII,
    text: "Long ago, in the depths of forgotten dungeons...",
    durationMs: 2500,
  },
  {
    ascii: DUNGEON_ASCII,
    text: "Heroes ventured forth seeking glory and treasure.",
    durationMs: 2500,
  },
  {
    ascii: HERO_SILHOUETTE,
    text: "Your journey begins now. May fortune favour the brave.",
    durationMs: 3000,
  },
];

const VICTORY_ASCII = `
  \\o/   YOU SURVIVED!   \\o/
   |           
  / \\          
  You have conquered the dungeon!
`;

const DEFEAT_ASCII = `
    +---+
    |   |
    O   |   GAME OVER
   /|\\  |
   / \\  |
        |
  =======
  Your journey ends here...
`;

const LEVEL_ASCII = `
   _____ _____ _____
  |  << | STAIRS | >>  |
  |_____|_____|_____|
  You descend deeper...
`;

export const VICTORY_FRAMES: CutsceneFrame[] = [
  { ascii: VICTORY_ASCII, text: "The dungeon is yours. Glory awaits!", durationMs: 4000 },
];

export const DEFEAT_FRAMES: CutsceneFrame[] = [
  { ascii: DEFEAT_ASCII, text: "Press any key to continue.", durationMs: 3000 },
];

export const LEVEL_TRANSITION_FRAMES: CutsceneFrame[] = [
  { ascii: LEVEL_ASCII, text: "You rest briefly and recover 3 HP.", durationMs: 2500 },
];
