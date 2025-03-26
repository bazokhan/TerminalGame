#!/usr/bin/env ts-node

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// Game setup
const ENEMIES = ["Goblin", "Skeleton", "Orc", "Bandit", "Slime", "Troll", "Witch"];
const TREASURES = ["Health Potion", "Dagger (+2 ATK)", "Shield (+2 DEF)", "Magic Amulet (+1 ATK, +1 DEF)"];
const EVENTS = ["Trap (-2 HP)", "Mysterious Shrine (+3 HP)", "Empty Room", "Puzzle Room (+5 Score)"];
const HIGH_SCORE_FILE = "high_scores.json";

// Difficulty settings
interface DifficultyLevel {
  name: string;
  maxTurns: number;
  enemyBonus: number;
  startingPotions: number;
  scoreMultiplier: number;
}

const DIFFICULTIES: Record<string, DifficultyLevel> = {
  easy: {
    name: "Easy",
    maxTurns: 8,
    enemyBonus: 0,
    startingPotions: 2,
    scoreMultiplier: 0.8
  },
  normal: {
    name: "Normal",
    maxTurns: 10,
    enemyBonus: 1,
    startingPotions: 1,
    scoreMultiplier: 1.0
  },
  hard: {
    name: "Hard",
    maxTurns: 12,
    enemyBonus: 2,
    startingPotions: 1,
    scoreMultiplier: 1.5
  }
};

// Default to normal difficulty
let currentDifficulty: DifficultyLevel = DIFFICULTIES.normal;

// Sound effects
function playSound(type: 'attack' | 'critical' | 'heal' | 'victory' | 'defeat') {
  // This would actually use console.beep() in a proper console,
  // but we'll use a visual indicator instead
  switch (type) {
    case 'attack':
      process.stdout.write('\x07'); // Bell character
      break;
    case 'critical':
      process.stdout.write('\x07\x07'); // Double bell
      break;
    case 'heal':
      process.stdout.write('\x07'); 
      break;
    case 'victory':
      process.stdout.write('\x07\x07\x07'); // Triple bell
      break;
    case 'defeat':
      process.stdout.write('\x07'); 
      break;
  }
}

// High Score system
interface HighScore {
  name: string;
  score: number;
  date: string;
}

let highScores: HighScore[] = [];

// Load high scores from file
function loadHighScores(): HighScore[] {
  try {
    if (fs.existsSync(HIGH_SCORE_FILE)) {
      const data = fs.readFileSync(HIGH_SCORE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading high scores:', err);
  }
  return [];
}

// Save high scores to file
function saveHighScore(name: string, score: number) {
  try {
    highScores.push({
      name,
      score,
      date: new Date().toISOString().split('T')[0]
    });
    
    // Sort by score (highest first) and keep only top 10
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) {
      highScores = highScores.slice(0, 10);
    }
    
    fs.writeFileSync(HIGH_SCORE_FILE, JSON.stringify(highScores, null, 2));
  } catch (err) {
    console.error('Error saving high score:', err);
  }
}

// Display high scores
function displayHighScores() {
  console.log(`\n${COLORS.yellow}╔══════════ HIGH SCORES ══════════╗${COLORS.reset}`);
  
  if (highScores.length === 0) {
    console.log(`${COLORS.yellow}║${COLORS.reset}        No scores yet!         ${COLORS.yellow}║${COLORS.reset}`);
  } else {
    console.log(`${COLORS.yellow}║${COLORS.reset} RANK  NAME           SCORE    ${COLORS.yellow}║${COLORS.reset}`);
    console.log(`${COLORS.yellow}║${COLORS.reset}──────────────────────────────${COLORS.yellow}║${COLORS.reset}`);
    
    highScores.slice(0, 10).forEach((score, index) => {
      const rank = `${index + 1}`.padEnd(5);
      const name = score.name.slice(0, 14).padEnd(15);
      const scoreStr = `${score.score}`.padStart(8);
      console.log(`${COLORS.yellow}║${COLORS.reset} ${rank}${name}${scoreStr}    ${COLORS.yellow}║${COLORS.reset}`);
    });
  }
  
  console.log(`${COLORS.yellow}╚══════════════════════════════╝${COLORS.reset}`);
}

// Load high scores at the start
highScores = loadHighScores();

// ASCII Art
const ASCII_ART: Record<string, string> = {
  title: `
   __  __ _       _   ____                        
  |  \\/  (_)_ __ (_) |  _ \\ ___   __ _ _   _  ___ 
  | |\\/| | | '_ \\| | | |_) / _ \\ / _\` | | | |/ _ \\
  | |  | | | | | | | |  _ < (_) | (_| | |_| |  __/
  |_|  |_|_|_| |_|_| |_| \\_\\___/ \\__, |\\__,_|\\___|
                                     |_|           
  `,
  goblin: `   ,      ,
  /(.-""-.)\\ 
 |\\  \\/  /| 
 | \\ () / |
  \\ \`-.-\` /
   \`._.\`   `,
  skeleton: `
     .-.
    (o.o)
     |\`|
     | |
    /   \\
    |___|`,
  orc: `
   _____
  |     |
  | O O |
  |  >  |
  |_____|
  //   \\\\
 //     \\\\`,
  witch: `
    /\\
   /  \\
  |\\  /|
  | \\/ |
  /____\\
 ( -  - )
  \`-==-'`,
  troll: `
   _____
  /     \\
 | O   O |
 |   ∆   |
  \\_www_/
  /|   |\\
 / |___| \\`,
  victory: `
   \\o/   YOU SURVIVED!   \\o/
    |           
   / \\          
  `,
  defeat: `
    +---+
    |   |
    O   |   GAME OVER!
   /|\\  |
   / \\  |
        |
  =======
  `,
  help: `
  ╔══════════════════════════════════════════════════╗
  ║                   GAME COMMANDS                  ║
  ╠══════════════════════════════════════════════════╣
  ║ [A] - Attack the enemy                           ║
  ║ [D] - Try to dodge the enemy's attack            ║
  ║ [P] - Use a potion to restore 5 HP               ║
  ║ [Q] - Quit the current game                      ║
  ║ [H] - Show this help screen during combat        ║
  ╚══════════════════════════════════════════════════╝
`
};

// ANSI color codes
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

class Player {
  hp = 10;
  maxHp = 10;
  atk = 2;
  def = 1;
  potions = 1;
  score = 0;

  constructor(difficulty: DifficultyLevel) {
    this.potions = difficulty.startingPotions;
  }

  attack(enemy: Enemy) {
    // Critical hit system (20% chance)
    const isCritical = Math.random() < 0.2;
    let damage = Math.max(this.atk - enemy.def, 1);
    
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
      playSound('critical');
    } else {
      playSound('attack');
    }
    
    enemy.hp -= damage;
    return { damage, isCritical };
  }

  dodge(): boolean {
    return Math.random() < 0.5; // 50% chance to dodge
  }

  heal() {
    if (this.potions > 0) {
      this.hp = Math.min(this.hp + 5, this.maxHp);
      this.potions--;
      playSound('heal');
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

  constructor(name: string, difficulty: DifficultyLevel) {
    this.name = name;
    this.hp = Math.floor(Math.random() * 5) + 3 + difficulty.enemyBonus;
    this.atk = Math.floor(Math.random() * 3) + 1 + Math.floor(difficulty.enemyBonus / 2);
    this.def = Math.floor(Math.random() * 2) + Math.floor(difficulty.enemyBonus / 3);
    
    // Make later enemies tougher
    if (turns > currentDifficulty.maxTurns / 2) {
      this.hp += 2;
      this.atk += 1;
    }
  }

  attack(player: Player) {
    // Enemy critical hit (10% chance)
    const isCritical = Math.random() < 0.1;
    let damage = Math.max(this.atk - player.def, 1);
    
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }
    
    player.hp -= damage;
    // Ensure HP doesn't go below 0 for cleaner game state
    player.hp = Math.max(0, player.hp);
    
    return { damage, isCritical };
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let player: Player;
let turns = 0;

// Clear screen
function clearScreen() {
  console.clear();
}

// Display status bar
function displayStatus() {
  // Ensure HP is not negative for display purposes
  const displayHp = Math.max(0, player.hp);
  const hpBar = "█".repeat(Math.floor(displayHp / player.maxHp * 10));
  const emptyBar = "░".repeat(10 - Math.floor(displayHp / player.maxHp * 10));
  
  console.log(`\n${COLORS.bright}╔════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} 🛡️  ${COLORS.cyan}Turn:${COLORS.reset} ${turns}/${currentDifficulty.maxTurns} | ${COLORS.red}HP:${COLORS.reset} [${COLORS.red}${hpBar}${COLORS.reset}${emptyBar}] ${displayHp}/${player.maxHp} | ${COLORS.yellow}Potions:${COLORS.reset} ${player.potions} | ${COLORS.green}Score:${COLORS.reset} ${player.score} ${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.bright}╚════════════════════════════════════════════════════╝${COLORS.reset}`);
}

// Display help screen
function showHelp() {
  console.log(COLORS.cyan + ASCII_ART.help + COLORS.reset);
}

// Game loop
function nextTurn() {
  if (turns >= currentDifficulty.maxTurns || player.hp <= 0) {
    clearScreen();
    const finalScore = Math.floor((player.hp > 0 ? player.score + player.hp * 10 : player.score) * currentDifficulty.scoreMultiplier);
    
    if (player.hp > 0) {
      playSound('victory');
      console.log(COLORS.green + ASCII_ART.victory + COLORS.reset);
      console.log(`${COLORS.bright}🎉 Congratulations! You survived the dungeon!${COLORS.reset}`);
      console.log(`${COLORS.yellow}Final Score: ${finalScore} (${currentDifficulty.name} mode)${COLORS.reset}`);
    } else {
      playSound('defeat');
      console.log(COLORS.red + ASCII_ART.defeat + COLORS.reset);
      console.log(`${COLORS.red}💀 You died in the dungeon...${COLORS.reset}`);
      console.log(`${COLORS.yellow}Final Score: ${finalScore} (${currentDifficulty.name} mode)${COLORS.reset}`);
    }
    
    // Only ask for name if score is greater than 0
    if (finalScore > 0) {
      rl.question(`\n${COLORS.cyan}Enter your name for the high score: ${COLORS.reset}`, (name) => {
        // Default to "Adventurer" if no name provided
        saveHighScore(name || "Adventurer", finalScore);
        displayHighScores();
        askToPlayAgain();
      });
    } else {
      displayHighScores();
      askToPlayAgain();
    }
    return;
  }

  turns++;
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  displayStatus();

  const roomType = Math.random();
  if (roomType < 0.45) {
    // Enemy encounter
    const enemy = new Enemy(
      ENEMIES[Math.floor(Math.random() * ENEMIES.length)],
      currentDifficulty
    );
    console.log(
      `\n${COLORS.red}⚔️  A wild ${enemy.name} appears!${COLORS.reset} (HP: ${enemy.hp}, ATK: ${enemy.atk}, DEF: ${enemy.def})`
    );
    
    // Show ASCII art for enemies
    const enemyType = enemy.name.toLowerCase();
    if (ASCII_ART[enemyType]) {
      console.log(ASCII_ART[enemyType]);
    }
    
    combat(enemy);
  } else if (roomType < 0.7) {
    // Treasure room
    const treasure = TREASURES[Math.floor(Math.random() * TREASURES.length)];
    console.log(`\n${COLORS.yellow}🎁 You found: ${treasure}${COLORS.reset}`);
    
    if (treasure.includes("Potion")) player.potions++;
    if (treasure.includes("Dagger")) player.atk += 2;
    if (treasure.includes("Shield")) player.def += 2;
    if (treasure.includes("Amulet")) {
      player.atk += 1;
      player.def += 1;
    }
    
    player.score += 5;
    rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
      nextTurn();
    });
  } else if (roomType < 0.85) {
    // Random event
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    console.log(`\n${COLORS.magenta}📜 Event: ${event}${COLORS.reset}`);
    
    if (event.includes("Trap")) player.hp -= 2;
    if (event.includes("Shrine")) player.hp += 3;
    if (event.includes("Puzzle")) {
      player.score += 5;
      console.log(`${COLORS.green}You solved the puzzle and gained 5 points!${COLORS.reset}`);
    }
    
    rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
      nextTurn();
    });
  } else {
    // Shop room (new!)
    console.log(`\n${COLORS.blue}🛒 You found a Merchant!${COLORS.reset}`);
    console.log(`The merchant offers you these items:`);
    console.log(`${COLORS.cyan}[1]${COLORS.reset} Health Potion - Restores 5 HP`);
    console.log(`${COLORS.cyan}[2]${COLORS.reset} Sharpening Stone - +1 ATK`);
    console.log(`${COLORS.cyan}[3]${COLORS.reset} Leather Padding - +1 DEF`);
    console.log(`${COLORS.cyan}[4]${COLORS.reset} Leave the shop`);
    
    rl.question(`\n${COLORS.cyan}What would you like to do? [1-4]: ${COLORS.reset}`, (choice) => {
      switch (choice) {
        case "1":
          player.potions++;
          console.log(`${COLORS.green}You acquired a health potion.${COLORS.reset}`);
          break;
        case "2":
          player.atk += 1;
          console.log(`${COLORS.green}You sharpen your weapon. ATK +1${COLORS.reset}`);
          break;
        case "3":
          player.def += 1;
          console.log(`${COLORS.green}You reinforce your armor. DEF +1${COLORS.reset}`);
          break;
        default:
          console.log(`${COLORS.yellow}You leave the shop without buying anything.${COLORS.reset}`);
      }
      
      rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
        nextTurn();
      });
    });
  }
}

function combat(enemy: Enemy) {
  displayCombatOptions();
  
  function displayCombatOptions() {
    console.log(`\n${COLORS.cyan}What will you do?${COLORS.reset}`);
    console.log(`${COLORS.bright}[A]${COLORS.reset}ttack | ${COLORS.bright}[D]${COLORS.reset}odge | ${COLORS.bright}[P]${COLORS.reset}otion (${player.potions}) | ${COLORS.bright}[H]${COLORS.reset}elp | ${COLORS.bright}[Q]${COLORS.reset}uit`);
  }
  
  rl.question("Your choice: ", (input) => {
    const choice = input.toUpperCase();
    
    if (choice === "A") {
      const result = player.attack(enemy);
      if (result.isCritical) {
        console.log(`${COLORS.yellow}💥 CRITICAL HIT! You hit the ${enemy.name} for ${result.damage} damage.${COLORS.reset}`);
      } else {
        console.log(`${COLORS.green}🗡️  You hit the ${enemy.name} for ${result.damage} damage.${COLORS.reset}`);
      }
      
      if (enemy.hp <= 0) {
        const bonus = Math.floor(Math.random() * 5) + 5;
        player.score += bonus;
        console.log(`${COLORS.green}✅ You defeated the ${enemy.name}!${COLORS.reset}`);
        console.log(`${COLORS.yellow}+${bonus} score points${COLORS.reset}`);
        
        rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
          nextTurn();
        });
        return;
      }
    } else if (choice === "D") {
      if (player.dodge()) {
        console.log(`${COLORS.cyan}💨 You successfully dodged the attack!${COLORS.reset}`);
        combat(enemy);
        return;
      } else {
        console.log(`${COLORS.red}❌ Dodge failed!${COLORS.reset}`);
      }
    } else if (choice === "P") {
      if (player.heal()) {
        console.log(`${COLORS.green}🧪 You drank a potion and restored 5 HP!${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}❌ No potions left!${COLORS.reset}`);
      }
    } else if (choice === "H") {
      showHelp();
      rl.question(`\n${COLORS.cyan}Press [Enter] to return to combat...${COLORS.reset}`, () => {
        combat(enemy);
      });
      return;
    } else if (choice === "Q") {
      console.log(`${COLORS.yellow}👋 You fled the dungeon.${COLORS.reset}`);
      askToPlayAgain();
      return;
    } else {
      console.log(`${COLORS.red}❓ Invalid choice.${COLORS.reset}`);
      combat(enemy);
      return;
    }

    // Enemy's turn
    const enemyResult = enemy.attack(player);
    if (enemyResult.isCritical) {
      console.log(`${COLORS.red}💥 CRITICAL HIT! The ${enemy.name} hits you for ${enemyResult.damage} damage!${COLORS.reset}`);
    } else {
      console.log(`${COLORS.red}👊 The ${enemy.name} hits you for ${enemyResult.damage} damage!${COLORS.reset}`);
    }
    
    if (player.hp <= 0) {
      console.log(`${COLORS.red}💀 You died...${COLORS.reset}`);
      
      rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
        nextTurn();
      });
      return;
    }
    
    displayStatus();
    combat(enemy);
  });
}

function askToPlayAgain() {
  rl.question(`\n${COLORS.cyan}Play again? [Y/N]: ${COLORS.reset}`, (answer) => {
    if (answer.toUpperCase() === 'Y') {
      startGame();
    } else {
      console.log(`${COLORS.yellow}Thanks for playing Mini Rogue!${COLORS.reset}`);
      rl.close();
    }
  });
}

function chooseDifficulty() {
  clearScreen();
  console.log(COLORS.cyan + ASCII_ART.title + COLORS.reset);
  console.log(`${COLORS.bright}Welcome to Mini Rogue! Choose your difficulty:${COLORS.reset}`);
  console.log(`${COLORS.green}[1] Easy${COLORS.reset} - 8 rooms, weaker enemies, 2 starting potions`);
  console.log(`${COLORS.yellow}[2] Normal${COLORS.reset} - 10 rooms, standard enemies, 1 starting potion`);
  console.log(`${COLORS.red}[3] Hard${COLORS.reset} - 12 rooms, stronger enemies, 1 starting potion, 50% score bonus`);
  console.log(`${COLORS.bright}[H] Help${COLORS.reset} - Show game instructions`);
  
  rl.question(`\n${COLORS.cyan}Select difficulty [1-3] or H for help: ${COLORS.reset}`, (choice) => {
    switch (choice.toUpperCase()) {
      case '1':
        currentDifficulty = DIFFICULTIES.easy;
        startAdventure();
        break;
      case '2':
        currentDifficulty = DIFFICULTIES.normal;
        startAdventure();
        break;
      case '3':
        currentDifficulty = DIFFICULTIES.hard;
        startAdventure();
        break;
      case 'H':
        showHelp();
        rl.question(`\n${COLORS.cyan}Press [Enter] to return...${COLORS.reset}`, () => {
          chooseDifficulty();
        });
        break;
      default:
        console.log(`${COLORS.red}Invalid choice. Please try again.${COLORS.reset}`);
        rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
          chooseDifficulty();
        });
    }
  });
}

function startAdventure() {
  // Reset game state
  turns = 0;
  player = new Player(currentDifficulty);
  
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}You've chosen ${currentDifficulty.name} difficulty!${COLORS.reset}`);
  console.log(`${COLORS.yellow}Use keyboard commands to play: [A]ttack, [D]odge, [P]otion, [H]elp, [Q]uit${COLORS.reset}`);
  console.log(`\n${COLORS.bright}Your adventure begins...${COLORS.reset}`);

  rl.question(`\n${COLORS.cyan}Press [Enter] to enter the dungeon...${COLORS.reset}`, () => {
    nextTurn();
  });
}

function startGame() {
  chooseDifficulty();
}

// Start the game
startGame();
