import blessed from "blessed";

export type BlessedScreen = blessed.Widgets.Screen;
export type BlessedBox = blessed.Widgets.BoxElement;
export type BlessedList = blessed.Widgets.ListElement;
export type BlessedLog = blessed.Widgets.Log;
export type BlessedListElement = blessed.Widgets.ListElement;

let screenInstance: BlessedScreen | null = null;

export function createScreen(): BlessedScreen {
  if (screenInstance) {
    return screenInstance;
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: "Mini Rogue",
    cursor: {
      artificial: true,
      shape: "line",
      blink: true,
      color: "white",
    },
    fullUnicode: true,
  });

  screenInstance = screen;

  screen.key(["escape", "q", "C-c"], () => {
    process.exit(0);
  });

  return screen;
}

export function getScreen(): BlessedScreen | null {
  return screenInstance;
}

export function destroyScreen(): void {
  if (screenInstance) {
    screenInstance.destroy();
    screenInstance = null;
  }
}
