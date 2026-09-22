/**
 * 科技树弹窗：Canvas 绘制节点图（拖拽平移 / 滚轮缩放 / 点击选中）
 * 右侧详情卡片由 React 渲染；定位请求（techFocusId）在打开时生效
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { FG } from '../engine';
import { ui, useUI } from '../state/ui';
import { useEvents } from '../state/hooks';

const NODE_R = 27;
const COL_W = 250, ROW_H = 120, M = 50;

function layout() {
  const pos = {};
  let maxX = 0, maxY = 0;
  for (const t of FG.Research.list()) {
    pos[t.id] = { x: M + t.col * COL_W, y: M + t.row * ROW_H };
    maxX = Math.max(maxX, t.col);
    maxY = Math.max(maxY, t.row);
  }
  return { pos, w: (maxX + 1) * COL_W + M * 2, h: (maxY + 1) * ROW_H + M * 2 };
}

function nodeState(id, mgr) {
  if (mgr.isDone(id)) return 'done';
  if (mgr.current && mgr.current.id === id) return 'current';
  const t = FG.Research.byId(id);
  return t.prereq.every(p => mgr.isDone(p)) ? 'available' : 'locked';
}

export default function TechTree() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const view = useRef({ zoom: 0.85, panX: 20, panY: 20 });
  const drag = useRef(null);
  const hoverId = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const { techFocusId } = useUI();

  useEvents(['research:start', 'research:complete', 'research:cancel', 'unlock']);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !FG.game.map) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.fillStyle = '#0f121a';
    ctx.fillRect(0, 0, W, H);

    const L = layout();
    const mgr = FG.game.research;
    const v = view.current;

    ctx.save();
    ctx.translate(v.panX, v.panY);
    ctx.scale(v.zoom, v.zoom);

    for (const t of FG.Research.list()) {
      const p = L.pos[t.id];
      for (const pre of t.prereq) {
        const pp = L.pos[pre];
        if (!pp) continue;
        const done = mgr.isDone(pre);
        ctx.strokeStyle = done ? 'rgba(88,194,111,0.7)' : '#3a4150';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pp.x + NODE_R, pp.y);
        const midX = (pp.x + p.x) / 2;
        ctx.bezierCurveTo(midX, pp.y, midX, p.y, p.x - NODE_R, p.y);
        ctx.stroke();
      }
    }

    for (const t of FG.Research.list()) {
      const p = L.pos[t.id];
      const st = nodeState(t.id, mgr);
      const colors = { done: '#58c26f', available: '#4da3ff', current: '#e8a33d', locked: '#3a4150' };
      const isHover = hoverId.current === t.id;
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_R + (isHover ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = colors[st];
      ctx.globalAlpha = st === 'locked' ? 0.55 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (st === 'current') {
        ctx.strokeStyle = '#ffd27a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, NODE_R + 6, 0, Math.PI * 2); ctx.stroke();
      }
      const iconType = t.unlocksB[0];
      if (iconType) {
        const icon = FG.Renderer.buildingIcon(iconType, 34);
        ctx.drawImage(icon, p.x - 17, p.y - 17, 34, 34);
      } else {
        ctx.fillStyle = '#0d0f14';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', p.x, p.y + 1);
      }
      ctx.fillStyle = st === 'locked' ? '#7a8194' : '#d6dbe8';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.name, p.x, p.y + NODE_R + 14);
    }
    ctx.restore();

    ctx.fillStyle = '#8b93a8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    let ly = 20;
    for (const [k, v2] of [['已完成', '#58c26f'], ['可研究', '#4da3ff'], ['研究中', '#e8a33d'], ['未解锁', '#3a4150']]) {
      ctx.fillStyle = v2;
      ctx.fillRect(12, ly - 9, 12, 12);
      ctx.fillStyle = '#8b93a8';
      ctx.fillText(k, 30, ly);
      ly += 18;
    }
  }, []);

  // 尺寸自适应
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const L = layout();
    const fit = Math.min(rect.width / L.w, rect.height / L.h);
    view.current.zoom = Math.min(fit, view.current.zoom || fit);
    draw();
  }, [draw]);

  const nodeAtEvent = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const L = layout();
    const v = view.current;
    for (const [id, p] of Object.entries(L.pos)) {
      const nx = p.x * v.zoom + v.panX;
      const ny = p.y * v.zoom + v.panY;
      if (Math.hypot(sx - nx, sy - ny) < NODE_R * v.zoom + 8) return id;
    }
    return null;
  }, []);

  const focusNode = useCallback((id) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const L = layout();
    const p = L.pos[id];
    const rect = wrap.getBoundingClientRect();
    view.current.zoom = Math.min(rect.width / L.w, rect.height / L.h, 1);
    view.current.panX = rect.width / 2 - p.x * view.current.zoom;
    view.current.panY = rect.height / 2 - p.y * view.current.zoom;
    setSelectedId(id);
    draw();
  }, [draw]);

  // 打开时：适配尺寸 → 初次绘制 → 处理定位请求
  useEffect(() => {
    resize();
    if (techFocusId) focusNode(techFocusId);
    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 画布交互（mousemove/mouseup 监听在 window 上以拖出画布仍可跟踪）
  useEffect(() => {
    const canvas = canvasRef.current;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const v = view.current;
      const nz = Math.min(1.6, Math.max(0.3, v.zoom * factor));
      v.panX = mx - (mx - v.panX) * (nz / v.zoom);
      v.panY = my - (my - v.panY) * (nz / v.zoom);
      v.zoom = nz;
      draw();
    };
    const onDown = (e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; };
    const onMove = (e) => {
      const d = drag.current;
      if (d) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
        view.current.panX += dx;
        view.current.panY += dy;
        d.x = e.clientX; d.y = e.clientY;
        draw();
      }
      const n = nodeAtEvent(e);
      if (n !== hoverId.current) { hoverId.current = n; draw(); }
    };
    const onUp = (e) => {
      const d = drag.current;
      drag.current = null;
      if (d && !d.moved) {
        const n = nodeAtEvent(e);
        if (n) setSelectedId(n);
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draw, nodeAtEvent]);

  // 节点选中 / 研究状态变化（useEvents 触发渲染）后同步重绘画布
  useEffect(() => { draw(); });

  const mgr = FG.game.research;
  const sel = selectedId ? FG.Research.byId(selectedId) : null;
  const selState = selectedId ? nodeState(selectedId, mgr) : null;
  const selPos = selectedId ? layout().pos[selectedId] : null;

  let detailStyle = null;
  if (selPos && wrapRef.current) {
    const rect = wrapRef.current.getBoundingClientRect();
    const v = view.current;
    detailStyle = {
      left: Math.min(rect.width - 250, selPos.x * v.zoom + v.panX + 30),
      top: Math.max(10, Math.min(rect.height - 200, selPos.y * v.zoom + v.panY - 40)),
    };
  }

  return (
    <div id="tech-tree">
      <div className="tt-head">
        <h2>🔬 科技树</h2>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>滚轮缩放 · 拖拽平移 · 点击节点研究</span>
        <button onClick={() => ui.set({ techOpen: false })}>关闭 (Esc)</button>
      </div>
      <div id="tech-wrap" ref={wrapRef}>
        <canvas id="tech-canvas" ref={canvasRef} />
        {sel && (
          <div id="tech-detail" style={detailStyle || undefined}>
            <h4>{sel.name}</h4>
            {selState === 'current' && (
              <>
                <div style={{ color: 'var(--accent)', margin: '4px 0' }}>
                  研究中 … {(mgr.progress() * 100).toFixed(0)}%
                </div>
                {Object.entries(mgr.packProgress()).map(([pack, val]) => (
                  <div className="td-cost" key={pack}>{FG.Items.byId(pack).name} {val.have}/{val.need}</div>
                ))}
                <button onClick={() => FG.game.cancelResearch()}>取消研究</button>
              </>
            )}
            {selState === 'available' && (
              <>
                <div className="td-cost">
                  {Object.entries(sel.cost).map(([pack, n]) => `${FG.Items.byId(pack).name} × ${n} `).join('')}
                </div>
                <div className="td-desc">{sel.desc}</div>
                <div className="td-desc">
                  解锁：{[
                    ...sel.unlocksB.map(b => FG.Buildings.byId(b).name),
                    ...sel.unlocksR.map(r => FG.Recipes.byId(r).name),
                  ].join('、')}
                </div>
                <button style={{ marginTop: 8 }} onClick={() => FG.game.startResearch(sel.id)}>开始研究</button>
              </>
            )}
            {selState === 'done' && (
              <>
                <div style={{ color: 'var(--green)', margin: '4px 0' }}>✅ 已完成</div>
                <div className="td-desc">{sel.desc}</div>
              </>
            )}
            {selState === 'locked' && (
              <>
                <div style={{ color: 'var(--red)', margin: '4px 0' }}>
                  🔒 需先完成：{sel.prereq.filter(pr => !mgr.isDone(pr)).map(pr => FG.Research.byId(pr).name).join('、')}
                </div>
                <div className="td-desc">{sel.desc}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
