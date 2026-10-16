export const STORAGE_KEY = 'anitrack_list'

// color = accent used for the status everywhere (chips, progress, tabs)
export const STATUS_META = {
  watching:  { label: 'Смотрю',      jp: '視聴中', color: 'var(--acid)' },
  completed: { label: 'Просмотрено', jp: '完了',   color: 'var(--cy)' },
  planned:   { label: 'В планах',    jp: '計画',   color: '#9aa3ff' },
  dropped:   { label: 'Брошено',     jp: '中断',   color: 'var(--mag)' },
}

export const TABS = [
  { key: 'all',       label: 'Все',         jp: '全部' },
  { key: 'watching',  label: 'Смотрю',      jp: '視聴中' },
  { key: 'completed', label: 'Просмотрено', jp: '完了' },
  { key: 'planned',   label: 'В планах',    jp: '計画' },
  { key: 'dropped',   label: 'Брошено',     jp: '中断' },
]

export const loadList = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
}
