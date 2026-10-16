import { useState } from 'react'
import NavBar from '../components/NavBar'
import { Duotone, Cutout, Sfx, Tape, Reveal } from '../ui'
import { useCovers } from '../ui/useCovers'

const WALL = ['var(--mag)', 'var(--cy)', 'var(--acid)', 'var(--mag)', 'var(--blue)', 'var(--cy)', 'var(--acid)', 'var(--mag)']

const STEPS = [
  { n: '01', t: 'Найди',  d: 'Начни вводить название, русские тоже понимаем. Или вставь список текстом.' },
  { n: '02', t: 'Отметь', d: 'Статус, оценка, заметка. Серия засчитана одним нажатием.' },
  { n: '03', t: 'Покажи', d: 'Профиль и тир-лист по ссылке. Друг видит всё без аккаунта.' },
]

const FEATURES = [
  { key: 'tracker',      title: 'Список',   jp: 'リスト',       desc: 'Поиск, импорт, оценки, статусы.' },
  { key: 'profile',      title: 'Профиль',  jp: 'プロフィール', desc: 'Статистика, жанры, студии.' },
  { key: 'tierlist',     title: 'Тир-лист', jp: 'ティア',       desc: 'Расставь аниме drag & drop.' },
  { key: 'together',     title: 'Вместе',   jp: '一緒に',       desc: 'Сравни два списка с другом.' },
  { key: 'achievements', title: 'Ачивки',   jp: '実績',         desc: 'Достижения, XP и уровни.' },
]

// The real "+1 серия" interaction, playable.
function DemoCard({ cover, name }) {
  const total = 12
  const [ep, setEp] = useState(7)
  const done = ep >= total
  return (
    <div className="demo">
      <div className="demo-pic"><Duotone src={cover} color="var(--blue)" style={{ position: 'absolute', inset: 0 }} /></div>
      <div className="demo-body">
        <span className="demo-chip" style={{ background: done ? 'var(--cy)' : 'var(--acid)' }}>{done ? 'Просмотрено' : 'Смотрю'}</span>
        <div className="t-head demo-title">{name || 'Твоё аниме'}</div>
        <div className="demo-segs" role="img" aria-label={`${ep} из ${total} серий`}>
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < ep ? 'f' : ''} />)}
        </div>
        <div className="demo-row">
          <span className="t-hud" style={{ color: 'var(--mut)' }}>{ep} / {total} серий</span>
          <button className="btn sm" onClick={() => setEp(e => (e >= total ? 0 : e + 1))}>{done ? 'Заново' : '+1 серия'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Landing({ navigate }) {
  const start = () => navigate('tracker')
  const covers = useCovers()
  const c = (i) => covers.length ? covers[i % covers.length].src : undefined

  return (
    <div className="lp">
      <NavBar active={null} onNavigate={navigate} />

      {/* ═════ HERO ═════ */}
      <section className="hero">
        <div className="wall" aria-hidden="true">
          {WALL.map((col, i) => <Duotone key={i} src={c(i + 3)} color={col} />)}
        </div>
        <div className="hero-veil" />
        <div className="scan" />
        <div className="rays hero-rays" />

        <div className="hud hud-tl t-hud">// anitrack.sys<br />status: online</div>
        <div className="hud hud-tr t-hud">no signup<br />no codes</div>

        <div className="hero-main">
          <h1 className="t-head hero-h1">
            <span className="glitch" data-t="Смотри.">Смотри.</span>
            <span className="t-out" style={{ '--stroke': 'var(--acid)', WebkitTextStrokeWidth: 3 }}>Отмечай.</span>
            <span className="t-impact mark hero-last">Хвастайся!</span>
          </h1>
          <p className="hero-lead">Трекер аниме без регистрации. Открыл, добавил, пользуешься. Весь список лежит у тебя в браузере.</p>
          <div className="hero-cta">
            <button className="btn" onClick={start}>Открыть список</button>
            <button className="btn ghost" onClick={() => navigate('together')}>Сравнить с другом</button>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <Cutout src={c(0)} tilt={5} className="hero-cut1" />
          <Cutout src={c(2)} tilt={-8} shadow="var(--mag)" className="hero-cut2" />
          <span className="hero-sfx"><Sfx size={112} rotate={-10}>ドン!</Sfx></span>
        </div>

        <Tape dark tilt={3} style={{ bottom: 104, zIndex: 7 }} text="アニメ ✦ 記録 ✦ 一緒に ✦ 実績 ✦ " />
        <Tape tilt={-3.5} style={{ bottom: 38, zIndex: 8 }} text="ОТМЕЧАЙ СЕРИИ ✦ ТИР-ЛИСТ ✦ ВМЕСТЕ С ДРУГОМ ✦ БЕЗ РЕГИСТРАЦИИ ✦ " />
      </section>

      {/* ═════ STEPS ═════ */}
      <section className="steps">
        <div className="steps-in">
          <Reveal>
            <div className="t-hud" style={{ color: 'var(--acid)', marginBottom: 18 }}>// как это работает</div>
            <h2 className="t-head sec-h">Три шага.<br /><span className="t-out">Ноль регистраций.</span></h2>
          </Reveal>
          {STEPS.map((s, i) => (
            <div key={s.n} className={`step ${i % 2 ? 'flip' : ''}`}>
              <Reveal dir={i % 2 ? 'right' : 'left'} className="step-text">
                <span className="t-head step-n">{s.n}</span>
                <h3 className="t-impact step-t">{s.t}</h3>
                <p>{s.d}</p>
              </Reveal>
              <Reveal dir={i % 2 ? 'left' : 'right'} delay={120} className="step-pic">
                <Cutout src={c(6 + i)} tilt={i % 2 ? -4 : 4} shadow={['var(--acid)', 'var(--mag)', 'var(--cy)'][i]} />
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ═════ DEMO (acid slab) ═════ */}
      <section className="slab">
        <div className="slab-in">
          <Reveal dir="left" className="slab-text">
            <div className="t-hud">// попробуй прямо здесь</div>
            <h2 className="t-impact slab-h">Один тап.<br />Серия<br />засчитана.</h2>
          </Reveal>
          <Reveal dir="right" delay={100} className="slab-card">
            <DemoCard cover={c(1)} name={covers[1]?.title} />
          </Reveal>
        </div>
      </section>

      {/* ═════ FEATURES ═════ */}
      <section className="feats">
        <div className="feats-in">
          <Reveal>
            <div className="t-hud" style={{ color: 'var(--cy)', marginBottom: 18 }}>// что внутри</div>
          </Reveal>
          {FEATURES.map((f, i) => (
            <Reveal key={f.key} delay={i * 60}>
              <div className="frow" onClick={() => navigate(f.key)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') navigate(f.key) }}>
                <span className="t-hud frow-n">0{i + 1}</span>
                <span className="t-head frow-t">{f.title}</span>
                <span className="frow-d">{f.desc}</span>
                <span className="t-jp frow-jp">{f.jp}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═════ FINAL ═════ */}
      <section className="final">
        <Duotone src={c(5)} color="var(--mag)" className="final-bg" style={{ position: 'absolute', inset: 0 }} />
        <div className="final-veil" />
        <div className="scan" />
        <div className="final-in">
          <Reveal>
            <h2 className="t-head final-h">Добавь<br /><span className="t-impact mark">первое</span> аниме</h2>
            <button className="btn" style={{ marginTop: 34 }} onClick={start}>Открыть AniTrack →</button>
          </Reveal>
        </div>
        <Tape tilt={-2.5} style={{ bottom: '6%' }} text="БЕЗ РЕГИСТРАЦИИ ✦ БЕСПЛАТНО ✦ НА РУССКОМ ✦ " />
      </section>

      <footer className="lp-foot t-hud">
        <span>anitrack © 2026</span>
        <span>данные: shikimori · anilist</span>
        <span>список хранится в твоём браузере</span>
      </footer>

      <style>{`
        .lp { padding-top: 52px; overflow-x: hidden; }

        /* hero */
        .hero { position: relative; min-height: calc(100vh - 52px); overflow: hidden; background: var(--bg); }
        .wall { position: absolute; inset: -10% -6%; display: flex; gap: 10px; transform: skewX(-14deg) rotate(-2deg); }
        .wall > .duo { flex: 1; }
        .wall > .duo:nth-child(even) { margin-top: 80px; } .wall > .duo:nth-child(3n) { margin-top: -60px; }
        .wall .duo img { transform: skewX(14deg) scale(1.5); }
        .hero-veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 28% 55%, rgba(7,7,14,.97) 0, rgba(7,7,14,.9) 38%, rgba(7,7,14,.3) 80%), linear-gradient(0deg, var(--bg), transparent 30%); }
        .hero-rays { --cx: 76%; --cy2: 46%; opacity: .22; }
        .hud { position: absolute; z-index: 5; line-height: 1.6; }
        .hud-tl { left: 24px; top: 24px; color: var(--acid); } .hud-tr { right: 24px; top: 24px; text-align: right; color: var(--cy); }
        .hero-main { position: relative; z-index: 6; min-height: calc(100vh - 52px); padding: 9vh 5vw 240px; display: flex; flex-direction: column; justify-content: center; }
        .hero-h1 { font-size: clamp(46px, 10.4vw, 176px); margin: 0; }
        .hero-h1 > span { display: block; }
        .hero-h1 .glitch { color: var(--fg); }
        .hero-last { font-size: .86em; margin-top: .06em; width: fit-content; position: relative; z-index: 4; }
        .hero-lead { max-width: 440px; font-size: 17px; line-height: 1.55; color: #c9c9e6; margin: 28px 0 28px; }
        .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .hero-art { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
        .hero-cut1 { position: absolute; right: 7vw; top: 8vh; width: min(25vw, 340px); aspect-ratio: 3 / 4.3; }
        .hero-cut2 { position: absolute; right: 24vw; top: 38vh; width: min(15vw, 210px); aspect-ratio: 3 / 4.3; z-index: 2; }
        .hero-sfx { position: absolute; right: 4vw; top: 52vh; z-index: 3; }

        /* steps */
        .steps { position: relative; background: var(--bg-2); padding: 14vw 0 12vw; clip-path: polygon(0 6vw, 100% 0, 100% calc(100% - 6vw), 0 100%); margin-top: -6vw; }
        .steps-in { max-width: 1240px; margin: 0 auto; padding: 0 5vw; }
        .sec-h { font-size: clamp(38px, 7vw, 108px); margin: 0 0 8vh; }
        .step { display: grid; grid-template-columns: 1.1fr .9fr; align-items: center; gap: 4vw; margin-bottom: 9vh; }
        .step.flip .step-text { order: 2; } .step.flip .step-pic { order: 1; }
        .step-n { display: block; font-family: var(--f-impact); font-weight: 400; font-size: clamp(70px, 12vw, 190px); color: transparent; -webkit-text-stroke: 2px var(--acid); margin-bottom: -.1em; }
        .step-t { font-size: clamp(46px, 8vw, 128px); margin: 0 0 18px; }
        .step-text p { max-width: 430px; font-size: 18px; line-height: 1.55; color: #c9c9e6; margin: 0; }
        .step-pic .cutout { width: min(100%, 330px); aspect-ratio: 3 / 4.2; margin: 0 auto; }

        /* slab */
        .slab { background: var(--acid); color: var(--bg); padding: 12vw 0 11vw; clip-path: polygon(0 5vw, 100% 0, 100% calc(100% - 5vw), 0 100%); margin-top: -5vw; position: relative; }
        .slab-in { max-width: 1240px; margin: 0 auto; padding: 0 5vw; display: grid; grid-template-columns: 1.1fr .9fr; gap: 5vw; align-items: center; }
        .slab-h { font-size: clamp(48px, 8.4vw, 140px); margin: 18px 0 0; }
        .demo { display: grid; grid-template-columns: 38% 1fr; background: var(--bg); color: var(--fg); transform: rotate(2.5deg); box-shadow: 14px 14px 0 var(--blue); }
        .demo-pic { position: relative; min-height: 240px; }
        .demo-body { padding: 22px 22px 24px; display: flex; flex-direction: column; gap: 14px; }
        .demo-chip { align-self: flex-start; color: var(--bg); font: 900 10px var(--f-head); letter-spacing: .12em; text-transform: uppercase; padding: 6px 10px; }
        .demo-title { font-size: 24px; letter-spacing: -.04em; line-height: .95; }
        .demo-segs { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; }
        .demo-segs i { height: 22px; border: 1.5px solid var(--line); transform: skewX(-18deg); display: block; transition: background .15s; }
        .demo-segs i.f { background: var(--acid); border-color: var(--acid); }
        .demo-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto; }

        /* features */
        .feats { background: var(--bg); padding: 9vw 0 7vw; }
        .feats-in { max-width: 1240px; margin: 0 auto; padding: 0 5vw; }
        .frow { position: relative; display: grid; grid-template-columns: 50px 1fr auto; align-items: center; gap: 16px; padding: 3vh 0; border-bottom: 1px solid var(--line); cursor: pointer; }
        .frow-n { color: var(--acid); }
        .frow-t { font-family: var(--f-impact); font-weight: 400; letter-spacing: -.02em; font-size: clamp(30px, 5.8vw, 92px); white-space: nowrap; color: transparent; -webkit-text-stroke: 2px var(--fg); transition: color .2s, -webkit-text-stroke-color .2s, transform .25s; }
        .frow-d { display: none; }
        .frow-jp { font-size: clamp(18px, 2.4vw, 34px); color: var(--mut); transition: color .2s; }
        .frow:hover .frow-t { color: var(--acid); -webkit-text-stroke-color: var(--acid); transform: translateX(14px) skewX(-6deg); }
        .frow:hover .frow-jp { color: var(--acid); }
        @media (min-width: 900px) { .frow { grid-template-columns: 50px minmax(0, 1.6fr) 1fr auto; } .frow-d { display: block; color: var(--mut); font-size: 15px; } }

        /* final */
        .final { position: relative; min-height: 86vh; overflow: hidden; display: flex; align-items: center; }
        .final-veil { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,7,14,.94) 20%, rgba(7,7,14,.25)); }
        .final-in { position: relative; z-index: 3; padding: 10vh 5vw 22vh; max-width: 1240px; margin: 0 auto; width: 100%; }
        .final-h { font-size: clamp(44px, 9.6vw, 160px); margin: 0; }
        .final .tape { z-index: 6; }

        .lp-foot { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 26px 5vw 34px; color: var(--mut); border-top: 1px solid var(--line); }

        @media (max-width: 820px) {
          .hud { display: none; }
          .hero-main { padding-bottom: 250px; }
          .hero-cut1 { right: 4vw; top: auto; bottom: 170px; width: 30vw; } .hero-cut2 { display: none; } .hero-sfx { display: none; }
          .step { grid-template-columns: 1fr; margin-bottom: 7vh; } .step.flip .step-text, .step.flip .step-pic { order: initial; }
          .step-pic .cutout { width: 62%; margin: 0; }
          .slab-in { grid-template-columns: 1fr; } .demo { transform: none; grid-template-columns: 34% 1fr; box-shadow: 8px 8px 0 var(--blue); }
        }
      `}</style>
    </div>
  )
}
