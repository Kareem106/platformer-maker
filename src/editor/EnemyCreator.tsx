import { useEffect, useState } from 'react';
import { ENEMY_PRESETS, uid, type EnemyPreset, type PixelGrid } from '../types';
import { useProject } from '../state/projectStore';
import { defaultEnemyPixels } from '../state/defaults';
import SpriteEditor from './SpriteEditor';

export default function EnemyCreator() {
  const open = useProject((s) => s.enemyEditorOpen);
  const editingId = useProject((s) => s.editingEnemyId);
  const enemyTypes = useProject((s) => s.project.enemyTypes);
  const addEnemyType = useProject((s) => s.addEnemyType);
  const updateEnemyType = useProject((s) => s.updateEnemyType);
  const setEditor = useProject((s) => s.setEnemyEditor);

  const editing = editingId ? (enemyTypes.find((e) => e.id === editingId) ?? null) : null;

  const [name, setName] = useState('');
  const [preset, setPreset] = useState<EnemyPreset>('patrol');
  const [pixels, setPixels] = useState<PixelGrid>(() => defaultEnemyPixels(0));
  const [hp, setHp] = useState(1);
  const [speed, setSpeed] = useState(80);
  const [damage, setDamage] = useState(1);
  const [range, setRange] = useState(260);
  const [shootCd, setShootCd] = useState(1.6);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setPreset(editing.preset);
      setPixels(editing.pixels.map((r) => [...r]));
      setHp(editing.hp);
      setSpeed(editing.speed);
      setDamage(editing.damage);
      setRange(editing.range);
      setShootCd(editing.shootCooldown);
    } else {
      setName(`Enemy ${enemyTypes.length + 1}`);
      setPreset('patrol');
      setPixels(defaultEnemyPixels(enemyTypes.length));
      setHp(1);
      setSpeed(80);
      setDamage(1);
      setRange(260);
      setShootCd(1.6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setEditor(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{editing ? `Edit ${editing.name}` : 'New enemy'}</h2>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </label>
        <SpriteEditor pixels={pixels} onChange={setPixels} />
        <div className="field">
          <span>Behavior preset</span>
          <div className="preset-grid">
            {ENEMY_PRESETS.map((p) => (
              <button
                key={p.id}
                className={preset === p.id ? 'preset active' : 'preset'}
                onClick={() => setPreset(p.id)}
                title={p.desc}
              >
                <b>{p.name}</b>
                <small>{p.desc}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="sliders">
          <Slider label={`HP ${hp}`} min={1} max={5} step={1} value={hp} onChange={setHp} />
          <Slider label={`Speed ${speed}`} min={20} max={300} step={5} value={speed} onChange={setSpeed} />
          <Slider label={`Damage ${damage}`} min={1} max={3} step={1} value={damage} onChange={setDamage} />
          {(preset === 'chaser' || preset === 'shooter' || preset === 'turret') && (
            <Slider label={`Range ${range}`} min={100} max={500} step={10} value={range} onChange={setRange} />
          )}
          {(preset === 'shooter' || preset === 'turret') && (
            <Slider
              label={`Shoot every ${shootCd.toFixed(1)}s`}
              min={0.5}
              max={4}
              step={0.1}
              value={shootCd}
              onChange={setShootCd}
            />
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={() => setEditor(false)}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => {
              if (editing) {
                updateEnemyType(editing.id, {
                  name: name || 'Enemy',
                  preset,
                  pixels,
                  hp,
                  speed,
                  damage,
                  range,
                  shootCooldown: shootCd,
                });
              } else {
                addEnemyType({
                  id: uid('enemy'),
                  name: name || 'Enemy',
                  preset,
                  pixels,
                  hp,
                  speed,
                  damage,
                  range,
                  jumpPower: 480,
                  shootCooldown: shootCd,
                  size: 1,
                });
              }
              setEditor(false);
            }}
          >
            {editing ? 'Save' : 'Create & place'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}
