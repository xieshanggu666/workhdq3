/**
 * 轻量 UI 全局状态（引擎之外的界面状态）：
 *  - modal：当前弹窗（newGame / saveLoad / menu / help / pipelines）
 *  - techOpen / techFocusId：科技树弹窗与定位节点
 *  - nonce：命令式动作触发全界面刷新用的计数器
 * 组件通过 useSyncExternalStore 订阅；Canvas 输入层通过 ui.get() 直接读取最新值。
 */
import { useSyncExternalStore } from 'react';

let state = {
  modal: null,
  techOpen: false,
  techFocusId: null,
  nonce: 0,
};

const listeners = new Set();

export const ui = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch };
    listeners.forEach(fn => fn());
  },
  bump() {
    state = { ...state, nonce: state.nonce + 1 };
    listeners.forEach(fn => fn());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useUI() {
  return useSyncExternalStore(ui.subscribe, ui.get);
}
