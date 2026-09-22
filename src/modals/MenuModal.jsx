/** 菜单弹窗 */
import Modal from './Modal.jsx';
import { ui } from '../state/ui';
import { FG } from '../engine';

export default function MenuModal() {
  const game = FG.game;
  const close = () => ui.set({ modal: null });
  return (
    <Modal onClose={close}>
      <h2>☰ 菜单</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
        <button onClick={close}>继续游戏</button>
        <button onClick={() => {
          close();
          if (game.saveInfo.slot) game.saveTo(game.saveInfo.slot, null);
          else ui.set({ modal: 'saveLoad' });
        }}>保存游戏</button>
        <button id="m-saveload" onClick={() => ui.set({ modal: 'saveLoad' })}>存档管理</button>
        <button onClick={() => ui.set({ techOpen: true, techFocusId: null, modal: null })}>科技树</button>
        <button onClick={() => ui.set({ modal: 'pipelines' })}>⚡ 一键流水线</button>
        <button onClick={() => ui.set({ modal: 'newGame' })}>新建游戏</button>
        <button onClick={() => ui.set({ modal: 'help' })}>帮助</button>
        <button className="danger" onClick={close}>关闭</button>
      </div>
    </Modal>
  );
}
