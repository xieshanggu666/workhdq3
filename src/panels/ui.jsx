/** 右侧面板共用的小型展示组件 */
import { FG } from '../engine';

export function Section({ title, children }) {
  return (
    <div className="panel-sec">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}

export function InfoGrid({ children }) {
  return <div className="info-grid">{children}</div>;
}

export function KV({ k, children, vStyle }) {
  return (
    <>
      <div className="k">{k}</div>
      <div className="v" style={vStyle}>{children}</div>
    </>
  );
}

export function ActionRow({ children, style }) {
  return <div className="action-row" style={style}>{children}</div>;
}

export function SlotRow({ name, s, warn }) {
  return (
    <div className={'slot-row' + (warn ? ' slot-warn' : '')}
      title={warn ? '当前配方不再需要，机械臂会将其运走' : ''}>
      <span className="sl-name">{name}</span>
      <div className="sl-bar">
        <div className="fill" style={{ width: Math.min(100, s.count / s.cap * 100).toFixed(0) + '%' }} />
      </div>
      <span className="sl-count">{s ? `${s.count}/${s.cap}` : ''}</span>
    </div>
  );
}

export function ProgressBar({ ratio, color }) {
  return (
    <div className="progress-bar">
      <div className="fill" style={{ width: Math.min(100, ratio * 100).toFixed(1) + '%', background: color }} />
    </div>
  );
}

/** 高/中/低优先级三档按钮（设备供料 / 施工计划 / 维修工单通用） */
export function PrioButtons({ value, options = [['high', '高'], ['normal', '中'], ['low', '低']], onPick, cls = '' }) {
  return (
    <div className={'prio-row ' + cls}>
      {options.map(([id, nm]) => (
        <button key={id}
          className={'prio-btn prio-' + id + (value === id ? ' active' : '')}
          onClick={() => onPick(id)}>{nm}</button>
      ))}
    </div>
  );
}

export function rewardText(reward) {
  return Object.keys(reward).map(k => FG.Items.byId(k).name + '×' + reward[k]).join('　');
}
