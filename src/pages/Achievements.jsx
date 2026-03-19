import { useState } from 'react'
import NavBar from '../components/NavBar'

const STORAGE_KEY = 'anitrack_list'
const SEEN_KEY    = 'anitrack_achievements_seen'

// ─── SVG иконки — Уникальный Художественный Скетч-стиль ────────────────────────
export function AchIcon({ id, size = 36, color = '#0a0a0a' }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 }
  
  // Плавные, чистые линии, как от линера
  const lineProps = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  // Сдвинутая заливка для эффекта "ручного раскрашивания маркером"
  const fillProps = { fill: color, fillOpacity: 0.15, stroke: 'none', transform: 'translate(-2, 3)' }

  // 87 уникальных иконок, привязанных строго к ID ачивки
  const paths = {
    // ── Эпизоды
    ep_50:      <><rect x="4" y="8" width="24" height="15" rx="3"/><polyline points="12,2 16,8 20,2"/><line x1="8" y1="23" x2="16" y2="23"/><line x1="20" y1="23" x2="24" y2="23"/></>,
    ep_100:     <><path d="M4 14v8h24v-8a2 2 0 00-2-2H6a2 2 0 00-2 2z"/><path d="M4 22h24v4H4z"/><line x1="10" y1="12" x2="10" y2="22"/><line x1="22" y1="12" x2="22" y2="22"/></>,
    ep_500:     <><rect x="10" y="4" width="12" height="24" rx="3"/><circle cx="16" cy="10" r="2"/><polygon points="14,16 14,22 19,19"/></>,
    ep_1000:    <><path d="M16 16m-2 0a2 2 0 1 1 4 0a4 4 0 1 1 -8 0a6 6 0 1 1 12 0a8 8 0 1 1 -16 0a10 10 0 1 1 20 0"/></>,
    ep_2000:    <><path d="M3 16 C 3 16 10 8 16 8 C 22 8 29 16 29 16 C 29 16 22 24 16 24 C 10 24 3 16 3 16 Z"/><rect x="14" y="14" width="4" height="4"/></>,
    ep_5000:    <><circle cx="16" cy="16" r="10" strokeDasharray="5 4"/><circle cx="16" cy="16" r="3"/></>,
    ep_10000:   <><path d="M6 12h20v8H6z"/><circle cx="16" cy="16" r="2"/><path d="M26 14l4 2-4 2M6 14l-4 2 4 2"/></>,

    // ── Часы
    h_10:       <><path d="M16 4 A 12 12 0 0 0 16 28 A 8 8 0 0 1 16 4 Z"/></>,
    h_24:       <><circle cx="16" cy="16" r="12"/><line x1="16" y1="16" x2="16" y2="8"/><line x1="16" y1="16" x2="22" y2="16"/></>,
    h_50:       <><path d="M8 10h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V10z"/><path d="M20 12h2a3 3 0 0 1 0 6h-2"/></>,
    h_100:      <><path d="M8 10h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V10z"/><path d="M20 12h2a3 3 0 0 1 0 6h-2"/><path d="M10 4q2 3-2 6M16 4q2 3-2 6"/></>,
    h_200:      <><path d="M6 10 L 10 6 L 14 10 L 18 6 L 22 10 L 26 6 V 26 H 6 Z"/><circle cx="12" cy="16" r="2"/><circle cx="20" cy="16" r="2"/></>,
    h_500:      <><rect x="12" y="6" width="8" height="14" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="16" y1="20" x2="16" y2="30"/><path d="M12 14h8"/></>,
    h_1000:     <><path d="M10 4 C 10 16, 22 16, 22 28"/><path d="M22 4 C 22 16, 10 16, 10 28"/><line x1="12" y1="10" x2="20" y2="10"/><line x1="12" y1="22" x2="20" y2="22"/></>,
    h_2000:     <><circle cx="16" cy="16" r="8"/><path d="M2 20 C 6 14 24 10 30 16"/></>,

    // ── Тайтлы
    titles_1:   <><path d="M8 6h12v20H8z"/><line x1="12" y1="6" x2="12" y2="26"/></>,
    titles_5:   <><rect x="6" y="20" width="20" height="4"/><rect x="8" y="16" width="16" height="4"/><rect x="10" y="12" width="12" height="4"/></>,
    titles_10:  <><rect x="6" y="8" width="6" height="16" rx="1"/><rect x="14" y="10" width="6" height="14" rx="1"/><rect x="22" y="6" width="6" height="18" rx="1"/><line x1="2" y1="24" x2="30" y2="24"/></>,
    titles_25:  <><polyline points="4,24 12,16 20,20 28,8"/><polyline points="28,14 28,8 22,8"/></>,
    titles_50:  <><path d="M6 12l10-6 10 6v12l-10 6-10-6z"/><line x1="16" y1="6" x2="16" y2="18"/><line x1="6" y1="12" x2="16" y2="18"/><line x1="26" y1="12" x2="16" y2="18"/></>,
    titles_100: <><path d="M8 18c0-8 16-8 16 0"/><path d="M6 18h20v4H6z"/><path d="M12 10l-4-6M20 10l4-6"/></>,
    titles_200: <><path d="M4 8h24M6 14h20M10 8v20M22 8v20M10 18h12"/></>,
    titles_250: <><path d="M4 10 L 16 26 L 28 10 A 16 16 0 0 0 4 10"/><line x1="16" y1="26" x2="10" y2="10"/><line x1="16" y1="26" x2="22" y2="10"/></>,
    titles_500: <><path d="M8 6h16v6a8 8 0 0 1-16 0V6zM16 20v6M10 26h12"/><path d="M8 10H4v-2h4M24 10h4v-2h-4"/></>,

    // ── Этти
    ecchi_1:    <><circle cx="16" cy="14" r="4"/><path d="M14 17l-2 5h8l-2-5"/></>,
    ecchi_5:    <><line x1="6" y1="14" x2="10" y2="10"/><line x1="10" y1="16" x2="14" y2="12"/><line x1="18" y1="12" x2="22" y2="16"/><line x1="22" y1="10" x2="26" y2="14"/></>,
    ecchi_20:   <><path d="M16 26 C 6 26 4 16 4 10 C 4 4 16 8 16 8 C 16 8 28 4 28 10 C 28 16 26 26 16 26 Z"/><line x1="16" y1="8" x2="16" y2="16"/></>,
    ecchi_50:   <><path d="M16 16c4 0 8 4 8 8M16 16c-4 0-8 4-8 8M14 10l-4-6-2 4M18 10l4-6 2 4"/></>,

    // ── Исекай
    isekai_1:   <><rect x="12" y="6" width="8" height="20" rx="4"/><circle cx="16" cy="10" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="16" cy="22" r="2"/></>,
    isekai_5:   <><path d="M4 14h18l4 6v6H4V14zM16 14v6"/><circle cx="8" cy="26" r="3"/><circle cx="24" cy="26" r="3"/></>,
    isekai_15:  <><ellipse cx="16" cy="16" rx="6" ry="12"/><path d="M10 16a6 12 0 0 0 12 0"/><circle cx="16" cy="16" r="2"/></>,
    isekai_30:  <><path d="M12 20 L 26 6 L 28 8 L 14 22 M 10 18 L 16 24 M 14 22 L 6 30"/></>,
    isekai_50:  <><circle cx="16" cy="16" r="10"/><path d="M16 6c-4 4-4 16 0 20M16 6c4 4 4 16 0 20M6 16h20"/></>,

    // ── Меха
    mecha_3:    <><path d="M12 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0"/><line x1="6" y1="26" x2="13" y2="15"/><line x1="26" y1="6" x2="19" y2="10"/></>,
    mecha_10:   <><rect x="8" y="12" width="16" height="14" rx="2"/><line x1="12" y1="18" x2="20" y2="18"/><path d="M16 12 L 16 4 M 10 6 L 16 10 L 22 6"/></>,
    mecha_25:   <><path d="M4 24L12 8h8l8 16"/><circle cx="16" cy="16" r="4"/><line x1="16" y1="16" x2="16" y2="20"/></>,

    // ── Романтика
    romance_5:  <><path d="M16 26 C 16 26 4 18 4 10 C 4 6 10 4 16 10 C 22 4 28 6 28 10 C 28 18 16 26 16 26 Z"/></>,
    romance_10: <><path d="M12 20 C 2 12 6 4 12 8 C 18 4 22 12 12 20"/><path d="M20 20 C 10 12 14 4 20 8 C 26 4 30 12 20 20"/></>,
    romance_30: <><path d="M16 26 C 16 26 4 18 4 10 C 4 6 10 4 16 10 C 22 4 28 6 28 10 C 28 18 16 26 16 26 Z"/><path d="M16 10 L 14 16 L 18 20 L 16 26"/></>,
    romance_50: <><rect x="4" y="8" width="24" height="16" rx="2"/><path d="M4 8l12 8l12-8"/><circle cx="16" cy="16" r="3"/></>,

    // ── Повседневность
    sol_5:      <><path d="M6 14 h 20 l -2 12 h -16 z"/><path d="M14 6 C 14 6 14 10 18 10 C 18 10 18 6 14 6 Z"/></>,
    sol_10:     <><circle cx="10" cy="16" r="4"/><circle cx="16" cy="16" r="4"/><circle cx="22" cy="16" r="4"/><line x1="4" y1="16" x2="28" y2="16"/></>,
    sol_25:     <><path d="M6 14h20v8H6z"/><rect x="8" y="10" width="16" height="4"/><line x1="10" y1="22" x2="10" y2="26"/><line x1="22" y1="22" x2="22" y2="26"/></>,

    // ── Психология
    psycho_3:   <><path d="M16 6 C 10 6 6 10 6 16 C 6 22 10 26 16 26 C 22 26 26 22 26 16 C 26 10 22 6 16 6 Z"/><path d="M16 6 Q 12 16 16 26"/></>,
    psycho_5:   <><rect x="8" y="8" width="16" height="16"/><circle cx="16" cy="8" r="3"/><circle cx="24" cy="16" r="3"/></>,
    psycho_15:  <><line x1="16" y1="4" x2="16" y2="16"/><circle cx="16" cy="20" r="4"/><circle cx="16" cy="20" r="1"/></>,
    psycho_30:  <><path d="M16 4 L 28 10 L 22 26 L 8 20 Z"/><path d="M16 4 L 14 16 L 8 20 M 14 16 L 22 26 M 14 16 L 28 10"/></>,

    // ── Экшен
    action_10:  <><path d="M6 16h6M20 16h6M10 10l2 2M22 10l-2 2M10 22l2-2M22 22l-2-2"/></>,
    action_25:  <><path d="M16 4 C 16 4 26 14 26 20 C 26 26 20 30 16 30 C 12 30 6 26 6 20 C 6 14 16 4 16 4 Z"/></>,
    action_50:  <><path d="M4 28 C 12 28 20 20 28 4"/><line x1="20" y1="12" x2="24" y2="16"/><line x1="18" y1="14" x2="22" y2="18"/></>,

    // ── Хоррор
    horror_3:   <><path d="M16 8 C 16 8 10 18 10 22 C 10 26 13 28 16 28 C 19 28 22 26 22 22 C 22 18 16 8 16 8 Z"/></>,
    horror_5:   <><path d="M8 26 L 8 12 C 8 6 24 6 24 12 L 24 26 L 20 22 L 16 26 L 12 22 Z"/><circle cx="12" cy="12" r="1"/><circle cx="20" cy="12" r="1"/></>,
    horror_15:  <><path d="M10 14 C 10 8 22 8 22 14 V 20 H 10 Z M 12 20 V 24 M 16 20 V 24 M 20 20 V 24"/></>,

    // ── Спорт
    sports_5:   <><rect x="8" y="12" width="16" height="10" rx="4"/><line x1="24" y1="16" x2="28" y2="16"/><circle cx="14" cy="16" r="2"/></>,
    sports_15:  <><circle cx="16" cy="18" r="6"/><path d="M12 12 L 10 4 L 16 8 L 22 4 L 20 12"/></>,

    // ── Фэнтези
    fantasy_10: <><line x1="8" y1="28" x2="24" y2="12"/><circle cx="24" cy="12" r="4"/><path d="M24 4l-2 4M30 12l-4 2"/></>,
    fantasy_25: <><path d="M4 16 C 10 8 22 8 28 16 C 22 24 10 24 4 16 Z"/><ellipse cx="16" cy="16" rx="2" ry="6"/></>,

    // ── Оценки
    score_first:   <><path d="M16 4 L 20 12 L 28 14 L 22 20 L 24 28 L 16 24 L 8 28 L 10 20 L 4 14 L 12 12 Z"/></>,
    score_ten:     <><path d="M16 6 L 18 12 L 24 12 L 20 16 L 22 22 L 16 18 L 10 22 L 12 16 L 8 12 L 14 12 Z"/><line x1="16" y1="2" x2="16" y2="4"/><line x1="16" y1="28" x2="16" y2="30"/><line x1="2" y1="16" x2="4" y2="16"/><line x1="28" y1="16" x2="30" y2="16"/></>,
    score_all10:   <><path d="M16 4l1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2h3z M8 12l1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2h3z M24 12l1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2h3z"/></>,
    score_many10:  <><path d="M16 2 L 28 10 L 16 30 L 4 10 Z M 4 10 L 28 10 M 10 10 L 16 30 M 22 10 L 16 30"/></>,
    score_low:     <><path d="M10 8 V 26 H 22 V 8 M 6 8 H 26 M 14 4 H 18"/></>,
    score_critic:  <><circle cx="10" cy="16" r="4"/><circle cx="22" cy="16" r="4"/><line x1="14" y1="16" x2="18" y2="16"/><line x1="26" y1="16" x2="30" y2="12"/></>,
    score_generous:<><path d="M10 16 A 2 2 0 0 1 14 16 L 12 20 Z M 22 16 A 2 2 0 0 1 26 16 L 24 20 Z"/></>,
    score_variety: <><path d="M16 4 C 8 4 4 10 4 16 C 4 22 10 28 16 28 C 22 28 28 22 28 16 C 28 10 22 8 16 8"/><circle cx="10" cy="16" r="2"/></>,

    // ── Поведение
    drop_1:           <><path d="M8 28 V 6 H 24 V 28 M 14 16 H 16"/></>,
    drop_5:           <><path d="M4 24 H 26 A 2 2 0 0 0 28 22 V 16 C 28 12 22 12 18 12 H 10 L 4 24"/></>,
    drop_20:          <><path d="M8 28 V 12 C 8 6 24 6 24 12 V 28"/><line x1="4" y1="28" x2="28" y2="28"/><line x1="16" y1="12" x2="16" y2="20"/><line x1="12" y1="16" x2="20" y2="16"/></>,
    planned_10:       <><rect x="8" y="6" width="16" height="22" rx="2"/><path d="M12 4 H 20 V 8 H 12 Z"/><line x1="12" y1="14" x2="20" y2="14"/><line x1="12" y1="18" x2="16" y2="18"/></>,
    planned_hoarder:  <><rect x="6" y="10" width="16" height="16"/><rect x="10" y="6" width="16" height="16"/></>,
    planned_100:      <><path d="M6 10 H 26 V 22 H 6 Z M 4 8 H 28 M 4 24 H 28"/></>,
    ongoing_watcher:  <><path d="M10 4 H 22 L 16 16 L 22 28 H 10 L 16 16 Z"/></>,
    no_drop:          <><path d="M16 4 L 26 8 V 16 C 26 22 16 28 16 28 C 16 28 6 22 6 16 V 8 Z"/></>,
    no_drop_100:      <><path d="M16 4 L 26 8 V 16 C 26 22 16 28 16 28 C 16 28 6 22 6 16 V 8 Z"/><path d="M10 14 L 14 18 L 22 10"/></>,
    season_collector: <><rect x="6" y="8" width="20" height="18" rx="2"/><line x1="10" y1="4" x2="10" y2="8"/><line x1="22" y1="4" x2="22" y2="8"/><line x1="6" y1="14" x2="26" y2="14"/></>,
    season_master:    <><path d="M16 28 V 16 M 16 16 L 10 10 M 16 16 L 22 10 M 16 16 L 16 8"/></>,
    genre_explorer:   <><circle cx="16" cy="16" r="10"/><path d="M16 10 L 18 16 L 16 22 L 14 16 Z"/></>,
    genre_master:     <><path d="M4 26 A 12 12 0 0 1 28 26 M 8 26 A 8 8 0 0 1 24 26 M 12 26 A 4 4 0 0 1 20 26"/></>,
    speed_watcher:    <><polygon points="18,2 8,16 15,16 13,30 24,14 16,14"/></>,

    // ── Секретные
    secret_studio:    <><rect x="8" y="10" width="16" height="22"/><rect x="12" y="4" width="8" height="6"/><line x1="12" y1="16" x2="14" y2="16"/><line x1="18" y1="16" x2="20" y2="16"/></>,
    secret_contrarian:<><path d="M8 12 Q 16 4 24 12 C 24 20 16 28 16 28 C 16 28 8 20 8 12 Z"/><path d="M12 16 Q 16 20 20 16"/></>,
    secret_cinephile: <><rect x="4" y="8" width="24" height="16" rx="2"/><line x1="10" y1="8" x2="10" y2="24"/><line x1="22" y1="8" x2="22" y2="24"/></>,
    secret_music:     <><path d="M12 22 A 3 3 0 1 1 12 16 V 6 L 24 4 V 18 A 3 3 0 1 1 24 12 V 8 L 12 10"/></>,
    secret_detective: <><path d="M6 16 C 6 10 26 10 26 16"/><rect x="10" y="8" width="12" height="8"/><line x1="4" y1="16" x2="28" y2="16"/></>,
    secret_telescope: <><path d="M4 22 L 24 8 L 28 12 L 8 26 Z M 16 14 L 14 28 M 20 10 L 26 26"/></>,
    secret_dice:      <><rect x="6" y="6" width="20" height="20" rx="4"/><circle cx="10" cy="10" r="1.5"/><circle cx="22" cy="22" r="1.5"/><circle cx="16" cy="16" r="1.5"/></>,
    secret_mask:      <><path d="M6 10 L 8 4 L 12 8 L 20 8 L 24 4 L 26 10 C 26 20 16 28 16 28 C 16 28 6 20 6 10 Z"/><path d="M10 14 L 14 16 M 22 14 L 18 16"/></>,
    
    lock:             <><rect x="8" y="14" width="16" height="12" rx="2"/><path d="M12 14 V 10 A 4 4 0 0 1 20 10 V 14"/></>,
  }

  const content = paths[id] || paths.lock

  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
        {/* Задний цветной сдвиг (эффект акварели/маркера) */}
        <g {...fillProps}>
          {content}
        </g>
        {/* Чистый, красивый контур */}
        <g {...lineProps}>
          {content}
        </g>
      </svg>
    </span>
  )
}

// ─── Все ачивки ───────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [

  // ── Эпизоды ──────────────────────────────────────────────
  { id: 'ep_50',    name: 'Первые серии',            desc: 'Просмотрено 50 эпизодов',      check: s => s.totalEp >= 50,    xp: 5  },
  { id: 'ep_100',   name: 'Диванный эксперт',        desc: 'Просмотрено 100 эпизодов',     check: s => s.totalEp >= 100,   xp: 10 },
  { id: 'ep_500',   name: 'Диван — второй дом',      desc: 'Просмотрено 500 эпизодов',     check: s => s.totalEp >= 500,   xp: 25 },
  { id: 'ep_1000',  name: 'Тысячник',                desc: 'Просмотрено 1000 эпизодов',    check: s => s.totalEp >= 1000,  xp: 50 },
  { id: 'ep_2000',  name: 'Глаза квадратные',        desc: 'Просмотрено 2000 эпизодов',    check: s => s.totalEp >= 2000,  xp: 80 },
  { id: 'ep_5000',  name: 'Выпал из реальности',     desc: 'Просмотрено 5000 эпизодов',    check: s => s.totalEp >= 5000,  xp: 150 },
  { id: 'ep_10000', name: 'Я — Наруто',              desc: 'Просмотрено 10 000 эпизодов',  check: s => s.totalEp >= 10000, xp: 500 },

  // ── Часы ─────────────────────────────────────────────────
  { id: 'h_10',    name: 'Поздно лёг',             desc: '10 часов за аниме',    check: s => s.totalHours >= 10,   xp: 5  },
  { id: 'h_24',    name: 'Одна бессонная ночь',    desc: '24 часа за аниме',     check: s => s.totalHours >= 24,   xp: 15 },
  { id: 'h_50',    name: 'Кофе кончился',          desc: '50 часов за аниме',    check: s => s.totalHours >= 50,   xp: 25 },
  { id: 'h_100',   name: 'Кофе не помогает',       desc: '100 часов за аниме',   check: s => s.totalHours >= 100,  xp: 40 },
  { id: 'h_200',   name: 'Ночная сова',            desc: '200 часов за аниме',   check: s => s.totalHours >= 200,  xp: 70 },
  { id: 'h_500',   name: 'Выпал из реальности',    desc: '500 часов за аниме',   check: s => s.totalHours >= 500,  xp: 100 },
  { id: 'h_1000',  name: 'Аниме — часть ДНК',     desc: '1000 часов за аниме',  check: s => s.totalHours >= 1000, xp: 300 },
  { id: 'h_2000',  name: 'Параллельная вселенная', desc: '2000 часов за аниме',  check: s => s.totalHours >= 2000, xp: 600 },

  // ── Тайтлы ───────────────────────────────────────────────
  { id: 'titles_1',   name: 'Первый шаг',           desc: 'Просмотрен 1 тайтл',        check: s => s.completedTitles >= 1,   xp: 5  },
  { id: 'titles_5',   name: 'Втягиваюсь',           desc: 'Просмотрено 5 тайтлов',     check: s => s.completedTitles >= 5,   xp: 8  },
  { id: 'titles_10',  name: 'Первые шаги в Японию', desc: 'Просмотрено 10 тайтлов',    check: s => s.completedTitles >= 10,  xp: 10 },
  { id: 'titles_25',  name: 'Растёт коллекция',     desc: 'Просмотрено 25 тайтлов',    check: s => s.completedTitles >= 25,  xp: 20 },
  { id: 'titles_50',  name: 'Небольшая коллекция',  desc: 'Просмотрено 50 тайтлов',    check: s => s.completedTitles >= 50,  xp: 30 },
  { id: 'titles_100', name: 'Сотня самураев',       desc: 'Просмотрено 100 тайтлов',   check: s => s.completedTitles >= 100, xp: 75 },
  { id: 'titles_200', name: 'Серьёзный отаку',      desc: 'Просмотрено 200 тайтлов',   check: s => s.completedTitles >= 200, xp: 150 },
  { id: 'titles_250', name: 'Почётный японец',      desc: 'Просмотрено 250 тайтлов',   check: s => s.completedTitles >= 250, xp: 200 },
  { id: 'titles_500', name: 'Живая легенда',        desc: 'Просмотрено 500 тайтлов',   check: s => s.completedTitles >= 500, xp: 500 },

  // ── Этти ─────────────────────────────────────────────────
  { id: 'ecchi_1',  name: 'Случайно включил',      desc: '1 тайтл жанра Этти',   check: s => (s.genreCounts['Этти']||0) >= 1,  xp: 5  },
  { id: 'ecchi_5',  name: 'Просто изучаю культуру',desc: '5 тайтлов жанра Этти',  check: s => (s.genreCounts['Этти']||0) >= 5,  xp: 10 },
  { id: 'ecchi_20', name: 'Вечный битард',         desc: '20 тайтлов жанра Этти', check: s => (s.genreCounts['Этти']||0) >= 20, xp: 30 },
  { id: 'ecchi_50', name: 'Исследователь культуры',desc: '50 тайтлов жанра Этти', check: s => (s.genreCounts['Этти']||0) >= 50, xp: 80 },

  // ── Исекай ───────────────────────────────────────────────
  { id: 'isekai_1',  name: 'Первый грузовик',       desc: '1 тайтл жанра Исекай',   check: s => (s.genreCounts['Исекай']||0) >= 1,  xp: 5  },
  { id: 'isekai_5',  name: 'Сбит грузовиком',       desc: '5 тайтлов жанра Исекай', check: s => (s.genreCounts['Исекай']||0) >= 5,  xp: 10 },
  { id: 'isekai_15', name: 'Попаданец со стажем',   desc: '15 тайтлов жанра Исекай',check: s => (s.genreCounts['Исекай']||0) >= 15, xp: 35 },
  { id: 'isekai_30', name: 'Избранный',             desc: '30 тайтлов жанра Исекай',check: s => (s.genreCounts['Исекай']||0) >= 30, xp: 80 },
  { id: 'isekai_50', name: 'Гражданин другого мира', desc: '50 тайтлов жанра Исекай',check: s => (s.genreCounts['Исекай']||0) >= 50, xp: 150 },

  // ── Меха ─────────────────────────────────────────────────
  { id: 'mecha_3',  name: 'В кабину!',            desc: '3 тайтла жанра Меха',  check: s => (s.genreCounts['Меха']||0) >= 3,  xp: 10 },
  { id: 'mecha_10', name: 'Пилот Евангелион',     desc: '10 тайтлов жанра Меха',check: s => (s.genreCounts['Меха']||0) >= 10, xp: 25 },
  { id: 'mecha_25', name: 'Легенда железа',       desc: '25 тайтлов жанра Меха',check: s => (s.genreCounts['Меха']||0) >= 25, xp: 60 },

  // ── Романтика ────────────────────────────────────────────
  { id: 'romance_5',  name: 'Романтик',            desc: '5 тайтлов романтика',  check: s => (s.genreCounts['Романтика']||0) >= 5,  xp: 10 },
  { id: 'romance_10', name: 'Романтик поневоле',   desc: '10 тайтлов романтика', check: s => (s.genreCounts['Романтика']||0) >= 10, xp: 20 },
  { id: 'romance_30', name: 'Мастер второго плана',desc: '30 тайтлов романтика', check: s => (s.genreCounts['Романтика']||0) >= 30, xp: 60 },
  { id: 'romance_50', name: 'Страдалец',           desc: '50 тайтлов романтика', check: s => (s.genreCounts['Романтика']||0) >= 50, xp: 100 },

  // ── Повседневность ───────────────────────────────────────
  { id: 'sol_5',  name: 'Спокойное утро',   desc: '5 тайтлов повседневность',  check: s => (s.genreCounts['Повседневность']||0) >= 5,  xp: 10 },
  { id: 'sol_10', name: 'Просто живу',      desc: '10 тайтлов повседневность', check: s => (s.genreCounts['Повседневность']||0) >= 10, xp: 20 },
  { id: 'sol_25', name: 'Мир и уют',        desc: '25 тайтлов повседневность', check: s => (s.genreCounts['Повседневность']||0) >= 25, xp: 45 },

  // ── Психология ───────────────────────────────────────────
  { id: 'psycho_3',  name: 'Первый сеанс',       desc: '3 психологических тайтла',  check: s => (s.genreCounts['Психология']||0) >= 3,  xp: 10 },
  { id: 'psycho_5',  name: 'Немного не в себе',  desc: '5 психологических тайтлов', check: s => (s.genreCounts['Психология']||0) >= 5,  xp: 15 },
  { id: 'psycho_15', name: 'Терапевт в отпуске', desc: '15 психологических тайтлов',check: s => (s.genreCounts['Психология']||0) >= 15, xp: 40 },
  { id: 'psycho_30', name: 'Тёмный мыслитель',   desc: '30 психологических тайтлов',check: s => (s.genreCounts['Психология']||0) >= 30, xp: 80 },

  // ── Экшен ────────────────────────────────────────────────
  { id: 'action_10', name: 'Боевой дух',       desc: '10 тайтлов экшен',  check: s => (s.genreCounts['Экшен']||0) >= 10, xp: 15 },
  { id: 'action_25', name: 'Берсерк',          desc: '25 тайтлов экшен',  check: s => (s.genreCounts['Экшен']||0) >= 25, xp: 35 },
  { id: 'action_50', name: 'Мастер клинка',    desc: '50 тайтлов экшен',  check: s => (s.genreCounts['Экшен']||0) >= 50, xp: 80 },

  // ── Хоррор ───────────────────────────────────────────────
  { id: 'horror_3',  name: 'Ещё не страшно',   desc: '3 тайтла хоррор',   check: s => (s.genreCounts['Хоррор']||0) >= 3,  xp: 8  },
  { id: 'horror_5',  name: 'Ночной зритель',   desc: '5 тайтлов хоррор',  check: s => (s.genreCounts['Хоррор']||0) >= 5,  xp: 15 },
  { id: 'horror_15', name: 'Гость из темноты', desc: '15 тайтлов хоррор', check: s => (s.genreCounts['Хоррор']||0) >= 15, xp: 40 },

  // ── Спорт ────────────────────────────────────────────────
  { id: 'sports_5',  name: 'Диванный болельщик', desc: '5 тайтлов спорт',  check: s => (s.genreCounts['Спорт']||0) >= 5,  xp: 10 },
  { id: 'sports_15', name: 'Чемпион по просмотру',desc: '15 тайтлов спорт',check: s => (s.genreCounts['Спорт']||0) >= 15, xp: 30 },

  // ── Фэнтези ──────────────────────────────────────────────
  { id: 'fantasy_10', name: 'Искатель приключений',desc: '10 тайтлов фэнтези',check: s => (s.genreCounts['Фэнтези']||0) >= 10, xp: 20 },
  { id: 'fantasy_25', name: 'Мастер волшебства',   desc: '25 тайтлов фэнтези',check: s => (s.genreCounts['Фэнтези']||0) >= 25, xp: 50 },

  // ── Оценки ───────────────────────────────────────────────
  { id: 'score_first',    name: 'Первая оценка',      desc: 'Поставил первую оценку',                      check: s => s.scoredCount >= 1,                          xp: 5  },
  { id: 'score_ten',      name: 'Первый шедевр',      desc: 'Поставил первую 10/10',                        check: s => s.score10count >= 1,                         xp: 10 },
  { id: 'score_all10',    name: 'Всё — шедевр',       desc: '5+ тайтлов с оценкой 10/10',                  check: s => s.score10count >= 5,                         xp: 40 },
  { id: 'score_many10',   name: 'Коллекционер шедевров',desc: '15+ тайтлов с оценкой 10/10',               check: s => s.score10count >= 15,                        xp: 80 },
  { id: 'score_low',      name: 'Ценитель треша',     desc: '5+ тайтлов с оценкой 1-3',                    check: s => s.scoreLowCount >= 5,                        xp: 20 },
  { id: 'score_critic',   name: 'Строгий критик',     desc: 'Средняя оценка ниже 5 при 20+ тайтлах',       check: s => s.completedTitles >= 20 && s.avgScore > 0 && s.avgScore < 5, xp: 30 },
  { id: 'score_generous', name: 'Всё нравится',       desc: 'Средняя оценка выше 8 при 20+ тайтлах',       check: s => s.completedTitles >= 20 && s.avgScore >= 8,  xp: 30 },
  { id: 'score_variety',  name: 'Тонкий вкус',        desc: 'Поставил все оценки от 1 до 10',               check: s => s.allScoresUsed,                             xp: 35 },

  // ── Поведение ────────────────────────────────────────────
  { id: 'drop_1',          name: 'Не зашло',           desc: 'Брошен 1 тайтл',                              check: s => s.droppedCount >= 1,                         xp: 5  },
  { id: 'drop_5',          name: 'Беглец',             desc: 'Брошено 5 тайтлов',                           check: s => s.droppedCount >= 5,                         xp: 10 },
  { id: 'drop_20',         name: 'Серийный бросатель', desc: 'Брошено 20 тайтлов',                          check: s => s.droppedCount >= 20,                        xp: 25 },
  { id: 'planned_10',      name: 'Планы-планы',        desc: '10+ аниме в планах',                          check: s => s.plannedCount >= 10,                        xp: 5  },
  { id: 'planned_hoarder', name: 'Когда-нибудь посмотрю',desc: '50+ аниме в планах',                       check: s => s.plannedCount >= 50,                        xp: 15 },
  { id: 'planned_100',     name: 'Список на всю жизнь',desc: '100+ аниме в планах',                         check: s => s.plannedCount >= 100,                       xp: 30 },
  { id: 'ongoing_watcher', name: 'Ждун',               desc: 'Смотришь 5+ онгоингов одновременно',          check: s => s.watchingCount >= 5,                        xp: 20 },
  { id: 'no_drop',         name: 'Железная воля',      desc: '30+ тайтлов и ни одного брошенного',          check: s => s.completedTitles >= 30 && s.droppedCount === 0, xp: 60 },
  { id: 'no_drop_100',     name: 'Непоколебимый',      desc: '100+ тайтлов и ни одного брошенного',         check: s => s.completedTitles >= 100 && s.droppedCount === 0, xp: 150 },
  { id: 'season_collector',name: 'Коллекционер сезонов',desc: '3+ сезона одного сериала',                  check: s => s.maxSeasonsOneSeries >= 3,                  xp: 20 },
  { id: 'season_master',   name: 'Верный фанат',       desc: '5+ сезонов одного сериала',                  check: s => s.maxSeasonsOneSeries >= 5,                  xp: 45 },
  { id: 'genre_explorer',  name: 'Исследователь',      desc: 'Посмотрел 5+ разных жанров',                 check: s => s.uniqueGenres >= 5,                         xp: 15 },
  { id: 'genre_master',    name: 'Всеядный',           desc: 'Посмотрел 10+ разных жанров',                check: s => s.uniqueGenres >= 10,                        xp: 40 },
  { id: 'speed_watcher',   name: 'Марафонец',          desc: 'Тайтл с 50+ эп. просмотрен полностью',       check: s => s.hasLongCompleted,                          xp: 50 },

  // ── Секретные ────────────────────────────────────────────
  { id: 'secret_studio',    name: 'Верный вассал',       desc: 'Секретная: 10+ тайтлов одной студии',   check: s => s.topStudioCount >= 10,   xp: 35,  secret: true },
  { id: 'secret_contrarian',name: 'Против системы',      desc: 'Секретная: поставил 1/10',              check: s => s.hasScore1,              xp: 20,  secret: true },
  { id: 'secret_cinephile', name: 'Синефил',             desc: 'Секретная: 20+ тайтлов аниме-фильмы',   check: s => s.movieCount >= 20,       xp: 40,  secret: true },
  { id: 'secret_music',     name: 'Живёт в наушниках',   desc: 'Секретная: 5 муз. аниме',               check: s => (s.genreCounts['Музыка']||0) >= 5, xp: 30, secret: true },
  { id: 'secret_detective', name: 'Мастер детектива',    desc: 'Секретная: 10 детективных тайтлов',     check: s => (s.genreCounts['Детектив']||0) >= 10, xp: 35, secret: true },
  { id: 'secret_telescope', name: 'Астроном фанатизма',  desc: 'Секретная: 1500+ часов',                check: s => s.totalHours >= 1500,     xp: 250, secret: true },
  { id: 'secret_dice',      name: 'Рандомный вкус',      desc: 'Секретная: тайтл с оценкой 1 и 10',    check: s => s.hasScore1 && s.score10count >= 1, xp: 25, secret: true },
  { id: 'secret_mask',      name: 'Театральный',         desc: 'Секретная: 15 тайтлов драма',           check: s => (s.genreCounts['Драма']||0) >= 15, xp: 30, secret: true },
]

// ─── Уровни ───────────────────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1,  xp: 0,    title: 'Новичок',            jp: '初心者',   color: '#9ca3af' },
  { level: 2,  xp: 25,   title: 'Любопытный',          jp: '好奇心',   color: '#6b7280' },
  { level: 3,  xp: 60,   title: 'Увлечённый',          jp: '熱中者',   color: '#4b5563' },
  { level: 4,  xp: 110,  title: 'Фанат',               jp: 'ファン',   color: '#1e40af' },
  { level: 5,  xp: 185,  title: 'Знаток',              jp: '知識者',   color: '#1d4ed8' },
  { level: 6,  xp: 290,  title: 'Отаку',               jp: 'オタク',   color: '#166534' },
  { level: 7,  xp: 430,  title: 'Хардкор-отаку',       jp: '本格オタ', color: '#15803d' },
  { level: 8,  xp: 620,  title: 'Легенда дивана',      jp: '伝説',     color: '#a16207' },
  { level: 9,  xp: 870,  title: 'Мастер аниме',        jp: '達人',     color: '#b45309' },
  { level: 10, xp: 1200, title: 'Живая энциклопедия',  jp: '大師匠',   color: '#d62828' },
  { level: 11, xp: 1600, title: 'Бог аниме',           jp: '神',       color: '#b91c1c' },
  { level: 12, xp: 2200, title: 'Запредельный',        jp: '超越者',   color: '#7c2d12' },
]

export function getLevelInfo(xp) {
  let current = LEVELS[0], next = LEVELS[1]
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) { current = LEVELS[i]; next = LEVELS[i + 1] || null }
  }
  const xpInLevel = next ? xp - current.xp : 0
  const xpToNext  = next ? next.xp - current.xp : 0
  const progress  = next ? xpInLevel / xpToNext : 1
  return { current, next, xpInLevel, xpToNext, progress }
}

// ─── Статистика ───────────────────────────────────────────────────────────────
export function computeStats(list) {
  const completed = list.filter(a => a.status === 'completed')
  const dropped   = list.filter(a => a.status === 'dropped')
  const planned   = list.filter(a => a.status === 'planned')
  const watching  = list.filter(a => a.status === 'watching')

  const totalEp    = list.reduce((s, a) => s + (a.ep || 0), 0)
  const totalHours = Math.round(totalEp * 23.5 / 60)

  // Нормализация жанров: API может возвращать разные написания
  const GENRE_NORM = {
    'Исэкай': 'Исекай',
    'Психологическое': 'Психология',
    'Ужасы': 'Хоррор',
  }
  const genreCounts = {}
  for (const a of list)
    for (const g of (a.genres || [])) {
      const key = GENRE_NORM[g] || g
      genreCounts[key] = (genreCounts[key] || 0) + 1
    }

  const scored        = completed.filter(a => a.score)
  const avgScore      = scored.length ? scored.reduce((s, a) => s + a.score, 0) / scored.length : 0
  const score10count  = completed.filter(a => a.score === 10).length
  const scoreLowCount = completed.filter(a => a.score <= 3 && a.score > 0).length
  const hasScore1     = completed.some(a => a.score === 1)
  const scoredCount   = scored.length
  const allScoresUsed = new Set(scored.map(a => a.score)).size >= 10

  const studioCounts  = {}
  for (const a of list) { const st = a.studio||'—'; if (st !== '—') studioCounts[st] = (studioCounts[st]||0) + 1 }
  const topStudioCount = Math.max(0, ...Object.values(studioCounts))

  const hasLongCompleted = completed.some(a => (a.epTotal||0) >= 50 && a.ep >= (a.epTotal||999))
  const uniqueGenres     = Object.keys(genreCounts).length
  const movieCount       = completed.filter(a => a.kind === 'movie').length

  // Макс сезонов одного сериала
  const seriesSeasons = {}
  for (const a of completed) {
    const k = a.seriesKey || a.titleRomaji || a.title
    seriesSeasons[k] = (seriesSeasons[k] || 0) + 1
  }
  const maxSeasonsOneSeries = Math.max(0, ...Object.values(seriesSeasons))

  return {
    totalEp, totalHours,
    completedTitles: completed.length,
    droppedCount: dropped.length,
    plannedCount: planned.length,
    watchingCount: watching.length,
    genreCounts, avgScore, score10count, scoreLowCount,
    hasScore1, scoredCount, allScoresUsed,
    topStudioCount, hasLongCompleted, uniqueGenres,
    movieCount, maxSeasonsOneSeries,
  }
}

export function getEarned(list) {
  const stats = computeStats(list)
  return ACHIEVEMENTS.filter(a => a.check(stats))
}

// ─── Страница ─────────────────────────────────────────────────────────────────
export default function Achievements({ navigate }) {
  const list = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } })()
  const stats   = computeStats(list)
  const earned  = new Set(ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id))
  const [filter, setFilter] = useState('all')

  const visible = ACHIEVEMENTS.filter(a =>
    filter === 'earned' ? earned.has(a.id) :
    filter === 'locked' ? !earned.has(a.id) : true
  )

  const earnedCount = earned.size
  const totalXp  = ACHIEVEMENTS.filter(a => earned.has(a.id)).reduce((s, a) => s + a.xp, 0)
  const { current: lvl, next: nextLvl, xpInLevel, xpToNext, progress } = getLevelInfo(totalXp)

  const F = "'Space Grotesk', sans-serif"
  const B = "'Bangers', sans-serif"
  const N = "'Noto Sans', sans-serif"
  const J = "'Noto Sans JP', sans-serif"

  return (
    <div style={{ background: '#f0ede6', minHeight: '100vh' }}>

      {/* Dot overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.025, backgroundImage: 'radial-gradient(circle,#000 1px,transparent 1px)', backgroundSize: '5px 5px' }} />

      <NavBar active="achievements" onNavigate={navigate} rightContent={
        <span style={{ fontFamily: B, fontSize: 16, color: '#0a0a0a', letterSpacing: '0.04em' }}>
          {earnedCount}<span style={{ color: '#aaa', fontSize: 12 }}>/{ACHIEVEMENTS.length}</span>
        </span>
      } />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 16px 20px', position: 'relative', zIndex: 1 }}>

        {/* Level card */}
        <div style={{ background: '#fff', border: '3px solid #0a0a0a', padding: '20px 24px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontFamily: B, fontSize: 130, color: 'rgba(10,10,10,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>{lvl.level}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
            <div style={{ flexShrink: 0, width: 68, height: 68, background: lvl.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '3px solid #0a0a0a' }}>
              <span style={{ fontFamily: B, fontSize: 30, color: '#fff', lineHeight: 1, letterSpacing: '0.04em' }}>{lvl.level}</span>
              <span style={{ fontFamily: J, fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>レベル</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: N, fontWeight: 900, fontStyle: 'italic', fontSize: 24, color: lvl.color, lineHeight: 1 }}>{lvl.title}</span>
                <span style={{ fontFamily: J, fontSize: 13, color: '#bbb' }}>{lvl.jp}</span>
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 12 }}>{totalXp} XP · {earnedCount} из {ACHIEVEMENTS.length} ачивок</div>
              {nextLvl ? (<>
                <div style={{ height: 8, background: 'rgba(10,10,10,0.08)', position: 'relative', marginBottom: 6 }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: lvl.color, width: `${progress * 100}%`, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: '#aaa' }}>{xpInLevel} / {xpToNext} XP до уровня {nextLvl.level}</span>
                  <span style={{ fontFamily: N, fontWeight: 900, fontStyle: 'italic', fontSize: 11, color: nextLvl.color }}>→ {nextLvl.title}</span>
                </div>
              </>) : (
                <div style={{ fontFamily: N, fontWeight: 900, fontStyle: 'italic', fontSize: 13, color: '#d62828' }}>Максимальный уровень достигнут</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(10,10,10,0.07)', flexWrap: 'wrap' }}>
            {LEVELS.map(l => {
              const done = totalXp >= l.xp, isCur = l.level === lvl.level
              return <div key={l.level} title={`${l.title} · ${l.xp} XP`} style={{ width: 28, height: 28, background: done ? l.color : 'rgba(10,10,10,0.06)', border: isCur ? '2px solid #0a0a0a' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: B, fontSize: 12, color: done ? '#fff' : '#ccc', boxShadow: isCur ? '2px 2px 0 #0a0a0a' : 'none', cursor: 'default' }}>{l.level}</div>
            })}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[['all','Все'],['earned',`Получено (${earnedCount})`],['locked','Заблокировано']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 16px', background: filter===k ? '#0a0a0a' : 'none', border: `2px solid ${filter===k ? '#0a0a0a' : '#ddd'}`, cursor: 'pointer', color: filter===k ? '#f0ede6' : '#bbb' }}
              onMouseEnter={e => { if(filter!==k){e.currentTarget.style.borderColor='#0a0a0a';e.currentTarget.style.color='#0a0a0a'} }}
              onMouseLeave={e => { if(filter!==k){e.currentTarget.style.borderColor='#ddd';e.currentTarget.style.color='#bbb'} }}
            >{l}</button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
          {visible.map(a => {
            const isEarned = earned.has(a.id)
            const isSecret = a.secret && !isEarned
            return (
              <div key={a.id}
                style={{ background: '#fff', border: `2px solid ${isEarned ? 'rgba(10,10,10,0.25)' : 'rgba(10,10,10,0.08)'}`, padding: '14px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden', minHeight: 88, opacity: isEarned ? 1 : 0.4, transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s' }}
                onMouseEnter={e => { if(isEarned){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='4px 4px 0 #0a0a0a';e.currentTarget.style.borderColor='#0a0a0a'} }}
                onMouseLeave={e => { e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';e.currentTarget.style.borderColor=isEarned?'rgba(10,10,10,0.25)':'rgba(10,10,10,0.08)' }}
              >
                {/* Icon box (Теперь использует a.id вместо a.icon) */}
                <div style={{ flexShrink: 0, width: 60, height: 60, background: '#f0ede6', border: `2px solid ${isEarned ? '#0a0a0a' : 'rgba(10,10,10,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AchIcon id={isSecret ? 'lock' : a.id} size={34} color={isEarned ? '#0a0a0a' : '#a8a5a0'} />
                </div>
                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: N, fontWeight: 900, fontStyle: 'italic', fontSize: 14, color: '#0a0a0a', lineHeight: 1.25, marginBottom: 3, filter: isSecret ? 'blur(5px)' : 'none', userSelect: isSecret ? 'none' : 'auto' }}>
                    {isSecret ? '???????????' : a.name}
                  </div>
                  <div style={{ fontFamily: F, fontSize: 11, color: '#888', fontWeight: 600, lineHeight: 1.4, filter: isSecret ? 'blur(4px)' : 'none' }}>
                    {isSecret ? 'Секретная ачивка' : a.desc}
                  </div>
                  <span style={{ fontFamily: B, fontSize: 14, letterSpacing: '0.06em', color: isEarned ? '#166534' : '#c0bdb8', marginTop: 5, display: 'block' }}>+{a.xp} XP</span>
                </div>
                {isEarned && <div style={{ position: 'absolute', top: 0, right: 0, fontFamily: B, fontSize: 9, letterSpacing: '0.08em', background: '#0a0a0a', color: '#f0ede6', padding: '2px 8px' }}>✓ ПОЛУЧЕНО</div>}
                {isSecret  && <div style={{ position: 'absolute', top: 0, right: 0, fontFamily: B, fontSize: 9, letterSpacing: '0.06em', background: '#92400e', color: '#fff', padding: '2px 8px' }}>СЕКРЕТ</div>}
              </div>
            )
          })}
        </div>

        {visible.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: B, fontSize: 48, color: '#ddd', marginBottom: 8 }}>空</div>
            <div style={{ fontFamily: J, fontSize: 13, color: '#bbb' }}>Пусто</div>
          </div>
        )}
      </div>
    </div>
  )
}