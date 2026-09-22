/**
 * 测试汇总入口：npm test
 * 逐个子进程运行 test/*.test.js，任一失败则退出码非 0
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js'));
let totalPass = 0, totalFail = 0, failed = [];

for (const f of files) {
  const out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  const m = out.match(/结果：(\d+) 通过, (\d+) 失败/);
  const p = m ? +m[1] : 0, fl = m ? +m[2] : 0;
  totalPass += p; totalFail += fl;
  console.log(`${fl ? '✗' : '✓'} ${f.padEnd(28)} ${p} 通过${fl ? `, ${fl} 失败` : ''}`);
  if (fl) failed.push(f);
}

console.log(`\n合计：${totalPass} 通过, ${totalFail} 失败`);
process.exit(failed.length ? 1 : 0);
