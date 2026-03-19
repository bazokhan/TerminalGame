#!/usr/bin/env ts-node

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { WorldMap, TileType, handleMovementInput, displayMapLegend } from './worldMap';

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

// Player class for the open world version
class Player {
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
  
  heal(amount: number): number {
    const oldHp = this.hp;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    return this.hp - oldHp;
  }
  
  usePotion(): boolean {
    if (this.potions > 0) {
      this.heal(5);
      this.potions--;
      return true;
    }
    return false;
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
function handleExplorationInput(input: string): void {
  const key = input.toLowerCase();
  
  switch (key) {
    case 'w':
    case 'a':
    case 's':
    case 'd':
    case 'arrowup':
    case 'arrowdown':
    case 'arrowleft':
    case 'arrowright':
      // Handle movement
      const result = handleMovementInput(key, gameState.worldMap);
      if (result.moved) {
        gameState.message = result.message;
        gameState.turns++;
        
        // Random encounter check (10% chance per move)
        if (Math.random() < 0.1) {
          triggerRandomEncounter();
        }
      } else {
        gameState.message = result.message;
      }
      break;
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
  
  // Continue the game loop
  gameLoop();
}

// Trigger a random encounter
function triggerRandomEncounter(): void {
  const encounterType = Math.random();
  
  if (encounterType < 0.6) {
    // Enemy encounter (will be implemented later)
    gameState.message = "You encountered an enemy! (Combat not yet implemented)";
  } else if (encounterType < 0.8) {
    // Find treasure
    const gold = Math.floor(Math.random() * 10) + 1;
    gameState.player.gold += gold;
    gameState.player.score += gold;
    gameState.message = `You found a small treasure chest with ${gold} gold!`;
  } else {
    // Find a potion
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
        handleExplorationInput(input);
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