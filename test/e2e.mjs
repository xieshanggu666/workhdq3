/**
 * React UI 端到端冒烟测试（Playwright + 无头 Chromium）：
 * 验证应用启动、新建游戏、各 UI 区/弹窗/页签渲染与交互、控制台无错误。
 * 运行：npm run build && node test/e2e.mjs
 */
import { spawn } from 'child_process';
import net from 'net';
import { chromium } from 'playwright';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.log('  ✗ FAIL:', msg); }
}

// 由系统分配空闲端口，避免上一轮残留 preview 进程占用固定端口
const PORT = await new Promise(resolve => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview',
  '--port', String(PORT), '--strictPort', '--host', '127.0.0.1', '--outDir', 'dist', '--no-open'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', d => { serverLog += d; });
server.stderr.on('data', d => { serverLog += d; });
server.on('exit', code => { if (code !== 0) console.log('[preview exited]', code, serverLog.slice(-500)); });

// 等待预览服务端口就绪（最多 ~15s）
const started = await new Promise(resolve => {
  const t0 = Date.now();
  const timer = setInterval(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) { clearInterval(timer); resolve(true); }
    } catch (e) { if (Date.now() - t0 > 15000) { clearInterval(timer); console.log('[probe]', e.message); resolve(false); } }
  }, 300);
});
if (!started) { console.error('预览服务未能启动'); console.error(serverLog.slice(-800)); process.exit(1); }

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  env: {
    ...process.env,
    // 无 root 环境下解包到用户目录的 Chromium 系统依赖（CI/容器内可用）
    LD_LIBRARY_PATH: ['/tmp/pwlibs/usr/lib/aarch64-linux-gnu', '/tmp/pwlibs/lib/aarch64-linux-gnu',
      process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  },
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(500);

  // 1) 首启弹窗（localStorage 为空 → 新建工厂）
  await page.waitForSelector('.modal-mask h2', { timeout: 5000 });
  ok((await page.textContent('.modal-mask h2')).includes('新建工厂'), '无存档时弹出新建工厂向导');

  // 2) 开始游戏（默认选项）
  await page.click('#ng-start');
  await page.waitForSelector('.modal-mask', { state: 'detached' });
  await page.waitForTimeout(300);
  ok(await page.isVisible('#topbar'), '顶栏已渲染');
  ok(await page.isVisible('#toolbar .bld-btn'), '工具栏建筑按钮已渲染');
  ok(await page.isVisible('#sidepanel'), '右侧面板已渲染');
  ok(await page.isVisible('#map-canvas'), '地图画布已渲染');
  ok((await page.textContent('.logo')) !== '', 'Logo 文本正常');

  // 3) 顶栏速度/暂停
  await page.click('#speed-btns button[data-speed="2"]');
  await page.click('#btn-pause');
  ok((await page.textContent('#btn-pause')).includes('继续'), '暂停按钮切换为「继续」');
  await page.click('#btn-pause');

  // 4) 工具栏选建筑 → 出现幽灵（按钮选中态）→ Esc 取消
  const firstBtn = page.locator('#toolbar .bld-btn:not(.locked)').first();
  await firstBtn.click();
  await page.waitForTimeout(50);
  ok(await page.locator('#toolbar .bld-btn.selected').count() > 0, '选中建筑按钮进入放置态');
  await page.keyboard.press('Escape');
  ok(await page.locator('#toolbar .bld-btn.selected').count() === 0, 'Esc 取消放置');

  // 5) 地图上点击空地（不放置时为选择），再切各页签
  await page.mouse.click(700, 450);
  for (const [tab, title] of [['stats', '全局状态'], ['build', '蓝图'], ['repair', '预测性维护'], ['contract', '供货合同'], ['log', '事件日志']]) {
    await page.click(`#sp-tabs button[data-tab="${tab}"]`, { timeout: 5000 });
    await page.waitForTimeout(50);
    const body = await page.textContent('.sp-body');
    ok(body.includes(title), `页签「${tab}」渲染：${title}`);
  }
  await page.click('#sp-tabs button[data-tab="info"]');

  // 6) 科技树弹窗
  await page.click('#btn-tech');
  await page.waitForSelector('#tech-tree canvas', { timeout: 3000 });
  await page.waitForTimeout(300);
  ok(await page.isVisible('#tech-tree'), '科技树弹窗打开且画布存在');
  await page.keyboard.press('Escape');
  ok(await page.isHidden('#tech-tree'), 'Esc 关闭科技树');

  // 7) 一键流水线弹窗
  await page.click('#btn-pipeline');
  await page.waitForSelector('.pl-card', { timeout: 3000 });
  const cardCount = await page.locator('.pl-card').count();
  ok(cardCount >= 5, `预设流水线卡片已列出（${cardCount} 张）`);
  await page.keyboard.press('Escape');

  // 8) 菜单 → 存档管理
  await page.click('#btn-menu');
  await page.click('#m-saveload');
  await page.waitForSelector('.save-row', { timeout: 3000 });
  ok(await page.locator('.save-row').count() === 4, '存档管理列出 4 个槽位');
  // 槽位 1 在新建游戏时已自动保存
  const slot1 = page.locator('.save-row').first();
  ok(await slot1.locator('.sl-load').isEnabled(), '槽位 1 已有存档可载入');
  await page.keyboard.press('Escape');

  // 9) 蓝图 / 升级模式切换（快捷键 B / U / Esc）
  await page.keyboard.press('b');
  await page.waitForTimeout(50);
  ok(await page.isVisible('#bp-hint'), 'B 进入蓝图框选，提示条显示');
  await page.keyboard.press('Escape');
  await page.keyboard.press('u');
  await page.waitForTimeout(50);
  ok(await page.isVisible('#bp-hint'), 'U 进入升级框选，提示条显示');
  await page.keyboard.press('Escape');

  // 9.5) 真实放置建筑：切到物流分类 → 选中传送带 → 在地图上连续放几格 → 引擎建筑数增加
  await page.evaluate(() => {
    // 点击「物流」分类（分类顺序：采集/生产/物流/科研）
    const t = Array.from(document.querySelectorAll('#tb-cats button')).find(b => b.textContent.includes('物流'));
    if (t) t.click();
  });
  const beltBtn = page.locator('#toolbar .bld-btn:not(.locked)', { hasText: '传送带' }).first();
  ok(await beltBtn.count() > 0, '工具栏可找到传送带按钮');
  await beltBtn.click();
  const before = await page.evaluate(() => FG.game.map.buildings.size);
  // 在视口中央区域找一排可放置陆地格点击
  await page.mouse.click(500, 400);
  await page.mouse.click(500, 432);
  await page.mouse.click(500, 464);
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => FG.game.map.buildings.size);
  ok(after > before, `点击地图成功放置传送带（建筑数 ${before} → ${after}）`);
  await page.keyboard.press('Escape');

  // 9.6) 选中已放置的传送带 → 信息面板出现「拆除/旋转」操作
  await page.mouse.click(500, 400);
  await page.waitForTimeout(80);
  ok(await page.locator('#btn-demolish').count() === 1, '点击建筑后信息面板出现拆除按钮');
  await page.click('#btn-rotate');
  const dir = await page.evaluate(() => FG.game.selection && FG.game.selection.dir);
  ok(dir === 1, '信息页「旋转」按钮使建筑朝向 +1（实际 ' + dir + '）');
  await page.click('#btn-demolish');
  await page.waitForTimeout(50);
  const afterDel = await page.evaluate(() => FG.game.map.buildings.size);
  ok(afterDel === after - 1, '拆除按钮移除建筑（' + after + ' → ' + afterDel + '）');

  // 10) 让仿真跑一会（确认主循环不抛错）
  await page.waitForTimeout(1200);
  const timeText = await page.textContent('#tb-time');
  ok(/\d{2}:\d{2}/.test(timeText || ''), '游戏时间在推进：' + timeText);

  // 11) 控制台无错误
  ok(errors.length === 0, errors.length ? '浏览器控制台无错误（实际：' + errors.slice(0, 3).join(' | ') + '）' : '浏览器控制台无错误');
} catch (e) {
  ok(false, 'E2E 异常：' + e.message);
} finally {
  await browser.close();
  server.kill('SIGKILL');
}

console.log(`\nE2E 结果：${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
