import { create } from 'zustand';
import type { EditorTool, EnemyPlacement, EnemyType, GameProject, Level, PlayerConfig, Tile } from '../types';
import { Tile as T, cloneTiles, emptyTiles, uid } from '../types';
import { defaultEnemies, defaultLevel, defaultPlayer } from './defaults';

interface HistoryEntry {
  tiles: number[][];
  enemies: EnemyPlacement[];
}

interface ProjectState {
  project: GameProject;
  tool: EditorTool;
  brush: Tile;
  selectedEnemyTypeId: string | null;
  showGrid: boolean;
  zoom: number;
  isPlaying: boolean;
  enemyEditorOpen: boolean;
  editingEnemyId: string | null;

  history: HistoryEntry[];
  future: HistoryEntry[];

  setTool: (t: EditorTool) => void;
  setBrush: (b: Tile) => void;
  setSelectedEnemy: (id: string | null) => void;
  toggleGrid: () => void;
  setZoom: (z: number) => void;
  setPlaying: (p: boolean) => void;
  setEnemyEditor: (open: boolean, editingId?: string | null) => void;

  activeLevel: () => Level;
  paintTile: (x: number, y: number, record?: boolean) => void;
  setSpawn: (x: number, y: number, record?: boolean) => void;
  floodFill: (x: number, y: number) => void;
  clearLevel: () => void;
  resizeLevel: (w: number, h: number) => void;
  placeEnemy: (tx: number, ty: number, record?: boolean) => void;
  removeEnemyAt: (tx: number, ty: number) => void;
  undo: () => void;
  redo: () => void;

  addEnemyType: (e: EnemyType) => void;
  updateEnemyType: (id: string, patch: Partial<EnemyType>) => void;
  deleteEnemyType: (id: string) => void;
  updatePlayer: (patch: Partial<PlayerConfig>) => void;
  pushHistory: () => void;
}

function snapshot(level: Level): HistoryEntry {
  return { tiles: cloneTiles(level.tiles), enemies: [...level.enemies] };
}

function sanitizeSpawn(tiles: number[][], x: number, y: number) {
  // only one spawn tile allowed — clear others
  for (let yy = 0; yy < tiles.length; yy++)
    for (let xx = 0; xx < tiles[0]!.length; xx++)
      if (tiles[yy]![xx] === T.Spawn) tiles[yy]![xx] = T.Empty;
  tiles[y]![x] = T.Spawn;
}

function initialProject(): GameProject {
  const level = defaultLevel();
  return {
    player: defaultPlayer(),
    enemyTypes: defaultEnemies(),
    levels: [level],
    activeLevelId: level.id,
  };
}

export const useProject = create<ProjectState>((set, get) => ({
  project: initialProject(),
  tool: 'brush',
  brush: T.Solid,
  selectedEnemyTypeId: 'enemy_patrol_0',
  showGrid: true,
  zoom: 1,
  isPlaying: false,
  enemyEditorOpen: false,
  editingEnemyId: null,
  history: [],
  future: [],

  setTool: (tool) => set({ tool }),
  setBrush: (brush) => set({ tool: 'brush', brush }),
  setSelectedEnemy: (id) => set({ selectedEnemyTypeId: id, tool: 'enemy' }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.4, zoom)) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setEnemyEditor: (open, editingId = null) =>
    set({ enemyEditorOpen: open, editingEnemyId: editingId }),

  activeLevel: () => {
    const { project } = get();
    return project.levels.find((l) => l.id === project.activeLevelId)!;
  },

  pushHistory: () => {
    const lvl = get().activeLevel();
    set((s) => ({ history: [...s.history.slice(-49), snapshot(lvl)], future: [] }));
  },

  paintTile: (x, y, record = true) => {
    const { project, tool, brush } = get();
    const lvl = project.levels.find((l) => l.id === project.activeLevelId)!;
    if (x < 0 || y < 0 || x >= lvl.w || y >= lvl.h) return;
    const next = cloneTiles(lvl.tiles);
    if (tool === 'erase') {
      if (next[y]![x] === T.Empty) return;
      if (record) get().pushHistory();
      next[y]![x] = T.Empty;
    } else {
      if (next[y]![x] === brush) return;
      if (record) get().pushHistory();
      if (brush === T.Spawn) sanitizeSpawn(next, x, y);
      else next[y]![x] = brush;
    }
    set((s) => ({
      project: {
        ...s.project,
        levels: s.project.levels.map((l) => (l.id === lvl.id ? { ...l, tiles: next } : l)),
      },
    }));
  },

  setSpawn: (x, y, record = true) => {
    const { project } = get();
    const lvl = project.levels.find((l) => l.id === project.activeLevelId)!;
    if (x < 0 || y < 0 || x >= lvl.w || y >= lvl.h) return;
    if (lvl.tiles[y]![x] === T.Spawn) return;
    if (record) get().pushHistory();
    const next = cloneTiles(lvl.tiles);
    sanitizeSpawn(next, x, y);
    set((s) => ({
      project: {
        ...s.project,
        levels: s.project.levels.map((l) => (l.id === lvl.id ? { ...l, tiles: next } : l)),
      },
    }));
  },

  floodFill: (x, y) => {
    const { project, brush } = get();
    const lvl = project.levels.find((l) => l.id === project.activeLevelId)!;
    if (x < 0 || y < 0 || x >= lvl.w || y >= lvl.h) return;
    const target = lvl.tiles[y]![x]!;
    if (target === brush) return;
    get().pushHistory();
    const next = cloneTiles(lvl.tiles);
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= lvl.w || cy >= lvl.h) continue;
      if (next[cy]![cx] !== target) continue;
      next[cy]![cx] = brush;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    if (brush === T.Spawn) {
      // keep only last spawn — find it and clear rest
      let last: [number, number] | null = null;
      for (let yy = 0; yy < lvl.h; yy++)
        for (let xx = 0; xx < lvl.w; xx++) if (next[yy]![xx] === T.Spawn) last = [xx, yy];
      for (let yy = 0; yy < lvl.h; yy++)
        for (let xx = 0; xx < lvl.w; xx++)
          if (next[yy]![xx] === T.Spawn && (xx !== last![0] || yy !== last![1]))
            next[yy]![xx] = T.Empty;
    }
    set((s) => ({
      project: {
        ...s.project,
        levels: s.project.levels.map((l) => (l.id === lvl.id ? { ...l, tiles: next } : l)),
      },
    }));
  },

  clearLevel: () => {
    get().pushHistory();
    set((s) => {
      const lvl = s.project.levels.find((l) => l.id === s.project.activeLevelId)!;
      return {
        project: {
          ...s.project,
          levels: s.project.levels.map((l) =>
            l.id === lvl.id ? { ...l, tiles: emptyTiles(l.w, l.h), enemies: [] } : l,
          ),
        },
      };
    });
  },

  resizeLevel: (w, h) => {
    const nw = Math.min(100, Math.max(10, Math.round(w)));
    const nh = Math.min(40, Math.max(8, Math.round(h)));
    get().pushHistory();
    set((s) => {
      const lvl = s.project.levels.find((l) => l.id === s.project.activeLevelId)!;
      const tiles = emptyTiles(nw, nh);
      for (let y = 0; y < Math.min(nh, lvl.h); y++)
        for (let x = 0; x < Math.min(nw, lvl.w); x++) tiles[y]![x] = lvl.tiles[y]![x]!;
      return {
        project: {
          ...s.project,
          levels: s.project.levels.map((l) =>
            l.id === lvl.id
              ? { ...l, w: nw, h: nh, tiles, enemies: l.enemies.filter((e) => e.tx < nw && e.ty < nh) }
              : l,
          ),
        },
      };
    });
  },

  placeEnemy: (tx, ty, record = true) => {
    const { selectedEnemyTypeId } = get();
    if (!selectedEnemyTypeId) return;
    if (record) get().pushHistory();
    set((s) => {
      const lvl = s.project.levels.find((l) => l.id === s.project.activeLevelId)!;
      const existing = lvl.enemies.findIndex((e) => e.tx === tx && e.ty === ty);
      let enemies = [...lvl.enemies];
      if (existing >= 0) enemies[existing] = { ...enemies[existing]!, typeId: selectedEnemyTypeId };
      else enemies.push({ id: uid('pl'), typeId: selectedEnemyTypeId, tx, ty });
      return {
        project: {
          ...s.project,
          levels: s.project.levels.map((l) => (l.id === lvl.id ? { ...l, enemies } : l)),
        },
      };
    });
  },

  removeEnemyAt: (tx, ty) => {
    const lvl = get().activeLevel();
    if (!lvl.enemies.some((e) => e.tx === tx && e.ty === ty)) return;
    get().pushHistory();
    set((s) => ({
      project: {
        ...s.project,
        levels: s.project.levels.map((l) =>
          l.id === lvl.id ? { ...l, enemies: l.enemies.filter((e) => !(e.tx === tx && e.ty === ty)) } : l,
        ),
      },
    }));
  },

  undo: () =>
    set((s) => {
      if (!s.history.length) return s;
      const prev = s.history[s.history.length - 1]!;
      const lvl = s.project.levels.find((l) => l.id === s.project.activeLevelId)!;
      return {
        history: s.history.slice(0, -1),
        future: [...s.future, snapshot(lvl)],
        project: {
          ...s.project,
          levels: s.project.levels.map((l) =>
            l.id === lvl.id ? { ...l, tiles: prev.tiles, enemies: prev.enemies } : l,
          ),
        },
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const nxt = s.future[s.future.length - 1]!;
      const lvl = s.project.levels.find((l) => l.id === s.project.activeLevelId)!;
      return {
        future: s.future.slice(0, -1),
        history: [...s.history, snapshot(lvl)],
        project: {
          ...s.project,
          levels: s.project.levels.map((l) =>
            l.id === lvl.id ? { ...l, tiles: nxt.tiles, enemies: nxt.enemies } : l,
          ),
        },
      };
    }),

  addEnemyType: (e) =>
    set((s) => ({
      project: { ...s.project, enemyTypes: [...s.project.enemyTypes, e] },
      selectedEnemyTypeId: e.id,
      tool: 'enemy',
    })),

  updateEnemyType: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        enemyTypes: s.project.enemyTypes.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      },
    })),

  deleteEnemyType: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        enemyTypes: s.project.enemyTypes.filter((e) => e.id !== id),
        levels: s.project.levels.map((l) => ({
          ...l,
          enemies: l.enemies.filter((e) => e.typeId !== id),
        })),
      },
      selectedEnemyTypeId:
        s.selectedEnemyTypeId === id ? (s.project.enemyTypes[0]?.id ?? null) : s.selectedEnemyTypeId,
    })),

  updatePlayer: (patch) =>
    set((s) => ({ project: { ...s.project, player: { ...s.project.player, ...patch } } })),
}));
