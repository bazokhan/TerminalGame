#!/usr/bin/env ts-node

import * as readline from "readline";

// Game setup
const MAX_TURNS = 10;
const ENEMIES = ["Goblin", "Skeleton", "Orc", "Bandit", "Slime"];
const TREASURES = ["Health Potion", "Dagger (+2 ATK)", "Shield (+2 DEF)"];
const EVENTS = ["Trap (-2 HP)", "Mysterious Shrine (+3 HP)", "Empty Room"];

class Player {
  hp = 10;
  atk = 2;
  def = 1;
  potions = 1;

  attack(enemy: Enemy) {
    const damage = Math.max(this.atk - enemy.def, 1);
    enemy.hp -= damage;
    return damage;
  }

  dodge(): boolean {
    return Math.random() < 0.5; // 50% chance to dodge
  }

  heal() {
    if (this.potions > 0) {
      this.hp += 5;
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

  constructor(name: string) {
    this.name = name;
    this.hp = Math.floor(Math.random() * 5) + 3;
    this.atk = Math.floor(Math.random() * 3) + 1;
    this.def = Math.floor(Math.random() * 2);
  }

  attack(player: Player) {
    const damage = Math.max(this.atk - player.def, 1);
    player.hp -= damage;
    return damage;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let player = new Player();
let turns = 0;

// Game loop
function nextTurn() {
  if (turns >= MAX_TURNS || player.hp <= 0) {
    console.log(
      player.hp > 0
        ? "🎉 You survived the dungeon!"
        : "💀 You died in the dungeon."
    );
    rl.close();
    return;
  }

  turns++;
  console.log(
    `\n🛡️ Turn ${turns}/${MAX_TURNS} - HP: ${player.hp} | Potions: ${player.potions}`
  );

  const roomType = Math.random();
  if (roomType < 0.5) {
    // Enemy encounter
    const enemy = new Enemy(
      ENEMIES[Math.floor(Math.random() * ENEMIES.length)]
    );
    console.log(
      `⚔️ A wild ${enemy.name} appears! (HP: ${enemy.hp}, ATK: ${enemy.atk}, DEF: ${enemy.def})`
    );
    combat(enemy);
  } else if (roomType < 0.75) {
    // Treasure room
    const treasure = TREASURES[Math.floor(Math.random() * TREASURES.length)];
    console.log(`🎁 You found: ${treasure}`);
    if (treasure.includes("Potion")) player.potions++;
    if (treasure.includes("Dagger")) player.atk += 2;
    if (treasure.includes("Shield")) player.def += 2;
    nextTurn();
  } else {
    // Random event
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    console.log(`📜 Event: ${event}`);
    if (event.includes("Trap")) player.hp -= 2;
    if (event.includes("Shrine")) player.hp += 3;
    nextTurn();
  }
}

function combat(enemy: Enemy) {
  rl.question("[A]ttack | [D]odge | [P]otion | [Q]uit: ", (input) => {
    const choice = input.toUpperCase();
    if (choice === "A") {
      const dmg = player.attack(enemy);
      console.log(`🗡️ You hit the ${enemy.name} for ${dmg} damage.`);
      if (enemy.hp <= 0) {
        console.log(`✅ You defeated the ${enemy.name}!`);
        nextTurn();
        return;
      }
    } else if (choice === "D") {
      if (player.dodge()) {
        console.log("💨 You dodged the attack!");
        combat(enemy);
        return;
      } else {
        console.log("❌ Dodge failed!");
      }
    } else if (choice === "P") {
      if (player.heal()) {
        console.log("🧪 You drank a potion and restored 5 HP!");
      } else {
        console.log("❌ No potions left!");
      }
    } else if (choice === "Q") {
      console.log("👋 You fled the dungeon.");
      rl.close();
      return;
    } else {
      console.log("❓ Invalid choice.");
      combat(enemy);
      return;
    }

    // Enemy's turn
    const enemyDmg = enemy.attack(player);
    console.log(`💥 The ${enemy.name} hits you for ${enemyDmg} damage!`);
    if (player.hp <= 0) {
      console.log("💀 You died...");
      rl.close();
      return;
    }
    combat(enemy);
  });
}

// Start the game
console.log("🗺️ Welcome to Mini Rogue!");
nextTurn();
