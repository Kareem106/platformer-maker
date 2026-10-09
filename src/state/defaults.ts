import type { EnemyType, PixelGrid, PlayerConfig, Level } from '../types';
import { Tile, emptyTiles } from '../types';

// ---- default sprites (16x16) ----

function grid(fn: (x: number, y: number) => string | null): PixelGrid {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => fn(x, y)),
  );
}

export function defaultPlayerPixels(): PixelGrid {
  // little hero: skin head, blue body, dark legs
  return grid((x, y) => {
    if (y >= 2 && y <= 5 && x >= 5 && x <= 10) return '#ffd9a0'; // head
    if (y >= 3 && y <= 4 && (x === 6 || x === 9)) return '#22222a'; // eyes
    if (y === 1 && x >= 4 && x <= 11) return '#e23b3b'; // cap
    if (y >= 7 && y <= 10 && x >= 4 && x <= 11) return '#2f6df6'; // torso
    if (y >= 7 && y <= 10 && (x === 3 || x === 12)) return '#ffd9a0'; // arms
    if (y >= 11 && y <= 14 && (x >= 5 && x <= 7)) return '#2b2b36'; // leg L
    if (y >= 11 && y <= 14 && (x >= 8 && x <= 10)) return '#2b2b36'; // leg R
    return null;
  });
}

export function defaultEnemyPixels(kind: number): PixelGrid {
  const palettes = [
    { body: '#7dd956', dark: '#3d8b2f', eye: '#ffffff' }, // slime
    { body: '#f25555', dark: '#8f1d1d', eye: '#ffffff' }, // chaser
    { body: '#b678f0', dark: '#5b2d96', eye: '#ffef5c' }, // jumper
    { body: '#f0a13c', dark: '#8a4d0f', eye: '#22222a' }, // shooter
    { body: '#5cc8e6', dark: '#1d5f7a', eye: '#ff3b3b' }, // turret
  ];
  const p = palettes[kind % palettes.length];
  return grid((x, y) => {
    if (y >= 5 && y <= 12 && x >= 2 && x <= 13) return p.body;
    if (y >= 12 && y <= 13 && x >= 2 && x <= 13) return p.dark;
    if (y >= 6 && y <= 8 && (x === 5 || x === 10)) return '#22222a';
    if (y >= 6 && y <= 8 && (x === 6 || x === 11)) return p.eye;
    if (y === 4 && x >= 4 && x <= 11) return p.dark;
    return null;
  });
}

export function defaultPlayer(): PlayerConfig {
  return {
    pixels: defaultPlayerPixels(),
    speed: 260,
    jumpVelocity: 560,
    gravity: 1600,
    doubleJump: false,
    maxHp: 3,
    coyote: 0.1,
    jumpBuffer: 0.12,
  };
}

export function defaultEnemies(): EnemyType[] {
  const defs: Array<Partial<EnemyType> & { preset: EnemyType['preset'] }> = [
    { preset: 'patrol', name: 'Goober', hp: 1, speed: 70, damage: 1, range: 0, jumpPower: 0, shootCooldown: 0 },
    { preset: 'chaser', name: 'Chomper', hp: 2, speed: 120, damage: 1, range: 260, jumpPower: 0, shootCooldown: 0 },
    { preset: 'shooter', name: 'Spitter', hp: 2, speed: 50, damage: 1, range: 320, jumpPower: 0, shootCooldown: 1.6 },
  ];
  return defs.map((d, i) => ({
    id: `enemy_${d.preset}_${i}`,
    name: d.name!,
    preset: d.preset,
    pixels: defaultEnemyPixels(i),
    hp: d.hp!,
    speed: d.speed!,
    damage: d.damage!,
    range: d.range!,
    jumpPower: 480,
    shootCooldown: d.shootCooldown || 1.6,
    size: 1,
  }));
}

export function defaultLevel(): Level {
  const w = 40;
  const h = 15;
  const tiles = emptyTiles(w, h);
  // ground
  for (let x = 0; x < w; x++) {
    tiles[h - 1][x] = Tile.Solid;
    tiles[h - 2][x] = Tile.Solid;
    if (x % 7 !== 3) tiles[h - 3][x] = Tile.Solid;
  }
  // gaps + platforms
  for (let x = 8; x < 12; x++) {
    tiles[h - 1][x] = Tile.Empty;
    tiles[h - 2][x] = Tile.Empty;
    tiles[h - 3][x] = Tile.Empty;
  }
  for (let x = 6; x < 10; x++) tiles[h - 6][x] = Tile.Platform;
  for (let x = 13; x < 17; x++) tiles[h - 8][x] = Tile.Platform;
  for (let x = 20; x < 24; x++) tiles[h - 6][x] = Tile.Platform;
  // coins arc
  tiles[h - 7][7] = Tile.Coin;
  tiles[h - 7][8] = Tile.Coin;
  tiles[h - 9][14] = Tile.Coin;
  tiles[h - 9][15] = Tile.Coin;
  tiles[h - 7][21] = Tile.Coin;
  tiles[h - 7][22] = Tile.Coin;
  // spikes
  tiles[h - 4]![14] = Tile.Spike;
  // spawn + goal
  tiles[h - 4][2] = Tile.Spawn;
  tiles[h - 4][w - 3] = Tile.Goal;
  tiles[h - 5][w - 3] = Tile.Goal;
  // deco
  tiles[h - 4][5] = Tile.Deco;
  return {
    id: 'level_1',
    name: 'Level 1',
    w,
    h,
    tiles,
    enemies: [
      { id: 'pl_1', typeId: 'enemy_patrol_0', tx: 11, ty: h - 5 },
      { id: 'pl_2', typeId: 'enemy_chaser_1', tx: 22, ty: h - 5 },
    ],
  };
}
