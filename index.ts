#!/usr/bin/env ts-node

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

// Game setup
const ENEMIES = ["Goblin", "Skeleton", "Orc", "Bandit", "Slime", "Troll", "Witch", "Spider", "Vampire", "Dragon"];
const ENEMY_TYPES: Record<string, {ability?: string, description: string}> = {
  "Goblin": {
    description: "Small but agile creature."
  },
  "Skeleton": {
    description: "Undead warrior with brittle bones."
  },
  "Orc": {
    description: "Strong, brutish humanoid."
  },
  "Bandit": {
    description: "Crafty human thief."
  },
  "Slime": {
    description: "Gelatinous creature that's hard to damage."
  },
  "Troll": {
    description: "Giant with regenerative abilities.",
    ability: "Regenerate (recovers 1 HP each turn)"
  },
  "Witch": {
    description: "Spellcaster with dark magic.",
    ability: "Curse (reduces your ATK for one turn)"
  },
  "Spider": {
    description: "Venomous arachnid.",
    ability: "Poison (deals 1 extra damage for 2 turns)"
  },
  "Vampire": {
    description: "Undead blood-drinker.",
    ability: "Lifesteal (heals itself when it damages you)"
  },
  "Dragon": {
    description: "Fearsome fire-breathing beast.",
    ability: "Breath attack (deals extra damage when below half health)"
  }
};
const TREASURES = ["Health Potion", "Dagger (+2 ATK)", "Shield (+2 DEF)", "Magic Amulet (+1 ATK, +1 DEF)"];
const EVENTS = ["Trap (-2 HP)", "Mysterious Shrine (+3 HP)", "Empty Room", "Puzzle Room (+5 Score)"];
const HIGH_SCORE_FILE = "high_scores.json";
const SAVE_FILE = "game_save.json";

// Difficulty settings
interface DifficultyLevel {
  name: string;
  dungeonLevels: number; // Number of dungeon levels to complete
  roomsPerLevel: number; // Number of rooms per level
  enemyBonus: number;
  startingPotions: number;
  scoreMultiplier: number;
}

// Character class system
interface CharacterClass {
  name: string;
  description: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  specialAbility: string;
  // Class-specific stats
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

// Default to warrior class
let currentClass: CharacterClass = CHARACTER_CLASSES.warrior;

const DIFFICULTIES: Record<string, DifficultyLevel> = {
  easy: {
    name: "Easy",
    dungeonLevels: 3,
    roomsPerLevel: 3,
    enemyBonus: 0,
    startingPotions: 2,
    scoreMultiplier: 0.8
  },
  normal: {
    name: "Normal",
    dungeonLevels: 3,
    roomsPerLevel: 4,
    enemyBonus: 1,
    startingPotions: 1,
    scoreMultiplier: 1.0
  },
  hard: {
    name: "Hard",
    dungeonLevels: 4,
    roomsPerLevel: 4,
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
  spider: `
     /\\  /\\
    / \\\\//\\\\
    \\__//\\__/
   /|  (())  |\\
  / |  /  \\  | \\
    \\__/  \\__/
     /      \\`,
  vampire: `
    ,---.
   /     \\
  | () () |
   \\  ^  /
    |||||
   /~   ~\\
  /|\\   /|\\
    ~~~~~`,
  dragon: `
     ^    ^
    / \\  // \\
    \\\\//|\\\\//|
     \\_/||\\_/
       |||
      //\\\\
     //  \\\\
    ||    ||`,
  warrior: `
    _,._
   /_,._,_\\
   |_,-._|
   | \\ / |
   |==@==|
   /|   |\\
  / |___| \\
    """""`,
  rogue: `
     _|_
    / . \\
   |  *  |
   \` -.- '
   /|   |\\
  / |___| \\
    /   \\`,
  mage: `
     /\\
    /  \\
   |\\__/|
   |★★★★|
   \\_||\\_/
   // \\\\ 
  /  |  \\`,
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
  ║ [M] - Cast a spell (Mage only)                   ║
  ║ [H] - Show this help screen during combat        ║
  ║ [S] - Save and quit                              ║
  ║ [Q] - Quit without saving                        ║
  ╠══════════════════════════════════════════════════╣
  ║                  CHARACTER CLASSES               ║
  ╠══════════════════════════════════════════════════╣
  ║ Warrior - High HP & defense, can block damage    ║
  ║ Rogue   - High dodge & critical hit chance       ║
  ║ Mage    - Can cast spells that ignore defense    ║
  ╠══════════════════════════════════════════════════╣
  ║                     SAVE SYSTEM                  ║
  ╠══════════════════════════════════════════════════╣
  ║ Game auto-saves after each room                  ║
  ║ You can manually save and quit with [S]          ║
  ║ Your save will be deleted when you win or die    ║
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

// Save and load system
interface GameSave {
  playerState: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    potions: number;
    score: number;
    mana: number;
    characterClassName: string;
  };
  gameState: {
    currentLevel: number;
    roomsExplored: number;
    difficultyName: string;
  };
  timestamp: string;
}

// Player status effects
interface PlayerStatus {
  poisoned: number; // Number of turns remaining for poison
  cursed: number;   // Number of turns remaining for curse
  atkModifier: number; // Temporary modification to ATK
}

class Player {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions = 1;
  score = 0;
  characterClass: CharacterClass;
  mana = 0; // For mage spells
  status: PlayerStatus = {
    poisoned: 0,
    cursed: 0,
    atkModifier: 0
  };

  constructor(difficulty: DifficultyLevel, characterClass: CharacterClass) {
    this.characterClass = characterClass;
    this.maxHp = characterClass.baseHp;
    this.hp = this.maxHp;
    this.atk = characterClass.baseAtk;
    this.def = characterClass.baseDef;
    this.potions = difficulty.startingPotions;
    
    // Mage gets mana
    if (characterClass.name === "Mage") {
      this.mana = 3;
    }
  }

  // Apply status effects at the start of player's turn
  applyStatusEffects() {
    let messages: string[] = [];
    
    // Apply poison damage
    if (this.status.poisoned > 0) {
      this.hp -= 1;
      this.status.poisoned--;
      messages.push(`${COLORS.green}🐍 You take 1 damage from poison. (${this.status.poisoned} turns left)${COLORS.reset}`);
    }
    
    // Apply curse effect
    if (this.status.cursed > 0) {
      // Effect already applied to atkModifier, just decrement the counter
      this.status.cursed--;
      if (this.status.cursed === 0) {
        this.status.atkModifier = 0; // Remove the curse effect
        messages.push(`${COLORS.magenta}✨ The curse has worn off. Your strength returns.${COLORS.reset}`);
      } else {
        messages.push(`${COLORS.magenta}⚠️ You are cursed! ATK reduced. (${this.status.cursed} turns left)${COLORS.reset}`);
      }
    }
    
    return messages;
  }

  // Get the current attack value (base + modifiers)
  getEffectiveAttack() {
    return Math.max(1, this.atk + this.status.atkModifier);
  }

  attack(enemy: Enemy) {
    // Critical hit system based on character class
    const isCritical = Math.random() < this.characterClass.criticalChance;
    let damage = Math.max(this.getEffectiveAttack() - enemy.def, 1);
    
    // Special ability: Mage's Magic Missile ignores defense
    if (this.characterClass.name === "Mage" && this.mana > 0 && Math.random() < 0.7) {
      damage = this.characterClass.magicPower;
      this.mana--;
      console.log(`${COLORS.blue}✨ You cast Magic Missile! (${this.mana} mana left)${COLORS.reset}`);
    }
    
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
    return Math.random() < this.characterClass.dodgeChance;
  }

  // Warriors have a chance to block damage
  block(): boolean {
    if (this.characterClass.name === "Warrior") {
      return Math.random() < 0.25;
    }
    return false;
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
  maxHp: number;
  ability?: string;
  
  // Ability flags
  canRegenerate = false;
  canPoison = false;
  canLifesteal = false;
  canCurse = false;
  hasBreathAttack = false;

  constructor(name: string, difficulty: DifficultyLevel) {
    this.name = name;
    
    // Base stats
    this.hp = Math.floor(Math.random() * 5) + 3 + difficulty.enemyBonus;
    this.atk = Math.floor(Math.random() * 3) + 1 + Math.floor(difficulty.enemyBonus / 2);
    this.def = Math.floor(Math.random() * 2) + Math.floor(difficulty.enemyBonus / 3);
    this.maxHp = this.hp;
    
    // Scale enemy based on dungeon level (enemies get tougher as you go deeper)
    const levelScaling = (currentLevel - 1) * 0.5;
    this.hp += Math.floor(levelScaling * 2);
    this.maxHp = this.hp;
    this.atk += Math.floor(levelScaling);
    this.def += Math.floor(levelScaling / 2);
    
    // Set ability based on enemy type
    if (ENEMY_TYPES[name] && ENEMY_TYPES[name].ability) {
      this.ability = ENEMY_TYPES[name].ability;
      
      // Enable specific ability flags
      if (name === "Troll") this.canRegenerate = true;
      if (name === "Spider") this.canPoison = true;
      if (name === "Vampire") this.canLifesteal = true;
      if (name === "Witch") this.canCurse = true;
      if (name === "Dragon") this.hasBreathAttack = true;
    }
  }

  // Apply special abilities before attack
  useAbility(player: Player): string | null {
    // Regeneration (Troll)
    if (this.canRegenerate && this.hp < this.maxHp) {
      this.hp += 1;
      return `${COLORS.green}The ${this.name} regenerates 1 HP!${COLORS.reset}`;
    }
    
    // Curse (Witch) - Reduce player's attack
    if (this.canCurse && Math.random() < 0.3 && player.status.cursed === 0) {
      player.status.cursed = 2;
      player.status.atkModifier = -1;
      return `${COLORS.magenta}The ${this.name} curses you! Your attacks are weakened for 2 turns.${COLORS.reset}`;
    }
    
    return null;
  }

  attack(player: Player) {
    // Apply special ability first
    const abilityMessage = this.useAbility(player);
    if (abilityMessage) {
      console.log(abilityMessage);
    }
    
    // Enemy critical hit (10% chance)
    const isCritical = Math.random() < 0.1;
    let damage = Math.max(this.atk - player.def, 1);
    
    // Special ability: Dragon's breath attack
    if (this.hasBreathAttack && this.hp < this.maxHp / 2 && Math.random() < 0.4) {
      damage += 2;
      console.log(`${COLORS.red}🔥 The ${this.name} breathes fire at you!${COLORS.reset}`);
    }
    
    if (isCritical) {
      damage = Math.floor(damage * 1.5);
    }
    
    // Check if player blocks the attack (warrior special ability)
    const blocked = player.block();
    if (blocked) {
      damage = Math.floor(damage / 2);
      console.log(`${COLORS.yellow}🛡️ You blocked part of the attack!${COLORS.reset}`);
    }
    
    player.hp -= damage;
    // Ensure HP doesn't go below 0 for cleaner game state
    player.hp = Math.max(0, player.hp);
    
    // Apply poison (Spider)
    if (this.canPoison && damage > 0 && Math.random() < 0.3 && player.status.poisoned === 0) {
      player.status.poisoned = 2;
      console.log(`${COLORS.green}🕷️ The ${this.name} has poisoned you!${COLORS.reset}`);
    }
    
    // Apply lifesteal (Vampire)
    if (this.canLifesteal && damage > 0) {
      const healAmount = Math.ceil(damage / 2);
      this.hp = Math.min(this.hp + healAmount, this.maxHp);
      console.log(`${COLORS.red}🧛 The ${this.name} drains your blood and heals for ${healAmount} HP!${COLORS.reset}`);
    }
    
    return { damage, isCritical, blocked };
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let player: Player;
let currentLevel = 1;
let roomsExplored = 0;
let turns = 0;

// Clear screen
function clearScreen() {
  console.clear();
}

// Display status bar
function displayStatus() {
  // Ensure HP is not negative for display purposes
  const displayHp = Math.max(0, player.hp);
  // Calculate the HP percentage (capped at 100%)
  const hpPercentage = Math.min(displayHp / player.maxHp, 1);
  // Calculate bar segments (0-10)
  const filledSegments = Math.floor(hpPercentage * 10);
  const emptySegments = 10 - filledSegments;
  
  // Create the bars with exact lengths
  const hpBar = "█".repeat(filledSegments);
  const emptyBar = "░".repeat(emptySegments);
  
  // Main status bar
  console.log(`\n${COLORS.bright}╔════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} 🛡️  ${COLORS.cyan}Level:${COLORS.reset} ${currentLevel}/${currentDifficulty.dungeonLevels} | ${COLORS.magenta}Room:${COLORS.reset} ${roomsExplored}/${currentDifficulty.roomsPerLevel} | ${COLORS.green}Score:${COLORS.reset} ${player.score} ${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.bright}║${COLORS.reset} ${COLORS.red}HP:${COLORS.reset} [${COLORS.red}${hpBar}${COLORS.reset}${emptyBar}] ${displayHp}/${player.maxHp} | ${COLORS.yellow}Potions:${COLORS.reset} ${player.potions} ${COLORS.bright}║${COLORS.reset}`);
  
  // Class info (only display for the specific class)
  let classInfo = `${COLORS.bright}║${COLORS.reset} ${COLORS.magenta}Class:${COLORS.reset} ${player.characterClass.name} | `;
  
  // Add class-specific info
  if (player.characterClass.name === "Warrior") {
    classInfo += `${COLORS.yellow}Block:${COLORS.reset} 25% `;
  } else if (player.characterClass.name === "Rogue") {
    classInfo += `${COLORS.yellow}Crit:${COLORS.reset} ${Math.floor(player.characterClass.criticalChance * 100)}% | ${COLORS.cyan}Dodge:${COLORS.reset} ${Math.floor(player.characterClass.dodgeChance * 100)}% `;
  } else if (player.characterClass.name === "Mage") {
    classInfo += `${COLORS.blue}Mana:${COLORS.reset} ${player.mana} | ${COLORS.yellow}Magic:${COLORS.reset} ${player.characterClass.magicPower} `;
  }
  
  // Padding to make it align with top line
  const padLength = 47 - classInfo.replace(/\x1b\[\d+m/g, '').length;
  classInfo += ' '.repeat(padLength) + `${COLORS.bright}║${COLORS.reset}`;
  
  console.log(classInfo);
  console.log(`${COLORS.bright}╚════════════════════════════════════════════════════╝${COLORS.reset}`);
}

// Display help screen
function showHelp() {
  console.log(COLORS.cyan + ASCII_ART.help + COLORS.reset);
}

// Game loop
function nextTurn() {
  // Autosave after each turn
  saveGame();
  
  // Check if player is dead
  if (player.hp <= 0) {
    gameOver(false);
    return;
  }

  // Check if the player has completed all dungeon levels
  if (currentLevel > currentDifficulty.dungeonLevels) {
    gameOver(true);
    return;
  }

  // Check if player has completed current level
  if (roomsExplored >= currentDifficulty.roomsPerLevel) {
    if (currentLevel === currentDifficulty.dungeonLevels) {
      gameOver(true);
      return;
    } else {
      // Level up!
      goToNextLevel();
      return;
    }
  }

  turns++;
  roomsExplored++;
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  displayStatus();

  const roomType = Math.random();
  if (roomType < 0.45) {
    // Enemy encounter
    const enemyName = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const enemy = new Enemy(enemyName, currentDifficulty);
    
    console.log(
      `\n${COLORS.red}⚔️  A wild ${enemy.name} appears!${COLORS.reset} (HP: ${enemy.hp}, ATK: ${enemy.atk}, DEF: ${enemy.def})`
    );
    
    // Show enemy description and ability
    if (ENEMY_TYPES[enemy.name]) {
      console.log(`${COLORS.yellow}${ENEMY_TYPES[enemy.name].description}${COLORS.reset}`);
      
      if (enemy.ability) {
        console.log(`${COLORS.red}Special Ability: ${enemy.ability}${COLORS.reset}`);
      }
    }
    
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
  // Apply status effects at the start of combat
  const statusMessages = player.applyStatusEffects();
  statusMessages.forEach(msg => console.log(msg));
  
  // Check if player died from status effects
  if (player.hp <= 0) {
    console.log(`${COLORS.red}💀 You died from poison...${COLORS.reset}`);
    
    rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
      nextTurn();
    });
    return;
  }
  
  displayCombatOptions();
  
  function displayCombatOptions() {
    // Show current ATK value if it's modified
    if (player.status.atkModifier !== 0) {
      console.log(`${COLORS.yellow}Current ATK: ${player.getEffectiveAttack()} (Base: ${player.atk})${COLORS.reset}`);
    }
    
    console.log(`\n${COLORS.cyan}What will you do?${COLORS.reset}`);
    
    // Basic options for all classes
    let options = `${COLORS.bright}[A]${COLORS.reset}ttack | ${COLORS.bright}[D]${COLORS.reset}odge | ${COLORS.bright}[P]${COLORS.reset}otion (${player.potions})`;
    
    // Class-specific options
    if (player.characterClass.name === "Mage" && player.mana > 0) {
      options += ` | ${COLORS.bright}[M]${COLORS.reset}agic (${player.mana})`;
    }
    
    options += ` | ${COLORS.bright}[H]${COLORS.reset}elp | ${COLORS.bright}[S]${COLORS.reset}ave | ${COLORS.bright}[Q]${COLORS.reset}uit`;
    console.log(options);
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
    } else if (choice === "M" && player.characterClass.name === "Mage" && player.mana > 0) {
      // Mage's special magic attack (explicit activation)
      const magicDamage = player.characterClass.magicPower + Math.floor(Math.random() * 2);
      enemy.hp -= magicDamage;
      player.mana--;
      
      console.log(`${COLORS.blue}✨ You cast a powerful spell for ${magicDamage} damage! (${player.mana} mana left)${COLORS.reset}`);
      
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
    } else if (choice === "H") {
      showHelp();
      rl.question(`\n${COLORS.cyan}Press [Enter] to return to combat...${COLORS.reset}`, () => {
        combat(enemy);
      });
      return;
    } else if (choice === "S") {
      saveGame();
      console.log(`${COLORS.green}Game saved successfully!${COLORS.reset}`);
      console.log(`${COLORS.yellow}Thanks for playing Mini Rogue! You can continue your adventure later.${COLORS.reset}`);
      rl.close();
      return;
    } else if (choice === "Q") {
      console.log(`${COLORS.yellow}👋 You fled the dungeon without saving.${COLORS.reset}`);
      askToPlayAgain();
      return;
    } else {
      console.log(`${COLORS.red}❓ Invalid choice.${COLORS.reset}`);
      combat(enemy);
      return;
    }

    // Enemy's turn
    const enemyResult = enemy.attack(player);
    
    // Display attack message based on critical/blocked status
    if (enemyResult.isCritical && !enemyResult.blocked) {
      console.log(`${COLORS.red}💥 CRITICAL HIT! The ${enemy.name} hits you for ${enemyResult.damage} damage!${COLORS.reset}`);
    } else if (enemyResult.blocked) {
      console.log(`${COLORS.yellow}🛡️ The ${enemy.name} hits you for ${enemyResult.damage} damage (reduced by block).${COLORS.reset}`);
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

function chooseClass() {
  clearScreen();
  console.log(COLORS.cyan + ASCII_ART.title + COLORS.reset);
  console.log(`${COLORS.bright}Choose your character class:${COLORS.reset}\n`);
  
  // Display class options with ASCII art
  console.log(`${COLORS.yellow}[1] Warrior${COLORS.reset} - ${CHARACTER_CLASSES.warrior.description}`);
  console.log(COLORS.yellow + ASCII_ART.warrior + COLORS.reset);
  
  console.log(`${COLORS.green}[2] Rogue${COLORS.reset} - ${CHARACTER_CLASSES.rogue.description}`);
  console.log(COLORS.green + ASCII_ART.rogue + COLORS.reset);
  
  console.log(`${COLORS.blue}[3] Mage${COLORS.reset} - ${CHARACTER_CLASSES.mage.description}`);
  console.log(COLORS.blue + ASCII_ART.mage + COLORS.reset);
  
  rl.question(`\n${COLORS.cyan}Select your class [1-3]: ${COLORS.reset}`, (choice) => {
    switch (choice) {
      case '1':
        currentClass = CHARACTER_CLASSES.warrior;
        startAdventure();
        break;
      case '2':
        currentClass = CHARACTER_CLASSES.rogue;
        startAdventure();
        break;
      case '3':
        currentClass = CHARACTER_CLASSES.mage;
        startAdventure();
        break;
      default:
        console.log(`${COLORS.red}Invalid choice. Please try again.${COLORS.reset}`);
        rl.question(`\n${COLORS.cyan}Press [Enter] to continue...${COLORS.reset}`, () => {
          chooseClass();
        });
    }
  });
}

function chooseDifficulty() {
  clearScreen();
  console.log(COLORS.cyan + ASCII_ART.title + COLORS.reset);
  console.log(`${COLORS.bright}Welcome to Mini Rogue! Choose your difficulty:${COLORS.reset}`);
  console.log(`${COLORS.green}[1] Easy${COLORS.reset} - 3 levels with 3 rooms each, weaker enemies, 2 starting potions`);
  console.log(`${COLORS.yellow}[2] Normal${COLORS.reset} - 3 levels with 4 rooms each, standard enemies, 1 starting potion`);
  console.log(`${COLORS.red}[3] Hard${COLORS.reset} - 4 levels with 4 rooms each, stronger enemies, 1 starting potion, 50% score bonus`);
  console.log(`${COLORS.bright}[H] Help${COLORS.reset} - Show game instructions`);
  
  rl.question(`\n${COLORS.cyan}Select difficulty [1-3] or H for help: ${COLORS.reset}`, (choice) => {
    switch (choice.toUpperCase()) {
      case '1':
        currentDifficulty = DIFFICULTIES.easy;
        chooseClass();
        break;
      case '2':
        currentDifficulty = DIFFICULTIES.normal;
        chooseClass();
        break;
      case '3':
        currentDifficulty = DIFFICULTIES.hard;
        chooseClass();
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
  currentLevel = 1;
  roomsExplored = 0;
  player = new Player(currentDifficulty, currentClass);
  
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  console.log(`${COLORS.bright}You've chosen ${currentDifficulty.name} difficulty!${COLORS.reset}`);
  console.log(`${COLORS.yellow}Dungeon Depth: ${currentDifficulty.dungeonLevels} levels with ${currentDifficulty.roomsPerLevel} rooms each${COLORS.reset}`);
  
  // Show class-specific info and ASCII art
  console.log(`${COLORS.magenta}You are a brave ${currentClass.name}!${COLORS.reset}`);
  
  if (currentClass.name === "Warrior") {
    console.log(COLORS.yellow + ASCII_ART.warrior + COLORS.reset);
    console.log(`${COLORS.yellow}Special Ability: ${currentClass.specialAbility}${COLORS.reset}`);
  } else if (currentClass.name === "Rogue") {
    console.log(COLORS.green + ASCII_ART.rogue + COLORS.reset);
    console.log(`${COLORS.green}Special Ability: ${currentClass.specialAbility}${COLORS.reset}`);
  } else if (currentClass.name === "Mage") {
    console.log(COLORS.blue + ASCII_ART.mage + COLORS.reset);
    console.log(`${COLORS.blue}Special Ability: ${currentClass.specialAbility}${COLORS.reset}`);
  }
  
  console.log(`${COLORS.yellow}Use keyboard commands to play: [A]ttack, [D]odge, [P]otion, [H]elp, [Q]uit${COLORS.reset}`);
  console.log(`\n${COLORS.bright}Your adventure begins...${COLORS.reset}`);

  rl.question(`\n${COLORS.cyan}Press [Enter] to enter the dungeon...${COLORS.reset}`, () => {
    nextTurn();
  });
}

function startGame() {
  // Check if there's a saved game
  const savedGame = loadGame();
  
  if (savedGame) {
    clearScreen();
    console.log(COLORS.cyan + ASCII_ART.title + COLORS.reset);
    console.log(`${COLORS.green}Found a saved game from: ${new Date(savedGame.timestamp).toLocaleString()}${COLORS.reset}`);
    console.log(`Level: ${savedGame.gameState.currentLevel}/${getDifficultyByName(savedGame.gameState.difficultyName).dungeonLevels}`);
    console.log(`Character: ${savedGame.playerState.characterClassName} | HP: ${savedGame.playerState.hp}/${savedGame.playerState.maxHp} | Score: ${savedGame.playerState.score}`);
    
    rl.question(`\n${COLORS.cyan}Would you like to continue your saved game? [Y/N]: ${COLORS.reset}`, (answer) => {
      if (answer.toUpperCase() === 'Y') {
        loadSavedGame(savedGame);
      } else {
        // Delete the save file and start a new game
        deleteSave();
        chooseDifficulty();
      }
    });
  } else {
    chooseDifficulty();
  }
}

// Function to handle level transition
function goToNextLevel() {
  currentLevel++;
  roomsExplored = 0;
  
  // Replenish some health between levels
  player.hp = Math.min(player.hp + 3, player.maxHp);
  
  // If player is a mage, replenish some mana
  if (player.characterClass.name === "Mage") {
    player.mana = Math.min(player.mana + 2, 3);
  }
  
  // Show level transition message
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  console.log(`\n${COLORS.green}You've reached the stairs to the next level!${COLORS.reset}`);
  console.log(`${COLORS.yellow}Dungeon Level ${currentLevel}${COLORS.reset}`);
  console.log(`\n${COLORS.green}You rest briefly, recovering 3 HP.${COLORS.reset}`);
  
  if (player.characterClass.name === "Mage" && player.mana < 3) {
    console.log(`${COLORS.blue}Your magical energy replenishes. (+2 mana)${COLORS.reset}`);
  }
  
  rl.question(`\n${COLORS.cyan}Press [Enter] to venture deeper...${COLORS.reset}`, () => {
    nextTurn();
  });
}

// Function to handle game over (victory or defeat)
function gameOver(victory: boolean) {
  clearScreen();
  const finalScore = Math.floor((victory ? player.score + player.hp * 10 : player.score) * currentDifficulty.scoreMultiplier);
  
  // Delete the save file on game over
  deleteSave();
  
  if (victory) {
    playSound('victory');
    console.log(COLORS.green + ASCII_ART.victory + COLORS.reset);
    console.log(`${COLORS.bright}🎉 Congratulations! You conquered the dungeon!${COLORS.reset}`);
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
}

// Save current game state
function saveGame() {
  try {
    const gameSave: GameSave = {
      playerState: {
        hp: player.hp,
        maxHp: player.maxHp,
        atk: player.atk,
        def: player.def,
        potions: player.potions,
        score: player.score,
        mana: player.mana,
        characterClassName: player.characterClass.name
      },
      gameState: {
        currentLevel,
        roomsExplored,
        difficultyName: currentDifficulty.name
      },
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(SAVE_FILE, JSON.stringify(gameSave, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving game:', err);
    return false;
  }
}

// Load saved game
function loadGame(): GameSave | null {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const data = fs.readFileSync(SAVE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading saved game:', err);
  }
  return null;
}

// Delete save file
function deleteSave() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      fs.unlinkSync(SAVE_FILE);
    }
  } catch (err) {
    console.error('Error deleting save file:', err);
  }
}

// Helper function to get difficulty settings by name
function getDifficultyByName(name: string): DifficultyLevel {
  return Object.values(DIFFICULTIES).find(diff => diff.name === name) || DIFFICULTIES.normal;
}

// Function to load a saved game
function loadSavedGame(save: GameSave) {
  // Set the difficulty and character class
  currentDifficulty = getDifficultyByName(save.gameState.difficultyName);
  currentClass = Object.values(CHARACTER_CLASSES).find(
    cls => cls.name === save.playerState.characterClassName
  ) || CHARACTER_CLASSES.warrior;
  
  // Create a new player with the saved stats
  player = new Player(currentDifficulty, currentClass);
  
  // Set saved player state
  player.hp = save.playerState.hp;
  player.maxHp = save.playerState.maxHp;
  player.atk = save.playerState.atk;
  player.def = save.playerState.def;
  player.potions = save.playerState.potions;
  player.score = save.playerState.score;
  player.mana = save.playerState.mana;
  
  // Set saved game state
  currentLevel = save.gameState.currentLevel;
  roomsExplored = save.gameState.roomsExplored;
  
  // Display welcome back message
  clearScreen();
  console.log(`${COLORS.cyan}═══════════════ MINI ROGUE ═══════════════${COLORS.reset}`);
  console.log(`${COLORS.green}Welcome back, brave ${player.characterClass.name}!${COLORS.reset}`);
  console.log(`${COLORS.yellow}You continue your adventure on dungeon level ${currentLevel}...${COLORS.reset}`);
  
  rl.question(`\n${COLORS.cyan}Press [Enter] to continue your quest...${COLORS.reset}`, () => {
    nextTurn();
  });
}

// Start the game
startGame();
