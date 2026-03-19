import * as readline from 'readline';

// Map tile types and their ASCII characters
export enum TileType {
  EMPTY = ' ',
  GRASS = '.',
  WALL = '#',
  PLAYER = '@',
  TOWN = 'T',
  DUNGEON = 'D',
  MERCHANT = 'M',
  ENEMY = 'E',
  TREASURE = '$',
  WATER = '~',
  FOREST = '♣',
  MOUNTAIN = '^',
  HOME = 'H'
}

// Entity types that can exist on the map
export enum EntityType {
  PLAYER,
  ENEMY,
  MERCHANT,
  NPC
}

// Represent an entity on the map
export interface Entity {
  type: EntityType;
  x: number;
  y: number;
  symbol: string;
  name: string;
  // Additional properties like health, inventory, etc. can be added
}

export interface WorldMapSaveData {
  width: number;
  height: number;
  player: Entity;
  entities: Entity[];
  map: Tile[][];
}

// Represent a map tile
export interface Tile {
  type: TileType;
  walkable: boolean;
  description: string;
  entity?: Entity;
  discovered: boolean;
  // Other properties can be added later (e.g., items, events)
}

// The world map class
export class WorldMap {
  private width: number;
  private height: number;
  private map: Tile[][];
  private player: Entity;
  private entities: Entity[] = [];
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.map = [];
    
    // Initialize player
    this.player = {
      type: EntityType.PLAYER,
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      symbol: '@',
      name: 'Player'
    };
    
    // Generate the initial map
    this.generateMap();
  }
  
  // Create a new random map
  private generateMap(): void {
    // Initialize map with empty tiles
    for (let y = 0; y < this.height; y++) {
      this.map[y] = [];
      for (let x = 0; x < this.width; x++) {
        // Create walls around the border
        if (x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1) {
          this.map[y][x] = {
            type: TileType.WALL,
            walkable: false,
            description: 'A solid wall.',
            discovered: true
          };
        } else {
          // Fill the rest with grass
          this.map[y][x] = {
            type: TileType.GRASS,
            walkable: true,
            description: 'Grassy ground.',
            discovered: false
          };
        }
      }
    }
    
    // Add a town
    this.addLocation(TileType.TOWN, 'A small town with shops and inns.');
    
    // Add a dungeon
    this.addLocation(TileType.DUNGEON, 'A dark dungeon entrance.');
    
    // Add a merchant
    this.addMerchant();
    
    // Add some basic terrain features
    this.addTerrainFeatures();
    
    // Set tiles around player as discovered
    this.discoverSurroundingTiles(this.player.x, this.player.y, 2);
  }
  
  // Add a special location to the map
  private addLocation(type: TileType, description: string): void {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * (this.width - 4)) + 2;
      y = Math.floor(Math.random() * (this.height - 4)) + 2;
    } while (
      !this.map[y][x].walkable || 
      this.map[y][x].type !== TileType.GRASS ||
      this.getDistance(x, y, this.player.x, this.player.y) < 5
    );
    
    this.map[y][x] = {
      type: type,
      walkable: true,
      description: description,
      discovered: false
    };
  }
  
  // Add a merchant to the map
  private addMerchant(): void {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * (this.width - 4)) + 2;
      y = Math.floor(Math.random() * (this.height - 4)) + 2;
    } while (
      !this.map[y][x].walkable || 
      this.map[y][x].type !== TileType.GRASS ||
      this.getDistance(x, y, this.player.x, this.player.y) < 4
    );
    
    const merchant: Entity = {
      type: EntityType.MERCHANT,
      x: x,
      y: y,
      symbol: 'M',
      name: 'Traveling Merchant'
    };
    
    this.entities.push(merchant);
    this.map[y][x].entity = merchant;
  }
  
  // Add basic terrain features
  private addTerrainFeatures(): void {
    // Add some water
    this.addTerrainCluster(TileType.WATER, 'A body of water.', false, 3, 8);
    
    // Add some forest
    this.addTerrainCluster(TileType.FOREST, 'A dense forest.', true, 5, 10);
    
    // Add mountains
    this.addTerrainCluster(TileType.MOUNTAIN, 'A tall mountain.', false, 2, 6);
  }
  
  // Add a cluster of terrain features
  private addTerrainCluster(
    type: TileType, 
    description: string, 
    walkable: boolean, 
    count: number, 
    size: number
  ): void {
    for (let c = 0; c < count; c++) {
      let centerX = Math.floor(Math.random() * (this.width - 6)) + 3;
      let centerY = Math.floor(Math.random() * (this.height - 6)) + 3;
      
      // Skip if too close to player
      if (this.getDistance(centerX, centerY, this.player.x, this.player.y) < 3) {
        continue;
      }
      
      // Create a cluster
      for (let i = 0; i < size; i++) {
        const offsetX = Math.floor(Math.random() * 5) - 2;
        const offsetY = Math.floor(Math.random() * 5) - 2;
        const x = Math.min(Math.max(centerX + offsetX, 1), this.width - 2);
        const y = Math.min(Math.max(centerY + offsetY, 1), this.height - 2);
        
        // Only replace grass
        if (this.map[y][x].type === TileType.GRASS) {
          this.map[y][x] = {
            type: type,
            walkable: walkable,
            description: description,
            discovered: false
          };
        }
      }
    }
  }
  
  // Calculate distance between two points
  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
  
  // Mark tiles around a position as discovered
  private discoverSurroundingTiles(x: number, y: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const newX = x + dx;
        const newY = y + dy;
        
        // Check if within map boundaries
        if (
          newX >= 0 && 
          newX < this.width && 
          newY >= 0 && 
          newY < this.height
        ) {
          this.map[newY][newX].discovered = true;
        }
      }
    }
  }
  
  // Move the player
  public movePlayer(dx: number, dy: number): string {
    const newX = this.player.x + dx;
    const newY = this.player.y + dy;
    
    // Check if the new position is within bounds
    if (
      newX < 0 || 
      newX >= this.width || 
      newY < 0 || 
      newY >= this.height
    ) {
      return "You can't move that way.";
    }
    
    // Check if the tile is walkable
    if (!this.map[newY][newX].walkable) {
      return `You can't walk there: ${this.map[newY][newX].description}`;
    }
    
    // Check for entity at the destination
    if (this.map[newY][newX].entity) {
      const entity = this.map[newY][newX].entity!;
      return this.handleEntityInteraction(entity);
    }
    
    // Move player
    this.player.x = newX;
    this.player.y = newY;
    
    // Discover surrounding tiles
    this.discoverSurroundingTiles(newX, newY, 2);
    
    // Generate description based on tile type
    let message = "";
    switch (this.map[newY][newX].type) {
      case TileType.TOWN:
        message = "You've entered a town. There are shops and inns here.";
        break;
      case TileType.DUNGEON:
        message = "You're at the entrance to a dark dungeon.";
        break;
      default:
        message = `You move to ${this.map[newY][newX].description}`;
    }
    
    return message;
  }
  
  // Handle interaction with entities
  private handleEntityInteraction(entity: Entity): string {
    switch (entity.type) {
      case EntityType.MERCHANT:
        return `You meet a ${entity.name}. They offer to trade with you.`;
      case EntityType.ENEMY:
        return `You encounter a ${entity.name}! Prepare for battle!`;
      default:
        return `You see a ${entity.name}.`;
    }
  }
  
  // Render the map to a string
  public render(): string {
    let result = "";
    
    // Add a border
    result += "+" + "-".repeat(this.width * 2 - 1) + "+\n";
    
    for (let y = 0; y < this.height; y++) {
      result += "|";
      for (let x = 0; x < this.width; x++) {
        // Player position
        if (x === this.player.x && y === this.player.y) {
          result += this.player.symbol + " ";
          continue;
        }
        
        // Other entities
        if (this.map[y][x].entity) {
          result += this.map[y][x].entity!.symbol + " ";
          continue;
        }
        
        // Only show discovered tiles
        if (this.map[y][x].discovered) {
          result += this.map[y][x].type + " ";
        } else {
          result += "  "; // Undiscovered tiles are blank
        }
      }
      result += "|\n";
    }
    
    // Add a border
    result += "+" + "-".repeat(this.width * 2 - 1) + "+";
    
    return result;
  }
  
  // Get information about the current player position
  public getPlayerPositionInfo(): string {
    const x = this.player.x;
    const y = this.player.y;
    return this.map[y][x].description;
  }
  
  // Get the current player position
  public getPlayerPosition(): { x: number, y: number } {
    return { x: this.player.x, y: this.player.y };
  }
  
  // Get the tile at a specific position
  public getTileAt(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.map[y][x];
  }
  
  // Get map dimensions
  public getDimensions(): { width: number, height: number } {
    return { width: this.width, height: this.height };
  }
  
  // Add an enemy to the map
  public addEnemy(x: number, y: number, name: string): void {
    // Make sure the position is valid and walkable
    if (
      x < 0 || 
      x >= this.width || 
      y < 0 || 
      y >= this.height || 
      !this.map[y][x].walkable
    ) {
      return;
    }
    
    // Create the enemy
    const enemy: Entity = {
      type: EntityType.ENEMY,
      x: x,
      y: y,
      symbol: 'E',
      name: name
    };
    
    this.entities.push(enemy);
    this.map[y][x].entity = enemy;
  }
  
  // Get a simplified representation of the map for saving
  public serialize(): WorldMapSaveData {
    return {
      width: this.width,
      height: this.height,
      player: this.player,
      entities: this.entities,
      map: this.map
    };
  }
  
  // Load a map from saved data
  public static deserialize(data: WorldMapSaveData): WorldMap {
    const map = new WorldMap(data.width, data.height);
    map.player = data.player;
    map.entities = data.entities;
    map.map = data.map;
    return map;
  }
}

// Helper function to handle keyboard input for movement
export function handleMovementInput(
  key: string, 
  worldMap: WorldMap
): { message: string, moved: boolean } {
  let dx = 0;
  let dy = 0;
  let moved = false;
  
  switch (key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      dy = -1;
      moved = true;
      break;
    case 's':
    case 'arrowdown':
      dy = 1;
      moved = true;
      break;
    case 'a':
    case 'arrowleft':
      dx = -1;
      moved = true;
      break;
    case 'd':
    case 'arrowright':
      dx = 1;
      moved = true;
      break;
  }
  
  if (moved) {
    const message = worldMap.movePlayer(dx, dy);
    return { message, moved };
  }
  
  return { message: "Invalid movement key.", moved: false };
}

// Simple legend to help players understand map symbols
export function displayMapLegend(): string {
  return `
Map Legend:
@ - Player
. - Grass
# - Wall
T - Town
D - Dungeon
M - Merchant
E - Enemy
$ - Treasure
~ - Water
♣ - Forest
^ - Mountain
H - Home
  `;
} 