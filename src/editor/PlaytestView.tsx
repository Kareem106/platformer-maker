import { useEffect, useRef, useState } from 'react';
import { useProject } from '../state/projectStore';
import { createGame, type GameHandle } from '../engine/loop';

export default function PlaytestView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const project = useProject((s) => s.project);
  const setPlaying = useProject((s) => s.setPlaying);
  const [touchMsg] = useState('Arrows/WASD move • Space jump • R restart • ESC stop');

  useEffect(() => {
    const canvas = canvasRef.current!;
    const level = project.levels.find((l) => l.id === project.activeLevelId)!;
    const handle = createGame(canvas, project, level);
    handleRef.current = handle;
    handle.start();
    return () => handle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // touch controls
  function press(key: 'left' | 'right' | 'jump', down: boolean) {
    const h = handleRef.current;
    if (!h) return;
    if (key === 'left') h.input.left = down;
    if (key === 'right') h.input.right = down;
    if (key === 'jump') {
      if (down && !h.input.jump) h.input.jumpPressed = true;
      h.input.jump = down;
    }
  }

  return (
    <div className="playtest">
      <canvas ref={canvasRef} className="play-canvas" />
      <div className="play-bar">
        <span className="muted">{touchMsg}</span>
        <div>
          <button className="mini" onClick={() => handleRef.current?.restart()}>↻ Restart (R)</button>
          <button className="mini" onClick={() => setPlaying(false)}>■ Stop (ESC)</button>
        </div>
      </div>
      <div className="touch-controls">
        <button
          onPointerDown={() => press('left', true)}
          onPointerUp={() => press('left', false)}
          onPointerLeave={() => press('left', false)}
        >
          ◀
        </button>
        <button
          onPointerDown={() => press('right', true)}
          onPointerUp={() => press('right', false)}
          onPointerLeave={() => press('right', false)}
        >
          ▶
        </button>
        <button
          className="jump"
          onPointerDown={() => press('jump', true)}
          onPointerUp={() => press('jump', false)}
          onPointerLeave={() => press('jump', false)}
        >
          ⤒ Jump
        </button>
      </div>
    </div>
  );
}
