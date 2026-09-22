/**
 * 供货合同：交付站信息页内嵌的邀约/进行中卡片（DeliveryInfo）
 * 与右侧「合同」页签（默认导出 ContractTab：全部进行中合同 + 最近成交）
 */
import { FG } from '../engine';
import { useTick, useEvents } from '../state/hooks';
import { Section, ActionRow, ProgressBar, rewardText } from './ui.jsx';

/** 交付站内嵌卡片 */
export function DeliveryInfo({ b }) {
  const cm = FG.game.contracts;
  useTick(200);
  useEvents(['contracts:change', 'contracts:complete']);
  const c = cm.contractAt(b);

  return (
    <Section title="🤝 供货合同">
      {c ? (
        <div className="bp-plan">
          <div className="bp-head">
            <span>{FG.Items.byId(c.item).name} × {c.qty}</span>
            <span className={'plan-st ' + (cm.remainSec(c) <= 30 ? 'st-blocked' : 'st-active')}>
              剩 {FG.Utils.fmtTime(cm.remainSec(c))}
            </span>
          </div>
          <ProgressBar ratio={Math.min(1, c.delivered / c.qty)} color={cm.remainSec(c) <= 30 ? '#e05c5c' : '#37c9b0'} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            已锁付 {c.delivered}/{c.qty}（列车到站卸货自动计入，不进站货位）
          </div>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            奖励：<b style={{ color: 'var(--accent2)' }}>{rewardText(c.reward)}</b>（完成入站货位）
          </div>
          <ActionRow style={{ marginTop: 5 }}>
            <button className="danger" onClick={() => cm.cancel(c.id)}>取消合同（释放锁付）</button>
          </ActionRow>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 6 }}>
            承接后用<b>列车分批</b>把货物运抵本站。卸入的合同货物立即锁付、独立记账（生产/施工不可动用）；交齐发放科研物资，逾期/取消则释放锁付货物。
          </div>
          {cm.getOffers(b).length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>暂无可接合同</div>}
          {cm.getOffers(b).map((o, i) => (
            <div className="bp-plan" key={i} style={{ marginBottom: 6 }}>
              <div className="bp-head">
                <span>{FG.Items.byId(o.item).name} × {o.qty}</span>
                <span className="plan-st st-waiting">期限 {o.duration}s</span>
              </div>
              <div style={{ fontSize: 11, margin: '2px 0' }}>
                奖励：<b style={{ color: 'var(--accent2)' }}>{rewardText(o.reward)}</b>
              </div>
              <ActionRow style={{ marginTop: 3 }}>
                <button onClick={() => cm.acceptOffer(b, i)}>接单</button>
              </ActionRow>
            </div>
          ))}
          <ActionRow style={{ marginTop: 4 }}>
            <button onClick={() => cm.refreshOffers(b)}>🔄 刷新邀约</button>
          </ActionRow>
        </>
      )}
    </Section>
  );
}

export default function ContractTab() {
  const game = FG.game;
  const cm = game.contracts;
  useTick(200);
  useEvents(['contracts:change', 'contracts:complete']);

  return (
    <>
      <Section title={'进行中的供货合同（' + cm.active.length + '）'}>
        {cm.active.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7 }}>
            研究「供货合同」科技后建造<b>交付站</b>（轨道旁），在交付站面板承接合同，
            再用列车把工厂产品分批运抵交付站。<br />
            锁付货物与生产、施工统一争料却独立记账，完成后发放科研物资。
          </div>
        )}
        {cm.active.map(c => {
          const st = game.railway.stationById(c.stationId);
          const remain = cm.remainSec(c);
          const late = remain <= 30;
          return (
            <div className="bp-plan" key={c.id}>
              <div className="bp-head">
                <span title={c.id}>
                  {st ? '📍 ' + st.stationName : '⚠ 站点已拆除'} · {FG.Items.byId(c.item).name}×{c.qty}
                </span>
                <span className={'plan-st ' + (late ? 'st-blocked' : 'st-active')}>{FG.Utils.fmtTime(remain)}</span>
              </div>
              <ProgressBar ratio={Math.min(1, c.delivered / c.qty)} color={late ? '#e05c5c' : '#37c9b0'} />
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                已锁付 {c.delivered}/{c.qty} · 奖励 {rewardText(c.reward)}
              </div>
              <ActionRow style={{ marginTop: 4 }}>
                {st && <button onClick={() => game.selectBuilding(st)}>定位交付站</button>}
                <button className="danger" onClick={() => cm.cancel(c.id)}>取消</button>
              </ActionRow>
            </div>
          );
        })}
      </Section>

      <Section title={'最近成交（' + cm.history.length + '）'}>
        {cm.history.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>尚无完成的合同</div>}
        {cm.history.slice(0, 10).map((r, i) => (
          <div className="slot-row" key={i}>
            <span className="sl-name">✅ {FG.Items.byId(r.item).name}×{r.qty}</span>
            <span style={{ color: 'var(--accent2)', fontSize: 11 }}>{rewardText(r.reward)}</span>
          </div>
        ))}
      </Section>
    </>
  );
}
