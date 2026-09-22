/**
 * 右侧「统计」页：全局状态、瓶颈分析、产出/消耗曲线（Canvas）、累计产量
 */
import { useEffect, useRef, useState } from 'react';
import { FG } from '../engine';
import { useTick } from '../state/hooks';
import { Section, InfoGrid, KV } from './ui.jsx';

function StatsChart({ itemIds }) {
  const game = FG.game;
  const stats = game.stats;
  const [chartItems, setChartItems] = useState(() => itemIds.slice(0, 4));
  const canvasRef = useRef(null);
  useTick(500);

  // 首次出现的物品默认选上前 4 个
  useEffect(() => {
    setChartItems(prev => prev.length ? prev : itemIds.slice(0, 4));
  }, [itemIds.join(',')]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cv.clientWidth, H = cv.clientHeight;
    ctx.fillStyle = '#12151d';
    ctx.fillRect(0, 0, W, H);
    if (!chartItems.length) return;

    let maxV = 1;
    const hist = stats.history;
    for (const id of chartItems) {
      for (const bk of hist) maxV = Math.max(maxV, bk.p[id] || 0, bk.c[id] || 0);
    }
    const pad = 4;
    const step = hist.length > 1 ? (W - pad * 2) / (hist.length - 1) : W;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (H - pad * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    }

    for (const id of chartItems) {
      const color = FG.Items.byId(id).color;
      for (const [kind, key] of [['p', 'p'], ['c', 'c']]) {
        ctx.strokeStyle = kind === 'p' ? color : 'rgba(224,92,92,0.85)';
        ctx.lineWidth = kind === 'p' ? 2 : 1.5;
        ctx.beginPath();
        hist.forEach((bk, i) => {
          const v = bk[key][id] || 0;
          const x = pad + i * step;
          const y = H - pad - (v / maxV) * (H - pad * 2);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#8b93a8';
    ctx.font = '10px Consolas';
    chartItems.forEach((id, i) => {
      const r = stats.rate(id);
      ctx.fillText(`${FG.Items.byId(id).name} 产出${FG.Utils.fmtRate(r.p)}`, pad + 4, 14 + i * 12);
    });
  });

  function toggle(id) {
    setChartItems(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  return (
    <>
      <div className="stats-toolbar">
        {itemIds.map(id => (
          <span key={id} className={'chip-item' + (chartItems.includes(id) ? ' active' : '')}
            onClick={() => toggle(id)}>{FG.Items.byId(id).name}</span>
        ))}
      </div>
      <div className="chart-box"><canvas ref={canvasRef} /></div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
        <span style={{ color: 'var(--green)' }}>■ 产出</span> &nbsp; <span style={{ color: 'var(--red)' }}>■ 消耗</span>
      </div>
    </>
  );
}

export default function StatsTab() {
  const game = FG.game;
  const stats = game.stats;
  useTick(300);

  const defs = stats.deficits();
  const ids = stats.itemIds().slice(0, 16);

  return (
    <>
      <Section title="全局状态">
        <InfoGrid>
          <KV k="建筑">{game.totalBuildings()}</KV>
          <KV k="缺料" vStyle={stats.agg.starveCount ? { color: 'var(--red)' } : undefined}>{stats.agg.starveCount}</KV>
          <KV k="堵塞" vStyle={stats.agg.blockCount ? { color: 'var(--orange)' } : undefined}>{stats.agg.blockCount}</KV>
        </InfoGrid>
      </Section>

      <Section title="瓶颈分析（近 30s 消耗>产出）">
        {(!defs.length && !stats.agg.starveCount && !stats.agg.blockCount)
          ? <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>暂无瓶颈，流水线运转良好</div>
          : (
            <>
              {defs.slice(0, 8).map(d => (
                <div className="bottleneck-item warn" key={d.id}>
                  <span>{FG.Items.byId(d.id).name}</span>
                  <span className="gap">缺口 {FG.Utils.fmtRate(d.gap)}</span>
                </div>
              ))}
              {Object.entries(stats.agg.starveByItem).map(([item, n]) => (
                <div className="bottleneck-item warn" key={'s' + item}>
                  <span>🔴 缺料：{FG.Items.byId(item).name}</span><span className="gap">{n} 座</span>
                </div>
              ))}
              {Object.entries(stats.agg.blockByItem).map(([item, n]) => (
                <div className="bottleneck-item warn" key={'b' + item}>
                  <span>🟠 堵塞：{FG.Items.byId(item).name}</span><span className="gap">{n} 座</span>
                </div>
              ))}
            </>
          )}
      </Section>

      <Section title="产量 / 消耗曲线（近 4 分钟）">
        <StatsChart itemIds={ids} />
      </Section>

      <Section title="累计产量">
        {ids.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>尚无生产记录</div>}
        {ids.map(id => {
          const t = stats.total(id);
          const r = stats.rate(id);
          return (
            <div className="rate-row" key={id}>
              <span className="rk">{FG.Items.byId(id).name}</span>
              <span className="rv">
                {FG.Utils.fmtNum(t.p)} 累计 · {FG.Utils.fmtRate(r.p)} 产出 · {FG.Utils.fmtRate(r.c)} 消耗
              </span>
            </div>
          );
        })}
      </Section>
    </>
  );
}
