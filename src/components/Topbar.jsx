/**
 * 顶栏：时间、速度、暂停、当前研究、物品资源条、蓝图/升级/流水线/科技/菜单入口
 */
import { FG } from '../engine';
import { ui, useUI } from '../state/ui';
import { useTick, useEvents } from '../state/hooks';
import { ItemIcon } from './icons.jsx';

function ItemStrip() {
  const game = FG.game;
  useTick(1000);
  const counts = game.state === 'playing' ? game.inventory() : {};
  const entries = Object.entries(counts).filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div id="item-strip">
      {entries.map(([id, n]) => (
        <div className="item-chip" key={id} title={FG.Items.byId(id).name}>
          <ItemIcon id={id} size={16} />
          <span className="qty">{FG.Utils.fmtNum(n)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Topbar() {
  const game = FG.game;
  const { techOpen } = useUI();
  useTick(200);
  useEvents(['game:start', 'speed:change', 'pause:change',
    'research:start', 'research:complete', 'research:cancel',
    'blueprint:mode', 'upgrade:mode']);

  const mgr = game.research;
  const speed = game.speed;

  return (
    <>
      <header id="topbar">
        <div className="tb-left">
          <span className="logo">⚙ 自动工厂</span>
          <span id="tb-time" className="tb-item">⏱ {FG.Utils.fmtTime(game.playTime)}</span>
        </div>
        <div className="tb-center">
          <div className="speed-btns" id="speed-btns">
            {FG.Config.SPEEDS.map(s => (
              <button key={s} data-speed={s} className={speed === s ? 'active' : ''}
                onClick={() => game.setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button id="btn-pause" className="btn-plain" title="暂停 (空格)" onClick={() => game.togglePause()}>
            {game.paused ? '▶ 继续' : '⏸ 暂停'}
          </button>
        </div>
        <div className="tb-right">
          <div className="research-bar" title="当前研究">
            <span className="rb-label">
              研究: {mgr.current ? mgr.current.name : '未选择'}
            </span>
            <div className="rb-track">
              <div className="rb-fill" style={{
                width: mgr.current ? (mgr.progress() * 100).toFixed(1) + '%' : '0%',
                background: mgr.current ? 'linear-gradient(90deg,#4da3ff,#7cc0ff)' : '#3a4150',
              }} />
            </div>
          </div>
          <button id="btn-blueprint" className={'btn-plain' + (game.bpMode ? ' active' : '')}
            title="蓝图：框选产线生成施工计划 (B)" onClick={() => game.toggleBlueprintMode()}>📐 蓝图</button>
          <button id="btn-upgrade" className={'btn-plain' + (game.upMode ? ' active' : '')}
            title="原地升级：框选产线批量替换为已解锁的高级建筑 (U)"
            onClick={() => game.toggleUpgradeMode()}>⬆ 升级</button>
          <button id="btn-pipeline" className={'btn-plain' + (game.pipelineId ? ' active' : '')}
            title="一键流水线：选择预设产线直接铺在地图上 (P)"
            onClick={() => { if (game.state === 'playing') ui.set({ modal: 'pipelines' }); }}>⚡ 流水线</button>
          <button id="btn-tech" className={'btn-plain' + (techOpen ? ' active' : '')}
            title="科技树 (T)" onClick={() => ui.set({ techOpen: true, techFocusId: null })}>🔬 科技</button>
          <button id="btn-menu" className="btn-plain" title="菜单" onClick={() => ui.set({ modal: 'menu' })}>☰</button>
        </div>
      </header>
      <ItemStrip />
    </>
  );
}
