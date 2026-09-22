/**
 * 右侧「施工」页：当前蓝图信息 + 全部施工/升级计划
 * （优先级 / 暂停 / 前置依赖 / 分阶段闸门 / 条目级预留状态）
 */
import { FG } from '../engine';
import { ui } from '../state/ui';
import { useTick, useEvents } from '../state/hooks';
import { Section, ActionRow, ProgressBar, PrioButtons } from './ui.jsx';

const PLAN_PRIO_OPTS = [['high', '高'], ['normal', '中'], ['low', '低']];

function planStatus(p) {
  if (p.paused) return { txt: '已暂停', cls: 'st-paused' };
  if (p.blocked) return { txt: '等待前置', cls: 'st-blocked' };
  if (p.stageBlocked) return { txt: '阶段试产', cls: 'st-stage' };
  if (p.waiting) return { txt: '缺料等待', cls: 'st-waiting' };
  return { txt: '施工中', cls: 'st-active' };
}

/** q 是否（经依赖链传递）依赖 planId —— 过滤会成环的前置选项 */
function dependsOn(cons, q, planId) {
  const stack = q.deps.slice();
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === planId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = cons.byId(id);
    if (d) stack.push(...d.deps);
  }
  return false;
}

// ================= 分阶段编辑 =================
function StageEditor({ game, p }) {
  const cons = game.construction;
  const nStages = p.stages.length;

  return (
    <div className="stage-box">
      <div className="stage-title">🧱 分阶段施工（{nStages} 阶段）</div>
      {p.stages.map((stage, k) => {
        const { from, to } = cons.stageRange(p, k);
        const stageEntries = p.entries.slice(from, to);
        const sDone = stageEntries.filter(e => e.state === 'done').length;
        const sSkip = stageEntries.filter(e => e.state === 'skip').length;
        const isActive = (p.activeStage || 0) === k;
        const gate = k < nStages - 1 ? stage.gate : null;
        const isLast = k === nStages - 1;

        let stateCls = 'stg-done', stateTxt = '✓ 已放行';
        if (isActive && p.stageBlocked) { stateCls = 'stg-trial'; stateTxt = '⏳ 试产中'; }
        else if (isActive) { stateCls = 'stg-active'; stateTxt = '▶ 施工中'; }
        else if (!gate || gate.opened) { stateCls = 'stg-done'; stateTxt = isLast ? '末阶段' : '✓ 已放行'; }
        else { stateCls = 'stg-pending'; stateTxt = '待开工'; }

        const mode = gate ? gate.mode : 'none';
        const trialItems = cons.stageTrialItems(p, k);

        function setGate(patch) {
          game.setPlanStageGate(p.id, k, patch);
        }

        return (
          <div className={'stage-row ' + (isActive ? 'is-active' : '')} key={k}>
            <div className="stage-head">
              <span className="stage-name">阶段 {k + 1}</span>
              <span className={'stage-state ' + stateCls}>{stateTxt}</span>
              <span className="stage-cnt">
                {sDone}/{stageEntries.length} 栋{sSkip ? '（跳 ' + sSkip + '）' : ''}
              </span>
            </div>

            {!isLast && (
              <>
                <div className="gate-row">
                  <span className="gate-label">放行：</span>
                  <select value={mode} onChange={e => {
                    const v = e.target.value;
                    if (v === 'none') setGate(null);
                    else if (v === 'built') setGate({ mode: 'built' });
                    else setGate({
                      mode: 'trial',
                      item: gate && gate.item ? gate.item : null,
                      n: gate && gate.n ? gate.n : FG.Config.STAGE_TRIAL_COUNT,
                    });
                  }}>
                    <option value="none">无（建成即放行）</option>
                    <option value="built">建成放行</option>
                    <option value="trial">试产达标…</option>
                  </select>
                  {mode === 'trial' && (
                    <>
                      <select title="试产产物（空=任意产物）"
                        value={gate.item || ''}
                        onChange={e => setGate({
                          mode: 'trial', item: e.target.value || null,
                          n: gate.n || FG.Config.STAGE_TRIAL_COUNT,
                        })}>
                        <option value="">任意产物</option>
                        {trialItems.map(it => (
                          <option key={it} value={it}>{FG.Items.byId(it).name}</option>
                        ))}
                      </select>
                      <input type="number" min={1} max={999} className="gate-n"
                        defaultValue={gate.n || FG.Config.STAGE_TRIAL_COUNT}
                        title="需要完成的生产次数"
                        onChange={e => {
                          const n = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || FG.Config.STAGE_TRIAL_COUNT));
                          setGate({ mode: 'trial', item: gate.item || null, n });
                        }} />
                      <span className="gate-prog">
                        {cons.trialProgress(p, k)}/{gate.n || FG.Config.STAGE_TRIAL_COUNT}
                      </span>
                    </>
                  )}
                </div>
                {gate && gate.opened && (
                  <div className="gate-hint">已放行：收紧闸门将重新挂起后续施工</div>
                )}
                <b className="stage-rm" title="删除此阶段边界（并入下一阶段、取消该闸门）"
                  onClick={() => game.removePlanStage(p.id, k)}>×</b>
              </>
            )}
          </div>
        );
      })}

      {(() => {
        const firstWait = p.entries.findIndex(e => e.state === 'wait');
        if (firstWait < 0) return null;
        return (
          <div className="stage-add">
            <select value="" onChange={e => {
              const cut = parseInt(e.target.value, 10);
              if (cut > 0) game.splitPlanStage(p.id, cut);
            }}>
              <option value="">＋ 在条目前切分新阶段…</option>
              {p.entries.map((e, i) => {
                if (i < Math.max(1, firstWait)) return null;
                if (p.stages.some(s => s.cut === i)) return null;
                const nm = e.from
                  ? FG.Buildings.byId(e.from).name + '→' + FG.Buildings.byId(e.type).name
                  : FG.Buildings.byId(e.type).name;
                return <option key={i} value={i}>#{i + 1} {nm}（{e.x},{e.y}）前</option>;
              })}
            </select>
          </div>
        );
      })()}
    </div>
  );
}

// ================= 计划卡片 =================
function PlanCard({ game, p }) {
  const cons = game.construction;
  const total = p.entries.length;
  const done = p.entries.filter(e => e.state === 'done').length;
  const skipped = p.entries.filter(e => e.state === 'skip').length;
  let head = null;
  for (let i = p.cursor; i < total; i++) {
    if (p.entries[i].state === 'wait') { head = p.entries[i]; break; }
  }
  if (!head) head = p.entries.find(e => e.state === 'wait') || null;
  const st = planStatus(p);

  const depPlans = cons.plans.filter(q => q.id !== p.id && !p.deps.includes(q.id) && !dependsOn(cons, q, p.id));

  return (
    <div className={'bp-plan' + (p.paused ? ' is-paused' : '')}>
      <div className="bp-head">
        <span title={p.id}>
          {p.kind === 'upgrade' && <span className="up-badge">升级</span>}{p.name}
        </span>
        <span className={'plan-st ' + st.cls}>{st.txt}</span>
      </div>
      <ProgressBar ratio={done / total} />
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        进度 {done}/{total} 栋{skipped ? ' · 跳过 ' + skipped : ''}
      </div>

      <StageEditor game={game} p={p} />

      <PrioButtons cls="plan-prio" value={p.priority} options={PLAN_PRIO_OPTS}
        onPick={v => game.setPlanPriority(p.id, v)} />

      <div className="dep-row">
        {p.deps.map(id => {
          const d = cons.byId(id);
          if (!d) return null;
          return (
            <span className="dep-chip" key={id}>
              ⛓ {d.name} <b title="移除前置" onClick={() => game.removePlanDep(p.id, id)}>×</b>
            </span>
          );
        })}
        {depPlans.length > 0 && (
          <select className="dep-select" value="" onChange={e => {
            if (e.target.value) game.addPlanDep(p.id, e.target.value);
          }}>
            <option value="">＋ 设前置…</option>
            {depPlans.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        )}
      </div>

      {head && head.state === 'wait' && (
        <>
          {(() => {
            const def = FG.Buildings.byId(head.type);
            const cost = FG.Buildings.costOf(head.type);
            const parts = Object.keys(cost).map(k =>
              `${FG.Items.byId(k).name} ${Math.min(head.stock[k] || 0, cost[k])}/${cost[k]}`);
            const headName = head.from
              ? FG.Buildings.byId(head.from).name + ' → ' + def.name
              : def.name;
            return (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                {head.from ? '待换' : '待建'}：{headName}（{head.x},{head.y}）{parts.length ? ' · ' + parts.join(' · ') : ''}
              </div>
            );
          })()}
          {!p.paused && !p.blocked && p.waiting && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>前沿缺料：后续能凑齐建材的建筑会先行建成</div>
          )}
          {p.blocked && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              等待前置计划完工：{p.deps.map(id => cons.byId(id) ? cons.byId(id).name : null).filter(Boolean).join('、')}
            </div>
          )}
          {!p.paused && !p.blocked && p.stageBlocked && (
            <div style={{ fontSize: 10, color: '#7fc7ff', marginTop: 2 }}>⏳ {p.stageReason || '等待前置阶段放行'}</div>
          )}
        </>
      )}

      <ActionRow>
        <button onClick={() => game.togglePlanPaused(p.id)}>{p.paused ? '▶ 继续' : '⏸ 暂停'}</button>
        <button className="danger" onClick={() => game.cancelConstruction(p.id)}>取消并返还建材</button>
      </ActionRow>
    </div>
  );
}

// ================= 页签 =================
export default function BuildTab() {
  const game = FG.game;
  const cons = game.construction;
  useTick(200);
  useEvents(['construction:change', 'blueprint:change', 'building:placed']);

  const order = { high: 0, normal: 1, low: 2 };
  const sorted = cons.plans.slice().sort((a, b) => order[a.priority] - order[b.priority]);

  return (
    <>
      <Section title="蓝图">
        <ActionRow style={{ marginBottom: 6 }}>
          <button onClick={() => ui.set({ modal: 'pipelines' })}>⚡ 一键流水线 (P)</button>
        </ActionRow>
        {game.blueprint ? (() => {
          const bp = game.blueprint;
          const cost = FG.Blueprint.costOf(bp);
          const costTxt = Object.keys(cost).map(k => FG.Items.byId(k).name + '×' + cost[k]).join('　');
          const preset = bp.fromPreset ? FG.Pipelines.byId(bp.fromPreset) : null;
          return (
            <>
              <div className="info-grid">
                <div className="k">来源</div><div className="v">{preset ? '⚡ ' + preset.name : '框选蓝图'}</div>
                <div className="k">规模</div><div className="v">{bp.entries.length} 栋 · {bp.w}×{bp.h}</div>
                <div className="k">建材</div><div className="v" style={{ fontFamily: 'inherit' }}>{costTxt || '无'}</div>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
                {preset
                  ? <>左键提交整套施工 · <b>R</b> 旋转 · <b>F</b> 重新智能选位 · 可连续盖章。</>
                  : <>按 <b>B</b> 放置预览：移动选位、<b>R</b> 旋转、左键提交施工计划；再按 <b>B</b> 重新框选。</>}
              </div>
            </>
          );
        })() : (
          <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.7 }}>
            按 <b>P</b> 选择<b style={{ color: 'var(--accent2)' }}>预设流水线</b>一键铺设，或按 <b>B</b> 框选已有产线生成蓝图。<br />
            施工计划自动从<b>箱子 / 地面物料堆</b>预留建材；缺料时等待，取消时返还。
          </div>
        )}
      </Section>

      <Section title={'施工计划（' + cons.plans.length + '）'}>
        {cons.plans.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>暂无进行中的施工计划</div>}
        {sorted.map(p => <PlanCard key={p.id} game={game} p={p} />)}
      </Section>
    </>
  );
}
