import { useEffect, useRef, useState } from 'react';
import type { PixelGrid } from '../types';

const PALETTE = [
  '#22222a', '#ffffff', '#ffd9a0', '#e23b3b', '#f25555',
  '#f0a13c', '#ffd94d', '#7dd956', '#3d8b2f', '#5cff8a',
  '#5cc8e6', '#2f6df6', '#1d5f7a', '#b678f0', '#f06ac8',
  '#a06a35', '#6b4a2f', '#9adcff', '#ff3b3b', '#d8dce6',
];

interface Props {
  pixels: PixelGrid;
  onChange: (p: PixelGrid) => void;
  cell?: number;
}

export default function SpriteEditor({ pixels, onChange, cell = 20 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(PALETTE[3]!);
  const [erasing, setErasing] = useState(false);
  const drawing = useRef(false);

  const N = pixels.length;
  const CELL = cell;

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = N * CELL;
    c.height = N * CELL;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels]);

  function draw() {
    const c = canvasRef.current!;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    // checkerboard for transparency
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if ((x + y) % 2 === 0) {
          g.fillStyle = '#2a2d3d';
          g.fillRect(x * CELL, y * CELL, CELL, CELL);
        } else {
          g.fillStyle = '#232636';
          g.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const col = pixels[y]![x];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      g.beginPath();
      g.moveTo(i * CELL + 0.5, 0);
      g.lineTo(i * CELL + 0.5, N * CELL);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * CELL + 0.5);
      g.lineTo(N * CELL, i * CELL + 0.5);
      g.stroke();
    }
  }

  function paintAt(e: React.MouseEvent, eraseOverride?: boolean) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const erase = eraseOverride ?? erasing;
    const next = pixels.map((row) => [...row]);
    next[y]![x] = erase ? null : color;
    onChange(next);
  }

  return (
    <div className="sprite-editor">
      <div className="sprite-row">
        <canvas
          ref={canvasRef}
          className="sprite-canvas"
          style={{ width: N * CELL, height: N * CELL }}
          onMouseDown={(e) => {
            drawing.current = true;
            paintAt(e, e.button === 2);
          }}
          onMouseMove={(e) => {
            if (drawing.current) paintAt(e);
          }}
          onMouseUp={() => (drawing.current = false)}
          onMouseLeave={() => (drawing.current = false)}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="sprite-side">
          <div className="palette">
            {PALETTE.map((p) => (
              <button
                key={p}
                className={`swatch ${color === p && !erasing ? 'active' : ''}`}
                style={{ background: p }}
                title={p}
                onClick={() => {
                  setColor(p);
                  setErasing(false);
                }}
              />
            ))}
          </div>
          <div className="sprite-tools">
            <button className={!erasing ? 'mini active' : 'mini'} onClick={() => setErasing(false)}>
              🖌 Paint
            </button>
            <button className={erasing ? 'mini active' : 'mini'} onClick={() => setErasing(true)}>
              🧽 Erase
            </button>
            <button
              className="mini"
              onClick={() => onChange(pixels.map((row) => row.map(() => null)))}
            >
              Clear
            </button>
          </div>
          <div className="hint">Left-click paint • Right-click erase • {N}×{N}</div>
        </div>
      </div>
    </div>
  );
}
