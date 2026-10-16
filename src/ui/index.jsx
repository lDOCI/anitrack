import { useInView } from './useInView'
import './theme.css'

const cx = (...a) => a.filter(Boolean).join(' ')

/** Grayscale cover multiplied onto a flat color. color = any CSS color. */
export function Duotone({ src, color, className, style }) {
  return (
    <div className={cx('duo', className)} style={{ '--duo': color, ...style }}>
      {src && <img src={src} alt="" loading="lazy" />}
    </div>
  )
}

/** Tilted cover "cut out" of the page with a hard colored offset shadow. */
export function Cutout({ src, tilt = 0, shadow, className, style }) {
  return (
    <div className={cx('cutout', className)} style={{ transform: `rotate(${tilt}deg)`, '--sh': shadow, ...style }}>
      {src && <img src={src} alt="" />}
    </div>
  )
}

export function Sfx({ size = 64, rotate = 0, color, style, children }) {
  return <span className="sfx" style={{ fontSize: size, transform: `rotate(${rotate}deg)`, color, ...style }}>{children}</span>
}

/** Scrolling tape. Absolute (crosses a section) unless `flat`. */
export function Tape({ text, dark, flat, tilt = 0, style }) {
  return (
    <div className={cx('tape', dark && 'dark', flat && 'flat')} style={{ transform: `rotate(${tilt}deg)`, ...style }} aria-hidden="true">
      <div>{text.repeat(8)}</div>
    </div>
  )
}

/** Slides/fades in once when scrolled into view. dir: left | right | undefined (rise). */
export function Reveal({ dir, delay = 0, className, style, children }) {
  const [ref, on] = useInView()
  return (
    <div ref={ref} className={cx('rv', dir, on && 'on', className)} style={{ '--d': `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}
