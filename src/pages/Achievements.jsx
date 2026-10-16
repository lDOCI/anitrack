/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import NavBar from '../components/NavBar'
import { EXTRA_ACHIEVEMENTS, EXTRA_ICONS, extraStats } from './achievementDefs'
import {
  Archive, Atom, Award, BadgeCheck, Ban, Bookmark, Bot, Brain, Building2, CalendarClock, CalendarDays, Castle, Cat, Clapperboard, Clock, Coffee, Compass, Cpu, Crown, Diamond, Dices, Dna, DoorOpen, Drama, Droplet, Droplets, Dumbbell, Eye, Fingerprint, Flame, Footprints, Gauge, Gem, Ghost, Gift, Glasses, Globe, GraduationCap, Heart, HeartCrack, HeartHandshake, Hourglass, House, Infinity as InfinityIcon, Landmark, Layers, ListTodo, Lock, LogOut, Mail, Medal, Microscope, Moon, MoonStar, MousePointerClick, Music, Orbit, Package, Palette, Play, Popcorn, Puzzle, Rainbow, Rocket, Scale, Search, ShieldCheck, Siren, Skull, Sofa, Sparkles, Star, Sword, Swords, Telescope, ThumbsDown, Trash2, TreeDeciduous, Truck, Undo2, WandSparkles, Warehouse, Waypoints, Zap,
} from 'lucide-react'

const STORAGE_KEY = 'anitrack_list'
const SEEN_KEY    = 'anitrack_achievements_seen'

// ─── Иконки: набор lucide, по одной смысловой иконке на ачивку ────────────────────
const ICONS = {
  ep_50: Play,
  ep_100: Sofa,
  ep_500: Popcorn,
  ep_1000: Flame,
  ep_2000: Eye,
  ep_5000: Orbit,
  ep_10000: InfinityIcon,
  h_10: Moon,
  h_24: Clock,
  h_50: Coffee,
  h_100: Hourglass,
  h_200: MoonStar,
  h_500: Ghost,
  h_1000: Dna,
  h_2000: Atom,
  titles_1: Footprints,
  titles_5: Bookmark,
  titles_10: Landmark,
  titles_25: Layers,
  titles_50: Archive,
  titles_100: Castle,
  titles_200: Glasses,
  titles_250: Award,
  titles_500: Crown,
  ecchi_1: MousePointerClick,
  ecchi_5: Microscope,
  ecchi_20: Droplets,
  ecchi_50: GraduationCap,
  isekai_1: Truck,
  isekai_5: Siren,
  isekai_15: DoorOpen,
  isekai_30: Sword,
  isekai_50: Globe,
  mecha_3: Bot,
  mecha_10: Cpu,
  mecha_25: Rocket,
  romance_5: Heart,
  romance_10: HeartHandshake,
  romance_30: HeartCrack,
  romance_50: Mail,
  sol_5: Coffee,
  sol_10: Cat,
  sol_25: House,
  psycho_3: Brain,
  psycho_5: Puzzle,
  psycho_15: Fingerprint,
  psycho_30: Waypoints,
  action_10: Zap,
  action_25: Flame,
  action_50: Swords,
  horror_3: Droplet,
  horror_5: Ghost,
  horror_15: Skull,
  sports_5: Dumbbell,
  sports_15: Medal,
  fantasy_10: WandSparkles,
  fantasy_25: Gem,
  score_first: Star,
  score_ten: Sparkles,
  score_all10: Diamond,
  score_many10: Award,
  score_low: ThumbsDown,
  score_critic: Scale,
  score_generous: Gift,
  score_variety: Palette,
  drop_1: LogOut,
  drop_5: Trash2,
  drop_20: Ban,
  planned_10: ListTodo,
  planned_hoarder: Package,
  planned_100: Warehouse,
  ongoing_watcher: CalendarClock,
  no_drop: ShieldCheck,
  no_drop_100: BadgeCheck,
  season_collector: CalendarDays,
  season_master: TreeDeciduous,
  genre_explorer: Compass,
  genre_master: Rainbow,
  speed_watcher: Gauge,
  secret_studio: Building2,
  secret_contrarian: Undo2,
  secret_cinephile: Clapperboard,
  secret_music: Music,
  secret_detective: Search,
  secret_telescope: Telescope,
  secret_dice: Dices,
  secret_mask: Drama,
  lock: Lock,
}

export function AchIcon({ id, size = 36, color = '#f4f4ff' }) {
  const Icon = ICONS[id] || EXTRA_ICONS[id] || Award
  return (
    <span aria-hidden="true" style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={size} color={color} strokeWidth={1.75} />
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

  // ── Длинный хвост (src/pages/achievementDefs.js) ─────────
  ...EXTRA_ACHIEVEMENTS,
]

// ─── Уровни ───────────────────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1,  xp: 0,    title: 'Новичок',            jp: '初心者',   color: '#8d8db3' },
  { level: 2,  xp: 25,   title: 'Любопытный',          jp: '好奇心',   color: '#a7b0ff' },
  { level: 3,  xp: 60,   title: 'Увлечённый',          jp: '熱中者',   color: '#7b86ff' },
  { level: 4,  xp: 110,  title: 'Фанат',               jp: 'ファン',   color: '#27e1ff' },
  { level: 5,  xp: 185,  title: 'Знаток',              jp: '知識者',   color: '#3fd0b5' },
  { level: 6,  xp: 290,  title: 'Отаку',               jp: 'オタク',   color: '#7dff9a' },
  { level: 7,  xp: 430,  title: 'Хардкор-отаку',       jp: '本格オタ', color: '#b6ff3d' },
  { level: 8,  xp: 620,  title: 'Легенда дивана',      jp: '伝説',     color: '#d6ff1f' },
  { level: 9,  xp: 870,  title: 'Мастер аниме',        jp: '達人',     color: '#ffc61f' },
  { level: 10, xp: 1200, title: 'Живая энциклопедия',  jp: '大師匠',   color: '#ff8a1f' },
  { level: 11, xp: 1600, title: 'Бог аниме',           jp: '神',       color: '#ff2d87' },
  { level: 12, xp: 2200, title: 'Запредельный',        jp: '超越者',   color: '#ff6ab0' },
  { level: 13, xp: 3200, title: 'Хранитель архива',    jp: '館長',     color: '#ff8fd0' },
  { level: 14, xp: 4500, title: 'Вне времени',         jp: '永遠',     color: '#c28bff' },
  { level: 15, xp: 6200, title: 'Аниме-божество',      jp: '神仏',     color: '#8f9bff' },
  { level: 16, xp: 8500, title: 'Первоисточник',       jp: '原点',     color: '#6ee7ff' },
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
    ...extraStats(list),
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

  const pct = Math.round((earnedCount / ACHIEVEMENTS.length) * 100)

  return (
    <div className="ac">
      <NavBar active="achievements" onNavigate={navigate} rightContent={
        <span className="t-impact" style={{ fontSize: 20, color: 'var(--acid)' }}>
          {earnedCount}<span style={{ color: 'var(--mut)', fontSize: 13 }}>/{ACHIEVEMENTS.length}</span>
        </span>
      } />

      {/* ═════ LEVEL HERO ═════ */}
      <section className="ac-hero" style={{ '--lc': lvl.color }}>
        <div className="scan" />
        <div className="ac-lv" aria-label={`Уровень ${lvl.level}`}>
          <span className="t-hud" style={{ color: 'var(--lc)' }}>// уровень · レベル</span>
          <span className="t-impact ac-lv-n">{lvl.level}</span>
        </div>
        <div className="ac-info">
          <h1 className="t-head ac-title">{lvl.title}</h1>
          <div className="t-jp ac-jp">{lvl.jp}</div>
          <div className="t-hud ac-meta">{totalXp} XP · {earnedCount} из {ACHIEVEMENTS.length} ачивок · {pct}%</div>
          {nextLvl ? (<>
            <div className="ac-segs" role="img" aria-label={`${Math.round(progress * 100)}% до следующего уровня`}>
              {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.round(progress * 20) ? 'f' : ''} />)}
            </div>
            <div className="ac-next">
              <span className="t-hud" style={{ color: 'var(--mut)' }}>{xpInLevel} / {xpToNext} XP до уровня {nextLvl.level}</span>
              <span className="t-hud" style={{ color: nextLvl.color }}>→ {nextLvl.title}</span>
            </div>
          </>) : (
            <div className="t-hud" style={{ color: 'var(--acid)', marginTop: 18 }}>Максимальный уровень достигнут</div>
          )}
        </div>
      </section>

      {/* ═════ LADDER ═════ */}
      <section className="ac-ladder">
        <div className="ac-ladder-in">
          {LEVELS.map(l => {
            const done = totalXp >= l.xp, isCur = l.level === lvl.level
            return (
              <div key={l.level} title={`${l.title} · ${l.xp} XP`} className={`ac-step${done ? ' done' : ''}${isCur ? ' cur' : ''}`} style={{ '--sc': l.color }}>
                <span>{l.level}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ═════ FILTERS + LIST ═════ */}
      <section className="ac-main">
        <div className="t-hud" style={{ color: 'var(--cy)', marginBottom: 16 }}>// 実績</div>
        <div className="ac-filters" role="group" aria-label="Фильтр ачивок">
          {[['all','Все'],['earned',`Получено (${earnedCount})`],['locked','Заблокировано']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter===k} className={filter===k ? 'on' : ''}><span>{l}</span></button>
          ))}
        </div>

        <div className="ac-grid">
          {visible.map(a => {
            const isEarned = earned.has(a.id)
            const isSecret = a.secret && !isEarned
            return (
              <div key={a.id} className={`ac-card${isEarned ? ' earned' : ''}`}>
                <div className="ac-ico">
                  <AchIcon id={isSecret ? 'lock' : a.id} size={36} color={isEarned ? '#07070e' : '#8d8db3'} />
                </div>
                <div className="ac-txt">
                  <div className="ac-name" style={isSecret ? { filter: 'blur(5px)', userSelect: 'none' } : undefined}>
                    {isSecret ? '???????????' : a.name}
                  </div>
                  <div className="ac-desc" style={isSecret ? { filter: 'blur(4px)' } : undefined}>
                    {isSecret ? 'Секретная ачивка' : a.desc}
                  </div>
                </div>
                <div className="ac-xp">
                  <span className="t-impact" style={{ fontSize: 22, color: isEarned ? 'var(--acid)' : 'var(--mut)' }}>+{a.xp}</span>
                  <span className="t-hud" style={{ color: isEarned ? 'var(--acid)' : isSecret ? 'var(--mag)' : 'var(--mut)', fontSize: 9 }}>
                    {isEarned ? 'получено' : isSecret ? 'секрет' : 'xp'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {visible.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="t-out" style={{ fontSize: 80, '--stroke': 'var(--mut)' }}>空</div>
            <div style={{ fontSize: 15, color: 'var(--mut)', marginTop: 8 }}>Пусто</div>
          </div>
        )}
      </section>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
  .ac { padding-top: 52px; min-height: 100vh; overflow-x: hidden; background: var(--bg); color: var(--fg); }
  .ac *, .ac *::before, .ac *::after { box-sizing: border-box; }
  .ac h1 { margin: 0; }
  .ac button:focus-visible { outline: 3px solid var(--cy); outline-offset: 3px; }

  .ac-hero { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 5vw; align-items: end; padding: 8vh 5vw 15vh; background: var(--bg-2); clip-path: polygon(0 0, 100% 0, 100% calc(100% - 5vw), 0 100%); overflow: hidden; }
  .ac-lv { position: relative; display: flex; flex-direction: column; }
  .ac-lv-n { font-size: clamp(140px, 26vw, 420px); line-height: .8; color: var(--lc); transform: rotate(-4deg); transform-origin: left bottom; margin-top: 10px; text-shadow: 10px 10px 0 var(--bg); }
  .ac-info { position: relative; min-width: 0; padding-bottom: 1vw; }
  .ac-title { font-size: clamp(24px, 3.9vw, 76px); overflow-wrap: normal; hyphens: none; text-wrap: balance; } /* the longest level names are 12-13 letters: size to the column, never split a word */
  .ac-jp { font-size: clamp(18px, 2.4vw, 34px); color: var(--mut); margin: 12px 0 18px; }
  .ac-meta { color: var(--fg); }
  .ac-segs { display: grid; grid-template-columns: repeat(20, 1fr); gap: 3px; margin: 22px 0 10px; max-width: 640px; }
  .ac-segs i { height: 24px; border: 1.5px solid var(--line); transform: skewX(-18deg); display: block; }
  .ac-segs i.f { background: var(--lc); border-color: var(--lc); }
  .ac-next { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; max-width: 640px; line-height: 1.6; }

  .ac-ladder { margin-top: -3vw; padding: 0 5vw; }
  .ac-ladder-in { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; }
  .ac-step { height: 44px; display: grid; place-items: center; transform: skewX(-18deg); background: rgba(244,244,255,.06); color: var(--mut); font: 400 16px var(--f-impact); }
  .ac-step span { transform: skewX(18deg); }
  .ac-step.done { background: var(--sc); color: var(--bg); }
  .ac-step.cur { box-shadow: 5px 5px 0 var(--fg); transform: skewX(-18deg) translateY(-6px); }

  .ac-main { max-width: 1240px; margin: 0 auto; padding: 8vw 5vw 8vw; }
  .ac-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 34px; }
  .ac-filters button { background: none; border: 0; padding: 0; cursor: pointer; color: var(--mut); font: 700 11px var(--f-head); letter-spacing: .1em; text-transform: uppercase; }
  .ac-filters button span { display: block; padding: 13px 20px; box-shadow: inset 0 0 0 1px var(--line); transform: skewX(-12deg); transition: background .15s, color .15s; }
  .ac-filters button:hover { color: var(--fg); }
  .ac-filters button.on { color: var(--bg); } .ac-filters button.on span { background: var(--acid); box-shadow: none; }

  .ac-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 5vw; }
  .ac-card { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--line); }
  .ac-ico { width: 64px; height: 64px; display: grid; place-items: center; background: rgba(244,244,255,.05); box-shadow: inset 0 0 0 1px var(--line); }
  .ac-card.earned .ac-ico { background: var(--acid); box-shadow: 5px 5px 0 var(--blue); transform: rotate(-3deg); }
  .ac-name { font-weight: 700; font-size: 16px; line-height: 1.25; margin-bottom: 4px; color: var(--mut); overflow-wrap: break-word; }
  .ac-card.earned .ac-name { color: var(--fg); }
  .ac-desc { font-size: 14px; line-height: 1.4; color: var(--mut); }
  .ac-xp { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

  @media (max-width: 820px) {
    .ac-hero { grid-template-columns: 1fr; gap: 24px; background: var(--bg-2); padding-bottom: 18vw; }
    .ac-lv-n { font-size: 38vw; }
    .ac-grid { grid-template-columns: 1fr; }
    .ac-ladder-in { grid-template-columns: repeat(6, 1fr); row-gap: 8px; padding-right: 10px; }
    .ac-step { height: 38px; }
    .ac-card { grid-template-columns: 56px minmax(0, 1fr) auto; gap: 12px; }
    .ac-ico { width: 56px; height: 56px; }
    .ac-filters button span { padding: 12px 14px; font-size: 10px; }
  }
  @media (prefers-reduced-motion: reduce) { .ac-filters button span { transition: none; } }
`
