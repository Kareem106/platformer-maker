import { Tile, TILE_SIZE, type PixelGrid } from '../types';
import type { GameState } from './simulation';

// Cache offscreen canvases for pixel sprites
const spriteCache = new Map<string, HTMLCanvasElement>();

export function pixelsToCanvas(pixels: PixelGrid, scale = 2): HTMLCanvasElement {
  const key = JSON.stringify(pixels) + scale;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const h = pixels.length;
  const w = pixels[0]?.length ?? 16;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const col = pixels[y]![x];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  spriteCache.set(key, c);
  return c;
}

function tileExposedTop(tiles: number[][], tx: number, ty: number): boolean {
  if (ty === 0) return true;
  return tiles[ty - 1]?.[tx] !== Tile.Solid;
}

export function renderGame(ctx: CanvasRenderingContext2D, st: GameState): void {
  const { viewW, viewH, camX, camY } = st;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, '#1b2340');
  sky.addColorStop(0.6, '#2b3a67');
  sky.addColorStop(1, '#3d4d7d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  // parallax hills
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 8; i++) {
    const hx = ((i * 430 - camX * 0.3) % (viewW + 400) + viewW + 400) % (viewW + 400) - 200;
    ctx.beginPath();
    ctx.arc(hx, viewH - 60 + (i % 3) * 30, 120, Math.PI, 0);
    ctx.fill();
  }
  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 197.3 - camX * 0.15) % viewW;
    const sy = (i * 131.7) % (viewH * 0.6);
    const x = sx < 0 ? sx + viewW : sx;
    ctx.fillRect(x, sy, 2, 2);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  const x0 = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const y0 = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const x1 = Math.min(st.level.w - 1, Math.ceil((camX + viewW) / TILE_SIZE) + 1);
  const y1 = Math.min(st.level.h - 1, Math.ceil((camY + viewH) / TILE_SIZE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = st.level.tiles[ty]![tx]!;
      if (t === Tile.Empty) continue;
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      drawTile(ctx, st.level.tiles, t, tx, ty, px, py, st.time);
    }
  }

  // projectiles
  for (const pr of st.projectiles) {
    ctx.fillStyle = '#ffb14d';
    ctx.beginPath();
    ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, 6 + Math.sin(st.time * 20) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // enemies
  for (const e of st.enemies) {
    if (e.dead) continue;
    const blink = e.hurtCd > 0 && Math.floor(st.time * 16) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;
    const spr = pixelsToCanvas(e.def.pixels, 2);
    // squash & stretch when jumping
    const squash = e.onGround ? 1 : 1 + Math.sin(e.anim * 2) * 0.03;
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    ctx.scale((e.dir >= 0 ? 1 : -1) * squash, 1 / squash);
    ctx.drawImage(spr, -16, -32, 32, 32);
    // hp pips for tough enemies
    if (e.def.hp > 1) {
      ctx.scale(e.dir >= 0 ? 1 : -1, 1); // unflip text-ish pips
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-12, -38, 24, 5);
      ctx.fillStyle = '#5cff8a';
      ctx.fillRect(-11, -37, 22 * (e.hp / e.def.hp), 3);
    }
    ctx.restore();
  }

  // player
  const pl = st.player;
  if (!pl.dead) {
    const blink = pl.hurtCd > 0 && Math.floor(st.time * 16) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    const spr = pixelsToCanvas(st.project.player.pixels, 2);
    ctx.translate(pl.x + pl.w / 2, pl.y + pl.h);
    ctx.scale(pl.face >= 0 ? 1 : -1, 1);
    const stretch = pl.onGround ? 1 : 1.06;
    ctx.drawImage(spr, -16, -32 * stretch, 32, 32 * stretch);
    ctx.restore();
  }

  // particles
  for (const p of st.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 10, 10, 150, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`🪙 ${st.coins}/${st.totalCoins}`, 22, 32);
  // hearts
  for (let i = 0; i < pl.maxHp; i++) {
    ctx.font = '16px system-ui';
    ctx.fillText(i < pl.hp ? '❤️' : '🖤', 22 + i * 22, 54);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, viewW - 150, 10, 140, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#9adcff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`⏱ ${st.time.toFixed(1)}s`, viewW - 138, 29);
  ctx.restore();

  // overlays
  if (st.status === 'won') {
    ctx.fillStyle = 'rgba(10,20,10,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#5cff8a';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU WIN! 🎉', viewW / 2, viewH / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Coins ${st.coins}/${st.totalCoins} • Time ${st.time.toFixed(1)}s — press R to replay`, viewW / 2, viewH / 2 + 24);
    ctx.textAlign = 'left';
  } else if (st.status === 'dead') {
    ctx.fillStyle = 'rgba(30,8,8,0.6)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press R to retry', viewW / 2, viewH / 2 + 24);
    ctx.textAlign = 'left';
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tiles: number[][],
  t: number,
  tx: number,
  ty: number,
  px: number,
  py: number,
  time: number,
): void {
  if (t === Tile.Solid) {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#7d5a3c';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    if (tileExposedTop(tiles, tx, ty)) {
      ctx.fillStyle = '#5fce5c';
      ctx.fillRect(px, py, TILE_SIZE, 9);
      ctx.fillStyle = '#8de68a';
      ctx.fillRect(px, py, TILE_SIZE, 4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3);
  } else if (t === Tile.Platform) {
    ctx.fillStyle = '#a06a35';
    ctx.fillRect(px, py + 6, TILE_SIZE, 10);
    ctx.fillStyle = '#c98d4e';
    ctx.fillRect(px, py + 6, TILE_SIZE, 4);
    ctx.fillStyle = '#5e3a18';
    for (let x = 4; x < TILE_SIZE; x += 8) ctx.fillRect(px + x, py + 6, 2, 10);
  } else if (t === Tile.Spike) {
    ctx.fillStyle = '#2b2b36';
    ctx.fillRect(px, py + 18, TILE_SIZE, 14);
    ctx.fillStyle = '#d8dce6';
    for (let i = 0; i < 4; i++) {
      const sx = px + i * 8;
      ctx.beginPath();
      ctx.moveTo(sx, py + 32);
      ctx.lineTo(sx + 4, py + 10);
      ctx.lineTo(sx + 8, py + 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + i * 8 + 3, py + 16, 2, 6);
    }
  } else if (t === Tile.Coin) {
    const bob = Math.sin(time * 4 + (tx + ty) * 0.7) * 3;
    const squish = Math.abs(Math.cos(time * 3 + tx * 0.5));
    const cx = px + 16;
    const cy = py + 16 + bob;
    ctx.fillStyle = '#8a6d00';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 8 * (0.35 + 0.65 * squish), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2, 3, 4 * (0.35 + 0.65 * squish), -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (t === Tile.Spawn) {
    ctx.fillStyle = 'rgba(92,255,138,0.18)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#5cff8a';
    const b = Math.sin(time * 5) * 3;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 8 + b);
    ctx.lineTo(px + 24, py + 16 + b);
    ctx.lineTo(px + 8, py + 24 + b);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('START', px + 2, py + 9);
  } else if (t === Tile.Goal) {
    ctx.fillStyle = 'rgba(255,217,77,0.15)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#7a5b00';
    ctx.fillRect(px + 14, py + 2, 4, 28);
    ctx.fillStyle = '#ffd94d';
    const wave = Math.sin(time * 6 + ty) * 2;
    ctx.fillRect(px + 18, py + 4 + wave * 0.3, 12, 9);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px system-ui';
    ctx.fillText('GOAL', px + 1, py + 9);
  } else if (t === Tile.Deco) {
    // bush / grass tuft, non-collidable
    ctx.strokeStyle = '#3f9e4d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const sx = px + 5 + i * 5.5;
      ctx.beginPath();
      ctx.moveTo(sx, py + 30);
      ctx.quadraticCurveTo(sx + 2, py + 16, sx + (i % 2 ? 5 : -5), py + 10);
      ctx.stroke();
    }
  }
}
