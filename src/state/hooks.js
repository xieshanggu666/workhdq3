/**
 * React 与引擎事件总线/仿真循环的桥接 hooks：
 *  - useGame()：取全局 Game 实例（构造一次，全局唯一）
 *  - useRerender()：命令式修改后强制当前组件刷新
 *  - useTick(intervalMs)：按时间间隔跟随仿真 tick 刷新（顶栏/面板/图表的节流刷新）
 *  - useEvent(type)：订阅 FG.Events 事件并在触发时刷新
 */
import { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { FG } from '../engine';

// 全局唯一 Game 实例（等价于旧版 main.js 中的 FG.game = new FG.Game()）
export const game = new FG.Game();
FG.game = game;

const GameContext = createContext(game);
export function useGame() {
  return useContext(GameContext);
}

export function useRerender() {
  return useReducer(n => n + 1, 0)[1];
}

/** 每 intervalMs 最多随 sim:tick 刷新一次；状态切换/显式事件立即刷新 */
export function useTick(intervalMs = 200) {
  const rerender = useRerender();
  const last = useRef(0);
  useEffect(() => {
    return FG.Events.on('sim:tick', () => {
      const now = performance.now();
      if (now - last.current >= intervalMs) {
        last.current = now;
        rerender();
      }
    });
  }, [intervalMs]);
}

/** 订阅引擎事件；event 变化时重新订阅，handler 始终读最新闭包 */
export function useEvent(type, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => FG.Events.on(type, (data) => ref.current && ref.current(data)), [type]);
}

/** 订阅多个引擎事件，任一触发即刷新 */
export function useEvents(types) {
  const rerender = useRerender();
  const key = types.join('|');
  useEffect(() => {
    const offs = key.split('|').map(t => FG.Events.on(t, rerender));
    return () => offs.forEach(off => off && off());
  }, [key]);
}
