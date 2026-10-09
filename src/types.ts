// Core data model for the platformer maker.
// Tiles are painted on a grid. TILE_SIZE px per tile at runtime.
export const TILE_SIZE = 32;

export const Tile = {
  Empty: 0,
  Solid: 1,
  Platform: 2, // one-way
  Spike: 3,
  Coin: 4,
  Spawn: 5,
  Goal: 6,
  Deco: 7,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];

export const TILE_NAMES: Record<Tile, string> = {
  [Tile.Empty]: 'Empty',
  [Tile.Solid]: 'Solid',
  [Tile.Platform]: 'Platform',
  [Tile.Spike]: 'Spikes',
  [Tile.Coin]: 'Coin',
  [Tile.Spawn]: 'Spawn',
  [Tile.Goal]: 'Goal',
  [Tile.Deco]: 'Deco',
};

export type PixelGrid = (string | null)[][]; // hex color or null=transparent, 16x16

export type EnemyPreset = 'patrol' | 'chaser' | 'jumper' | 'shooter' | 'turret';

export const ENEMY_PRESETS: { id: EnemyPreset; name: string; desc: string }[] = [
  { id: 'patrol', name: 'Patroller', desc: 'Walks back & forth, turns at edges/walls' },
  { id: 'chaser', name: 'Chaser', desc: 'Chases player when in range' },
  { id: 'jumper', name: 'Jumper', desc: 'Hops around, damages on touch' },
  { id: 'shooter', name: 'Shooter', desc: 'Walks + shoots at player in range' },
  { id: 'turret', name: 'Turret', desc: 'Stays still, shoots at player' },
];

export interface EnemyType {
  id: string;
  name: string;
  preset: EnemyPreset;
  pixels: PixelGrid;
  hp: number;
  speed: number; // px/sec
  damage: number;
  range: number; // px detection
  jumpPower: number;
  shootCooldown: number; // seconds
  size: number; // tiles wide (1 = 32px). v1 fixed 1
}

export interface EnemyPlacement {
  id: string;
  typeId: string;
  tx: number;
  ty: number;
}

export interface PlayerConfig {
  pixels: PixelGrid;
  speed: number;
  jumpVelocity: number;
  gravity: number;
  doubleJump: boolean;
  maxHp: number;
  coyote: number; // seconds
  jumpBuffer: number; // seconds
}

export interface Level {
  id: string;
  name: string;
  w: number;
  h: number;
  tiles: number[][]; // [y][x]
  enemies: EnemyPlacement[];
}

export interface GameProject {
  player: PlayerConfig;
  enemyTypes: EnemyType[];
  levels: Level[];
  activeLevelId: string;
}

export type EditorTool = 'brush' | 'erase' | 'fill' | 'enemy' | 'eraseEnemy' | 'spawn';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyTiles(w: number, h: number, fill = Tile.Empty): number[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function cloneTiles(tiles: number[][]): number[][] {
  return tiles.map((row) => [...row]);
}
