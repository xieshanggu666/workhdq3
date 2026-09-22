/**
 * 右侧「信息」页：无选中时的工厂概况；建筑详情（配方/槽位/筛选/优先级/磨损/车站/机务段）；
 * 列车详情（车载货物与运输计划编辑）。数据变更由引擎事件 + 150ms tick 刷新。
 */
import { FG } from '../engine';
import { useState } from 'react';
import { useEvents, useTick, useRerender } from '../state/hooks';
import { STATUS_NAMES, TRAIN_STATE_NAMES, PRIO_NAMES } from '../components/icons';
import { Section, InfoGrid, KV, ActionRow, SlotRow, ProgressBar, PrioButtons } from './ui.jsx';
import MaintenanceInfo from './MaintenancePanel.jsx';
import DeliveryInfo from './ContractPanel.jsx';

const PRIO_OPTS = [
  ['high', '高优先', '缺料时优先供料'],
  ['normal', '普通', '同级轮转公平供料'],
  ['low', '低优先', '物料紧张时最后供料'],
];

// ================= 概况 =================
function Overview({ game }) {
  const ry = game.railway;
  return (
    <Section title="工厂概况">
      <InfoGrid>
        <KV k="建筑数">{game.totalBuildings()}</KV>
        <KV k="列车">{ry ? ry.trains.length : 0}</KV>
        <KV k="火车站">{ry ? ry.stationList().length : 0}</KV>
        <KV k="供货合同">{game.contracts ? game.contracts.active.length : 0}</KV>
        <KV k="待修设备" vStyle={game.maintenance && game.maintenance.orders.length ? { color: 'var(--red)' } : undefined}>
          {game.maintenance ? game.maintenance.orders.length : 0}
        </KV>
        <KV k="已研究">{game.research.completed.size} / {FG.Research.list().length}</KV>
        <KV k="游戏时间">{FG.Utils.fmtTime(game.playTime)}</KV>
      </InfoGrid>
      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
        点击地图上的建筑查看详情。<br />
        拖动右键平移视野，滚轮缩放。<br />
        矿机→熔炉→组装机→科学包，最后发射卫星！<br />
        研究「铁路货运」后铺轨道、建车站，用列车跨区运料。
      </div>
    </Section>
  );
}

// ================= 建筑详情 =================
function BuildingPanel({ game, b, bump }) {
  const solids = FG.Items.list().filter(i => !i.fluid);
  const wanted = game.sim ? game.sim.inserterWanted(b) : null;
  let needTxt = '—';
  if (b.def.inserterTier !== undefined) {
    if (wanted === null) needTxt = '任意（终端/箱子）';
    else if (!wanted.size) needTxt = '下游暂不缺料';
    else needTxt = Array.from(wanted).slice(0, 5).map(id => FG.Items.byId(id).name).join('、')
      + (wanted.size > 5 ? '…' : '');
  }

  const recipe = b.recipe ? FG.Recipes.byId(b.recipe) : null;
  const recipes = b.def.recipeBuilding ? FG.Recipes.forBuilding(b.type) : [];
  const needed = new Set(recipe ? recipe.ingredients.filter(i => !FG.Items.isFluid(i.item)).map(i => i.item) : []);
  const hasSlots = Object.keys(b.slots.inputs).length || Object.keys(b.slots.outputs).length;

  return (
    <>
      <Section title={b.def.name}>
        <InfoGrid>
          <KV k="状态"><span className={'status-' + b.status}>{STATUS_NAMES[b.status] || b.status}</span></KV>
          <KV k="坐标">({b.x}, {b.y})</KV>
          {b.def.beltTier !== undefined && <KV k="方向">{FG.Utils.dirName(b.dir)}</KV>}
          {b.def.inserterTier !== undefined && <KV k="方向">{FG.Utils.dirName(b.dir)}</KV>}
          {b.def.beltTier !== undefined && <KV k="物品">{b.items.length}/{FG.Config.BELT_CAP}</KV>}
          {b.type === 'pipe' && <KV k="流体">{(b.level / FG.Config.FLUID_PIPE_CAP * 100).toFixed(0)}%</KV>}
          {b.def.inserterTier !== undefined && <KV k="手持">{b.held ? FG.Items.byId(b.held.type).name : '空'}</KV>}
          {b.def.inserterTier !== undefined && <KV k="筛选">{b.filter ? FG.Items.byId(b.filter).name : '任意'}</KV>}
          {b.def.inserterTier !== undefined && <KV k="按需供给">{b.demandMode ? '开' : '关'}</KV>}
          {b.type === 'miner' && <KV k="矿种">{b.oreType ? FG.Items.byId(b.oreType).name : '无'}</KV>}
          {b.type === 'miner' && b.oreType && <KV k="剩余">{FG.Utils.fmtNum(game.map.amountAt(b.x, b.y))}</KV>}
          {(b.def.recipeBuilding || b.type === 'lab') && <KV k="供料优先级">{PRIO_NAMES[b.priority] || '中'}</KV>}
          {b.def.recipeBuilding && <KV k="产量">{FG.Utils.fmtNum(b.totalCrafted)}</KV>}
        </InfoGrid>
        <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{b.def.desc}</div>
      </Section>

      {/* 机械臂：按需供给 + 物品筛选 */}
      {b.def.inserterTier !== undefined && (
        <Section title="取放规则">
          <label className="cfg-row">
            <input type="checkbox" checked={!!b.demandMode}
              onChange={e => { b.demandMode = e.target.checked; bump(); }} />
            <span>按需供给：按下游缺口数量与在途预留联动（沿带追踪 {FG.Config.BELT_TRACE_DEPTH} 格）</span>
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 6px' }}>
            当前需求：<b style={{ color: 'var(--accent2)' }}>{needTxt}</b>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>筛选物品（点击切换，再点取消）：</div>
          <div className="filter-grid">
            <button className={'filter-chip' + (b.filter === null ? ' active' : '')}
              onClick={() => { b.filter = null; bump(); }}>任意</button>
            {solids.map(i => (
              <button key={i.id} className={'filter-chip' + (b.filter === i.id ? ' active' : '')}
                onClick={() => { b.filter = b.filter === i.id ? null : i.id; bump(); }}>{i.name}</button>
            ))}
          </div>
        </Section>
      )}

      {/* 生产线供料优先级 */}
      {(b.def.recipeBuilding || b.type === 'lab') && (
        <Section title="生产线供料优先级">
          <PrioButtons value={b.priority || 'normal'}
            options={PRIO_OPTS.map(([id, name]) => [id, name])}
            onPick={v => { b.priority = v; bump(); }} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
            料源紧张时高优先级产线先得料，同优先级轮转均分；在途货物自动预留，在带面上以青色环标记。</div>
        </Section>
      )}

      {/* 磨损与维修 */}
      {game.maintenance && game.maintenance.enabled && game.maintenance.wearsOut(b) && (
        <MaintenanceInfo b={b} bump={bump} embedded />
      )}

      {/* 配方与生产进度 */}
      {b.def.recipeBuilding && (
        <Section title="配方">
          {recipe && (
            <>
              <ProgressBar ratio={Math.min(1, b.progress / recipe.time)} />
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {recipe.name} · {(Math.min(1, b.progress / recipe.time) * 100).toFixed(0)}%
              </div>
            </>
          )}
          <div className="recipe-list">
            {recipes.map(rc => {
              const unlocked = game.research.isRecipeUnlocked(rc.id);
              const lockedBy = FG.Research.byId(rc.unlockedBy);
              return (
                <button key={rc.id}
                  className={'recipe-btn' + (b.recipe === rc.id ? ' selected' : '') + (unlocked ? '' : ' locked')}
                  title={unlocked ? '' : '需要研究：' + (lockedBy ? lockedBy.name : rc.unlockedBy)}
                  onClick={() => { if (unlocked) game.setRecipe(b, rc.id); }}>
                  <span className="rc-name">{rc.name}</span>
                  <span className="rc-ing">
                    {rc.ingredients.map(i => `${FG.Items.byId(i.item).name}×${i.count}`).join(' + ')}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* 输入/输出槽 */}
      {hasSlots && (
        <Section title="物料">
          {Object.keys(b.slots.inputs).map(k => (
            <SlotRow key={'i' + k} s={b.slots.inputs[k]}
              warn={b.def.recipeBuilding && !needed.has(k)}
              name={(b.def.recipeBuilding && !needed.has(k) ? '残留 ' : '输入 ') + FG.Items.byId(k).name} />
          ))}
          {Object.keys(b.slots.outputs).map(k => (
            <SlotRow key={'o' + k} s={b.slots.outputs[k]} name={'输出 ' + FG.Items.byId(k).name} />
          ))}
        </Section>
      )}

      {/* 流体缓冲罐 */}
      {!!Object.keys(b.fluidTanks).length && (
        <Section title="流体缓冲">
          {Object.keys(b.fluidTanks).map(k => (
            <SlotRow key={k} name={FG.Items.byId(k).name}
              s={{ count: b.fluidTanks[k], cap: FG.Config.FLUID_TANK_CAP }} />
          ))}
        </Section>
      )}

      {/* 箱子 / 车站货位 */}
      {b.def.storage && (
        <Section title={b.def.railStation ? '车站货位（接入产线供料）' : '存储'}>
          {b.chest.map((s, i) => (
            <SlotRow key={i} name={s.type ? FG.Items.byId(s.type).name : '空'} s={s} />
          ))}
        </Section>
      )}

      {b.def.railStation && <StationInfo game={game} b={b} bump={bump} />}
      {b.def.delivery && <DeliveryInfo b={b} />}
      {b.def.railDepot && <DepotInfo game={game} />}

      <ActionRow>
        {(b.def.beltTier !== undefined || b.def.inserterTier !== undefined) && (
          <button id="btn-rotate" onClick={() => { b.dir = (b.dir + 1) % 4; bump(); }}>旋转</button>
        )}
        <button id="btn-demolish" className="danger" onClick={() => game.removeBuilding(b)}>拆除</button>
        <button id="btn-clear" onClick={() => { game.selection = null; FG.Events.emit('selection:change'); }}>取消选择</button>
      </ActionRow>
    </>
  );
}

function StationInfo({ game, b, bump }) {
  const users = [];
  for (const tr of game.railway.trains) {
    tr.stops.forEach((s, i) => { if (s.stationId === b.stationId) users.push({ tr, i }); });
  }
  return (
    <Section title="火车站">
      <InfoGrid>
        <KV k="站号">{b.stationId}</KV>
      </InfoGrid>
      <label className="cfg-row" style={{ margin: '4px 0' }}>站名
        <input type="text" className="txt-input" maxLength={12}
          defaultValue={b.stationName || ''}
          onChange={e => { b.stationName = e.target.value.trim() || ('站点 ' + b.stationId.slice(1)); bump(); }} />
      </label>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        机械臂/传送带可直接与本站货位转运：到站物料即接入按需物流，供周边产线使用。
      </div>
      {users.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>停靠列车：</div>
      )}
      {users.map(({ tr, i }, k) => (
        <div className="slot-row" key={k}>
          <span className="sl-name">🚆 {tr.id}</span>
          <span style={{ color: 'var(--text)' }}>
            第 {i + 1} 站 · {tr.stops[i].action === 'load' ? '装' : '卸'}
            {tr.stops[i].item ? FG.Items.byId(tr.stops[i].item).name : '任意'}×{tr.stops[i].count}
          </span>
        </div>
      ))}
    </Section>
  );
}

function DepotInfo({ game }) {
  const b = game.selection;
  return (
    <Section title="机务段">
      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 6 }}>
        向相邻空轨道编组一列新车；选中列车可编辑其运输计划（站点顺序与装卸规则）。</div>
      <ActionRow>
        <button onClick={() => {
          const tr = game.railway.spawnTrain(b);
          if (tr) {
            game.logMsg('🚆 已编组列车 ' + tr.id + '：选中列车添加停靠站点与装卸规则', 'unlock');
            game.selectBuilding(tr);
          } else {
            game.logMsg('⚠ 机务段四周没有空闲轨道（接轨格被占或未铺轨）', 'error');
          }
        }}>🚆 编组列车</button>
      </ActionRow>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>在役列车 {game.railway.trains.length} 列</div>
    </Section>
  );
}

// ================= 列车详情 =================
function TrainPanel({ game, tr, bump }) {
  const ry = game.railway;
  const stations = ry.stationList();
  const solids = FG.Items.list().filter(i => !i.fluid);

  function moveStop(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= tr.stops.length) return;
    const arr = tr.stops;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    if (tr.stopIdx === i) tr.stopIdx = j;
    else if (tr.stopIdx === j) tr.stopIdx = i;
    bump();
  }

  return (
    <>
      <Section title={'🚆 列车 ' + tr.id}>
        <InfoGrid>
          <KV k="状态">
            <span className={'status-' + (tr.state === 'docked' ? 'working'
              : (tr.state === 'blocked' || tr.state === 'noroute') ? 'blocked' : 'idle')}>
              {TRAIN_STATE_NAMES[tr.state] || tr.state}
            </span>
          </KV>
          <KV k="位置">({tr.x}, {tr.y})</KV>
          <KV k="载货">{tr.cargoTotal()}/{FG.Config.TRAIN_CARGO_CAP}</KV>
          <KV k="停站">{tr.stops.length ? (tr.stopIdx + 1) + ' / ' + tr.stops.length : '无计划'}</KV>
        </InfoGrid>
      </Section>

      <Section title="车载货物">
        {!tr.cargo.length && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>空车</div>}
        {tr.cargo.map((s, i) => (
          <SlotRow key={i} name={FG.Items.byId(s.type).name}
            s={{ count: s.count, cap: FG.Config.TRAIN_CARGO_CAP }} />
        ))}
      </Section>

      <Section title={'运输计划（' + (tr.plan.loop === false ? '单程：末站卸完待命' : '循环执行') + '）'}>
        <label className="cfg-row">
          <input type="checkbox" checked={tr.plan.loop !== false}
            onChange={e => { tr.plan.loop = e.target.checked; bump(); }} />
          <span>循环运输：末站完成后自动返回首站；取消则末站卸完即待命</span>
        </label>
        {!stations.length && (
          <div style={{ color: 'var(--red)', fontSize: 11 }}>
            图上还没有火车站：先在轨道旁建「火车站」，再为其添加停靠动作。
          </div>
        )}
        {tr.stops.map((s, i) => {
          const st = ry.stationById(s.stationId);
          return (
            <div className="bp-plan" key={i} style={{ marginBottom: 6 }}>
              <div className="bp-head">
                <span>第 {i + 1} 站 · {st ? st.stationName : '⚠ 站点已拆除'}</span>
                <span className={'plan-st ' + (s.action === 'load' ? 'st-active' : 'st-waiting')}>
                  {s.action === 'load' ? '装货' : '卸货'}
                </span>
              </div>
              <div className="stop-cfg">
                <select value={s.action} onChange={e => { tr.updateStop(i, { action: e.target.value }); bump(); }}>
                  <option value="unload">卸货（车→站）</option>
                  <option value="load">装货（站→车）</option>
                </select>
                <select value={s.item || ''} onChange={e => { tr.updateStop(i, { item: e.target.value || null }); bump(); }}>
                  <option value="">任意物品</option>
                  {solids.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
                <input type="number" min={1} max={FG.Config.TRAIN_CARGO_CAP} className="num-input"
                  defaultValue={s.count}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    tr.updateStop(i, { count: isNaN(n) ? 1 : n });
                    bump();
                  }} />
              </div>
              <ActionRow style={{ marginTop: 4 }}>
                <button disabled={i === 0} onClick={() => moveStop(i, -1)}>↑</button>
                <button disabled={i === tr.stops.length - 1} onClick={() => moveStop(i, 1)}>↓</button>
                <button onClick={() => { if (i === tr.stopIdx) tr.skip(); else tr.removeStop(i); bump(); }}>立即跳过</button>
                <button className="danger" onClick={() => { tr.removeStop(i); bump(); }}>删除</button>
              </ActionRow>
            </div>
          );
        })}
        {stations.length > 0 && <AddStop tr={tr} stations={stations} solids={solids} bump={bump} />}
      </Section>

      <ActionRow>
        <button onClick={() => { tr.setPaused(!tr.plan.paused); bump(); }}>
          {tr.plan.paused ? '▶ 恢复运行' : '⏸ 停运'}
        </button>
        <button onClick={() => { tr.skip(); bump(); }}>跳过当前站</button>
        <button className="danger" onClick={() => game.removeTrainSelection()}>解编（货落地）</button>
        <button onClick={() => { game.selection = null; FG.Events.emit('selection:change'); }}>取消选择</button>
      </ActionRow>
    </>
  );
}

function AddStop({ tr, stations, solids, bump }) {
  const [sid, setSid] = useState(stations[0].stationId);
  const [act, setAct] = useState('load');
  const [item, setItem] = useState('');
  const [count, setCount] = useState(20);
  return (
    <div className="stop-cfg" style={{ marginTop: 6 }}>
      <select value={sid} onChange={e => setSid(e.target.value)}>
        {stations.map(s => <option key={s.stationId} value={s.stationId}>{s.stationName} ({s.x},{s.y})</option>)}
      </select>
      <select value={act} onChange={e => setAct(e.target.value)}>
        <option value="load">装货</option>
        <option value="unload">卸货</option>
      </select>
      <select value={item} onChange={e => setItem(e.target.value)}>
        <option value="">任意物品</option>
        {solids.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
      </select>
      <input type="number" className="num-input" min={1} value={count}
        onChange={e => setCount(parseInt(e.target.value, 10) || 1)} />
      <button onClick={() => { tr.addStop(sid, act, item || null, isNaN(count) ? 1 : count); bump(); }}>
        ＋ 添加停靠
      </button>
    </div>
  );
}

export default function InfoPanel() {
  const game = FG.game;
  useEvents(['selection:change', 'recipe:change', 'building:removed',
    'contracts:change', 'maintenance:change', 'building:placed']);
  useTick(150);
  const sel = game.selection;
  const bump = useRerender();

  if (game.state !== 'playing') return null;
  if (!sel) return <Overview game={game} />;
  if (sel.isTrain) return <TrainPanel game={game} tr={sel} bump={bump} />;
  return <BuildingPanel game={game} b={sel} bump={bump} />;
}
