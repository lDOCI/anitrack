// Long-tail achievements: for people who finish the base set after ~200 titles.
// Icons live in EXTRA_ICONS (keyed by id) so achievement objects stay plain data.

import {
  Flame, Swords, Laugh, Smile, Mic, Frown, Cloud, Castle, Wand, Compass, Map, Mountain, BookHeart, Rocket, Satellite, Orbit,
  Ghost, Eye, Moon, Leaf, Coffee, Siren, Crosshair, Search, Fingerprint, Backpack, School, GraduationCap, Boxes, Globe,
  BookText, Users, Crown, WandSparkles, Sparkles, Dumbbell, Trophy, Skull, Biohazard, Brain, Headphones, Medal, Flag, Shield,
  Landmark, Scroll, Sword, Axe, Gamepad2, Timer, Utensils, Soup, Archive, Library, Package, Warehouse, Milestone, Infinity as InfinityIcon,
  Hourglass, Gem, Diamond, Pencil, Newspaper, Feather, Star, Angry, Film, Clapperboard, Gift, Disc3, Tv, PartyPopper, Radio,
  Pyramid, CalendarRange, Telescope, Calendar, Sunrise, Factory, Building2, Building, Heart, Store, Layers, Repeat, Footprints,
  TrainFront, Sunset, Shuffle, Sun, Anchor, Gauge, Percent, Meh, MoonStar,
} from 'lucide-react'

const THIS_YEAR = new Date().getFullYear()

/** Extra numbers derived from the list (merged into computeStats). */
export function extraStats(list) {
  const completed = list.filter(a => a.status === 'completed')
  const rated = list.filter(a => a.score > 0)
  const ratedCompleted = completed.filter(a => a.score > 0)
  const kinds = (k) => completed.filter(a => (a.kind || '').toLowerCase() === k).length
  const years = completed.map(a => a.year).filter(Boolean)

  const series = {}
  for (const a of completed) { const k = a.franchiseId || a.seriesKey || a.title; series[k] = (series[k] || 0) + 1 }
  const studios = new Set(list.map(a => a.studio).filter(s => s && s !== '—'))
  const studioCount = {}
  for (const a of list) if (a.studio && a.studio !== '—') studioCount[a.studio] = (studioCount[a.studio] || 0) + 1

  const scores = new Set(rated.map(a => a.score))
  const byStatus = (st) => list.filter(a => a.status === st).length
  const droppedN = byStatus('dropped')

  return {
    listTotal: list.length,
    ratedCount: rated.length,
    score9plus: ratedCompleted.filter(a => a.score >= 9).length,
    avgAll: rated.length ? rated.reduce((s, a) => s + a.score, 0) / rated.length : 0,
    ovaCount: kinds('ova'), onaCount: kinds('ona'), specialCount: kinds('special'), movieCount2: kinds('movie'),
    retroCount: years.filter(y => y < 2000).length,
    classicCount: years.filter(y => y < 1990).length,
    decades: new Set(years.map(y => Math.floor(y / 10))).size,
    yearsDistinct: new Set(years).size,
    newThisYear: completed.filter(a => a.year === THIS_YEAR).length,
    studiosDistinct: studios.size,
    topStudio: Math.max(0, ...Object.values(studioCount)),
    franchisesDone: Object.values(series).filter(n => n >= 2).length,
    maxSeasons: Math.max(0, ...Object.values(series)),
    longCompleted100: completed.filter(a => (a.epTotal || 0) >= 100).length,
    longCompleted200: completed.filter(a => (a.epTotal || 0) >= 200).length,
    longCompleted500: completed.filter(a => (a.epTotal || 0) >= 500).length,
    watchingN: byStatus('watching'),
    plannedN: byStatus('planned'),
    droppedN,
    dropRatioLow: completed.length >= 100 && droppedN / (droppedN + completed.length) < 0.05,
    allStatuses: ['watching', 'completed', 'planned', 'dropped'].every(st => byStatus(st) >= 5),
    twoScoresOnly: rated.length >= 20 && scores.size <= 2,
    allTens: ratedCompleted.length >= 20 && ratedCompleted.every(a => a.score === 10),
    noScores: completed.length >= 30 && rated.length === 0,
  }
}

const g = (name) => (s) => s.genreCounts[name] || 0

// [id, name, genre key (after normalisation), count, xp, icon]
const GENRE_TIERS = [
  ['action_100', 'Адреналин в крови', 'Экшен', 100, 50, Flame], ['action_200', 'Вечный бой', 'Экшен', 200, 110, Swords],
  ['comedy_25', 'Смех без причины', 'Комедия', 25, 20, Laugh], ['comedy_60', 'Душа компании', 'Комедия', 60, 45, Smile], ['comedy_120', 'Король стендапа', 'Комедия', 120, 100, Mic],
  ['drama_40', 'Слёзы в подушку', 'Драма', 40, 30, Frown], ['drama_80', 'Платок наготове', 'Драма', 80, 60, Cloud],
  ['fantasy_50', 'Хранитель сказок', 'Фэнтези', 50, 70, Castle], ['fantasy_100', 'Архимаг', 'Фэнтези', 100, 140, Wand],
  ['adventure_25', 'Путешественник', 'Приключения', 25, 25, Compass], ['adventure_60', 'Странник миров', 'Приключения', 60, 60, Map], ['adventure_120', 'Первооткрыватель', 'Приключения', 120, 120, Mountain],
  ['romance_100', 'Хронический романтик', 'Романтика', 100, 100, BookHeart],
  ['scifi_15', 'Космический турист', 'Фантастика', 15, 20, Rocket], ['scifi_40', 'Звёздный пилот', 'Фантастика', 40, 50, Satellite], ['scifi_80', 'Хранитель галактики', 'Фантастика', 80, 100, Orbit],
  ['supernatural_25', 'Охотник за духами', 'Сверхъестественное', 25, 30, Ghost], ['supernatural_60', 'Медиум', 'Сверхъестественное', 60, 70, Eye], ['supernatural_120', 'Другая сторона', 'Сверхъестественное', 120, 130, Moon],
  ['sol_50', 'Мастер дзен', 'Повседневность', 50, 40, Leaf], ['sol_100', 'Чайная церемония', 'Повседневность', 100, 90, Coffee],
  ['thriller_10', 'Нервы на пределе', 'Триллер', 10, 20, Siren], ['thriller_30', 'Холодный расчёт', 'Триллер', 30, 60, Crosshair],
  ['detective_25', 'Шерлок на диване', 'Детектив', 25, 50, Search], ['detective_50', 'Мозг как у Конана', 'Детектив', 50, 100, Fingerprint],
  ['school_30', 'Прогульщик', 'Школа', 30, 25, Backpack], ['school_80', 'Староста класса', 'Школа', 80, 60, School], ['school_150', 'Выпускник', 'Школа', 150, 120, GraduationCap],
  ['mecha_50', 'Гигантский робот', 'Меха', 50, 70, Boxes],
  ['isekai_100', 'Постоянный житель другого мира', 'Исекай', 100, 110, Globe],
  ['ecchi_100', 'Профессор культуры', 'Этти', 100, 120, BookText],
  ['harem_10', 'Окружён', 'Гарем', 10, 15, Users], ['harem_30', 'Хозяин гарема', 'Гарем', 30, 50, Crown],
  ['mahou_5', 'Девочка-волшебница', 'Махо-сёдзё', 5, 15, WandSparkles], ['mahou_15', 'Королева превращений', 'Махо-сёдзё', 15, 50, Sparkles],
  ['sports_30', 'Тренер', 'Спорт', 30, 60, Dumbbell], ['sports_50', 'Олимпиец', 'Спорт', 50, 100, Trophy],
  ['horror_30', 'Бесстрашный', 'Хоррор', 30, 70, Skull], ['horror_50', 'Король ужасов', 'Хоррор', 50, 130, Biohazard],
  ['psycho_50', 'Мозгоправ', 'Психология', 50, 90, Brain],
  ['music_15', 'Меломан', 'Музыка', 15, 40, Headphones],
  ['martial_10', 'Чёрный пояс', 'Боевые искусства', 10, 30, Swords], ['martial_30', 'Мастер додзё', 'Боевые искусства', 30, 80, Medal],
  ['military_10', 'Ветеран', 'Военное', 10, 30, Flag], ['military_25', 'Генерал', 'Военное', 25, 70, Shield],
  ['historical_10', 'Хранитель эпох', 'Исторический', 10, 30, Landmark], ['historical_25', 'Летописец', 'Исторический', 25, 80, Scroll],
  ['samurai_5', 'Ронин', 'Самураи', 5, 20, Sword], ['samurai_15', 'Сёгун', 'Самураи', 15, 70, Axe],
  ['vampire_5', 'Ночной житель', 'Вампиры', 5, 20, Moon], ['vampire_15', 'Граф', 'Вампиры', 15, 60, Crown],
  ['game_10', 'Геймер', 'Игры', 10, 25, Gamepad2], ['game_30', 'Спидраннер', 'Игры', 30, 70, Timer],
  ['space_10', 'Космонавт', 'Космос', 10, 30, Rocket],
  ['gourmet_5', 'Гурман', 'Гурман', 5, 20, Utensils], ['gourmet_15', 'Шеф-повар', 'Гурман', 15, 60, Soup],
  ['magic_15', 'Ученик чародея', 'Магия', 15, 30, Wand], ['magic_40', 'Верховный маг', 'Магия', 40, 90, Sparkles],
]

const genreAch = GENRE_TIERS.map(([id, name, genre, n, xp, icon]) => ({
  id, name, desc: `${n} тайтлов жанра «${genre}»`, xp, check: s => g(genre)(s) >= n, icon,
}))

// [id, name, desc, xp, icon, check, secret?]
const GENERAL = [
  ['list_150', 'Каталогизатор', '150 аниме в списке', 30, Archive, s => s.listTotal >= 150],
  ['list_300', 'Библиотекарь', '300 аниме в списке', 70, Library, s => s.listTotal >= 300],
  ['list_500', 'Архивариус', '500 аниме в списке', 150, Package, s => s.listTotal >= 500],
  ['list_1000', 'Хранитель базы', '1000 аниме в списке', 400, Warehouse, s => s.listTotal >= 1000],
  ['titles_300', 'Три сотни', 'Просмотрено 300 тайтлов', 250, Medal, s => s.completedTitles >= 300],
  ['titles_400', 'Бесконечный марафон', 'Просмотрено 400 тайтлов', 350, Milestone, s => s.completedTitles >= 400],
  ['titles_750', 'Монумент', 'Просмотрено 750 тайтлов', 700, Landmark, s => s.completedTitles >= 750],
  ['titles_1000', 'Тысяча тайтлов', 'Просмотрено 1000 тайтлов', 1200, Trophy, s => s.completedTitles >= 1000],
  ['ep_20000', 'Лунатик', 'Просмотрено 20 000 эпизодов', 800, MoonStar, s => s.totalEp >= 20000],
  ['ep_30000', 'Часть пейзажа', 'Просмотрено 30 000 эпизодов', 1200, InfinityIcon, s => s.totalEp >= 30000],
  ['h_3000', 'Вторая работа', '3000 часов за аниме', 600, Timer, s => s.totalHours >= 3000],
  ['h_5000', 'Космический срок', '5000 часов за аниме', 1000, Hourglass, s => s.totalHours >= 5000],

  ['rated_100', 'Критик', 'Оценил 100 тайтлов', 40, Pencil, s => s.ratedCount >= 100],
  ['rated_250', 'Критик-профи', 'Оценил 250 тайтлов', 120, Newspaper, s => s.ratedCount >= 250],
  ['rated_500', 'Золотое перо', 'Оценил 500 тайтлов', 300, Feather, s => s.ratedCount >= 500],
  ['score_10_30', 'Всё лучшее', '30 тайтлов с оценкой 10/10', 150, Gem, s => s.score10count >= 30],
  ['score_10_60', 'Вечный фанат', '60 тайтлов с оценкой 10/10', 300, Diamond, s => s.score10count >= 60],
  ['score_9plus_50', 'Высокая планка', '50 тайтлов с оценкой 9 и выше', 100, Star, s => s.score9plus >= 50],
  ['avg_low_50', 'Хейтер года', 'Средняя оценка ниже 6 при 50+ оценках', 120, Angry, s => s.ratedCount >= 50 && s.avgAll > 0 && s.avgAll < 6],
  ['avg_high_50', 'Добряк', 'Средняя оценка 8.5+ при 50+ оценках', 120, Smile, s => s.ratedCount >= 50 && s.avgAll >= 8.5],

  ['movies_5', 'Киноман', '5 аниме-фильмов', 25, Film, s => s.movieCount2 >= 5],
  ['movies_50', 'Кинокритик', '50 аниме-фильмов', 200, Clapperboard, s => s.movieCount2 >= 50],
  ['ova_5', 'Бонусный контент', '5 OVA', 20, Gift, s => s.ovaCount >= 5],
  ['ova_20', 'Коллекционер OVA', '20 OVA', 80, Disc3, s => s.ovaCount >= 20],
  ['ona_5', 'Стриминговый зритель', '5 ONA', 20, Tv, s => s.onaCount >= 5],
  ['special_10', 'Спешлы — наше всё', '10 спешлов', 60, PartyPopper, s => s.specialCount >= 10],

  ['retro_5', 'Ретроград', '5 тайтлов до 2000 года', 30, Radio, s => s.retroCount >= 5],
  ['retro_20', 'Хранитель классики', '20 тайтлов до 2000 года', 100, Pyramid, s => s.retroCount >= 20],
  ['classic_5', 'Дедушка аниме', '5 тайтлов до 1990 года', 80, Hourglass, s => s.classicCount >= 5],
  ['decades_4', 'Путешественник во времени', 'Тайтлы из 4 разных десятилетий', 60, CalendarRange, s => s.decades >= 4],
  ['decades_5', 'Все эпохи', 'Тайтлы из 5 разных десятилетий', 150, Telescope, s => s.decades >= 5],
  ['years_15', 'Каждый год', 'Тайтлы 15 разных лет выпуска', 80, Calendar, s => s.yearsDistinct >= 15],
  ['newyear_10', 'Свежак', '10 тайтлов этого года', 40, Sunrise, s => s.newThisYear >= 10],

  ['studios_10', 'Знаток студий', 'Тайтлы 10 разных студий', 25, Factory, s => s.studiosDistinct >= 10],
  ['studios_25', 'Продюсер', 'Тайтлы 25 разных студий', 70, Building2, s => s.studiosDistinct >= 25],
  ['studios_50', 'Вся индустрия', 'Тайтлы 50 разных студий', 160, Building, s => s.studiosDistinct >= 50],
  ['studio_20', 'Фанат студии', '20 тайтлов одной студии', 80, Heart, s => s.topStudio >= 20],
  ['studio_40', 'Живая вывеска', '40 тайтлов одной студии', 200, Store, s => s.topStudio >= 40],

  ['franchises_5', 'Сериаломан', '5 франшиз с двумя и более просмотренными частями', 40, Layers, s => s.franchisesDone >= 5],
  ['franchises_15', 'Эксперт по сезонам', '15 франшиз с двумя и более просмотренными частями', 120, Boxes, s => s.franchisesDone >= 15],
  ['seasons_7', 'Долгая дорога', '7 просмотренных частей одной франшизы', 90, Milestone, s => s.maxSeasons >= 7],
  ['seasons_10', 'Десять сезонов', '10 просмотренных частей одной франшизы', 200, Repeat, s => s.maxSeasons >= 10],
  ['long_100', 'Длинный путь', 'Досмотрел тайтл от 100 серий', 80, Footprints, s => s.longCompleted100 >= 1],
  ['long_200', 'Марафон богов', 'Досмотрел тайтл от 200 серий', 150, TrainFront, s => s.longCompleted200 >= 1],
  ['long_500', 'Вечность', 'Досмотрел тайтл от 500 серий', 400, Sunset, s => s.longCompleted500 >= 1],

  ['watching_10', 'Многостаночник', 'Смотришь 10+ тайтлов одновременно', 40, Shuffle, s => s.watchingN >= 10],
  ['watching_20', 'Хаос', 'Смотришь 20+ тайтлов одновременно', 120, Siren, s => s.watchingN >= 20],
  ['noplans_50', 'Живу сегодняшним днём', '50+ аниме и ни одного в планах', 50, Sun, s => s.listTotal >= 50 && s.plannedN === 0],
  ['drop_50', 'Беспощадный', 'Брошено 50 тайтлов', 100, Axe, s => s.droppedN >= 50],
  ['drop_ratio_low', 'Дотерплю до конца', 'Брошено меньше 5% при 100+ тайтлах', 100, Anchor, s => s.dropRatioLow],
  ['mix_all', 'Баланс', 'По 5+ тайтлов во всех статусах', 40, Gauge, s => s.allStatuses],

  ['secret_binary', 'Чёрное и белое', 'Секретная: 20+ оценок, но всего два разных балла', 60, Percent, s => s.twoScoresOnly, true],
  ['secret_all10', 'Фанатик', 'Секретная: 20+ тайтлов и все на 10/10', 120, Crown, s => s.allTens, true],
  ['secret_noscores', 'Без оценок', 'Секретная: 30+ просмотренных, ни одной оценки', 30, Meh, s => s.noScores, true],
  ['secret_insomnia', 'Бессонница', 'Секретная: 2500+ часов', 300, MoonStar, s => s.totalHours >= 2500, true],
]

const generalAch = GENERAL.map(([id, name, desc, xp, icon, check, secret]) => ({ id, name, desc, xp, check, icon, ...(secret ? { secret: true } : {}) }))

const ALL = [...genreAch, ...generalAch]

export const EXTRA_ICONS = Object.fromEntries(ALL.map(a => [a.id, a.icon]))
// plain data for the list (icon component stays in EXTRA_ICONS)
export const EXTRA_ACHIEVEMENTS = ALL.map(({ icon, ...a }) => { void icon; return a })
