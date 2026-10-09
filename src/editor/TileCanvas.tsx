import { useEffect, useRef } from 'react';
import { Tile, TILE_SIZE } from '../types';
import { useProject } from '../state/projectStore';
import { pixelsToCanvas } from '../engine/renderer';

const TILE_COLORS: Record<number, string> = {
  [Tile.Solid]: '#7d5a3c',
  [Tile.Platform]: '#c98d4e',
  [Tile.Spike]: '#d8dce6',
  [Tile.Coin]: '#ffd94d',
  [Tile.Spawn]: '#5cff8a',
  [Tile.Goal]: '#ffd94d',
  [Tile.Deco]: '#3f9e4d',
};

export default function TileCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const project = useProject((s) => s.project);
  const tool = useProject((s) => s.tool);
  const zoom = useProject((s) => s.zoom);
  const showGrid = useProject((s) => s.showGrid);
  const level = project.levels.find((l) => l.id === project.activeLevelId)!;
  const isDown = useRef(false);
  const strokeStarted = useRef(false);

  const CELL = Math.round(30 * zoom);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = level.w * CELL;
    canvas.height = level.h * CELL;
    const g = canvas.getContext('2d')!;
    // bg
    const grad = g.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1b2340');
    grad.addColorStop(1, '#2b3a67');
    g.fillStyle = grad;
    g.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const t = level.tiles[y]![x]!;
        if (t === Tile.Empty) continue;
        drawEditorTile(g, t, x * CELL, y * CELL, CELL);
      }
    }

    // player spawn preview — draw player sprite standing on the spawn tile
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (level.tiles[y]![x] !== Tile.Spawn) continue;
        try {
          const spr = pixelsToCanvas(project.player.pixels, 2);
          g.save();
          if (tool === 'spawn') {
            g.fillStyle = 'rgba(92,255,138,0.25)';
            g.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
          // draw player standing on top of the spawn tile
          g.drawImage(spr, x * CELL, y * CELL - CELL * 0.9, CELL, CELL);
          g.restore();
        } catch {
          /* ignore sprite errors */
        }
      }
    }

    // enemies
    for (const e of level.enemies) {
      const def = project.enemyTypes.find((d) => d.id === e.typeId);
      if (!def) continue;
      const spr = pixelsToCanvas(def.pixels, 2);
      g.save();
      g.fillStyle = 'rgba(255,80,80,0.25)';
      g.fillRect(e.tx * CELL, e.ty * CELL, CELL, CELL);
      g.drawImage(spr, e.tx * CELL, e.ty * CELL, CELL, CELL);
      g.fillStyle = '#ff8a8a';
      g.font = `bold ${Math.max(9, CELL * 0.32)}px system-ui`;
      g.fillText(def.name.slice(0, 8), e.tx * CELL + 2, e.ty * CELL + 11);
      g.restore();
    }

    if (showGrid) {
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 1;
      for (let x = 0; x <= level.w; x++) {
        g.beginPath();
        g.moveTo(x * CELL + 0.5, 0);
        g.lineTo(x * CELL + 0.5, level.h * CELL);
        g.stroke();
      }
      for (let y = 0; y <= level.h; y++) {
        g.beginPath();
        g.moveTo(0, y * CELL + 0.5);
        g.lineTo(level.w * CELL, y * CELL + 0.5);
        g.stroke();
      }
    }
  }, [level, project.enemyTypes, project.player.pixels, CELL, showGrid, tool]);

  function coords(e: React.MouseEvent): [number, number] {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const px = (e.clientX - r.left) * scaleX;
    const py = (e.clientY - r.top) * scaleY;
    return [Math.floor(px / CELL), Math.floor(py / CELL)];
  }

  function handleDown(e: React.MouseEvent) {
    isDown.current = true;
    strokeStarted.current = false;
    applyAt(e, true);
  }

  function handleMove(e: React.MouseEvent) {
    if (!isDown.current) return;
    applyAt(e, false);
  }

  function applyAt(e: React.MouseEvent, isStart: boolean) {
    const [tx, ty] = coords(e);
    const st = useProject.getState();
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return;
    if (st.tool === 'brush' || st.tool === 'erase') {
      if (isStart) {
        st.pushHistory();
        strokeStarted.current = true;
      }
      st.paintTile(tx, ty, false);
    } else if (st.tool === 'fill') {
      if (isStart) st.floodFill(tx, ty);
    } else if (st.tool === 'spawn') {
      if (isStart) {
        st.pushHistory();
        strokeStarted.current = true;
      }
      st.setSpawn(tx, ty, false);
    } else if (st.tool === 'enemy') {
      if (isStart) st.placeEnemy(tx, ty);
    } else if (st.tool === 'eraseEnemy') {
      if (isStart) {
        st.pushHistory();
        const lvl = st.activeLevel();
        const filtered = lvl.enemies.filter((en) => !(en.tx === tx && en.ty === ty));
        // direct set without extra history
        useProject.setState((s) => ({
          project: {
            ...s.project,
            levels: s.project.levels.map((l) =>
              l.id === lvl.id ? { ...l, enemies: filtered } : l,
            ),
          },
          history: s.history, // already pushed
        }));
        void strokeStarted;
      }
    }
  }

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-meta">
        <span>
          {level.name} — {level.w}×{level.h} tiles ({level.w * TILE_SIZE}×{level.h * TILE_SIZE}px) • tool:{' '}
          {tool}
        </span>
        <span className="legend">
          {Object.entries(TILE_COLORS).map(([k, c]) => (
            <i key={k} style={{ background: c }} />
          ))}
        </span>
      </div>
      <div className="canvas-scroll">
        <canvas
          ref={canvasRef}
          className="level-canvas"
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={() => (isDown.current = false)}
          onMouseLeave={() => (isDown.current = false)}
          onContextMenu={(ev) => ev.preventDefault()}
        />
      </div>
    </div>
  );
}

function drawEditorTile(g: CanvasRenderingContext2D, t: number, px: number, py: number, s: number) {
  if (t === Tile.Solid) {
    g.fillStyle = '#6b4a2f';
    g.fillRect(px, py, s, s);
    g.fillStyle = '#7d5a3c';
    g.fillRect(px + 2, py + 2, s - 4, s - 4);
    g.fillStyle = '#5fce5c';
    g.fillRect(px, py, s, Math.max(3, s * 0.22));
  } else if (t === Tile.Platform) {
    g.fillStyle = '#c98d4e';
    g.fillRect(px, py + s * 0.3, s, s * 0.32);
  } else if (t === Tile.Spike) {
    g.fillStyle = '#2b2b36';
    g.fillRect(px, py, s, s);
    g.fillStyle = '#d8dce6';
    const n = 4;
    for (let i = 0; i < n; i++) {
      const sx = px + (i * s) / n;
      g.beginPath();
      g.moveTo(sx, py + s);
      g.lineTo(sx + s / n / 2, py + s * 0.25);
      g.lineTo(sx + s / n, py + s);
      g.closePath();
      g.fill();
    }
  } else if (t === Tile.Coin) {
    g.fillStyle = 'rgba(255,217,77,0.2)';
    g.fillRect(px, py, s, s);
    g.fillStyle = '#ffd94d';
    g.beginPath();
    g.arc(px + s / 2, py + s / 2, s * 0.28, 0, Math.PI * 2);
    g.fill();
  } else if (t === Tile.Spawn) {
    g.fillStyle = 'rgba(92,255,138,0.3)';
    g.fillRect(px, py, s, s);
    g.fillStyle = '#5cff8a';
    g.font = `bold ${Math.max(9, s * 0.3)}px system-ui`;
    g.fillText('▶', px + s * 0.32, py + s * 0.65);
  } else if (t === Tile.Goal) {
    g.fillStyle = 'rgba(255,217,77,0.3)';
    g.fillRect(px, py, s, s);
    g.fillStyle = '#3a2f00';
    g.font = `bold ${Math.max(8, s * 0.26)}px system-ui`;
    g.fillText('🏁', px + s * 0.15, py + s * 0.68);
  } else if (t === Tile.Deco) {
    g.strokeStyle = '#3f9e4d';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px + s * 0.3, py + s);
    g.quadraticCurveTo(px + s * 0.5, py + s * 0.4, px + s * 0.7, py + s * 0.3);
    g.stroke();
  }
}
