import * as fs from "fs";
import * as path from "path";

const SAVES_DIR = path.join(process.cwd(), "saves");
const SLOT_PATHS = [
  path.join(SAVES_DIR, "slot1.json"),
  path.join(SAVES_DIR, "slot2.json"),
  path.join(SAVES_DIR, "slot3.json"),
];
const AUTOSAVE_PATH = path.join(SAVES_DIR, "autosave.json");

export interface SaveMetadata {
  character: string;
  difficulty: string;
  level: number;
  score: number;
  timestamp: string;
  playTimeSeconds?: number;
  mode: "dungeon" | "openWorld";
}

export interface SaveData {
  metadata: SaveMetadata;
  gameState: unknown;
}

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

export function getSlotMetadata(slotIndex: 1 | 2 | 3): SaveMetadata | null {
  ensureSavesDir();
  const filePath = SLOT_PATHS[slotIndex - 1];
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return data.metadata ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getAllSlotMetadata(): (SaveMetadata | null)[] {
  return [
    getSlotMetadata(1),
    getSlotMetadata(2),
    getSlotMetadata(3),
  ];
}

export function saveToSlot(slotIndex: 1 | 2 | 3, data: SaveData): boolean {
  ensureSavesDir();
  try {
    fs.writeFileSync(
      SLOT_PATHS[slotIndex - 1],
      JSON.stringify(data, null, 2),
      "utf8"
    );
    return true;
  } catch (err) {
    console.error("Save failed:", err);
    return false;
  }
}

export function loadFromSlot(slotIndex: 1 | 2 | 3): SaveData | null {
  ensureSavesDir();
  const filePath = SLOT_PATHS[slotIndex - 1];
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

export function autosave(data: SaveData): boolean {
  ensureSavesDir();
  try {
    fs.writeFileSync(
      AUTOSAVE_PATH,
      JSON.stringify(data, null, 2),
      "utf8"
    );
    return true;
  } catch (err) {
    console.error("Autosave failed:", err);
    return false;
  }
}

export function loadAutosave(): SaveData | null {
  ensureSavesDir();
  try {
    if (fs.existsSync(AUTOSAVE_PATH)) {
      return JSON.parse(fs.readFileSync(AUTOSAVE_PATH, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

export function hasAutosave(): boolean {
  return fs.existsSync(AUTOSAVE_PATH);
}
