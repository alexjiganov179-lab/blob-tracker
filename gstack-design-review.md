# 🎯 Contour VFX Overlay — GStack Design Review

**Tool:** gstack browse (headless Chromium)
**Viewport tested:** 1440×900 (desktop)
**Project:** Blob Tracker — real-time contour VFX overlay editor

> Historical design review snapshot. The current product surface is documented in
> `README.md` and `online-version/README.md`; effect names and panel contents may
> differ from the captured UI below.

---

## 1. Layout & Structure

```
┌─────────────────────────────────────────────┬──────────┐
│                 VIEWER                      │  PANEL   │
│              (flex: 1)                      │ (340px)  │
│  ┌──────────────────────────────────────┐   │  Sticky  │
│  │        Drop Zone / Canvas           │   │  header  │
│  │                                     │   │          │
│  │  🎬 Drop video / Upload Video      │   │  Cards   │
│  │                                     │   │  scroll  │
│  │  Export overlay (absolute top-right)│   │          │
│  └──────────────────────────────────────┘   │          │
│                                             │          │
│  Progress bar (absolute bottom-center)      │  Footer  │
└─────────────────────────────────────────────┴──────────┘
```

**Desktop (1440×900):** Viewer ~1100px, panel 340px. Хорошие пропорции — просмотру видео отдано 76% ширины.

**Блокировка скролла:** body `overflow: hidden` — вся навигация внутри панели, viewer без скролла. Никакого случайного ухода с экрана.

---

## 2. Color System

| Роль | Цвет | Применение |
|------|------|-----------|
| **Фон** | `#0d0d12` | body, глубокий тёмный фон |
| **Текст** | `#e0e0e0` | основной текст |
| **Акцент** | `#f3ac03` (золотой) | active state, export btn, toggle, slider, кнопки |
| **Карточки** | `rgba(255,255,255,.02)` | фон карточек с `border rgba(255,255,255,.055)` |
| **Сегменты** | `rgba(0,0,0,.3)` → active `#1e1b24` | segmented buttons |
| **Лейблы** | `#555` | card-label (10px uppercase) |
| **Подписи** | `#444` → `#666` → `#777` | sub-labels, pro-label, текст кнопок |
| **Неактивные** | `#1e1e28` | границы, слайдеры треки |

**Оценка:** 🟢 Когерентная тёмная тема с тёплым золотым акцентом. Gold accent последовательно используется во всех активных состояниях — единый визуальный язык. Градации серого хорошие, создают чёткую иерархию: карточки → лейблы → кнопки → активные элементы.

**Контраст (WCAG AA):**
- `#555` на `#0d0d12` → ~4.1:1 (граница AA для small text, приемлемо для жирного 10px)
- `#666` на `#0d0d12` → ~4.9:1 ✅

---

## 3. Typography

**Стек:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

| Элемент | Размер | Вес | Цвет | Примечание |
|---------|--------|-----|------|-----------|
| Panel title | **15px** | **700** | `#fff` | letter-spacing -.01em |
| Card label | **10px** | 600 | `#555` | uppercase + .06em — аккуратно |
| Sub label | **9px** | normal | `#444` | uppercase + .04em |
| Seg buttons | **11px** | 500 | `#777` | — |
| Grid buttons | **9px** | 500 | `#888` | 4 колонки |
| Slider value | **10px** | — | `#f3ac03` | tabular-nums для стабильной ширины |
| Export text | **12px** | 600 | `#fff` | — |

**Оценка:** 🟢 Типографическая иерархия хорошо построена. Размеры уменьшаются от заголовка (15px) через секции (10px) к контролам (9-11px). Использование uppercase + letter-spacing для лейблов создаёт чистый, инструментальный тон.

**Замечание:** `line-height: normal` по всему документу — можно было бы задать явно для более предсказуемого вертикального ритма на всех платформах.

---

## 4. Компонентная система

### Border Radius Scale

```
#drop-zone → 12px     (внешний контейнер)
.card     → 10px      (секции)
#upload-btn → 8px     (действия)
#export-btn → 8px     (действия)
.seg      → 7px       (группа кнопок)
.seg button → 5px     (кнопка внутри группы)
.gbtn     → 6px       (сетка эффектов)
.lbtn     → 6px       (линии соединения)
```

🟢 **Система радиусов последовательна и продумана.** Scale: 12 → 10 → 8 → 6–7 → 5. Внешние контейнеры более скруглённые, внутренние элементы — более прямоугольные. Хорошая иерархичная логика.

### Segmented Controls
- Container: `rgba(0,0,0,.3)` bg, `7px` radius, `3px` gap
- Кнопки: `5px 8px` padding, `11px` font
- Active: `#1e1b24` bg на кнопке — «ink-in-glass» эффект, когда активная кнопка выглядит утопленной
- Transition: 0.15s

### Grid Buttons (`.gbtn`)
- 4 колонки по умолчанию, 3 для `.grid.w3`
- Active: gold border + gold text + `rgba(249,115,22,.08)` bg
- **Dot-индикатор**: `5px` circle `position: absolute; top:3px; right:3px` — для эффектов Label, Basic, Backdrop помечены дополнительной точкой (вероятно, самые используемые)
- 🟢 Элегантный компактный дизайн

### Toggle Switches (кастомные)
- 32×16px, `border-radius: 8px`
- Thumb: 11×11px circle, transition 0.2s
- Checked: gold track + white thumb с transform translateX(16px)
- 🟢 Чистая кастомная реализация, zero dependencies

### Color Palette
- 9 колонок, 18 цветов (от белого через спектр до чёрного и фиолетовых)
- Active state: white border + box-shadow + `✓` checkmark overlay
- 🟢 Плотная, но аккуратная сетка

### Tooltips (`.tip`)
- Circle `?` (16×16px), `rgba(255,255,255,.06)` bg
- Hover: `rgba(249,115,22,.15)` bg + `#f3ac03` text — тонкая анимация
- Popup: `position: fixed; bottom: 12px; left: 50%` — появляется внизу по центру, не перекрывает элементы управления
- Shadow: `0 4px 20px rgba(0,0,0,.5)` — хорошая глубина
- 🟢 Продуманный UX — появляется в безопасной зоне, не мешает работе

---

## 5. Анимации и Micro-interactions

| Элемент | Свойство | Длительность |
|---------|----------|-------------|
| Seg buttons, Grid, Line, Icons | все transition | **0.15s** |
| Drop zone border | border-color | **0.2s** |
| Toggle switch | все | **0.2s** |
| Progress fill | width | **0.15s** |
| Color swatches | все | **0.12s** |
| Tooltip | bg, color | **0.15s** |

🟢 **Отлично.** Все transition-ы в диапазоне 0.12–0.2s — «золотой стандарт» UI-анимации. Быстро, отзывчиво, профессионально. Единообразие длительности создаёт ощущение цельной системы.

**Особо:** прогресс-бар со `transition: width .15s` и спиннером — визуальная обратная связь при детекции без скрытия управления.

---

## 6. Экспорт и Overlay

**Export overlay** (`position: absolute; top:12px; right:12px`):
- Кнопка `⬇ Export MP4` — золотая `#f3ac03`, жирный 600 текст
- Select формата — стилизован под тёмную тему
- Кнопка `🔄 Re-detect` — нейтральная, с gold border на hover
- **Progress bar**: semi-transparent чёрный фон, gold fill, спиннер, текстовый лейбл

🟢 Все элементы экспорта аккуратно собраны в правом верхнем углу, не мешают просмотру, появляются только после обработки видео.

---

## 7. UX Flow

```
  Drop video → Upload Video
       │
  [Progress bar: Loading… → Detecting… %]
       │
  Canvas preview with contour overlay
       │
  Export overlay visible ◄── Adjust params in panel
       │
  Export MP4 (or Re-detect)
```

🟢 **Key UX strengths:**

1. **Drag-and-drop** — работает на всё окно (event на `window`), не только на drop-zone
2. **Пресеты Sensitivity / Object Size** — скрывают сложные Canny/blob параметры за простыми названиями (Low/Normal/High). Отличный UX-паттерн для технических инструментов
3. **Friendly error handling** — сообщения на русском, таймаут 30с, recoverFromFatal()
4. **Redirect on error** — повторный дроп или загрузка без перезагрузки страницы
5. **Sticky header** — `.panel-header { position: sticky }` с градиентным затуханием снизу, чтобы названия секций не терялись при скролле
6. **Debug logger** — `📋 Copy debug log` с таймстемпами и JSON параметров
7. **Reset to defaults** — одним кликом, с полным сбросом всех слайдеров, чекбоксов и состояний
8. **Центроидный трекер** — стабилизация через экспоненциальное сглаживание (alpha=0.25), удаление ghost-треков через MIN_AGE, удержание через MAX_MISSED

---

## 8. Визуальные замечания

| Замечание | Важность |
|-----------|----------|
| `font-size: 9px` для `.sub` и `.gbtn` — мелковато для просмотра с расстояния | 🟡 Medium |
| `line-height: normal` — непредсказуем на разных ОС, лучше явно `1.4` | 🟢 Low |
| `.pro-row` gap не задан (`gap: normal`) — разный отступ между строками | 🟢 Low |
| Нет `:focus-visible` стилей — клавиатурная навигация без индикации | 🟡 Medium |
| Все 53 `<button>` без `type` — технически корректно (default type="submit" в форме, но формы нет) | 🟢 Low |
| Иконки `.lbtn svg` — внутри кнопок как `<img>`, без alt-текста | 🟡 Medium |
| `presets.json` fetch падает на file:// — требуется HTTP сервер | 🟡 Medium |
| OpenCV CDN без fallback — если CDN недоступен, приложение не стартует | 🟢 Low |

---

## 9. Итоговая Оценка

```
DESIGN SYSTEM:     █████████░ 9/10
  + Когерентная тёмная тема с тёплым золотым акцентом
  + Продуманная система border-radius (12→10→8→6→5)
  + Единообразные transition (0.12–0.2s)
  + Пресеты, скрывающие сложность технических параметров
  + Кастомные toggle/switches — zero dependencies

UI CONSISTENCY:    ████████░░ 8/10
  + Все активные состояния — золотой #f3ac03
  + Единый стиль для segmented, grid, icon, line кнопок
  + Чёткая иерархия: заголовок → карточка → секция → контрол
  - 9px текст на грани читаемости
  - gap не везде задан явно

UX FLOW:          █████████░ 9/10
  + Интуитивный drag-and-drop на всё окно
  + Плавный переход: drop → processing → preview → export
  + Пресеты упрощают порог входа
  + Солидная обработка ошибок и восстановление
  + Sticky header не теряется при скролле панели

ACCESSIBILITY:    ██████░░░░ 6/10
  - 53 кнопки без aria-label
  - Нет focus-visible стилей
  + Цветовой контраст в целом OK
  + Семантические кнопки, не div'ы

TECH:             ████████░░ 8/10
  + Single-file — zero build step
  + Встроенный debug logger с localStorage persistence
  + Centroid tracker с умной стабилизацией
  + OpenCV.js + MP4Muxer — мощный стек в браузере
  - file:// режим ломает fetch presets.json
```

---

**Вердикт:** Солидное VFX-приложение с профессионально выстроенной тёмной темой, продуманными микровзаимодействиями и отличным UX, скрывающим сложность компьютерного зрения за простыми пресетами. Основные точки улучшения — доступность (aria-label, focus-visible) и font-size для мелких элементов.
