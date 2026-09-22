/**
 * 右侧面板容器：信息 / 统计 / 施工 / 维修 / 合同 / 日志 页签
 */
import { useState } from 'react';
import { FG } from '../engine';
import { useEvents } from '../state/hooks';
import InfoPanel from './InfoPanel.jsx';
import StatsTab from './StatsTab.jsx';
import BuildTab from './BuildTab.jsx';
import RepairTab from './MaintenancePanel.jsx';
import ContractTab from './ContractPanel.jsx';
import LogTab from './LogTab.jsx';

const TABS = [
  { id: 'info', name: '信息' },
  { id: 'stats', name: '统计' },
  { id: 'build', name: '施工' },
  { id: 'repair', name: '维修' },
  { id: 'contract', name: '合同' },
  { id: 'log', name: '日志' },
];

export default function SidePanel() {
  const [tab, setTab] = useState('info');
  // 接单/维修完成等事件即使停留在其他页也保持状态；游戏开始时重挂载
  useEvents(['game:start']);

  return (
    <aside id="sidepanel">
      <div className="sp-tabs" id="sp-tabs">
        {TABS.map(t => (
          <button key={t.id} data-tab={t.id} className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}>{t.name}</button>
        ))}
      </div>
      <div className="sp-body" id="sp-body" key={FG.game.state + tab}>
        {tab === 'info' && <InfoPanel />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'build' && <BuildTab />}
        {tab === 'repair' && <RepairTab />}
        {tab === 'contract' && <ContractTab />}
        {tab === 'log' && <LogTab />}
      </div>
    </aside>
  );
}
