import { useEffect } from 'react'

/**
 * Shared modal shell for the tracker. Esc / backdrop click close it (unless `locked`).
 *   <Modal title="Импорт" jp="インポート" onClose={...} wide>…</Modal>
 */
export default function Modal({ title, jp, onClose, locked, wide, children, footer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !locked) onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, locked])

  return (
    <div className="tk-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !locked) onClose?.() }}>
      <div className={`tk-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="tk-modal-head">
          <div>
            {jp && <div className="t-hud tk-modal-jp">{jp}</div>}
            <h2 className="t-head tk-modal-title">{title}</h2>
          </div>
          {!locked && <button className="tk-x" onClick={onClose} aria-label="Закрыть">✕</button>}
        </div>
        <div className="tk-modal-body">{children}</div>
        {footer && <div className="tk-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
