#!/usr/bin/env ts-node

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { WorldMap, TileType, handleMovementInput, displayMapLegend } from "./worldMap";
import {
  CombatEnemy,
  runCombatReadline,
  ENEMIES,
  type ICombatPlayer,
} from "./combat";

// Terminal colors
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

// File paths
const SAVE_FILE = "world_save.json";

// Character class system (reusing from original Mini Rogue)
interface CharacterClass {
  name: string;
  description: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  specialAbility: string;
  criticalChance: number;
  dodgeChance: number;
  magicPower: number;
}

const CHARACTER_CLASSES: Record<string, CharacterClass> = {
  warrior: {
    name: "Warrior",
    description: "High HP and defense, but lower dodge chance",
    baseHp: 12,
    baseAtk: 2,
    baseDef: 2,
    specialAbility: "Block (25% chance to reduce damage by half)",
    criticalChance: 0.15,
    dodgeChance: 0.3,
    magicPower: 0
  },
  rogue: {
    name: "Rogue",
    description: "High dodge chance and critical hits, but lower HP",
    baseHp: 8,
    baseAtk: 3,
    baseDef: 1,
    specialAbility: "Backstab (35% chance for critical hit)",
    criticalChance: 0.35,
    dodgeChance: 0.6,
    magicPower: 0
  },
  mage: {
    name: "Mage",
    description: "Can cast Magic Missile, but has lower HP and defense",
    baseHp: 7,
    baseAtk: 1,
    baseDef: 1,
    specialAbility: "Magic Missile (ignores enemy defense)",
    criticalChance: 0.2,
    dodgeChance: 0.4, 
    magicPower: 3
  }
};

interface PlayerSaveData {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions: number;
  score: number;
  gold: number;
  characterClassName: string;
  mana: number;
  level: number;
  exp: number;
  expToNextLevel: number;
  inventory: string[];
}

// Player class for the open world version (implements ICombatPlayer for combat)
class Player implements ICombatPlayer {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions = 1;
  score = 0;
  gold = 0;
  characterClass: CharacterClass;
  mana = 0;
  level = 1;
  exp = 0;
  expToNextLevel = 100;
  inventory: string[] = [];
  status = { poisoned: 0, cursed: 0, atkModifier: 0 };

  constructor(characterClass: CharacterClass) {
    this.characterClass = characterClass;
    this.maxHp = characterClass.baseHp;
    this.hp = this.maxHp;
    this.atk = characterClass.baseAtk;
    this.def = characterClass.baseDef;
    
    // Mage gets mana
    if (characterClass.name === "Mage") {
      this.mana = 3;
    }
  }
  
  restoreHp(amount: number): number {
    const oldHp = this.hp;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    return this.hp - oldHp;
  }

  usePotion(): boolean {
    if (this.potions > 0) {
      this.restoreHp(5);
      this.potions--;
      return true;
    }
    return false;
  }

  getEffectiveAttack(): number {
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

  attack(enemy: CombatEnemy): { damage: number; isCritical: boolean } {
    const isCritical = Math.random() < this.characterClass.criticalChance;
    let damage = Math.max(this.getEffectiveAttack() - enemy.def, 1);
    if (
      this.characterClass.name === "Mage" &&
      this.mana > 0 &&
      Math.random() < 0.7
    ) {
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
    return this.usePotion();
  }

  dealDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }
  
  gainExp(amount: number): boolean {
    this.exp += amount;
    
    // Check for level up
    if (this.exp >= this.expToNextLevel) {
      this.levelUp();
      return true;
    }
    
    return false;
  }
  
  levelUp(): void {
    this.level++;
    this.exp -= this.expToNextLevel;
    this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
    
    // Increase stats
    this.maxHp += 2;
    this.hp = this.maxHp;
    this.atk += 1;
    this.def += 1;
    
    // Class-specific bonuses
    if (this.characterClass.name === "Warrior") {
      this.maxHp += 1;
      this.hp = this.maxHp;
    } else if (this.characterClass.name === "Rogue") {
      this.atk += 1;
    } else if (this.characterClass.name === "Mage") {
      this.mana += 1;
    }
  }
  
  addToInventory(item: string): void {
    this.inventory.push(item);
  }
  
  serialize(): PlayerSaveData {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      atk: this.atk,
      def: this.def,
      potions: this.potions,
      score: this.score,
      gold: this.gold,
      characterClassName: this.characterClass.name,
      mana: this.mana,
      level: this.level,
      exp: this.exp,
      expToNextLevel: this.expToNextLevel,
      inventory: this.inventory
    };
  }
  
  static deserialize(data: PlayerSaveData, classes: Record<string, CharacterClass>): Player {
    const characterClass = Object.values(classes).find(
      cls => cls.name === data.characterClassName
    ) || classes.warrior;
    
    const player = new Player(characterClass);
    player.hp = data.hp;
    player.maxHp = data.maxHp;
    player.atk = data.atk;
    player.def = data.def;
    player.potions = data.potions;
    player.score = data.score;
    player.gold = data.gold;
    player.mana = data.mana;
    player.level = data.level;
    player.exp = data.exp;
    player.expToNextLevel = data.expToNextLevel;
    player.inventory = data.inventory;
    
    return player;
  }
}

// Game state
interface GameState {
  player: Player;
  worldMap: WorldMap;
  turns: number;
  gameMode: 'explore' | 'combat' | 'town' | 'dungeon' | 'shop';
  currentEnemy?: { name: string; hp: number; atk: number; def: number };
  message: string;
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ASCII Art for title
const TITLE_ART = `
   __  __ _       _   ____
  |  \\/  (_)_ __ (_) |  _ \\ ___   __ _ _   _  ___
  | |\\/| | | '_ \\| | | |_) / _ \\ / _\` | | | |/ _ \\
  | |  | | | | | | | |  _ < (_) | (_| | |_| |  __/
  |_|  |_|_|_| |_|_| |_| \\_\\___/ \\__, |\\__,_|\\___|
                                 |_|
  ═══════════════ OPEN WORLD EDITION ═══════════════
`;

// Main game state
let gameState: GameState;

// Clear the console
function clearScreen(): void {
  console.clear();
}

// Display player stats
function displayPlayerStats(): void {
  const player = gameState.player;
  
  // Calculate HP bar
  const hpPercentage = Math.min(player.hp / player.maxHp, 1);
  const filledSegments = Math.floor(hpPercentage * 10);
  const emptySegments = 10 - filledSegments;
  const hpBar = "█".repeat(filledSegments) + "░".repeat(emptySegments);
  
  // Calculate EXP bar
  const expPercentage = player.exp / player.expToNextLevel;
  const expFilledSegments = Math.floor(expPercentage * 10);
  const expEmptySegments = 10 - expFilledSegments;
  const expBar = "█".repeat(expFilledSegments) + "░".repeat(expEmptySegments);
  
  console.log(`\n${COLORS.bright}╔════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} ${COLORS.cyan}Level:${COLORS.reset} ${player.level} | ${COLORS.yellow}Gold:${COLORS.reset} ${player.gold} | ${COLORS.green}Score:${COLORS.reset} ${player.score} ${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} ${COLORS.red}HP:${COLORS.reset} [${COLORS.red}${hpBar}${COLORS.reset}] ${player.hp}/${player.maxHp} | ${COLORS.yellow}Potions:${COLORS.reset} ${player.potions} ${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} ${COLORS.blue}EXP:${COLORS.reset} [${COLORS.blue}${expBar}${COLORS.reset}] ${player.exp}/${player.expToNextLevel} ${COLORS.bright}║${COLORS.reset}`);
  
  // Class-specific stats
  let classInfo = `${COLORS.bright}║${COLORS.reset} ${COLORS.magenta}Class:${COLORS.reset} ${player.characterClass.name} | ${COLORS.cyan}ATK:${COLORS.reset} ${player.atk} | ${COLORS.green}DEF:${COLORS.reset} ${player.def} `;
  
  // Add class-specific info
  if (player.characterClass.name === "Mage") {
    classInfo += `| ${COLORS.blue}Mana:${COLORS.reset} ${player.mana} `;
  }
  
  // Padding to make it align with top line
  const padLength = 47 - classInfo.replace(/\x1b\[\d+m/g, '').length;
  classInfo += ' '.repeat(padLength) + `${COLORS.bright}║${COLORS.reset}`;
  
  console.log(classInfo);
  console.log(`${COLORS.bright}╚════════════════════════════════════════════════════╝${COLORS.reset}`);
}

// Display the game screen for exploration mode
function displayExplorationMode(): void {
  clearScreen();
  console.log(`${COLORS.cyan}${TITLE_ART}${COLORS.reset}`);
  
  // Show map and player info
  console.log(gameState.worldMap.render());
  displayPlayerStats();
  
  // Show the last message
  console.log(`\n${COLORS.yellow}${gameState.message}${COLORS.reset}`);
  
  // Show available commands
  console.log(`\n${COLORS.cyan}Commands:${COLORS.reset}`);
  console.log(`${COLORS.bright}[W/A/S/D]${COLORS.reset} - Move | ${COLORS.bright}[I]${COLORS.reset}nventory | ${COLORS.bright}[P]${COLORS.reset}otion | ${COLORS.bright}[L]${COLORS.reset}egend | ${COLORS.bright}[H]${COLORS.reset}elp | ${COLORS.bright}[S]${COLORS.reset}ave | ${COLORS.bright}[Q]${COLORS.reset}uit`);
}

// Handle exploration mode input
async function handleExplorationInput(input: string): Promise<void> {
  const key = input.toLowerCase();

  switch (key) {
    case "w":
    case "a":
    case "s":
    case "d":
    case "arrowup":
    case "arrowdown":
    case "arrowleft":
    case "arrowright": {
      const result = handleMovementInput(key, gameState.worldMap);
      if (result.moved) {
        gameState.message = result.message;
        gameState.turns++;

        if (
          result.tileType === TileType.TOWN ||
          result.tileType === TileType.MERCHANT
        ) {
          await runTownShop();
        } else if (result.tileType === TileType.DUNGEON) {
          await runMiniDungeon();
        } else if (Math.random() < 0.1) {
          await triggerRandomEncounter();
        }
      } else {
        gameState.message = result.message;
      }
      break;
    }
    case 'i':
      // Show inventory
      if (gameState.player.inventory.length === 0) {
        gameState.message = "Your inventory is empty.";
      } else {
        gameState.message = "Inventory: " + gameState.player.inventory.join(", ");
      }
      break;
    case 'p':
      // Use potion
      if (gameState.player.usePotion()) {
        gameState.message = "You drank a health potion and recovered 5 HP.";
      } else {
        gameState.message = "You don't have any potions left.";
      }
      break;
    case 'l':
      // Show map legend
      gameState.message = displayMapLegend();
      break;
    case 'h':
      // Show help
      gameState.message = getHelpText();
      break;
    case 's':
      // Save game
      saveGame();
      gameState.message = "Game saved successfully!";
      break;
    case 'q':
      // Quit game
      rl.question(`\n${COLORS.yellow}Save before quitting? [Y/N]: ${COLORS.reset}`, (answer) => {
        if (answer.toLowerCase() === 'y') {
          saveGame();
          console.log(`${COLORS.green}Game saved successfully!${COLORS.reset}`);
        }
        console.log(`${COLORS.yellow}Thanks for playing Mini Rogue Open World!${COLORS.reset}`);
        rl.close();
        process.exit(0);
      });
      return;
    default:
      gameState.message = "Unknown command. Press H for help.";
  }

  gameLoop();
}

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function runTownShop(): Promise<void> {
  const prices = { potion: 10, atk: 25, def: 25 };
  clearScreen();
  console.log(`${COLORS.cyan}=== TOWN SHOP ===${COLORS.reset}\n`);
  console.log(`Gold: ${gameState.player.gold}\n`);
  console.log(`[1] Health Potion - ${prices.potion} gold`);
  console.log(`[2] Sharpening Stone (+1 ATK) - ${prices.atk} gold`);
  console.log(`[3] Leather Padding (+1 DEF) - ${prices.def} gold`);
  console.log(`[4] Leave shop\n`);

  const choice = await question("Your choice [1-4]: ");
  if (choice === "1" && gameState.player.gold >= prices.potion) {
    gameState.player.gold -= prices.potion;
    gameState.player.potions++;
    gameState.message = "You bought a health potion.";
  } else if (choice === "2" && gameState.player.gold >= prices.atk) {
    gameState.player.gold -= prices.atk;
    gameState.player.atk++;
    gameState.message = "You bought a sharpening stone. ATK +1";
  } else if (choice === "3" && gameState.player.gold >= prices.def) {
    gameState.player.gold -= prices.def;
    gameState.player.def++;
    gameState.message = "You bought leather padding. DEF +1";
  } else if (choice !== "4") {
    gameState.message = "Not enough gold or invalid choice.";
  }
}

async function runMiniDungeon(): Promise<void> {
  clearScreen();
  console.log(
    `${COLORS.red}You enter the dungeon...${COLORS.reset}\n`
  );

  const difficulty = { enemyBonus: Math.floor(gameState.player.level / 2) };
  const rooms = 2 + Math.floor(Math.random() * 2);

  for (let r = 0; r < rooms; r++) {
    if (gameState.player.hp <= 0) break;

    const roomType = Math.random();
    if (roomType < 0.6) {
      const enemyName = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
      const levelScaling = gameState.player.level * 0.5;
      const enemy = new CombatEnemy(enemyName, difficulty, levelScaling);
      console.log(`\n${COLORS.red}Room ${r + 1}: A ${enemy.name} blocks your path!${COLORS.reset}\n`);
      const { victory } = await runCombatReadline(
        gameState.player,
        enemy,
        rl,
        difficulty
      );
      if (!victory) {
        if (gameState.player.hp <= 0) {
          console.log(`\n${COLORS.red}You have fallen in the dungeon...${COLORS.reset}`);
          process.exit(0);
        }
        gameState.message = "You fled the dungeon.";
        return;
      }
      const gold = Math.floor(Math.random() * 20) + 10;
      gameState.player.gold += gold;
      gameState.player.gainExp(Math.floor(Math.random() * 30) + 15);
      console.log(`\n${COLORS.green}+${gold} gold!${COLORS.reset}`);
    } else {
      const gold = Math.floor(Math.random() * 15) + 5;
      gameState.player.gold += gold;
      gameState.player.potions += 1;
      console.log(
        `\n${COLORS.yellow}Room ${r + 1}: You found treasure! +${gold} gold, +1 potion${COLORS.reset}`
      );
    }
  }

  gameState.message = "You conquered the dungeon and returned to the overworld!";
}

// Trigger a random encounter (async for combat)
async function triggerRandomEncounter(): Promise<void> {
  const encounterType = Math.random();

  if (encounterType < 0.6) {
    const enemyName = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const levelScaling = (gameState.player.level - 1) * 0.5;
    const difficulty = { enemyBonus: Math.floor(gameState.player.level / 2) };
    const enemy = new CombatEnemy(enemyName, difficulty, levelScaling);

    console.log(
      `\n${COLORS.red}A wild ${enemy.name} appears!${COLORS.reset} Prepare for battle!\n`
    );

    const { victory } = await runCombatReadline(
      gameState.player,
      enemy,
      rl,
      difficulty
    );

    if (victory) {
      const gold = Math.floor(Math.random() * 15) + 5;
      const exp = Math.floor(Math.random() * 20) + 10;
      gameState.player.gold += gold;
      gameState.player.score += gold;
      gameState.player.gainExp(exp);
      gameState.message = `You defeated the ${enemy.name}! +${gold} gold, +${exp} exp`;
    } else {
      if (gameState.player.hp <= 0) {
        console.log(`\n${COLORS.red}You have fallen...${COLORS.reset}`);
        process.exit(0);
      }
      gameState.message = "You fled from the enemy.";
    }
  } else if (encounterType < 0.8) {
    const gold = Math.floor(Math.random() * 10) + 1;
    gameState.player.gold += gold;
    gameState.player.score += gold;
    gameState.message = `You found a small treasure chest with ${gold} gold!`;
  } else {
    gameState.player.potions += 1;
    gameState.message = "You found a health potion!";
  }
}

// Get help text
function getHelpText(): string {
  return `
${COLORS.bright}MINI ROGUE: OPEN WORLD - HELP${COLORS.reset}

${COLORS.cyan}Movement:${COLORS.reset}
- Use ${COLORS.bright}W${COLORS.reset}/${COLORS.bright}A${COLORS.reset}/${COLORS.bright}S${COLORS.reset}/${COLORS.bright}D${COLORS.reset} or arrow keys to move around the map

${COLORS.cyan}Commands:${COLORS.reset}
- ${COLORS.bright}I${COLORS.reset}: View your inventory
- ${COLORS.bright}P${COLORS.reset}: Use a health potion to restore 5 HP
- ${COLORS.bright}L${COLORS.reset}: Display the map legend
- ${COLORS.bright}H${COLORS.reset}: Show this help screen
- ${COLORS.bright}S${COLORS.reset}: Save your game
- ${COLORS.bright}Q${COLORS.reset}: Quit the game

${COLORS.cyan}World Locations:${COLORS.reset}
- ${COLORS.bright}Towns (T)${COLORS.reset}: Safe locations with shops and inns
- ${COLORS.bright}Dungeons (D)${COLORS.reset}: Dangerous areas with powerful enemies and rewards
- ${COLORS.bright}Merchants (M)${COLORS.reset}: Characters who will trade with you

${COLORS.cyan}Game Goal:${COLORS.reset}
Explore the world, defeat enemies, discover treasures, and become a legendary hero!
`;
}

// Choose character class
function chooseClass(): void {
  clearScreen();
  console.log(COLORS.cyan + TITLE_ART + COLORS.reset);
  console.log(`${COLORS.bright}Choose your character class:${COLORS.reset}\n`);
  
  // Display class options
  console.log(`${COLORS.yellow}[1] Warrior${COLORS.reset} - ${CHARACTER_CLASSES.warrior.description}`);
  console.log(`${COLORS.green}[2] Rogue${COLORS.reset} - ${CHARACTER_CLASSES.rogue.description}`);
  console.log(`${COLORS.blue}[3] Mage${COLORS.reset} - ${CHARACTER_CLASSES.mage.description}`);
  
  rl.question(`\n${COLORS.cyan}Select your class [1-3]: ${COLORS.reset}`, (choice) => {
    let characterClass: CharacterClass;
    
    switch (choice) {
      case '1':
        characterClass = CHARACTER_CLASSES.warrior;
        break;
      case '2':
        characterClass = CHARACTER_CLASSES.rogue;
        break;
      case '3':
        characterClass = CHARACTER_CLASSES.mage;
        break;
      default:
        console.log(`${COLORS.red}Invalid choice. Please try again.${COLORS.reset}`);
        rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
          chooseClass();
        });
        return;
    }
    
    // Create the player and start the game
    gameState = {
      player: new Player(characterClass),
      worldMap: new WorldMap(20, 12), // Create a 20x12 world map
      turns: 0,
      gameMode: 'explore',
      message: `Welcome, brave ${characterClass.name}! Use WASD or arrow keys to move.`
    };
    
    gameLoop();
  });
}

// Main game loop
function gameLoop(): void {
  switch (gameState.gameMode) {
    case 'explore':
      displayExplorationMode();
      rl.question("Your action: ", (input) => {
        void handleExplorationInput(input);
      });
      break;
    // Other game modes (combat, town, etc.) will be implemented later
    default:
      gameState.gameMode = 'explore';
      gameLoop();
  }
}

// Save the game
function saveGame(): void {
  try {
    const data = {
      player: gameState.player.serialize(),
      worldMap: gameState.worldMap.serialize(),
      turns: gameState.turns,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving game:', err);
  }
}

// Load a saved game
function loadGame(): boolean {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      
      gameState = {
        player: Player.deserialize(data.player, CHARACTER_CLASSES),
        worldMap: WorldMap.deserialize(data.worldMap),
        turns: data.turns,
        gameMode: 'explore',
        message: "Welcome back to your adventure!"
      };
      
      return true;
    }
  } catch (err) {
    console.error('Error loading game:', err);
  }
  
  return false;
}

// Ask if player wants to start a new game or load a saved one
function startGame(): void {
  clearScreen();
  console.log(COLORS.cyan + TITLE_ART + COLORS.reset);
  
  if (fs.existsSync(SAVE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      console.log(`${COLORS.green}Found a saved game from: ${new Date(data.timestamp).toLocaleString()}${COLORS.reset}`);
      console.log(`Character: ${data.player.characterClassName} | Level: ${data.player.level} | Gold: ${data.player.gold}`);
      
      rl.question(`\n${COLORS.cyan}Would you like to continue your saved game? [Y/N]: ${COLORS.reset}`, (answer) => {
        if (answer.toLowerCase() === 'y') {
          if (loadGame()) {
            gameLoop();
          } else {
            console.log(`${COLORS.red}Error loading game. Starting a new game...${COLORS.reset}`);
            chooseClass();
          }
        } else {
          chooseClass();
        }
      });
    } catch (err) {
      console.error('Error reading save file:', err);
      chooseClass();
    }
  } else {
    // No save file found, start a new game
    chooseClass();
  }
}

// Start the game when the script is run
startGame(); 