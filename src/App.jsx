/**
 * App：整体布局 + 全局键盘快捷键 + 首启弹窗
 * 顶栏 / 工具栏 / 地图 / 侧栏均为 React 组件；弹窗与科技树由 UI 状态驱动
 */
import { useEffect } from 'react';
import { FG } from './engine';
import { ui, useUI } from './state/ui';
import Topbar from './components/Topbar.jsx';
import Toolbar from './components/Toolbar.jsx';
import MapWrap from './components/MapWrap.jsx';
import SidePanel from './panels/SidePanel.jsx';
import TechTree from './components/TechTree.jsx';
import NewGameModal from './modals/NewGameModal.jsx';
import SaveLoadModal from './modals/SaveLoadModal.jsx';
import MenuModal from './modals/MenuModal.jsx';
import HelpModal from './modals/HelpModal.jsx';
import PipelinesModal from './modals/PipelinesModal.jsx';

export default function App() {
  const { modal, techOpen } = useUI();

  // 全局键盘（Esc / 空格 / 快捷键）。弹窗开关状态从 UI store 实时读取，避免闭包过期
  useEffect(() => {
    function onKeyDown(e) {
      const { modal, techOpen } = ui.get();
      const g = FG.game;

      if (e.key === 'Escape') {
        if (modal) { ui.set({ modal: null }); return; }
        if (techOpen) { ui.set({ techOpen: false }); return; }
        if (g.upMode) { g.cancelUpgradePreview(); return; }
        if (g.bpMode) { g.exitBlueprintMode(); return; }
        if (g.ghost) { g.cancelGhost(); return; }
        g.selection = null;
        FG.Events.emit('selection:change');
        return;
      }
      if (modal || techOpen) return;

      switch (e.key) {
        case 'r': case 'R':
          if (g.bpMode === 'place') g.rotateBlueprint();
          else if (g.ghost) g.rotateGhost();
          else if (g.selection && !g.selection.isTrain
                   && (g.selection.def.beltTier !== undefined || g.selection.def.inserterTier !== undefined)) {
            g.selection.dir = (g.selection.dir + 1) % 4;
            FG.Events.emit('selection:change');
          }
          break;
        case 'u': case 'U': g.toggleUpgradeMode(); break;
        case 'f': case 'F':
          if (g.bpMode === 'place' && g.pipelineId) g.refindPipelineAnchor();
          break;
        case 'p': case 'P':
          if (g.state === 'playing') ui.set({ modal: 'pipelines' });
          break;
        case 'b': case 'B': g.toggleBlueprintMode(); break;
        case 'Delete': case 'Backspace':
          if (g.selection && g.selection.isTrain) g.removeTrainSelection();
          else if (g.selection) g.removeBuilding(g.selection);
          break;
        case ' ':
          e.preventDefault();
          g.togglePause();
          break;
        case 't': case 'T': ui.set({ techOpen: true, techFocusId: null }); break;
        case 's': case 'S': g.showStatus = !g.showStatus; break;
        case '1': g.setSpeed(0.5); break;
        case '2': g.setSpeed(1); break;
        case '3': g.setSpeed(2); break;
        case '4': g.setSpeed(4); break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 首启：有存档显示帮助，无存档直接引导新建
  useEffect(() => {
    const hasSave = FG.Save.listSlots().some(s => s.exists);
    ui.set({ modal: hasSave ? 'help' : 'newGame' });
  }, []);

  return (
    <>
      <Topbar />
      <div id="layout">
        <Toolbar />
        <MapWrap />
        <SidePanel />
      </div>
      {techOpen && <TechTree />}
      {modal === 'newGame' && <NewGameModal />}
      {modal === 'saveLoad' && <SaveLoadModal />}
      {modal === 'menu' && <MenuModal />}
      {modal === 'help' && <HelpModal />}
      {modal === 'pipelines' && <PipelinesModal />}
    </>
  );
}
