/**
 * 引擎入口：按依赖顺序导入原有原生 JS 模块。
 * 这些脚本以 IIFE 形式挂载到全局命名空间 window.FG（与重构前 <script> 顺序加载等价），
 * React UI 层只通过 FG 命名空间与引擎交互；核心仿真与 Canvas 渲染逻辑保持不变。
 */
import './config.js';
import './utils.js';
import './items.js';
import './recipes.js';
import './buildings.js';
import './research.js';
import './maps.js';
import './pipelines.js';
import './map.js';
import './scheduler.js';
import './railway.js';
import './contracts.js';
import './maintenance.js';
import './sim.js';
import './researchmgr.js';
import './stats.js';
import './save.js';
import './blueprint.js';
import './game.js';
import './renderer.js';

export const FG = window.FG;
export default FG;
