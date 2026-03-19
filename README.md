# Mini Rogue Terminal Game

A text-based roguelike adventure game played in the terminal. Built with TypeScript and blessed for a full-screen TUI experience.

## Game Modes

### Mini Rogue (Blessed TUI – `npm start`)

Full-screen terminal UI with:

- **Main menu:** New Game, Load Game, Continue (if autosave), **Open World**, High Scores, Quit
- **Save system:** 3 manual slots + auto-checkpoint after each room
- **Cutscenes:** Intro (ASCII art + typewriter), level transitions, victory, defeat
- **Difficulty:** Easy, Normal, Hard, Quick Play (~5–8 min)
- **Classes:** Warrior, Rogue, Mage
- **Combat:** Attack, Dodge, Potion, Magic (Mage), with 10 enemy types
- **Rooms:** Combat, treasure, events, shops, **puzzles**
- **Layout:** Header, main area, stats panel, message log

### Classic Dungeon (`npm run dungeon`)

The original readline-based dungeon crawler.

### Open World (`npm start` → Open World, or `npm run open-world`)

Grid-based ASCII world with free movement. Access from the main menu or run directly:

- Combat on random encounters (10% per move)
- Gold and EXP rewards on victory
- Town and merchant shops (buy potions, +ATK, +DEF)
- Mini-dungeon (2–3 rooms: combat and treasure)

## How to Play

### Installation

1. Node.js and npm required
2. `npm install`

### Running

| Command | Mode |
|--------|------|
| `npm start` | Blessed TUI – main launcher |
| `npm run dungeon` | Classic readline dungeon |
| `npm run open-world` | Open world exploration |

### Controls (Blessed TUI)

- **Combat:** `A` Attack, `D` Dodge, `P` Potion, `M` Magic (Mage), `S` Save, `Q` Quit
- **Cutscenes:** `Space` to skip

### Open World Controls

- **Move:** `W`/`A`/`S`/`D` or arrow keys
- **Legend:** `L` — Map symbols
- **Help:** `H` — Commands
- **Inventory:** `I` · **Potion:** `P` · **Save:** `S` · **Quit:** `Q`

**Map legend:** `@` Player · `T` Town · `D` Dungeon · `M` Merchant · `.` Grass · `~` Water · `♣` Forest · `^` Mountains · `#` Walls

## Project Structure

```
├── game.ts          # Main launcher (blessed)
├── dungeonGame.ts   # Dungeon mode logic
├── openWorld.ts     # Open world mode
├── worldMap.ts      # Open world map
├── gameData.ts      # Shared data (enemies, classes, difficulties)
├── puzzles.ts       # Puzzle definitions
├── saves/           # Save slots + autosave
└── ui/              # Blessed UI (screen, layout, menus, cutscene, prompt)
```

## ASCII Art & Animations

Skills that can help with ASCII graphics, logos, and terminal animations:

| Skill | Purpose |
|-------|---------|
| **ascii-terminal-animation-pack** | Matrix rain, waves, terminal demos |
| **ascii-art-diagram-creator** | ASCII diagrams |
| **ascii-cli-logo-banner** | CLI logos and banners |
| **ascii-image-to-ascii** | Convert images to ASCII |

Install: `npx skills add partme-ai/full-stack-skills@ascii-terminal-animation-pack`

## Planned

- Combat animations (flash on hit)
- Richer ASCII sprites and shooting mechanics

Enjoy your adventure!
