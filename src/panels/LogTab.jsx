/**
 * 右侧「日志」页：事件日志流（新消息在底部，自动滚底）
 */
import { useEffect, useRef } from 'react';
import { FG } from '../engine';
import { useEvents } from '../state/hooks';
import { Section } from './ui.jsx';

export default function LogTab() {
  const game = FG.game;
  useEvents(['message']);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  return (
    <Section title="事件日志">
      <div className="log-list" ref={bodyRef}>
        {game.log.map((l, i) => {
          const t = new Date(l.t);
          const ts = String(t.getHours()).padStart(2, '0') + ':'
            + String(t.getMinutes()).padStart(2, '0') + ':'
            + String(t.getSeconds()).padStart(2, '0');
          return (
            <div className={'log-line msg-' + l.cls} key={i}>
              <span className="log-time">{ts}</span>{l.text}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
