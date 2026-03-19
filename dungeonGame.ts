import blessed from "blessed";
import type { BlessedScreen } from "./ui/screen";
import { createLayout, setHeader, setFooter, setMainContent, appendLog, setStats } from "./ui/layout";
import {
  ENEMIES,
  ENEMY_TYPES,
  TREASURES,
  EVENTS,
  type DifficultyLevel,
  type CharacterClass,
  DIFFICULTIES,
  CHARACTER_CLASSES,
} from "./gameData";
import { getRandomPuzzle, checkAnswer } from "./puzzles";
import { askText } from "./ui/prompt";
import { saveToSlot, autosave, type SaveData } from "./saves/saveManager";
import {
  playCutscene,
  VICTORY_FRAMES,
  DEFEAT_FRAMES,
  LEVEL_TRANSITION_FRAMES,
} from "./ui/cutscene";
import * as fs from "fs";
import * as path from "path";

const HIGH_SCORE_FILE = path.join(process.cwd(), "high_scores.json");

interface PlayerStatus {
  poisoned: number;
  cursed: number;
  atkModifier: number;
}

class Player {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions: number;
  score: number;
  characterClass: CharacterClass;
  mana: number;
  status: PlayerStatus;

  constructor(difficulty: DifficultyLevel, characterClass: CharacterClass) {
    this.characterClass = characterClass;
    this.maxHp = characterClass.baseHp;
    this.hp = this.maxHp;
    this.atk = characterClass.baseAtk;
    this.def = characterClass.baseDef;
    this.potions = difficulty.startingPotions;
    this.score = 0;
    this.mana = characterClass.name === "Mage" ? 3 : 0;
    this.status = { poisoned: 0, cursed: 0, atkModifier: 0 };
  }

  getEffectiveAttack() {
    return Math.max(1, this.atk + this.status.atkModifier);
  }

  applyStatusEffects(): string[] {
    const messages: string[] = [];
    if (this.status.poisoned > 0) {
      this.hp -= 1;
      this.status.poisoned--;
      messages.push(`You take 1 damage from poison. (${this.status.poisoned} turns left)`);
    }
    if (this.status.cursed > 0) {
      this.status.cursed--;
      if (this.status.cursed === 0) {
        this.status.atkModifier = 0;
        messages.push("The curse has worn off.");
      } else {
        messages.push(`Cursed! ATK reduced. (${this.status.cursed} turns left)`);
      }
    }
    return messages;
  }

  attack(enemy: Enemy): { damage: number; isCritical: boolean } {
    const isCritical = Math.random() < this.characterClass.criticalChance;
    let damage = Math.max(this.getEffectiveAttack() - enemy.def, 1);
    if (this.characterClass.name === "Mage" && this.mana > 0 && Math.random() < 0.7) {
      damage = this.characterClass.magicPower;
      this.mana--;
    }
    if (isCritical) damage = Math.floor(damage * 1.5);
    enemy.hp -= damage;
    return { damage, isCritical };
  }

  dodge(): boolean {
    return Math.random() < this.characterClass.dodgeChance;
  }

  block(): boolean {
    return this.characterClass.name === "Warrior" && Math.random() < 0.25;
  }

  heal(): boolean {
    if (this.potions > 0) {
      this.hp = Math.min(this.hp + 5, this.maxHp);
      this.potions--;
      return true;
    }
    return false;
  }
}

class Enemy {
  hp: number;
  atk: number;
  def: number;
  name: string;
  maxHp: number;
  canRegenerate = false;
  canPoison = false;
  canLifesteal = false;
  canCurse = false;
  hasBreathAttack = false;

  constructor(name: string, difficulty: DifficultyLevel, levelScaling: number) {
    this.name = name;
    this.hp = Math.floor(Math.random() * 5) + 3 + difficulty.enemyBonus + Math.floor(levelScaling * 2);
    this.atk = Math.floor(Math.random() * 3) + 1 + Math.floor(difficulty.enemyBonus / 2) + Math.floor(levelScaling);
    this.def = Math.floor(Math.random() * 2) + Math.floor(difficulty.enemyBonus / 3) + Math.floor(levelScaling / 2);
    this.maxHp = this.hp;

    if (name === "Troll") this.canRegenerate = true;
    if (name === "Spider") this.canPoison = true;
    if (name === "Vampire") this.canLifesteal = true;
    if (name === "Witch") this.canCurse = true;
    if (name === "Dragon") this.hasBreathAttack = true;
  }

  useAbility(player: Player): string | null {
    if (this.canRegenerate && this.hp < this.maxHp) {
      this.hp += 1;
      return `The ${this.name} regenerates 1 HP!`;
    }
    if (this.canCurse && Math.random() < 0.3 && player.status.cursed === 0) {
      player.status.cursed = 2;
      player.status.atkModifier = -1;
      return `The ${this.name} curses you!`;
    }
    return null;
  }

  attack(player: Player): { damage: number; isCritical: boolean; blocked: boolean } {
    const abilityMsg = this.useAbility(player);
    if (abilityMsg) player;
    let damage = Math.max(this.atk - player.def, 1);
    const isCritical = Math.random() < 0.1;
    if (isCritical) damage = Math.floor(damage * 1.5);
    if (this.hasBreathAttack && this.hp < this.maxHp / 2 && Math.random() < 0.4) damage += 2;
    const blocked = player.block();
    if (blocked) damage = Math.floor(damage / 2);
    player.hp = Math.max(0, player.hp - damage);
    if (this.canPoison && damage > 0 && Math.random() < 0.3 && player.status.poisoned === 0) {
      player.status.poisoned = 2;
    }
    if (this.canLifesteal && damage > 0) {
      this.hp = Math.min(this.hp + Math.ceil(damage / 2), this.maxHp);
    }
    return { damage, isCritical, blocked };
  }
}

function waitForKey(screen: BlessedScreen, validKeys: string[]): Promise<string> {
  return new Promise((resolve) => {
    const handler = (_ch: string, key: { name?: string }) => {
      const k = (key?.name || _ch || "").toLowerCase();
      if (validKeys.includes(k) || validKeys.includes(_ch?.toLowerCase() || "")) {
        screen.removeListener("keypress", handler);
        resolve(k || _ch?.toLowerCase() || "");
      }
    };
    screen.on("keypress", handler);
  });
}

function formatStatus(player: Player, level: number, rooms: number, maxRooms: number, diff: DifficultyLevel): string {
  const hpPct = Math.min(player.hp / player.maxHp, 1);
  const hpBar = "█".repeat(Math.floor(hpPct * 10)) + "░".repeat(10 - Math.floor(hpPct * 10));
  return [
    `Level: ${level}/${diff.dungeonLevels}  Room: ${rooms}/${diff.roomsPerLevel}`,
    `HP: [${hpBar}] ${player.hp}/${player.maxHp}`,
    `Potions: ${player.potions}  Score: ${player.score}`,
    player.characterClass.name === "Mage" ? `Mana: ${player.mana}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEnemyStats(enemy: Enemy): string {
  const hpPct = Math.min(enemy.hp / enemy.maxHp, 1);
  const hpBar =
    "█".repeat(Math.floor(hpPct * 10)) +
    "░".repeat(10 - Math.floor(hpPct * 10));
  return [
    `ENEMY: ${enemy.name}`,
    `HP: [${hpBar}] ${enemy.hp}/${enemy.maxHp}`,
    `ATK: ${enemy.atk}  DEF: ${enemy.def}`,
  ].join("\n");
}

interface LoadedState {
  player: Player;
  currentLevel: number;
  roomsExplored: number;
  difficulty: DifficultyLevel;
}

function restoreFromSave(save: SaveData): LoadedState | null {
  try {
    const gs = save.gameState as {
      playerState: Record<string, number | string>;
      gameState: { currentLevel: number; roomsExplored: number; difficultyName: string };
    };
    const ps = gs.playerState;
    const diff = Object.values(DIFFICULTIES).find((d) => d.name === gs.gameState.difficultyName) ?? DIFFICULTIES.normal;
    const cls = Object.values(CHARACTER_CLASSES).find((c) => c.name === ps.characterClassName) ?? CHARACTER_CLASSES.warrior;
    const player = new Player(diff, cls);
    player.hp = ps.hp as number;
    player.maxHp = ps.maxHp as number;
    player.atk = ps.atk as number;
    player.def = ps.def as number;
    player.potions = ps.potions as number;
    player.score = ps.score as number;
    player.mana = (ps.mana as number) ?? 0;
    return {
      player,
      currentLevel: gs.gameState.currentLevel,
      roomsExplored: gs.gameState.roomsExplored,
      difficulty: diff,
    };
  } catch {
    return null;
  }
}

export async function runDungeon(
  screen: BlessedScreen,
  difficultyKey: string,
  classKey: string,
  savedData?: SaveData | null
): Promise<"victory" | "defeat" | "quit" | "saved"> {
  const layout = createLayout(screen);

  let player: Player;
  let currentLevel: number;
  let roomsExplored: number;
  let difficulty: DifficultyLevel;

  const loaded = savedData ? restoreFromSave(savedData) : null;
  if (loaded) {
    player = loaded.player;
    currentLevel = loaded.currentLevel;
    roomsExplored = loaded.roomsExplored;
    difficulty = loaded.difficulty;
  } else {
    difficulty = DIFFICULTIES[difficultyKey] ?? DIFFICULTIES.normal;
    const charClass = CHARACTER_CLASSES[classKey] ?? CHARACTER_CLASSES.warrior;
    player = new Player(difficulty, charClass);
    currentLevel = 1;
    roomsExplored = 0;
  }
  let lastSaveSlot: 1 | 2 | 3 | null = null;
  const outcomeRef: { value: "victory" | "defeat" | "quit" | "saved" } = { value: "quit" };

  setHeader(layout, " MINI ROGUE - Dungeon ");
  setFooter(layout, " [A]ttack [D]odge [P]otion [M]agic [H]elp [S]ave [Q]uit ");

  const doSave = (slot?: 1 | 2 | 3) => {
    const data: SaveData = {
      metadata: {
        character: player.characterClass.name,
        difficulty: difficulty.name,
        level: currentLevel,
        score: player.score,
        timestamp: new Date().toISOString(),
        mode: "dungeon",
      },
      gameState: {
        playerState: {
          hp: player.hp,
          maxHp: player.maxHp,
          atk: player.atk,
          def: player.def,
          potions: player.potions,
          score: player.score,
          mana: player.mana,
          characterClassName: player.characterClass.name,
        },
        gameState: { currentLevel, roomsExplored, difficultyName: difficulty.name },
      },
    };
    if (slot) saveToSlot(slot, data);
    else autosave(data);
  };

  const nextTurn = async (): Promise<void> => {
    if (player.hp <= 0) {
      outcomeRef.value = "defeat";
      return;
    }

    if (currentLevel > difficulty.dungeonLevels) {
      outcomeRef.value = "victory";
      appendLog(layout, "VICTORY!");
      await playCutscene(screen, VICTORY_FRAMES);
      return;
    }

    if (roomsExplored >= difficulty.roomsPerLevel) {
      currentLevel++;
      roomsExplored = 0;
      player.hp = Math.min(player.hp + 3, player.maxHp);
      if (player.characterClass.name === "Mage") player.mana = Math.min(player.mana + 2, 3);
      appendLog(layout, `Level ${currentLevel}`);
      doSave();
      await playCutscene(screen, LEVEL_TRANSITION_FRAMES);
      return nextTurn();
    }

    roomsExplored++;
    doSave();

    setStats(layout, formatStatus(player, currentLevel, roomsExplored, difficulty.roomsPerLevel, difficulty));

    const roomType = Math.random();
    const levelScaling = (currentLevel - 1) * 0.5;

    if (roomType < 0.45) {
      const enemyName = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
      const enemy = new Enemy(enemyName, difficulty, levelScaling);
      const meta = ENEMY_TYPES[enemyName];

      const combatContent = [
        `A ${enemy.name} appears!`,
        meta?.description ? meta.description : "",
        meta?.ability ? `Ability: ${meta.ability}` : "",
        "",
        "[A]ttack [D]odge [P]otion" +
          (player.characterClass.name === "Mage" && player.mana > 0
            ? " [M]agic"
            : "") +
          " [H]elp [S]ave [Q]uit",
      ]
        .filter(Boolean)
        .join("\n");

      const runCombat = async (): Promise<boolean> => {
        const statusMsgs = player.applyStatusEffects();
        statusMsgs.forEach((m) => appendLog(layout, m));
        if (player.hp <= 0) return false;

        setMainContent(layout, combatContent);
        setStats(
          layout,
          formatStatus(
            player,
            currentLevel,
            roomsExplored,
            difficulty.roomsPerLevel,
            difficulty
          ),
          formatEnemyStats(enemy)
        );
        layout.screen.render();

        const key = await waitForKey(screen, [
          "a",
          "d",
          "p",
          "m",
          "h",
          "s",
          "q",
          "escape",
        ]);
        if (key === "q" || key === "escape") return false;
        if (key === "s") return false;

        if (key === "h") {
          const helpContent = [
            "COMBAT HELP",
            "",
            "[A] Attack - Deal damage",
            "[D] Dodge - Avoid enemy attack",
            "[P] Potion - Restore 5 HP",
            "[M] Magic - Mage: ignore defense",
            "[S] Save to slot",
            "[Q] Quit combat",
          ].join("\n");
          setMainContent(layout, helpContent);
          layout.screen.render();
          await waitForKey(screen, ["escape", "enter", " "]);
          return runCombat();
        }

        if (key === "a") {
          const result = player.attack(enemy);
          appendLog(
            layout,
            result.isCritical
              ? `CRITICAL! ${result.damage} damage`
              : `You hit for ${result.damage}`
          );
          setStats(
            layout,
            formatStatus(
              player,
              currentLevel,
              roomsExplored,
              difficulty.roomsPerLevel,
              difficulty
            ),
            formatEnemyStats(enemy)
          );
          if (enemy.hp <= 0) {
            player.score += Math.floor(Math.random() * 5) + 5;
            appendLog(layout, `Defeated ${enemy.name}! +score`);
            return true;
          }
        } else if (key === "d") {
          if (player.dodge()) {
            appendLog(layout, "Dodged!");
            return runCombat();
          }
          appendLog(layout, "Dodge failed!");
        } else if (key === "p") {
          if (player.heal()) appendLog(layout, "Potion: +5 HP");
          else appendLog(layout, "No potions!");
          setStats(
            layout,
            formatStatus(
              player,
              currentLevel,
              roomsExplored,
              difficulty.roomsPerLevel,
              difficulty
            ),
            formatEnemyStats(enemy)
          );
        } else if (
          key === "m" &&
          player.characterClass.name === "Mage" &&
          player.mana > 0
        ) {
          const dmg =
            player.characterClass.magicPower + Math.floor(Math.random() * 2);
          enemy.hp -= dmg;
          player.mana--;
          appendLog(layout, `Magic Missile: ${dmg} damage`);
          setStats(
            layout,
            formatStatus(
              player,
              currentLevel,
              roomsExplored,
              difficulty.roomsPerLevel,
              difficulty
            ),
            formatEnemyStats(enemy)
          );
          if (enemy.hp <= 0) {
            player.score += Math.floor(Math.random() * 5) + 5;
            appendLog(layout, `Defeated ${enemy.name}!`);
            return true;
          }
        }

        const er = enemy.attack(player);
        appendLog(
          layout,
          `${enemy.name} hits for ${er.damage}${er.blocked ? " (blocked)" : ""}`
        );
        if (player.hp <= 0) {
          outcomeRef.value = "defeat";
          return false;
        }
        setStats(
          layout,
          formatStatus(
            player,
            currentLevel,
            roomsExplored,
            difficulty.roomsPerLevel,
            difficulty
          ),
          formatEnemyStats(enemy)
        );
        return runCombat();
      };

      const combatDone = await runCombat();
      if (!combatDone) {
        if (player.hp <= 0) return;
        setMainContent(layout, "Fled! [S]ave to slot [Q]uit without saving");
        layout.screen.render();
        const q = await waitForKey(screen, ["s", "q", "escape"]);
        if (q === "s") {
          const { showSaveMenu } = await import("./ui/menus");
          const slot = await showSaveMenu(screen, `${player.characterClass.name} Lv${currentLevel}`);
          if (slot) {
            doSave(slot);
            lastSaveSlot = slot;
            outcomeRef.value = "saved";
          }
        }
        return;
      }
      return nextTurn();
    }

    if (roomType < 0.7) {
      const treasure = TREASURES[Math.floor(Math.random() * TREASURES.length)];
      if (treasure.includes("Potion")) player.potions++;
      if (treasure.includes("Dagger")) player.atk += 2;
      if (treasure.includes("Shield")) player.def += 2;
      if (treasure.includes("Amulet")) {
        player.atk += 1;
        player.def += 1;
      }
      player.score += 5;
      setMainContent(layout, `You found: ${treasure}\n\nPress any key to continue.`);
      appendLog(layout, `Found ${treasure}`);
      await waitForKey(screen, ["escape", "enter", " "]);
      return nextTurn();
    }

    if (roomType < 0.85) {
      const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      if (event.includes("Trap")) {
        player.hp -= 2;
        setMainContent(layout, `Event: ${event}\n\nPress any key to continue.`);
        appendLog(layout, `Event: ${event}`);
      } else if (event.includes("Shrine")) {
        player.hp += 3;
        setMainContent(layout, `Event: ${event}\n\nPress any key to continue.`);
        appendLog(layout, `Event: ${event}`);
      } else if (event.includes("Puzzle")) {
        const puzzle = getRandomPuzzle();
        setMainContent(layout, `{bold}Puzzle Room!{/}\n\n${puzzle.question}\n\nEnter your answer:`);
        setStats(layout, formatStatus(player, currentLevel, roomsExplored, difficulty.roomsPerLevel, difficulty));
        layout.screen.render();
        const answer = await askText(screen, "Your answer:", "");
        if (checkAnswer(puzzle, answer)) {
          player.score += puzzle.reward.score;
          if (puzzle.reward.potion) player.potions++;
          setMainContent(layout, `{green-fg}Correct!{/} +${puzzle.reward.score} score${puzzle.reward.potion ? ", +1 potion" : ""}\n\nPress any key to continue.`);
          appendLog(layout, `Puzzle solved! +${puzzle.reward.score}`);
        } else {
          player.hp = Math.max(0, player.hp - puzzle.penalty.hp);
          setMainContent(layout, `{red-fg}Wrong!{/} A trap activates. -${puzzle.penalty.hp} HP\n\nPress any key to continue.`);
          appendLog(layout, `Puzzle failed! -${puzzle.penalty.hp} HP`);
        }
      } else {
        setMainContent(layout, `Event: ${event}\n\nPress any key to continue.`);
        appendLog(layout, `Event: ${event}`);
      }
      await waitForKey(screen, ["escape", "enter", " "]);
      return nextTurn();
    }

    {
      setMainContent(layout, "You found a Merchant!\n[1] Potion [2] +1 ATK [3] +1 DEF [4] Leave\nPick 1-4:");
      layout.screen.render();
      const k = await waitForKey(screen, ["1", "2", "3", "4"]);
      if (k === "1") player.potions++;
      if (k === "2") player.atk += 1;
      if (k === "3") player.def += 1;
      const msg = k === "4" ? "You leave without buying." : "You trade with the merchant.";
      setMainContent(layout, `${msg}\n\nPress any key to continue.`);
      await waitForKey(screen, ["escape", "enter", " "]);
      return nextTurn();
    }
  };

  try {
    await nextTurn();
    const finalOutcome = outcomeRef.value;
    if (finalOutcome === "defeat") {
      await playCutscene(screen, DEFEAT_FRAMES);
    }
    return finalOutcome;
  } finally {
    layout.header.destroy();
    layout.main.destroy();
    layout.stats.destroy();
    layout.log.destroy();
    layout.footer.destroy();
    screen.render();
  }
}
