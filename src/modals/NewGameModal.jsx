/** 新建游戏弹窗：场景 / 尺寸 / 种子 / 名称 / 槽位 */
import { useState } from 'react';
import Modal from './Modal.jsx';
import { ui } from '../state/ui';
import { FG } from '../engine';

export default function NewGameModal() {
  const [preset, setPreset] = useState('greenfield');
  const [size, setSize] = useState('medium');
  const [slot, setSlot] = useState('1');
  const [seedText, setSeedText] = useState('');
  const [name, setName] = useState('我的工厂');
  const slots = FG.Save.listSlots();
  const close = () => ui.set({ modal: null });

  function start() {
    const parsed = parseInt(seedText, 10);
    const seed = (parsed && parsed > 0) ? parsed : Math.floor(Math.random() * 99999);
    const factoryName = name.trim() || '我的工厂';
    close();
    FG.game.newGame(preset, size, seed, slot, factoryName);
    FG.game.saveTo(slot, factoryName);
  }

  return (
    <Modal onClose={close}>
      <h2>🏭 新建工厂</h2>

      <h3>选择地图场景</h3>
      <div id="ng-maps">
        {FG.Maps.PRESETS.map(p => (
          <div key={p.id}
            className={'map-card' + (preset === p.id ? ' active' : '')}
            style={{ borderColor: preset === p.id ? 'var(--accent)' : undefined }}
            onClick={() => setPreset(p.id)}>
            <div className="mc-name">{p.name}</div>
            <div className="mc-desc">{p.desc}</div>
          </div>
        ))}
      </div>

      <h3>地图尺寸</h3>
      <div style={{ display: 'flex', gap: 6 }}>
        {Object.entries(FG.Config.MAP_SIZES).map(([k, v]) => (
          <button key={k} className={size === k ? 'active' : ''} onClick={() => setSize(k)}>
            {v.label} ({v.w}×{v.h})
          </button>
        ))}
      </div>

      <h3>随机种子</h3>
      <div className="seed-row">
        <input type="text" placeholder="留空随机" value={seedText} onChange={e => setSeedText(e.target.value)} />
        <button onClick={() => setSeedText(String(Math.floor(Math.random() * 99999)))}>🎲</button>
      </div>

      <h3>工厂名称</h3>
      <div className="seed-row">
        <input type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <h3>保存槽位</h3>
      <div style={{ display: 'flex', gap: 6 }}>
        {['1', '2', '3'].map(s => {
          const info = slots.find(x => x.id === s);
          return (
            <button key={s} className={slot === s ? 'active' : ''} onClick={() => setSlot(s)}>
              {s}{info && info.exists ? '（已有存档）' : ''}
            </button>
          );
        })}
      </div>

      <div className="m-btns">
        <button onClick={close}>取消</button>
        <button id="ng-start" className="active" onClick={start}>开始游戏</button>
      </div>
    </Modal>
  );
}
