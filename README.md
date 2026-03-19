# Mini Rogue Terminal Game

A text-based roguelike adventure game played in the terminal. Built with TypeScript and blessed for a full-screen TUI experience.

## Game Modes

### Mini Rogue (Blessed TUI – `npm start`)

Full-screen terminal UI with:

- **Main menu:** New Game, Load Game, High Scores, Quit
- **Save system:** 3 manual slots + auto-checkpoint after each room
- **Cutscenes:** Intro (ASCII art + typewriter), level transitions, victory, defeat
- **Difficulty:** Easy, Normal, Hard, Quick Play (~5–8 min)
- **Classes:** Warrior, Rogue, Mage
- **Combat:** Attack, Dodge, Potion, Magic (Mage), with 10 enemy types
- **Rooms:** Combat, treasure, events, shops, **puzzles**
- **Layout:** Header, main area, stats panel, message log

### Classic Dungeon (`npm run dungeon`)

The original readline-based dungeon crawler.

### Open World (`npm run open-world`)

Grid-based ASCII world with free movement, towns, dungeons, merchants. Combat and town/shop interactions are planned.

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

### Map Legend (Open World)

`@` Player · `T` Town · `D` Dungeon · `M` Merchant · `.` Grass · `~` Water · `♣` Forest · `^` Mountains · `#` Walls

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

## Planned

- Open World combat
- Town/shop interactions
- Dungeon entrance (mini-dungeon)
- Combat animations

Enjoy your adventure!
