/**
 * 设备维护：建筑信息页内嵌的「磨损与维修」卡片（MaintenanceInfo）
 * 与右侧「维修」页签（默认导出 RepairTab：工单/备件/预警/归档）
 */
import { FG } from '../engine';
import { useTick, useEvents } from '../state/hooks';
import { Section, InfoGrid, KV, ActionRow, ProgressBar, PrioButtons } from './ui.jsx';

const MO_PRIO_NAMES = { high: '高优先', normal: '普通', low: '低优先' };
const MO_PRIO_OPTS = [['high', '高'], ['normal', '中'], ['low', '低']];

/** 建筑信息页内嵌卡片（embedded 时不带标题外层样式差异保持与旧版一致） */
export function MaintenanceInfo({ b, bump, embedded }) {
  const mo = FG.game.maintenance;
  const ratio = mo.wearRatio(b);
  const pct = Math.round(ratio * 100);
  const warn = ratio >= FG.Config.WEAR_WARN;

  return (
    <Section title="磨损与维修">
      {b.broken ? (
        <>
          <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>🛠 故障停机：等待维修</div>
          {(() => {
            const o = mo.orderAt(b.x, b.y);
            if (!o) {
              return (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 4 }}>
                    工单已取消，设备仍停机。备件由组装机生产（齿轮×1+铁板×1）。</div>
                  <ActionRow><button onClick={() => mo.report(b)}>重新报修（生成工单）</button></ActionRow>
                </>
              );
            }
            const have = o.stock.sparePart || 0;
            const stateTxt = o.upgrading ? '设备升级中（暂停备料）'
              : o.state === 'repairing' ? '停机检修中…'
              : o.waiting ? '缺备件等待' : '备件已齐备，待检修';
            return (
              <>
                <InfoGrid>
                  <KV k="工单">{o.id} · {MO_PRIO_NAMES[o.priority]}</KV>
                  <KV k="状态" vStyle={{ color: 'var(--orange)' }}>{stateTxt}</KV>
                  <KV k="备件">{have}/{o.need}</KV>
                </InfoGrid>
                {o.state === 'repairing'
                  ? <div style={{ marginTop: 4 }}><ProgressBar ratio={1 - o.repairTimer / FG.Config.REPAIR_TIME_TICKS} /></div>
                  : <div style={{ marginTop: 4 }}><ProgressBar ratio={Math.min(1, have / o.need)} color="var(--orange)" /></div>}
                <div style={{ marginTop: 5 }}>
                  <PrioButtons cls="" value={o.priority} options={MO_PRIO_OPTS}
                    onPick={v => mo.setPriority(o.id, v)} />
                </div>
                <ActionRow style={{ marginTop: 4 }}>
                  <button className="danger" onClick={() => mo.cancel(o.id)}>取消工单（返还备件）</button>
                </ActionRow>
              </>
            );
          })()}
        </>
      ) : (
        <>
          <InfoGrid>
            <KV k="磨损" vStyle={warn ? { color: 'var(--orange)' } : undefined}>{pct}%</KV>
          </InfoGrid>
          <div style={{ marginTop: 3 }}>
            <ProgressBar ratio={ratio / 1} color={warn ? 'var(--orange)' : 'var(--green)'} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
            磨损满后故障停机，自动生成维修工单，按优先级预留备件检修。</div>
        </>
      )}
    </Section>
  );
}

function OrderCard({ game, o }) {
  const b = game.map.buildingAt(o.x, o.y);
  const have = o.stock.sparePart || 0;
  const stTxt = o.upgrading ? { t: '升级中挂起', c: 'st-blocked' }
    : o.state === 'repairing' ? { t: '检修中', c: 'st-active' }
    : o.waiting ? { t: '缺备件', c: 'st-waiting' }
    : { t: '待检修', c: 'st-stage' };
  return (
    <div className="bp-plan">
      <div className="bp-head">
        <span title={o.id}>🛠 {b ? b.def.name : '设备已拆除'}（{o.x},{o.y}）</span>
        <span className={'plan-st ' + stTxt.c}>{stTxt.t}</span>
      </div>
      <ProgressBar ratio={Math.min(1, have / o.need)}
        color={o.state === 'repairing' ? 'var(--green)' : 'var(--orange)'} />
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        备件 {have}/{o.need}
        {o.state === 'repairing' ? ' · 停机检修中' : ''}
        {o.upgrading ? ' · 设备升级中，暂停备料（不占料）' : ''}
      </div>
      <PrioButtons cls="plan-prio" value={o.priority} options={MO_PRIO_OPTS}
        onPick={v => game.maintenance.setPriority(o.id, v)} />
      <ActionRow>
        <button onClick={() => {
          const bb = game.map.buildingAt(o.x, o.y);
          if (bb) game.selectBuilding(bb);
        }}>定位设备</button>
        <button className="danger" onClick={() => game.maintenance.cancel(o.id)}>取消（返还备件）</button>
      </ActionRow>
    </div>
  );
}

export default function RepairTab() {
  const game = FG.game;
  const mo = game.maintenance;
  useTick(200);
  useEvents(['maintenance:change', 'maintenance:breakdown', 'maintenance:repaired', 'selection:change']);

  if (!mo.enabled) {
    return (
      <Section title="🔧 预测性维护">
        <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.8 }}>
          在科技树研究「<b style={{ color: 'var(--accent2)' }}>预测性维护</b>」（前置：高级电子学）后开启：<br />
          · 生产设备随运转积累磨损，磨损满后<b style={{ color: 'var(--red)' }}>故障停机</b>并自动生成维修工单；<br />
          · 工单按<b>高/中/低优先级</b>从全图物流（箱子/地面堆）预留<b>备件</b>，同级轮转公平；<br />
          · 备件齐备后停机检修 2 秒，更换备件、磨损清零、恢复生产；<br />
          · 取消工单或拆除设备返还未用备件；设备升级衔接工单状态；全部状态随存档保存。
        </div>
      </Section>
    );
  }

  const inv = game.inventory();
  const spareN = inv.sparePart || 0;
  const order = { high: 0, normal: 1, low: 2 };
  const sorted = mo.orders.slice().sort((a, b2) => order[a.priority] - order[b2.priority]);

  const warns = [];
  for (const b of game.map.buildings.values()) {
    if (!mo.wearsOut(b) || b.broken) continue;
    if (mo.wearRatio(b) >= FG.Config.WEAR_WARN) warns.push(b);
  }
  warns.sort((a, b2) => mo.wearRatio(b2) - mo.wearRatio(a));

  return (
    <>
      <Section title={'备件库存：' + FG.Utils.fmtNum(spareN)}>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.6 }}>
          备件由<b>组装机</b>生产（齿轮×1 + 铁板×1），经传送带/箱子接入全图物流。<br />
          故障工单自动从箱子/地面堆按优先级预留备件，预留即移出物流。
        </div>
      </Section>

      <Section title={'维修工单（' + mo.orders.length + '）'}>
        {!mo.orders.length && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>暂无故障设备，产线运转正常</div>}
        {sorted.map(o => <OrderCard key={o.id} game={game} o={o} />)}
      </Section>

      <Section title={'高磨损预警（' + warns.length + '）'}>
        {!warns.length && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          暂无磨损超过 {Math.round(FG.Config.WEAR_WARN * 100)}% 的设备</div>}
        {warns.slice(0, 12).map((b, i) => {
          const pct = Math.round(mo.wearRatio(b) * 100);
          return (
            <div className="slot-row" key={i}>
              <span className="sl-name">{b.def.name}（{b.x},{b.y}）</span>
              <div className="sl-bar"><div className="fill" style={{ width: pct + '%', background: 'var(--orange)' }} /></div>
              <span className="sl-count">{pct}%</span>
            </div>
          );
        })}
      </Section>

      {mo.archived.length > 0 && (
        <Section title={'维修记录（' + mo.archived.length + '）'}>
          {mo.archived.slice(0, 10).map((a, i) => {
            const STATE_TXT = { done: '✅ 已修复', canceled: '取消', demolished: '设备拆除' };
            return (
              <div className="slot-row" key={i}>
                <span className="sl-name">{STATE_TXT[a.state] || a.state} · {a.name}（{a.x},{a.y}）</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{a.id} · {FG.Utils.fmtTime(a.at || 0)}</span>
              </div>
            );
          })}
        </Section>
      )}
    </>
  );
}
