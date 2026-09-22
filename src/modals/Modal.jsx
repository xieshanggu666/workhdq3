/** 弹窗外壳：遮罩 + 居中卡片；点击遮罩关闭，Esc 已由 App 统一处理 */
export default function Modal({ children, onClose }) {
  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}
