/** 存档管理：多槽位载入/保存/删除/导出/导入 */
import { useRef } from 'react';
import Modal from './Modal.jsx';
import { ui } from '../state/ui';
import { useRerender } from '../state/hooks';
import { FG } from '../engine';

function SlotRow({ id, info, reload }) {
  const fileRef = useRef(null);

  function importFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const obj = FG.Save.importText(String(reader.result));
      if (!obj) { alert('导入失败：无效的存档文件'); return; }
      FG.Save.saveToSlot(id, obj.meta || { name: '导入存档', playTime: 0, date: new Date().toLocaleString('zh-CN') }, obj.data);
      reload();
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <div className="save-row">
      <div className="sr-info">
        {info.exists ? (
          <>
            <div className="sr-name">{info.meta.name || '存档'}</div>
            <div className="sr-meta">
              槽位 {id} · 游戏时间 {FG.Utils.fmtTime(info.meta.playTime || 0)} · {info.meta.date || ''}
            </div>
          </>
        ) : <div className="sr-empty">槽位 {id} · 空</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className="sl-load" disabled={!info.exists} onClick={() => {
          ui.set({ modal: null });
          FG.game.loadSlot(id);
        }}>载入</button>
        <button className="sl-save" onClick={() => { FG.game.saveTo(id, null); reload(); }}>保存</button>
        <button className="sl-export" disabled={!info.exists} onClick={() => FG.Save.exportSlot(id)}>导出</button>
        <button className="sl-del danger" disabled={!info.exists} onClick={() => {
          FG.Save.deleteSlot(id);
          if (FG.game.saveInfo.slot === id) FG.game.saveInfo.slot = null;
          reload();
        }}>删除</button>
        <label className="sl-import" style={{ cursor: 'pointer' }}>
          <input type="file" accept=".json" hidden ref={fileRef} onChange={importFile} />导入
        </label>
      </div>
    </div>
  );
}

export default function SaveLoadModal() {
  const close = () => ui.set({ modal: null });
  // 用 key 自增强制重新读取槽位列表
  const slots = FG.Save.listSlots();
  const bump = useRerender();
  const all = ['1', '2', '3', 'auto'];

  return (
    <Modal onClose={close}>
      <h2>💾 存档管理</h2>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 10 }}>
        自动存档每 {FG.Config.AUTOSAVE_SEC}s 写入「auto」槽位。可导出 JSON 备份或导入恢复。
      </div>
      {all.map(id => (
        <SlotRow key={id} id={id} info={slots.find(x => x.id === id) || { exists: false }} reload={bump} />
      ))}
      <div className="m-btns"><button onClick={close}>关闭</button></div>
    </Modal>
  );
}
