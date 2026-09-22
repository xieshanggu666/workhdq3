/**
 * 地图区：Canvas 渲染主循环、鼠标输入（放置/拖拽/框选/平移/缩放）、悬浮提示
 * Canvas 绘制仍由引擎 FG.Renderer 完成；本组件负责 DOM 容器与事件接线
 */
import { useEffect, useRef, useState } from 'react';
import { FG } from '../engine';
import { ui, useUI } from '../state/ui';
import { useTick, useEvents } from '../state/hooks';

// ================= 蓝图/升级模式提示条 =================
export function BpHint() {
  const game = FG.game;
  useTick(150);
  useEvents(['blueprint:mode', 'blueprint:change', 'upgrade:mode', 'upgrade:change']);

  if (game.state !== 'playing' || (!game.bpMode && !game.upMode)) return null;

  let content;
  if (game.upMode === 'select') {
    content = <>⬆ <b>原地升级</b>：按住左键框选产线，框内建筑批量替换为<b>已解锁的最高级型号</b>
      （配方/库存/在途物料保留） · <span className="bh-key">Esc</span> 退出</>;
  } else if (game.upMode === 'confirm') {
    const pv = game.upPreview;
    const costTxt = pv ? Object.keys(pv.cost).map(k => FG.Items.byId(k).name + '×' + pv.cost[k]).join(' ') : '';
    content = <>⬆ <b>升级预览</b>：{pv ? pv.entries.length : 0} 栋建筑（备料 {costTxt}）——
      <span className="bh-key">左键</span>确认提交施工 · <span className="bh-key">右键</span>/<span className="bh-key">Esc</span> 重选</>;
  } else if (game.bpMode === 'select') {
    content = <>📐 <b>框选产线</b>：按住左键拖出矩形区域，框住已有建筑生成蓝图</>;
  } else if (game.pipelineId) {
    const p = FG.Pipelines.byId(game.pipelineId);
    const n = game.blueprint ? game.blueprint.entries.length : 0;
    content = <>⚡ 一键流水线 <b>{p ? p.name : ''}</b>（{n} 栋）：
      <span className="bh-key">左键</span>提交整套施工 · <span className="bh-key">R</span>旋转 ·
      <span className="bh-key">F</span>重新智能选位 · <span className="bh-key">Esc</span>取消
      {game.bpAnchor ? '' : <span>　<b style={{ color: 'var(--red)' }}>未找到合适落点，请对准资源后按 F</b></span>}</>;
  } else {
    content = <>📐 <b>蓝图放置</b>：<span className="bh-key">左键</span>提交施工计划 ·
      <span className="bh-key">R</span>旋转 · <span className="bh-key">B</span>重新框选 · <span className="bh-key">Esc</span>退出</>;
  }
  return <div id="bp-hint">{content}</div>;
}

// ================= 悬浮提示 =================
const TIP_STATUS = { working: '生产中/流动', starving: '缺料', blocked: '堵塞', idle: '闲置', empty: '枯竭', broken: '故障停机' };
const TIP_TRAIN = { moving: '行驶中', docked: '装卸中', waiting: '等站排队', blocked: '堵死/让行', noroute: '断路', paused: '已停运', idle: '待命' };

function TooltipView({ info }) {
  if (!info) return null;
  const { x, y, content } = info;
  return <div id="map-tooltip" style={{ left: x, top: y }}>{content}</div>;
}

function computeTooltip(game, px, py, tile, wrapW, wrapH, uiState) {
  const { techOpen, modal } = uiState;
  if (modal || techOpen || game.bpMode) return null;
  const m = game.map;
  if (!m || !m.inBounds(tile.x, tile.y)) return null;

  const b = m.buildingAt(tile.x, tile.y);
  const tr = !b && game.railway ? game.railway.trainAt(tile.x, tile.y)
    : (game.railway && b && (b.type === 'rail' || b.def.railStation)) ? game.railway.trainAt(tile.x, tile.y) : null;
  const pile = !b ? m.pileAt(tile.x, tile.y) : null;
  const planEntry = !b && game.construction ? game.construction.entryAt(tile.x, tile.y) : null;
  const C = FG.Config;
  const rows = [];
  let title = '';

  if (tr) {
    title = `🚆 列车 ${tr.id}`;
    rows.push(<div className="tt-row" key="st">状态：<b>{TIP_TRAIN[tr.state] || tr.state}</b></div>);
    rows.push(<div className="tt-row" key="cg">载货 <b>{tr.cargoTotal()}/{C.TRAIN_CARGO_CAP}</b> 件 · 停靠 {tr.stopIdx + 1}/{Math.max(1, tr.stops.length)}</div>);
    const stop = tr.stops[tr.stopIdx];
    if (stop) {
      const st = game.railway.stationById(stop.stationId);
      rows.push(<div className="tt-row" key="tg">目标：<b>{st ? st.stationName : '站点已拆除'}</b> · {stop.action === 'load' ? '装' : '卸'} {stop.item ? FG.Items.byId(stop.item).name : '任意'}×{stop.count}</div>);
    }
    if (tr.cargo.length) {
      rows.push(<div className="tt-row" key="cr">{tr.cargo.slice(0, 4).map(s => FG.Items.byId(s.type).name + '×' + s.count).join('、')}{tr.cargo.length > 4 ? '…' : ''}</div>);
    }
  } else if (b) {
    title = b.def.name;
    rows.push(<div className="tt-row" key="st">状态：<b style={b.status === 'broken' ? { color: '#e05c5c' } : undefined}>{TIP_STATUS[b.status] || b.status}</b></div>);
    if (game.maintenance && game.maintenance.enabled && game.maintenance.wearsOut(b)) {
      if (b.broken) {
        const o = game.maintenance.orderAt(b.x, b.y);
        rows.push(<div className="tt-row" key="br" style={{ color: '#e05c5c' }}>🛠 故障：{o
          ? '工单 ' + o.id + ' · 备件 ' + (o.stock.sparePart || 0) + '/' + o.need
            + (o.state === 'repairing' ? ' · 检修中' : o.waiting ? ' · 缺件等待' : '')
          : '工单已取消，可在信息页重新报修'}</div>);
      } else {
        const pct = Math.round(game.maintenance.wearRatio(b) * 100);
        rows.push(<div className="tt-row" key="wr">磨损 <b style={{ color: pct >= 95 ? '#e05c5c' : pct >= 70 ? '#e8a33d' : 'inherit' }}>{pct}%</b></div>);
      }
    }
    if (b.recipe) {
      const r = FG.Recipes.byId(b.recipe);
      rows.push(<div className="tt-row" key="rc">{r.name} <b>{(Math.min(1, b.progress / r.time) * 100).toFixed(0)}%</b></div>);
    }
    if (b.def.beltTier !== undefined) {
      let merge = 0;
      for (const side of [2, 3]) {
        const sv = FG.Map.beltSideVec(b.dir, side);
        const nb = m.buildingAt(b.x + sv.x, b.y + sv.y);
        if (nb && nb.def.beltTier !== undefined && FG.Map.beltFeedsInto(nb, b)) merge++;
      }
      rows.push(<div className="tt-row" key="bl">方向 <b>{FG.Utils.dirName(b.dir)}</b> · {b.items.length}/{C.BELT_CAP}{merge ? ` · ${merge} 路汇入` : ''}</div>);
    }
    if (b.def.inserterTier !== undefined)
      rows.push(<div className="tt-row" key="in">方向 <b>{FG.Utils.dirName(b.dir)}</b> · 筛选 <b>{b.filter ? FG.Items.byId(b.filter).name : '任意'}</b>{b.demandMode ? ' · 按需' : ''}</div>);
    if (b.type === 'pipe')
      rows.push(<div className="tt-row" key="pp">流体 <b>{(b.level / C.FLUID_PIPE_CAP * 100).toFixed(0)}%</b></div>);
    if (b.type === 'rail') {
      const held = game.railway.occupiedBy(b.x, b.y);
      rows.push(<div className="tt-row" key="rl">轨道{held && <> · <b style={{ color: '#e05c5c' }}>{held} 占用</b></>}</div>);
    }
    if (b.def.railStation) {
      const held = game.railway.occupiedBy(b.x, b.y);
      const tag = b.def.delivery ? '交付站' : '站号';
      rows.push(<div className="tt-row" key="stn">{tag} <b>{b.stationId}</b>{held && <> · <b style={{ color: '#58c26f' }}>停靠中</b></>}</div>);
      const cargo = b.chest.reduce((n, s) => n + s.count, 0);
      rows.push(<div className="tt-row" key="stc">货位 <b>{cargo}/{C.STATION_SLOTS * C.STATION_SLOT_CAP}</b></div>);
      if (b.def.delivery && game.contracts) {
        const c = game.contracts.contractAt(b);
        if (c) rows.push(<div className="tt-row" key="ct">合同 <b>{FG.Items.byId(c.item).name} {c.delivered}/{c.qty}</b> · 剩 <b>{FG.Utils.fmtTime(game.contracts.remainSec(c))}</b></div>);
      }
    }
    if (b.def.railDepot) {
      const near = FG.Utils.dirs.map(v => {
        const nb = m.buildingAt(b.x + v.x, b.y + v.y);
        return nb && (nb.type === 'rail' || nb.def.railStation);
      }).filter(Boolean).length;
      rows.push(<div className="tt-row" key="dp">接轨 <b>{near}</b> 侧 · 选中可编组发车</div>);
    }
    if (b.type === 'miner' && b.oreType)
      rows.push(<div className="tt-row" key="ore">{FG.Items.byId(b.oreType).name} <b>{FG.Utils.fmtNum(m.amountAt(b.x, b.y))}</b></div>);
  } else if (pile) {
    title = '地面物料';
    pile.slice(0, 6).forEach((s, i) =>
      rows.push(<div className="tt-row" key={i}>{FG.Items.byId(s.type).name} <b>×{FG.Utils.fmtNum(s.count)}</b></div>));
    rows.push(<div className="tt-row" key="hint" style={{ marginTop: 3 }}>在此格放置建筑可回收</div>);
  } else if (planEntry) {
    const p = planEntry.plan, e = planEntry.entry;
    const def = FG.Buildings.byId(e.type);
    const cost = FG.Buildings.costOf(e.type);
    const eIdx = p.entries.indexOf(e);
    const sIdx = game.construction.stageOfEntry(p, eIdx);
    const activeTo = p.stages && p.stages.length
      ? p.stages[Math.min(p.activeStage || 0, p.stages.length - 1)].cut : p.entries.length;
    title = `🏗 ${p.name}`;
    rows.push(<div className="tt-row" key="e">待建：<b>{def.name}</b>（{FG.Utils.dirName(e.dir)}） · 阶段 {sIdx + 1}/{p.stages.length}</div>);
    const stTxt = p.paused ? '已暂停（预留已返还）'
      : p.blocked ? '等待前置计划'
      : p.stageBlocked ? (p.stageReason || '等待前置阶段放行')
      : (eIdx >= activeTo) ? '等待前置阶段放行（不占料）'
      : p.waiting ? '缺料等待（可建部分先行）'
      : '施工中';
    rows.push(<div className="tt-row" key="s">状态：<b>{stTxt}</b></div>);
    const parts = Object.keys(cost).map(k =>
      `${FG.Items.byId(k).name} ${Math.min(e.stock[k] || 0, cost[k])}/${cost[k]}`);
    if (parts.length) rows.push(<div className="tt-row" key="p">建材：{parts.join(' · ')}</div>);
  } else {
    const ore = m.ores[tile.y][tile.x];
    if (ore) {
      title = FG.Items.byId(ore.type).name;
      rows.push(<div className="tt-row" key="a">储量 <b>{FG.Utils.fmtNum(ore.amount)}</b></div>);
    } else if (m.isOil(tile.x, tile.y)) {
      title = '油田';
      rows.push(<div className="tt-row" key="a">放置抽油机抽取原油</div>);
    } else if (m.isWater(tile.x, tile.y)) {
      title = '水域';
      rows.push(<div className="tt-row" key="a">放置水泵取水</div>);
    } else return null;
  }

  const content = (
    <>
      <div className="tt-title">{title}</div>
      {rows}
    </>
  );
  return {
    x: Math.min(px + 14, wrapW - 250),
    y: Math.min(py + 14, wrapH - 120),
    content,
  };
}

// ================= 地图主组件 =================
export default function MapWrap() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [tip, setTip] = useState(null);
  const { modal, techOpen } = useUI();

  const panning = useRef(false);
  const dragPlace = useRef(null);
  const bpDrag = useRef(false);
  const upDrag = useRef(false);

  // ---- 初始化渲染器、主循环、resize ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    FG.Renderer.init(canvas, FG.game);

    const onResize = () => FG.Renderer.resize();
    window.addEventListener('resize', onResize);

    let raf;
    let lastTime = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      FG.game.update(dt);
      FG.Renderer.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // 科技树打开期间窗口尺寸变化无需重绘地图
  useEvents(['game:start']);

  function tileFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return FG.Renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
  }

  // ---- 鼠标移动：平移 / 框选 / 拖铺 / 提示 ----
  function onMouseMove(e) {
    const game = FG.game;
    const wrap = wrapRef.current;
    const tile = tileFromEvent(e);
    FG.Renderer.setMouseTile(tile.x, tile.y);
    game._lastMouseTile = tile;

    if (panning.current) {
      const t = FG.Config.TILE * game.camera.zoom;
      game.camera.x -= e.movementX / t;
      game.camera.y -= e.movementY / t;
    }
    if (bpDrag.current && game.bpMode === 'select') {
      game.bpSelect = { ...game.bpSelect, x1: tile.x, y1: tile.y };
    }
    if (upDrag.current && game.upMode === 'select') {
      game.upSelect = { ...game.upSelect, x1: tile.x, y1: tile.y };
    }
    if (game.bpMode === 'place' && game.pipelineId && game.bpAnchor) {
      if (FG.Blueprint.validate(game, game.blueprint, tile.x, tile.y).ok) {
        game.bpAnchor = null;
        FG.Events.emit('blueprint:change');
      }
    }
    if (dragPlace.current) {
      const dx = tile.x - dragPlace.current.lastX, dy = tile.y - dragPlace.current.lastY;
      if (dx || dy) {
        const ghostDef = FG.Buildings.byId(game.ghost.type);
        if (ghostDef && ghostDef.beltTier !== undefined) {
          game.ghost.dir = dx !== 0 ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        }
        if (game.placeGhost(tile.x, tile.y)) {
          dragPlace.current = { lastX: tile.x, lastY: tile.y };
        }
      }
    }
    const wr = wrap.getBoundingClientRect();
    setTip(computeTooltip(game, e.clientX - wr.left, e.clientY - wr.top, tile, wrap.clientWidth, wrap.clientHeight, ui.get()));
  }

  function onMouseDown(e) {
    const game = FG.game;
    const tile = tileFromEvent(e);
    if (e.button === 2 || e.button === 1) { panning.current = true; return; }
    if (e.button !== 0) return;
    game._lastMouseTile = tile;

    if (game.upMode === 'select') {
      upDrag.current = true;
      game.upSelect = { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y };
      return;
    }
    if (game.upMode === 'confirm') { game.confirmUpgrade(); return; }
    if (game.bpMode === 'select') {
      bpDrag.current = true;
      game.bpSelect = { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y };
      return;
    }
    if (game.bpMode === 'place') {
      const o = game.blueprintOrigin(tile.x, tile.y);
      game.submitBlueprintPlanAt(o.x, o.y);
      return;
    }
    if (game.ghost) {
      const gDef = FG.Buildings.byId(game.ghost.type);
      if (gDef.beltTier !== undefined || gDef.railTier !== undefined) {
        dragPlace.current = { lastX: tile.x, lastY: tile.y };
        game.placeGhost(tile.x, tile.y);
      } else {
        game.placeGhost(tile.x, tile.y);
      }
    } else {
      const tr = game.railway && game.railway.trainAt(tile.x, tile.y);
      if (tr) game.selectBuilding(tr);
      else {
        const b = game.map.buildingAt(tile.x, tile.y);
        if (b) game.selectBuilding(b);
        else { game.selection = null; FG.Events.emit('selection:change'); }
      }
    }
  }

  function onMouseUp(e) {
    if (e.button === 2 || e.button === 1) panning.current = false;
    if (e.button !== 0) return;
    const game = FG.game;
    dragPlace.current = null;
    if (upDrag.current) {
      const r = game.upSelect;
      upDrag.current = false;
      game.upSelect = null;
      if (r && game.upMode === 'select') game.previewUpgrade(r.x0, r.y0, r.x1, r.y1);
    }
    if (bpDrag.current) {
      const r = game.bpSelect;
      bpDrag.current = false;
      game.bpSelect = null;
      if (r && game.bpMode === 'select') game.captureBlueprint(r.x0, r.y0, r.x1, r.y1);
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    const game = FG.game;
    if (game.upMode) { game.cancelUpgradePreview(); return; }
    if (game.bpMode) { game.exitBlueprintMode(); return; }
    if (game.ghost) game.cancelGhost();
  }

  function onWheel(e) {
    e.preventDefault();
    const cam = FG.game.camera;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    const nz = Math.min(2.5, Math.max(0.4, cam.zoom * factor));
    const t = FG.Config.TILE;
    cam.x = (mx / (t * nz)) - (mx / (t * cam.zoom) - cam.x);
    cam.y = (my / (t * nz)) - (my / (t * cam.zoom) - cam.y);
    cam.zoom = nz;
  }

  // 暂停/弹窗时提示收起，仿真推进时刷新提示（进度/储量实时变化）
  useTick(150);
  useEffect(() => { if (modal || techOpen) setTip(null); }, [modal, techOpen]);

  return (
    <main id="map-wrap" ref={wrapRef}>
      <canvas
        id="map-canvas"
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        onWheel={onWheel}
      />
      <BpHint />
      <TooltipView info={tip} />
    </main>
  );
}
