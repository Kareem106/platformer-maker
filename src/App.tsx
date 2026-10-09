import { useEffect } from 'react';
import { useProject } from './state/projectStore';
import TileCanvas from './editor/TileCanvas';
import PropsPanel from './editor/PropsPanel';
import PlaytestView from './editor/PlaytestView';
import EnemyCreator from './editor/EnemyCreator';
import { downloadGame } from './templates/exportTemplate';

export default function App() {
  const isPlaying = useProject((s) => s.isPlaying);
  const setPlaying = useProject((s) => s.setPlaying);
  const project = useProject((s) => s.project);
  const showGrid = useProject((s) => s.showGrid);
  const toggleGrid = useProject((s) => s.toggleGrid);
  const zoom = useProject((s) => s.zoom);
  const setZoom = useProject((s) => s.setZoom);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useProject.getState().isPlaying) {
        useProject.getState().setPlaying(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // autosave to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('platformer-maker-autosave', JSON.stringify(project));
    } catch {
      /* ignore */
    }
  }, [project]);

  const coins = project.levels
    .find((l) => l.id === project.activeLevelId)!
    .tiles.flat().filter((t) => t === 4).length;
  const enemyCount = project.levels.find((l) => l.id === project.activeLevelId)!.enemies.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🎮</span>
          <div>
            <h1>Platformer Maker</h1>
            <p>draw levels • create enemies • export game</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="stat">🪙 {coins}</span>
          <span className="stat">👾 {enemyCount}</span>
          <button className="mini" onClick={toggleGrid} title="Toggle grid">
            {showGrid ? '🔲 Grid on' : '🔳 Grid off'}
          </button>
          <button className="mini" onClick={() => setZoom(zoom - 0.2)}>−</button>
          <span className="zoom">{Math.round(zoom * 100)}%</span>
          <button className="mini" onClick={() => setZoom(zoom + 0.2)}>+</button>
          {!isPlaying ? (
            <button className="primary" onClick={() => setPlaying(true)}>
              ▶ Playtest
            </button>
          ) : (
            <button className="primary stop" onClick={() => setPlaying(false)}>
              ■ Stop
            </button>
          )}
          <button className="export" onClick={() => downloadGame(project)}>
            ⬇ Export game.html
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="stage">{isPlaying ? <PlaytestView key="play" /> : <TileCanvas />}</div>
        {!isPlaying && <PropsPanel />}
      </main>

      <footer className="foot">
        <span>Paint tiles on the left canvas • pick an enemy → click map to place • stomp enemies in playtest • Export gives you one shareable .html file</span>
      </footer>

      <EnemyCreator />
    </div>
  );
}
