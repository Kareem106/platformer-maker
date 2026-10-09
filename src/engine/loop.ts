import type { GameProject, Level } from '../types';
import { createGameState, updateGame, type GameState, type InputState } from './simulation';
import { renderGame } from './renderer';

export interface GameHandle {
  state: GameState;
  input: InputState;
  start: () => void;
  stop: () => void;
  restart: (freshLevel?: Level) => void;
}

/** Fixed-timestep loop: 60Hz sim, render every rAF. */
export function createGame(
  canvas: HTMLCanvasElement,
  project: GameProject,
  level: Level,
): GameHandle {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = 960;
  const H = 540;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.aspectRatio = '16 / 9';
  ctx.scale(dpr, dpr);

  // deep-clone level tiles so playtest coin collection doesn't mutate the editor
  const levelCopy: Level = {
    ...level,
    tiles: level.tiles.map((r) => [...r]),
    enemies: level.enemies.map((e) => ({ ...e })),
  };
  const state = createGameState(project, levelCopy, W, H);
  const input: InputState = { left: false, right: false, jump: false, jumpPressed: false, down: false };

  let raf = 0;
  let last = 0;
  let acc = 0;
  const STEP = 1 / 60;
  let running = false;

  const keyDown = (e: KeyboardEvent) => {
    if (e.repeat) {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        input.down = true;
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        if (!input.jump) input.jumpPressed = true;
        input.jump = true;
        break;
      case 'KeyR':
        handle.restart();
        break;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  };
  const keyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        input.down = false;
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        input.jump = false;
        break;
    }
  };

  function frame(t: number) {
    if (!running) return;
    const now = t / 1000;
    let dt = now - (last || now);
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      updateGame(state, input, STEP);
      acc -= STEP;
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGame(ctx, state);
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  const handle: GameHandle = {
    state,
    input,
    start() {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    },
    restart(freshLevel?: Level) {
      const src = freshLevel ?? level;
      const copy: Level = {
        ...src,
        tiles: src.tiles.map((r) => [...r]),
        enemies: src.enemies.map((e) => ({ ...e })),
      };
      const fresh = createGameState(project, copy, W, H);
      state.player = fresh.player;
      state.enemies = fresh.enemies;
      state.projectiles = [];
      state.particles = [];
      state.coins = 0;
      state.totalCoins = fresh.totalCoins;
      state.level = fresh.level;
      state.time = 0;
      state.status = 'playing';
      state.camX = 0;
      state.camY = 0;
    },
  };
  return handle;
}
