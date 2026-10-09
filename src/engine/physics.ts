// Pure collision helpers — no React, reused by playtest + export.
import { Tile, TILE_SIZE } from '../types';

export interface Body {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  onGround: boolean;
}

export function tileAt(tiles: number[][], tx: number, ty: number): number {
  if (ty < 0 || tx < 0 || ty >= tiles.length || tx >= tiles[0]!.length) {
    // side/bottom walls are solid, top is open
    if (ty < 0) return Tile.Empty;
    return Tile.Solid;
  }
  return tiles[ty]![tx]!;
}

export function isSolid(t: number): boolean {
  return t === Tile.Solid;
}

export function isOneWay(t: number): boolean {
  return t === Tile.Platform;
}

export function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Move body with tile collision. Mutates body. */
export function moveAndCollide(body: Body, tiles: number[][], dt: number): void {
  // X axis
  body.x += body.vx * dt;
  resolveAxis(body, tiles, true);
  // Y axis
  body.y += body.vy * dt;
  body.onGround = false;
  resolveAxis(body, tiles, false);
}

function resolveAxis(body: Body, tiles: number[][], isX: boolean): void {
  const x0 = Math.floor(body.x / TILE_SIZE);
  const x1 = Math.floor((body.x + body.w - 0.01) / TILE_SIZE);
  const y0 = Math.floor(body.y / TILE_SIZE);
  const y1 = Math.floor((body.y + body.h - 0.01) / TILE_SIZE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tiles, tx, ty);
      if (isX) {
        if (!isSolid(t)) continue;
        const tileL = tx * TILE_SIZE;
        const tileR = tileL + TILE_SIZE;
        if (body.vx > 0 && body.x + body.w > tileL && body.x + body.w - body.vx * 0.1 < tileR) {
          body.x = tileL - body.w;
          body.vx = 0;
        } else if (body.vx < 0 && body.x < tileR && body.x - body.vx * 0.1 > tileL) {
          body.x = tileR;
          body.vx = 0;
        }
      } else {
        const tileT = ty * TILE_SIZE;
        const tileB = tileT + TILE_SIZE;
        if (isSolid(t)) {
          if (body.vy > 0 && body.y + body.h > tileT && body.y + body.h - body.vy * 0.05 <= tileT + 6) {
            body.y = tileT - body.h;
            body.vy = 0;
            body.onGround = true;
          } else if (body.vy < 0 && body.y < tileB && body.y - body.vy * 0.05 >= tileB - 6) {
            body.y = tileB;
            body.vy = 0;
          }
        } else if (isOneWay(t)) {
          // land only when falling and feet were above platform top
          if (body.vy >= 0) {
            const prevBottom = body.y + body.h - body.vy * (1 / 60);
            if (prevBottom <= tileT + 8 && body.y + body.h >= tileT && body.y + body.h <= tileT + 18) {
              body.y = tileT - body.h;
              body.vy = 0;
              body.onGround = true;
            }
          }
        }
      }
    }
  }
}

/** Is there ground one tile below the body? (for edge detection) */
export function groundAhead(tiles: number[][], body: Body, dir: number): boolean {
  const footX = dir > 0 ? body.x + body.w + 2 : body.x - 2;
  const footY = body.y + body.h + 4;
  const tx = Math.floor(footX / TILE_SIZE);
  const ty = Math.floor(footY / TILE_SIZE);
  const t = tileAt(tiles, tx, ty);
  return isSolid(t) || isOneWay(t);
}

/** Would moving horizontally hit a wall? probe */
export function wallAhead(tiles: number[][], body: Body, dir: number): boolean {
  const probeX = dir > 0 ? body.x + body.w + 2 : body.x - 2;
  const probeY = body.y + body.h / 2;
  const t = tileAt(tiles, Math.floor(probeX / TILE_SIZE), Math.floor(probeY / TILE_SIZE));
  return isSolid(t);
}
