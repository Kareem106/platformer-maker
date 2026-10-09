import { useEffect, useRef } from 'react';
import { Tile, TILE_NAMES } from '../types';
import { useProject } from '../state/projectStore';
import { paintTileArt } from '../engine/pixelTiles';
import SpriteEditor from './SpriteEditor';

const BRUSHES: Tile[] = [Tile.Solid, Tile.Platform, Tile.Spike, Tile.Coin, Tile.Spawn, Tile.Goal, Tile.Deco];

/** Mini pixel-art preview of a tile, painted with the same art as the game. */
function TileIcon({ tile }: { tile: Tile }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const S = 32;
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, S, S);
    paintTileArt(g, tile, 3, 5, 0, 0, S, {
      grassTop: true,
      coinFrame: 0,
    });
  }, [tile]);
  return <canvas ref={ref} className="tile-icon" width={32} height={32} />;
}

export default function PropsPanel() {
  const tool = useProject((s) => s.tool);
  const brush = useProject((s) => s.brush);
  const setBrush = useProject((s) => s.setBrush);
  const setTool = useProject((s) => s.setTool);
  const enemyTypes = useProject((s) => s.project.enemyTypes);
  const selectedEnemy = useProject((s) => s.selectedEnemyTypeId);
  const setSelectedEnemy = useProject((s) => s.setSelectedEnemy);
  const setEnemyEditor = useProject((s) => s.setEnemyEditor);
  const deleteEnemyType = useProject((s) => s.deleteEnemyType);
  const player = useProject((s) => s.project.player);
  const updatePlayer = useProject((s) => s.updatePlayer);
  const level = useProject((s) => s.project.levels.find((l) => l.id === s.project.activeLevelId)!);
  const resizeLevel = useProject((s) => s.resizeLevel);
  const clearLevel = useProject((s) => s.clearLevel);
  const undo = useProject((s) => s.undo);
  const redo = useProject((s) => s.redo);

  return (
    <aside className="props">
      <section>
        <h3>Tiles</h3>
        <div className="brush-grid">
          {BRUSHES.map((b) => (
            <button
              key={b}
              className={tool === 'brush' && brush === b ? 'brush active' : 'brush'}
              onClick={() => setBrush(b)}
              title={TILE_NAMES[b]}
            >
              <span className="tile-icon-wrap"><TileIcon tile={b} /></span>
              <small>{TILE_NAMES[b]}</small>
            </button>
          ))}
        </div>
        <div className="tool-row">
          <button className={tool === 'brush' ? 'mini active' : 'mini'} onClick={() => setTool('brush')}>Paint</button>
          <button className={tool === 'erase' ? 'mini active' : 'mini'} onClick={() => setTool('erase')}>Erase</button>
          <button className={tool === 'fill' ? 'mini active' : 'mini'} onClick={() => setTool('fill')}>Fill</button>
          <button className="mini" onClick={undo}>↩</button>
          <button className="mini" onClick={redo}>↪</button>
        </div>
      </section>

      <section>
        <div className="sec-head">
          <h3>Enemies</h3>
          <button className="mini primary-mini" onClick={() => setEnemyEditor(true, null)}>+ New</button>
        </div>
        <div className="tool-row">
          <button className={tool === 'enemy' ? 'mini active' : 'mini'} onClick={() => setTool('enemy')}>Place</button>
          <button className={tool === 'eraseEnemy' ? 'mini active' : 'mini'} onClick={() => setTool('eraseEnemy')}>Remove</button>
        </div>
        <div className="enemy-list">
          {enemyTypes.map((e) => (
            <div key={e.id} className={selectedEnemy === e.id ? 'enemy-card active' : 'enemy-card'}>
              <button className="enemy-main" onClick={() => setSelectedEnemy(e.id)}>
                <b>{e.name}</b>
                <small>{e.preset} • ❤{e.hp} • ⚡{e.speed}</small>
              </button>
              <div className="enemy-actions">
                <button title="Edit" onClick={() => setEnemyEditor(true, e.id)}>✏️</button>
                <button title="Delete" onClick={() => deleteEnemyType(e.id)}>🗑</button>
              </div>
            </div>
          ))}
          {enemyTypes.length === 0 && <p className="muted">No enemies yet — create one!</p>}
        </div>
      </section>

      <section>
        <h3>Player</h3>
        <button
          className={tool === 'spawn' ? 'mini active' : 'mini'}
          onClick={() => setTool('spawn')}
          title="Click on the map to place the player spawn"
        >
          📍 {tool === 'spawn' ? 'Click map to set spawn…' : 'Set spawn point'}
        </button>
        {tool === 'spawn' && (
          <p className="muted">Click any tile on the map — the player will spawn there.</p>
        )}
        <details open>
          <summary>Sprite (click to edit)</summary>
          <SpriteEditor pixels={player.pixels} onChange={(p) => updatePlayer({ pixels: p })} cell={13} />
        </details>
        <label className="slider"><span>Speed {player.speed}</span>
          <input type="range" min={120} max={420} step={10} value={player.speed} onChange={(e) => updatePlayer({ speed: Number(e.target.value) })} />
        </label>
        <label className="slider"><span>Jump {player.jumpVelocity}</span>
          <input type="range" min={300} max={800} step={10} value={player.jumpVelocity} onChange={(e) => updatePlayer({ jumpVelocity: Number(e.target.value) })} />
        </label>
        <label className="slider"><span>Gravity {player.gravity}</span>
          <input type="range" min={800} max={2600} step={50} value={player.gravity} onChange={(e) => updatePlayer({ gravity: Number(e.target.value) })} />
        </label>
        <label className="check"><input type="checkbox" checked={player.doubleJump} onChange={(e) => updatePlayer({ doubleJump: e.target.checked })} /> Double jump</label>
        <label className="slider"><span>Lives {player.maxHp}</span>
          <input type="range" min={1} max={6} step={1} value={player.maxHp} onChange={(e) => updatePlayer({ maxHp: Number(e.target.value) })} />
        </label>
      </section>

      <section>
        <h3>Level</h3>
        <div className="level-size">
          <label>W <input type="number" value={level.w} min={10} max={100} onChange={(e) => resizeLevel(Number(e.target.value), level.h)} /></label>
          <label>H <input type="number" value={level.h} min={8} max={40} onChange={(e) => resizeLevel(level.w, Number(e.target.value))} /></label>
        </div>
        <button className="mini danger" onClick={() => { if (confirm('Clear level?')) clearLevel(); }}>Clear level</button>
      </section>
    </aside>
  );
}
