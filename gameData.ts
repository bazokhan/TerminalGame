export const ENEMIES = [
  "Goblin",
  "Skeleton",
  "Orc",
  "Bandit",
  "Slime",
  "Troll",
  "Witch",
  "Spider",
  "Vampire",
  "Dragon",
];

export const ENEMY_TYPES: Record<
  string,
  { ability?: string; description: string }
> = {
  Goblin: { description: "Small but agile creature." },
  Skeleton: { description: "Undead warrior with brittle bones." },
  Orc: { description: "Strong, brutish humanoid." },
  Bandit: { description: "Crafty human thief." },
  Slime: { description: "Gelatinous creature that's hard to damage." },
  Troll: {
    description: "Giant with regenerative abilities.",
    ability: "Regenerate (recovers 1 HP each turn)",
  },
  Witch: {
    description: "Spellcaster with dark magic.",
    ability: "Curse (reduces your ATK for one turn)",
  },
  Spider: {
    description: "Venomous arachnid.",
    ability: "Poison (deals 1 extra damage for 2 turns)",
  },
  Vampire: {
    description: "Undead blood-drinker.",
    ability: "Lifesteal (heals itself when it damages you)",
  },
  Dragon: {
    description: "Fearsome fire-breathing beast.",
    ability: "Breath attack (deals extra damage when below half health)",
  },
};

export const TREASURES = [
  "Health Potion",
  "Dagger (+2 ATK)",
  "Shield (+2 DEF)",
  "Magic Amulet (+1 ATK, +1 DEF)",
];

export const EVENTS = [
  "Trap (-2 HP)",
  "Mysterious Shrine (+3 HP)",
  "Empty Room",
  "Puzzle Room (+5 Score)",
];

export interface DifficultyLevel {
  name: string;
  dungeonLevels: number;
  roomsPerLevel: number;
  enemyBonus: number;
  startingPotions: number;
  scoreMultiplier: number;
}

export interface CharacterClass {
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

export const CHARACTER_CLASSES: Record<string, CharacterClass> = {
  warrior: {
    name: "Warrior",
    description: "High HP and defense, but lower dodge chance",
    baseHp: 12,
    baseAtk: 2,
    baseDef: 2,
    specialAbility: "Block (25% chance to reduce damage by half)",
    criticalChance: 0.15,
    dodgeChance: 0.3,
    magicPower: 0,
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
    magicPower: 0,
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
    magicPower: 3,
  },
};

export const DIFFICULTIES: Record<string, DifficultyLevel> = {
  easy: {
    name: "Easy",
    dungeonLevels: 3,
    roomsPerLevel: 3,
    enemyBonus: 0,
    startingPotions: 2,
    scoreMultiplier: 0.8,
  },
  normal: {
    name: "Normal",
    dungeonLevels: 3,
    roomsPerLevel: 4,
    enemyBonus: 1,
    startingPotions: 1,
    scoreMultiplier: 1.0,
  },
  hard: {
    name: "Hard",
    dungeonLevels: 4,
    roomsPerLevel: 4,
    enemyBonus: 2,
    startingPotions: 1,
    scoreMultiplier: 1.5,
  },
  quick: {
    name: "Quick Play",
    dungeonLevels: 1,
    roomsPerLevel: 3,
    enemyBonus: 0,
    startingPotions: 2,
    scoreMultiplier: 0.7,
  },
};
