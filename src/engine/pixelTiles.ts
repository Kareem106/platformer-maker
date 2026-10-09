// Procedural pixel-art tiles. One painter shared by the level editor,
// the playtest renderer, and the brush-icon previews so everything matches.
//
// Each tile is an 8x8 character map. '.' = transparent.
// Palette keys are single chars mapped to colors below.

export const ART_SIZE = 8;

const DIRT = {
  D: '#8a5a33', // dirt base
  d: '#5e3a1e', // dirt shadow
  k: '#3f2612', // dirt deep
  L: '#b07a45', // pebble highlight
  G: '#3fa34d', // grass base
  l: '#7dd956', // grass light
  g: '#2a7a33', // grass dark
};

const SOLID_GRASS = [
  'llllllll',
  'GGGGGGGG',
  'GGgGGGGg',
  'gGGgGGgG',
  'DdDDDDdD',
  'DDDDDDDD',
  'DLDDDDdD',
  'kkkkkkkk',
];

const SOLID_DIRT = [
  'DDDDDDDD',
  'DdDDDDdD',
  'DDDDDDDD',
  'DDdDDDLD',
  'DDDDDDDD',
  'DdDDDDdD',
  'DDDDDdDD',
  'kkkkkkkk',
];

const PLATFORM = [
  'LLLLLLLL',
  'WWWWWWWW',
  'WNWWWWNW',
  'WWWWWWWW',
  'wWWWWWWw',
  'DDDDDDDD',
  'dddddddd',
  '........',
];

const PLATFORM_PAL = {
  L: '#d29a5b',
  W: '#a06a35',
  w: '#c98d4e',
  N: '#3a2a18',
  D: '#6e451f',
  d: '#4a2d12',
};

const SPIKE = [
  '........',
  'M.M.M.M.',
  'M.M.M.M.',
  'MM.MM.MM',
  'MMmMMmMM',
  'MMMMMMMM',
  'DDDDDDDD',
  'dddddddd',
];

const SPIKE_PAL = {
  M: '#dfe5f2',
  m: '#9aa3b2',
  D: '#565d6b',
  d: '#333842',
};

const COIN_A = [
  '..YYYY..',
  '.YYYYYY.',
  'YYWWYYYY',
  'YWYYDYYY',
  'YWYYDYYY',
  'YYYYYYYY',
  '.YYYYYY.',
  '..SSSS..',
];

const COIN_B = [
  '........',
  '...YY...',
  '...WYD..',
  '...WYD..',
  '...WYD..',
  '...WYD..',
  '...YY...',
  '...SS...',
];

const COIN_PAL = {
  Y: '#f5b301',
  W: '#ffefa8',
  D: '#9a6200',
  S: 'rgba(0,0,0,0.35)',
};

const SPAWN = [
  '........',
  '........',
  '......G.',
  '.GGGGGGG',
  '.WWGGGGG',
  '......G.',
  '........',
  'GGGGGGGG',
];

const SPAWN_PAL = {
  G: '#37d67a',
  W: '#d2ffe4',
};

const GOAL = [
  '.PWBBWB.',
  '.PWBWBB.',
  '.PWBBWB.',
  '.PWBWBB.',
  '.P......',
  '.P......',
  '.P......',
  'DDDDDDDD',
];

const GOAL_PAL = {
  P: '#6e451f',
  W: '#f4f4f4',
  B: '#22222a',
  D: '#3f2612',
};

const DECO = [
  '........',
  '...FF...',
  '...FF...',
  '..FFFF..',
  '...GG...',
  '..GGGG..',
  '.GgGGgG.',
  'GGgGGgGG',
];

const DECO_PAL = {
  F: '#ff6b9d',
  G: '#3fa34d',
  g: '#2a7a33',
};

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h;
}

export function paintPixels(
  g: CanvasRenderingContext2D,
  map: string[],
  pal: Record<string, string>,
  px: number,
  py: number,
  size: number,
): void {
  const n = map.length;
  const cell = size / n;
  const w = Math.ceil(cell * 10) / 10;
  for (let y = 0; y < n; y++) {
    const row = map[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const c = pal[ch];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(px + x * cell, py + y * cell, w, w);
    }
  }
}

/** Deterministic dirt speckles so big ground areas don't look flat. */
function sprinkle(
  g: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  px: number,
  py: number,
  size: number,
  grassTop: boolean,
): void {
  const h = hash2(tx, ty);
  const cell = size / ART_SIZE;
  const topRows = grassTop ? 4 : 0;
  const spots: Array<[number, number, string]> = [];
  for (let i = 0; i < 3; i++) {
    const sx = (h >> (i * 6)) % ART_SIZE;
    const sy = topRows + ((h >> (i * 6 + 3)) % (ART_SIZE - topRows));
    spots.push([sx < 0 ? sx + ART_SIZE : sx, sy, i === 2 ? '#b07a45' : '#5e3a1e']);
  }
  for (const [sx, sy, c] of spots) {
    g.fillStyle = c;
    g.fillRect(px + sx * cell, py + sy * cell, Math.ceil(cell * 10) / 10, Math.ceil(cell * 10) / 10);
  }
}

export interface TileArtOptions {
  grassTop?: boolean;
  coinFrame?: number;
}

/** Paint one tile's pixel art. tx/ty are tile coords (for variation seed). */
export function paintTileArt(
  g: CanvasRenderingContext2D,
  t: number,
  tx: number,
  ty: number,
  px: number,
  py: number,
  size: number,
  opts: TileArtOptions = {},
): void {
  switch (t) {
    case 1: {
      // solid
      const grass = opts.grassTop ?? true;
      paintPixels(g, grass ? SOLID_GRASS : SOLID_DIRT, DIRT, px, py, size);
      sprinkle(g, tx, ty, px, py, size, grass);
      break;
    }
    case 2:
      paintPixels(g, PLATFORM, PLATFORM_PAL, px, py, size);
      break;
    case 3:
      paintPixels(g, SPIKE, SPIKE_PAL, px, py, size);
      break;
    case 4:
      paintPixels(g, (opts.coinFrame ?? 0) % 2 === 0 ? COIN_A : COIN_B, COIN_PAL, px, py, size);
      break;
    case 5:
      paintPixels(g, SPAWN, SPAWN_PAL, px, py, size);
      break;
    case 6:
      paintPixels(g, GOAL, GOAL_PAL, px, py, size);
      break;
    case 7:
      paintPixels(g, DECO, DECO_PAL, px, py, size);
      break;
    default:
      break;
  }
}

/** Is the tile above (tx, ty) non-solid? Used to decide grass tops. */
export function hasGrassTop(tiles: number[][], tx: number, ty: number): boolean {
  if (ty === 0) return true;
  return tiles[ty - 1]?.[tx] !== 1;
}
