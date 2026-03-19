import blessed from "blessed";
import type { BlessedScreen, BlessedBox, BlessedLog } from "./screen";

export interface GameLayout {
  screen: BlessedScreen;
  header: BlessedBox;
  main: BlessedBox;
  stats: BlessedBox;
  log: BlessedLog;
  footer: BlessedBox;
}

const BORDER_STYLE: { type: "line"; fg: number; ch: string } = {
  type: "line",
  fg: 6,
  ch: " ",
};

const HEADER_HEIGHT = 3;
const FOOTER_HEIGHT = 3;
const LOG_HEIGHT = 5;
const STATS_WIDTH = 28;

export function createLayout(screen: BlessedScreen): GameLayout {
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: HEADER_HEIGHT,
    content: " MINI ROGUE ",
    tags: true,
    align: "center",
    valign: "middle",
    style: {
      fg: "cyan",
      bold: true,
      border: BORDER_STYLE,
    },
  });

  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: FOOTER_HEIGHT,
    content: " [W/A/S/D] Move | [I] Inventory | [P] Potion | [S] Save | [Q] Quit ",
    tags: true,
    align: "center",
    valign: "middle",
    style: {
      fg: "yellow",
      border: BORDER_STYLE,
    },
  });

  const log = blessed.log({
    parent: screen,
    bottom: FOOTER_HEIGHT,
    left: 0,
    width: "100%-" + (STATS_WIDTH + 2),
    height: LOG_HEIGHT,
    tags: true,
    scrollable: true,
    scrollbar: {
      ch: " ",
      track: { bg: "grey" },
      style: { inverse: true },
    },
    style: {
      fg: "white",
      border: BORDER_STYLE,
    },
  });

  const stats = blessed.box({
    parent: screen,
    top: HEADER_HEIGHT,
    right: 0,
    width: STATS_WIDTH + 2,
    height: "100%-" + (HEADER_HEIGHT + FOOTER_HEIGHT + LOG_HEIGHT),
    content: " Stats\n\n",
    tags: true,
    style: {
      fg: "green",
      border: BORDER_STYLE,
    },
  });

  const main = blessed.box({
    parent: screen,
    top: HEADER_HEIGHT,
    left: 0,
    width: "100%-" + (STATS_WIDTH + 2),
    height: "100%-" + (HEADER_HEIGHT + FOOTER_HEIGHT + LOG_HEIGHT),
    content: "",
    tags: true,
    padding: { left: 1, right: 1, top: 1, bottom: 1 },
    scrollable: true,
    scrollbar: {
      ch: " ",
      track: { bg: "grey" },
      style: { inverse: true },
    },
    style: {
      fg: "white",
      border: BORDER_STYLE,
    },
  });

  return { screen, header, main, stats, log, footer };
}

export function createFullScreenLayout(screen: BlessedScreen): {
  screen: BlessedScreen;
  main: BlessedBox;
} {
  const main = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    content: "",
    tags: true,
    padding: { left: 2, right: 2, top: 1, bottom: 1 },
    scrollable: true,
    style: {
      fg: "white",
      border: BORDER_STYLE,
    },
  });

  return { screen, main };
}

export function setHeader(layout: GameLayout, text: string): void {
  layout.header.setContent(` {center}${text}{/center}`);
}

export function setFooter(layout: GameLayout, text: string): void {
  layout.footer.setContent(` {center}${text}{/center}`);
}

export function setMainContent(layout: GameLayout, content: string): void {
  layout.main.setContent(content);
}

export function appendLog(layout: GameLayout, line: string): void {
  layout.log.log(line);
}

export function setStats(layout: GameLayout, content: string): void {
  layout.stats.setContent(content);
}
