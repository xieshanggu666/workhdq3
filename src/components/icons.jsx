/**
 * 共用小工具：Canvas 图标组件（dataURL 缓存，避免每次渲染重新编码）
 */
import { memo } from 'react';
import { FG } from '../engine';

const urlCache = new Map();

export function itemIconUrl(id, size = 16) {
  const k = 'i:' + id + ':' + size;
  let url = urlCache.get(k);
  if (!url) {
    url = FG.Renderer.itemIcon(id, size).toDataURL();
    urlCache.set(k, url);
  }
  return url;
}

export function buildingIconUrl(type, size = 40, dir = 0) {
  const k = 'b:' + type + ':' + size + ':' + dir;
  let url = urlCache.get(k);
  if (!url) {
    url = FG.Renderer.buildingIcon(type, size, dir).toDataURL();
    urlCache.set(k, url);
  }
  return url;
}

export const ItemIcon = memo(function ItemIcon({ id, size = 16 }) {
  return <img src={itemIconUrl(id, size)} width={size} height={size} alt="" />;
});

export const BuildingIcon = memo(function BuildingIcon({ type, size = 40, dir = 0 }) {
  return <img src={buildingIconUrl(type, size, dir)} width={size} height={size} alt="" />;
});

export const STATUS_NAMES = {
  working: '生产中',
  starving: '缺料',
  blocked: '堵塞',
  idle: '闲置',
  empty: '枯竭',
  broken: '故障停机',
};

export const TRAIN_STATE_NAMES = {
  moving: '行驶中',
  docked: '装卸中',
  waiting: '等站排队',
  blocked: '堵死/让行',
  noroute: '断路（待轨网接通）',
  paused: '已停运',
  idle: '待命',
};

export const PRIO_NAMES = { high: '高', normal: '中', low: '低' };
export const PLAN_PRIO = [['high', '高'], ['normal', '中'], ['low', '低']];
