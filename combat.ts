import * as readline from "readline";
import { ENEMIES, ENEMY_TYPES, type CharacterClass } from "./gameData";

export interface DifficultyLike {
  enemyBonus: number;
}

export interface CombatStatus {
  poisoned: number;
  cursed: number;
  atkModifier: number;
}

export interface ICombatPlayer {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions: number;
  characterClass: CharacterClass;
  mana: number;
  status: CombatStatus;
  getEffectiveAttack(): number;
  applyStatusEffects(): string[];
  attack(enemy: CombatEnemy): { damage: number; isCritical: boolean };
  dodge(): boolean;
  block(): boolean;
  heal(): boolean;
  dealDamage(amount: number): void;
}

export class CombatEnemy {
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

  constructor(
    name: string,
    difficulty: DifficultyLike,
    levelScaling: number
  ) {
    this.name = name;
    this.hp =
      Math.floor(Math.random() * 5) +
      3 +
      difficulty.enemyBonus +
      Math.floor(levelScaling * 2);
    this.atk =
      Math.floor(Math.random() * 3) +
      1 +
      Math.floor(difficulty.enemyBonus / 2) +
      Math.floor(levelScaling);
    this.def =
      Math.floor(Math.random() * 2) +
      Math.floor(difficulty.enemyBonus / 3) +
      Math.floor(levelScaling / 2);
    this.maxHp = this.hp;

    if (name === "Troll") this.canRegenerate = true;
    if (name === "Spider") this.canPoison = true;
    if (name === "Vampire") this.canLifesteal = true;
    if (name === "Witch") this.canCurse = true;
    if (name === "Dragon") this.hasBreathAttack = true;
  }

  useAbility(player: ICombatPlayer): string | null {
    if (this.canRegenerate && this.hp < this.maxHp) {
      this.hp += 1;
      return `The ${this.name} regenerates 1 HP!`;
    }
    if (
      this.canCurse &&
      Math.random() < 0.3 &&
      player.status.cursed === 0
    ) {
      player.status.cursed = 2;
      player.status.atkModifier = -1;
      return `The ${this.name} curses you!`;
    }
    return null;
  }

  attack(player: ICombatPlayer): { damage: number; blocked: boolean } {
    const abilityMsg = this.useAbility(player);
    if (abilityMsg) void abilityMsg;
    let damage = Math.max(this.atk - player.def, 1);
    if (Math.random() < 0.1) damage = Math.floor(damage * 1.5);
    if (
      this.hasBreathAttack &&
      this.hp < this.maxHp / 2 &&
      Math.random() < 0.4
    ) {
      damage += 2;
    }
    const blocked = player.block();
    if (blocked) damage = Math.floor(damage / 2);
    player.dealDamage(damage);
    if (
      this.canPoison &&
      damage > 0 &&
      Math.random() < 0.3 &&
      player.status.poisoned === 0
    ) {
      player.status.poisoned = 2;
    }
    if (this.canLifesteal && damage > 0) {
      this.hp = Math.min(this.hp + Math.ceil(damage / 2), this.maxHp);
    }
    return { damage, blocked };
  }
}

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

export async function runCombatReadline(
  player: ICombatPlayer,
  enemy: CombatEnemy,
  rl: readline.Interface,
  _difficulty: DifficultyLike
): Promise<{ victory: boolean }> {
  const meta = ENEMY_TYPES[enemy.name];

  const combatLoop = async (): Promise<boolean> => {
    const statusMsgs = player.applyStatusEffects();
    statusMsgs.forEach((m) => console.log(`${COLORS.green}${m}${COLORS.reset}`));
    if (player.hp <= 0) return false;

    console.log(
      `\n${COLORS.red}A ${enemy.name} attacks!${COLORS.reset} (HP: ${enemy.hp}, ATK: ${enemy.atk}, DEF: ${enemy.def})`
    );
    if (meta?.description) console.log(meta.description);
    if (meta?.ability) console.log(`${COLORS.red}Ability: ${meta.ability}${COLORS.reset}`);

    let options = `[A]ttack [D]odge [P]otion`;
    if (player.characterClass.name === "Mage" && player.mana > 0) {
      options += " [M]agic";
    }
    options += " [Q]uit";
    console.log(`\n${COLORS.cyan}${options}${COLORS.reset}`);

    const input = (
      await question(rl, "Your choice: ")
    )
      .trim()
      .toLowerCase();

    if (input === "q") return false;

    if (input === "a") {
      const result = player.attack(enemy);
      if (result.isCritical) {
        console.log(
          `${COLORS.yellow}CRITICAL! ${result.damage} damage${COLORS.reset}`
        );
      } else {
        console.log(`${COLORS.green}You hit for ${result.damage}${COLORS.reset}`);
      }
      if (enemy.hp <= 0) return true;
    } else if (input === "d") {
      if (player.dodge()) {
        console.log(`${COLORS.cyan}Dodged!${COLORS.reset}`);
        return combatLoop();
      }
      console.log(`${COLORS.red}Dodge failed!${COLORS.reset}`);
    } else if (input === "p") {
      if (player.heal()) {
        console.log(`${COLORS.green}Potion: +5 HP${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}No potions!${COLORS.reset}`);
      }
    } else if (
      input === "m" &&
      player.characterClass.name === "Mage" &&
      player.mana > 0
    ) {
      const dmg =
        player.characterClass.magicPower + Math.floor(Math.random() * 2);
      enemy.hp -= dmg;
      player.mana--;
      console.log(
        `${COLORS.blue}Magic Missile: ${dmg} damage (${player.mana} mana left)${COLORS.reset}`
      );
      if (enemy.hp <= 0) return true;
    } else {
      console.log(`${COLORS.red}Invalid choice.${COLORS.reset}`);
    }

    const er = enemy.attack(player);
    console.log(
      `${COLORS.red}${enemy.name} hits for ${er.damage}${er.blocked ? " (blocked)" : ""}${COLORS.reset}`
    );
    if (player.hp <= 0) return false;
    return combatLoop();
  };

  const victory = await combatLoop();
  return { victory };
}

export { ENEMIES };
