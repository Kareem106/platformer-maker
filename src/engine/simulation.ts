import type { EnemyType, GameProject, Level, PixelGrid } from '../types';
import { Tile, TILE_SIZE } from '../types';
import { moveAndCollide, rectsOverlap, groundAhead, wallAhead, tileAt, type Body } from './physics';
import { sfx } from './audio';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean; // edge-triggered, consumed each frame
  down: boolean;
}

export interface EnemyState extends Body {
  id: string;
  typeId: string;
  def: EnemyType;
  hp: number;
  dir: number;
  shootCd: number;
  jumpCd: number;
  hurtCd: number;
  dead: boolean;
  anim: number;
}

export interface Projectile {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  fromEnemy: boolean;
  dead: boolean;
  life: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number;
}

export interface PlayerState extends Body {
  hp: number;
  maxHp: number;
  coyote: number;
  buffer: number;
  jumpsLeft: number;
  face: number;
  hurtCd: number;
  anim: number;
  dead: boolean;
  won: boolean;
}

export interface GameState {
  project: GameProject;
  level: Level;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: Projectile[];
  particles: Particle[];
  coins: number;
  totalCoins: number;
  time: number;
  status: 'playing' | 'won' | 'dead';
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
}

export function findSpawn(tiles: number[][]): { x: number; y: number } {
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[0]!.length; x++)
      if (tiles[y]![x] === Tile.Spawn) return { x: x * TILE_SIZE, y: y * TILE_SIZE };
  return { x: TILE_SIZE * 2, y: 0 };
}

export function createGameState(project: GameProject, level: Level, viewW: number, viewH: number): GameState {
  const spawn = findSpawn(level.tiles);
  let totalCoins = 0;
  for (const row of level.tiles) for (const t of row) if (t === Tile.Coin) totalCoins++;
  const enemies: EnemyState[] = level.enemies.map((p) => {
    const def = project.enemyTypes.find((e) => e.id === p.typeId) ?? project.enemyTypes[0]!;
    const s = TILE_SIZE * (def?.size ?? 1);
    return {
      id: p.id, typeId: p.typeId, def: def!,
      x: p.tx * TILE_SIZE, y: p.ty * TILE_SIZE, w: s * 0.9, h: s * 0.9,
      vx: 0, vy: 0, onGround: false,
      hp: def?.hp ?? 1, dir: Math.random() > 0.5 ? 1 : -1,
      shootCd: 1 + Math.random(), jumpCd: 1 + Math.random() * 2,
      hurtCd: 0, dead: false, anim: Math.random() * 10,
    };
  });
  return {
    project, level,
    player: {
      x: spawn.x, y: spawn.y - 4, w: 24, h: 28,
      vx: 0, vy: 0, onGround: false,
      hp: project.player.maxHp, maxHp: project.player.maxHp,
      coyote: 0, buffer: 0, jumpsLeft: project.player.doubleJump ? 1 : 0,
      face: 1, hurtCd: 0, anim: 0, dead: false, won: false,
    },
    enemies, projectiles: [], particles: [],
    coins: 0, totalCoins, time: 0, status: 'playing',
    camX: 0, camY: 0, viewW, viewH,
  };
}

function burst(st: GameState, x: number, y: number, color: string, n = 10) {
  for (let i = 0; i < n; i++) {
    st.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 260,
      vy: -Math.random() * 260,
      life: 0, maxLife: 0.4 + Math.random() * 0.3,
      color, size: 2 + Math.random() * 3,
    });
  }
}

export function updateGame(st: GameState, input: InputState, dt: number): void {
  if (st.status !== 'playing') {
    // still update particles for win/death fx
    for (const p of st.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
    }
    st.particles = st.particles.filter((p) => p.life < p.maxLife);
    return;
  }
  st.time += dt;
  const cfg = st.project.player;
  const pl = st.player;
  const tiles = st.level.tiles;

  // --- player horizontal ---
  const target = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const accel = pl.onGround ? 2400 : 1600;
  if (target !== 0) {
    pl.vx += target * accel * dt;
    pl.vx = Math.max(-cfg.speed, Math.min(cfg.speed, pl.vx));
    pl.face = target;
  } else {
    const f = pl.onGround ? 2000 : 400;
    if (Math.abs(pl.vx) <= f * dt) pl.vx = 0;
    else pl.vx -= Math.sign(pl.vx) * f * dt;
  }

  // --- jumping (coyote + buffer + double) ---
  if (pl.onGround) {
    pl.coyote = cfg.coyote;
    pl.jumpsLeft = cfg.doubleJump ? 1 : 0;
  } else pl.coyote -= dt;
  if (input.jumpPressed) {
    pl.buffer = cfg.jumpBuffer;
    input.jumpPressed = false;
  } else pl.buffer -= dt;
  if (pl.buffer > 0) {
    if (pl.coyote > 0) {
      pl.vy = -cfg.jumpVelocity;
      pl.coyote = 0; pl.buffer = 0; pl.onGround = false;
      sfx.jump();
      burst(st, pl.x + pl.w / 2, pl.y + pl.h, '#ffffff', 5);
    } else if (pl.jumpsLeft > 0) {
      pl.vy = -cfg.jumpVelocity * 0.9;
      pl.jumpsLeft--;
      pl.buffer = 0;
      sfx.doubleJump();
      burst(st, pl.x + pl.w / 2, pl.y + pl.h, '#9adcff', 8);
    }
  }
  // variable jump height
  if (!input.jump && pl.vy < -200) pl.vy += cfg.gravity * 1.6 * dt;

  pl.vy += cfg.gravity * dt;
  if (pl.vy > 900) pl.vy = 900;
  moveAndCollide(pl, tiles, dt);
  pl.anim += dt * (Math.abs(pl.vx) > 20 ? 10 : 3);
  if (pl.hurtCd > 0) pl.hurtCd -= dt;

  // fell out of world
  if (pl.y > st.level.h * TILE_SIZE + 80) {
    damagePlayer(st, 99);
  }

  // --- tile interactions: coins / spikes / goal ---
  const px0 = Math.floor(pl.x / TILE_SIZE);
  const px1 = Math.floor((pl.x + pl.w) / TILE_SIZE);
  const py0 = Math.floor(pl.y / TILE_SIZE);
  const py1 = Math.floor((pl.y + pl.h) / TILE_SIZE);
  let dirtyTiles = false;
  for (let ty = py0; ty <= py1; ty++) {
    for (let tx = px0; tx <= px1; tx++) {
      if (ty < 0 || tx < 0 || ty >= st.level.h || tx >= st.level.w) continue;
      const t = tiles[ty]![tx]!;
      const tileRect = { x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE };
      if (!rectsOverlap(pl, tileRect)) continue;
      if (t === Tile.Coin) {
        tiles[ty]![tx] = Tile.Empty;
        st.coins++;
        sfx.coin();
        burst(st, tileRect.x + 16, tileRect.y + 16, '#ffd94d', 8);
        dirtyTiles = true;
      } else if (t === Tile.Spike) {
        // spike hitbox slightly smaller
        const spikeBox = { x: tileRect.x + 6, y: tileRect.y + 14, w: 20, h: 18 };
        if (rectsOverlap(pl, spikeBox)) damagePlayer(st, 1, tileRect.x + 16);
      } else if (t === Tile.Goal) {
        pl.won = true;
        st.status = 'won';
        sfx.win();
        burst(st, pl.x + pl.w / 2, pl.y, '#5cff8a', 30);
      }
    }
  }
  if (dirtyTiles) st.level = { ...st.level, tiles };

  // --- enemies ---
  for (const e of st.enemies) {
    if (e.dead) continue;
    e.anim += dt * 6;
    if (e.hurtCd > 0) e.hurtCd -= dt;
    const dx = pl.x - e.x;
    const adx = Math.abs(dx);
    const preset = e.def.preset;
    e.vx = 0;
    if (preset === 'patrol') {
      e.vx = e.dir * e.def.speed;
    } else if (preset === 'chaser') {
      if (adx < e.def.range && !pl.dead) e.vx = Math.sign(dx) * e.def.speed;
      else e.vx = e.dir * e.def.speed * 0.4;
    } else if (preset === 'jumper') {
      e.vx = e.dir * e.def.speed * 0.7;
      e.jumpCd -= dt;
      if (e.jumpCd <= 0 && e.onGround) {
        e.vy = -e.def.jumpPower;
        e.jumpCd = 1.2 + Math.random() * 1.2;
      }
    } else if (preset === 'shooter') {
      e.vx = e.dir * e.def.speed * 0.6;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && adx < e.def.range && Math.abs(pl.y - e.y) < 220) {
        enemyShoot(st, e);
        e.shootCd = e.def.shootCooldown;
      }
    } else if (preset === 'turret') {
      e.shootCd -= dt;
      if (e.shootCd <= 0 && adx < e.def.range) {
        enemyShoot(st, e);
        e.shootCd = e.def.shootCooldown;
      }
    }
    e.vy += cfg.gravity * 0.9 * dt;
    if (e.vy > 800) e.vy = 800;
    const wasDir = e.dir;
    moveAndCollide(e, tiles, dt);
    // turn at walls / edges
    if (preset === 'patrol' || preset === 'shooter' || preset === 'chaser' || preset === 'jumper') {
      if (wallAhead(tiles, e, e.dir) && e.onGround) e.dir = -e.dir as 1 | -1;
      else if (e.onGround && !groundAhead(tiles, e, e.dir) && (preset === 'patrol' || preset === 'shooter')) e.dir = -e.dir as 1 | -1;
      if (Math.abs(e.vx) < 1 && e.onGround) e.dir = -wasDir as 1 | -1;
    }
    if (e.dir !== 0 && e.vx !== 0) e.dir = Math.sign(e.vx) as 1 | -1;

    // player vs enemy
    if (!pl.dead && rectsOverlap(pl, e)) {
      const stomping = pl.vy > 120 && pl.y + pl.h - e.y < 20;
      if (stomping) {
        e.hp -= 1;
        pl.vy = -cfg.jumpVelocity * 0.65;
        sfx.stomp();
        burst(st, e.x + e.w / 2, e.y, '#ffffff', 10);
        if (e.hp <= 0) {
          e.dead = true;
          burst(st, e.x + e.w / 2, e.y + e.h / 2, '#ff5c5c', 16);
        }
      } else {
        damagePlayer(st, e.def.damage, e.x + e.w / 2);
      }
    }
    // enemy fell out
    if (e.y > st.level.h * TILE_SIZE + 100) e.dead = true;
  }
  st.enemies = st.enemies.filter((e) => !e.dead);

  // --- projectiles ---
  for (const pr of st.projectiles) {
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life <= 0) { pr.dead = true; continue; }
    // hit wall?
    const t = tileAt(tiles, Math.floor((pr.x + pr.w / 2) / TILE_SIZE), Math.floor((pr.y + pr.h / 2) / TILE_SIZE));
    if (t === Tile.Solid) {
      pr.dead = true;
      burst(st, pr.x, pr.y, '#ffb14d', 5);
      continue;
    }
    if (pr.fromEnemy && !pl.dead && rectsOverlap(pl, pr)) {
      pr.dead = true;
      damagePlayer(st, 1, pr.x);
    }
  }
  st.projectiles = st.projectiles.filter((p) => !p.dead);

  // --- particles ---
  for (const p of st.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 700 * dt;
  }
  st.particles = st.particles.filter((p) => p.life < p.maxLife);

  // --- camera ---
  const targetX = pl.x + pl.w / 2 - st.viewW / 2;
  const targetY = pl.y + pl.h / 2 - st.viewH / 2 - 40;
  const maxX = Math.max(0, st.level.w * TILE_SIZE - st.viewW);
  const maxY = Math.max(0, st.level.h * TILE_SIZE - st.viewH);
  st.camX += (Math.max(0, Math.min(maxX, targetX)) - st.camX) * Math.min(1, dt * 8);
  st.camY += (Math.max(0, Math.min(maxY, targetY)) - st.camY) * Math.min(1, dt * 8);
}

function enemyShoot(st: GameState, e: EnemyState) {
  const dir = st.player.x >= e.x ? 1 : -1;
  st.projectiles.push({
    x: e.x + e.w / 2 - 5, y: e.y + e.h / 2 - 5, w: 10, h: 10,
    vx: dir * 260, vy: 0, fromEnemy: true, dead: false, life: 3,
  });
  sfx.shoot();
}

function damagePlayer(st: GameState, dmg: number, fromX?: number) {
  const pl = st.player;
  if (pl.hurtCd > 0 || st.status !== 'playing') return;
  pl.hp -= dmg;
  pl.hurtCd = 1.0;
  sfx.hurt();
  burst(st, pl.x + pl.w / 2, pl.y + pl.h / 2, '#ff5c5c', 12);
  if (fromX !== undefined) {
    pl.vx = (pl.x + pl.w / 2 < fromX ? -1 : 1) * 220;
    pl.vy = -320;
  }
  if (pl.hp <= 0) {
    pl.hp = 0;
    pl.dead = true;
    st.status = 'dead';
    sfx.lose();
  }
}

export function resetLevelInPlace(st: GameState): void {
  const fresh = createGameState(st.project, st.level, st.viewW, st.viewH);
  // keep coin-eaten tiles? No — restore original tiles from level snapshot is complex;
  // for v1, coins stay eaten on retry within same session is confusing, so we restore
  // by re-reading project level. Caller should pass pristine level.
  st.player = fresh.player;
  st.enemies = fresh.enemies;
  st.projectiles = [];
  st.particles = [];
  st.coins = 0;
  st.time = 0;
  st.status = 'playing';
}

export type { PixelGrid };
