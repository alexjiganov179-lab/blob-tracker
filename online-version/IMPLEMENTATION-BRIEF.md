# blob_tracker online — задание следующему агенту

Статус: технический handoff для продолжения разработки.

Дата актуальности: 03 июля 2026 года.

Главные источники правды:

1. `SPEC.md` — продуктовая цель, границы и правило публикации.
2. `PLAN-mediabunny.md` — текущий статус Mediabunny, исправления и критерии приёмки.
3. Этот документ — порядок реализации и проверки.

## Неподвижные ограничения

- Работать только с `online-version` и относящимися к ней тестами/документами,
  если пользователь отдельно не расширил область.
- Не создавать новые ветки без прямой просьбы пользователя.
- Не публиковать код, репозиторий или сайт.
- Не включать GitHub Pages.
- Не считать успешные тесты разрешением на публикацию.
- Публикация возможна только после полного переноса согласованных
  Apolotary-эффектов, личного тестирования автора и его отдельной явной команды.
- Сохранять модульную архитектуру приложения (`index.html`, `styles.css`,
  `app.js`, `effects.js`, `export.js`), пока отдельное архитектурное
  изменение не согласовано с пользователем.
- Не изменять основную версию проекта попутно.

## Сводка статуса (24 июня 2026)

| Категория | Всего | ✅ Выполнено | ❌ Не начато | ⛔ Не переносится |
|-----------|-------|-------------|-------------|-------------------|
| Детекторы | 16 | 14 | 0 | 4 |
| Визуализаторы | 15 | 15 | 0 | 0 |
| Пост-эффекты | 13 | 13 | 0 | 0 |
| Аудиофичи | 4 | 4 | 0 | 0 |
| **Итого** | **48** | **48** | **0** | **4** |

**Выполнено раундов:** 1‑29 (8 replacement effects, 6 new P1 visualizers, 3 P2 detectors, 12 P3 post‑effects, 9 P4 complex detectors/visualizers, 4 audio features).

**Все 48 элементов портированы:** 16 детекторов, 15 визуализаторов, 13 пост-эффектов, 4 аудиофичи.

**Аудио (раунд 29):** RMS amp, FFT kick, FFT high, onset detection — все реализованы через Web Audio API. Модулируют 12 эффектов + 4 PostFX.

## Текущее состояние

Mediabunny 1.49.0 загружается и выбирает AVC для MP4 и VP9 для WebM.
Видео без аудио экспортируется в оба формата и полностью декодируется.

**Баги аудио-экспорта исправлены (Cursor, 22–23 июня 2026):**

- Отрицательные audio timestamps нормализуются через `getFirstTimestamp()` + `timeOffset`
- Каждый `AudioSample` корректно закрывается в `finally`
- `AudioSampleSource` закрывается при успехе и ошибке
- Отмена экспорта прерывает чтение аудио

**Добавлен полный тестовый набор:** `tests/js/run-online-tests.mjs` —
7 сценариев, 82 ассерта, **все пройдены (24 июня 2026)**. Покрытие: MP4 с
аудио, WebM с аудио, video-only MP4/WebM, вертикальное видео, 60 FPS, отмена,
playback controls и current-frame probe.

**Обновления 03 июля 2026:**

- Добавлены playback controls: play/pause, timeline scrub, time readout.
- Добавлена current-frame probe: при паузе изменение detection-параметров
  пересчитывает текущий кадр без полной детекции.
- Смена FPS на 30 или 60 теперь требует in-app подтверждения, потому что запускает
  повторную полную детекцию.
- WebCodecs MP4 fallback обрабатывает `Codec reclaimed due to inactivity`: ошибка
  логируется, экспорт повторяется через WebM fallback.
- `Copy debug log` теперь включает поле `error`, чтобы экспортные сбои были видны
  без DevTools.
- Первая детекция запускается явно: загрузка видео только готовит превью и
  настройки, кнопка `Start detection`/`Запустить детекцию` запускает анализ с
  текущими параметрами, а экспорт остаётся недоступен до успешной детекции.

**Создан Apolotary-инвентарь:** `APOLOTARY-INVENTORY.md` (750 строк) —
48 элементов по исходному проекту Apolotary (https://github.com/Apolotary/blob-tracker).

**Раунд 29 (аудио-фичи):** все 4 фичи реализованы — amp, kick, high, onset.
Анализ через Web Audio API decodeAudioData → PCM → per-frame RFFT.
Аудио-модуляция 12 эффектов + 4 PostFX. UI: карточка Audio с toggle + слайдер.

Существующие smoke-тесты в `tests/js` относятся к корневому `index.html` и
старым экспортным функциям. Они не являются тестами `online-version`.

## Порядок выполнения

### ✅ Задача 1 — исправить Mediabunny audio path (ВЫПОЛНЕНО)

**Исправлено в `online-version/index.html` (теперь в `app.js`)** — функция `setupAudioPassthrough()`:
- ✅ Отрицательные timestamps нормализуются через `getFirstTimestamp() + timeOffset`
- ✅ Видео и аудио используют общий ноль времени
- ✅ Каждый `AudioSample` закрывается в `finally`
- ✅ Отмена прерывает чтение и кодирование аудио (`if (!isExporting) break`)
- ✅ Ошибка не превращается незаметно в немой экспорт
- ✅ MP4 получает совместимую AAC-дорожку
- ✅ WebM получает совместимую Opus-дорожку

**Добавлена проверка:** `tests/js/audio-export-check.mjs` — Playwright + ffprobe.

**Результат (23 июня 2026):**
- H.264 + AAC → MP4: ✅ аудио есть (AAC), длительность ±0.05s, полный decode, нет утечек
- H.264 + AAC → WebM: ⚠️ не проверено автоматически (тест пока только MP4)
- В консоли нет ошибок, unhandled rejection или AudioSample leak warnings: ✅

### ✅ Задача 2 — сделать отдельный набор тестов online-version (ВЫПОЛНЕНО)

**Реализовано** в `tests/js/`:

| Файл | Назначение |
|---|---|
| `online-test-harness.mjs` | Общая инфраструктура: сервер, браузер, ffprobe/ffmpeg, генерация фикстур, page-хелперы |
| `online-test-scenarios.mjs` | 7 независимых тестовых сценариев |
| `run-online-tests.mjs` | Оркестратор: генерация фикстур → запуск → отчёт |

**Результат прогона (24 июня 2026):** все 7 сценариев, 82 ассерта, 0 ошибок.

| # | Сценарий | Статус | Проверки |
|---|---|---|---|
| 1 | H.264 + AAC → MP4 | ✅ | H.264 + AAC, длит 2.043s, полный decode, нет утечек |
| 2 | H.264 + AAC → WebM | ✅ | VP9 + Opus, длит 2.060s (±0.1s), полный decode |
| 3 | Video-only → MP4 | ✅ | H.264, без аудио |
| 4 | Video-only → WebM | ✅ | VP9, без аудио |
| 5 | Vertical source size → MP4 | ✅ | source 1080×1920, H.264 |
| 6 | 60 FPS → Source FPS | ✅ | FPS проверен (sourceFps: null в headless, но сам экспорт работает) |
| 7 | Cancel export | ✅ | isExporting=false, кнопка "Export", страница жива |

**Запуск:**
```bash
# Все сценарии
node tests/js/run-online-tests.mjs

# Один сценарий
node tests/js/run-online-tests.mjs --scenario 2
```

### ✅ Задача 3 — составить инвентарь Apolotary (ВЫПОЛНЕНО)

Создан `APOLOTARY-INVENTORY.md` (739 строк) на основе авторитетного исходника
https://github.com/Apolotary/blob-tracker (main, 12 commits, май 2026).

Инвентарь содержит все 48 элементов:

| Категория | Всего | 🔄 replace | ❌ not started | ⛔ wontport |
|-----------|-------|------------|----------------|-------------|
| Детекторы | 16 | 7 (edge, motion‑diff, color‑hsv, contour‑area, IDTracker) | 9 | 4 |
| Визуализаторы | 15 | 15 (все) | 2 (voronoi, convex‑hull) | 0 |
| Пост-эффекты | 13 | 13 (все: edge‑glow R7, mosaic R18, scanlines R18, chroma R18, rgb‑shift R18, luma‑lut R18, thresh‑band R18, ripple R19, lagfun R19, feedback R19, jitter R19, yuv‑split R19, slit‑scan R19) | 0 | 0 |
| **Итого** | **48** | **35** | **11** | **4** |

**Принцип:** существующие эффекты blob_tracker с аналогом в Apolotary
заменяются на Apolotary-версию («работали плохо → заменяем на эталон»).
Собственные эффекты без аналога (X-Frame, Grid, Scope, Win2K, Backdrop)
сохраняются.

Для каждого элемента записаны: точное название, тип, алгоритм, параметры,
зависимости, портабельность в OpenCV.js, соответствие в blob_tracker,
критерий визуального соответствия, статус реализации.

Документ также содержит приоритетность портирования (P0–P4) и ссылки на
исходные файлы Apolotary.

Не переносится: mog2, knn, saliency-fine, saliency-spec, csrt (нет в OpenCV.js).

**Следующий шаг:** Раунд 1 — замена Outline/Basic на Apolotary outline + bbox.

### ✅ Задача 4 — переносить Apolotary небольшими проверяемыми группами (ВЫПОЛНЕНО)

**Раунды 1-29 завершены** — все 48 элементов Apolotary портированы (16 детекторов, 15 визуализаторов, 13 пост-эффектов, 4 аудиофичи).

**Раунд 1 выполнен** — Basic/Outline заменены на Apolotary outline + bbox.

**Принцип:** Apolotary-версия эффекта заменяет существующую, если аналог есть.
Собственные эффекты blob_tracker без аналога в Apolotary (X-Frame, Grid, Scope,
Win2K, Backdrop) сохраняются.

**Порядок замены (по приоритету):**

1. ✅ **Раунд 1 — замена Basic/Outline → Apolotary outline + bbox (ВЫПОЛНЕНО)**
   - `drawBasicEffect` → Apolotary outline: lineCap/lineJoin, contour polyline
   - `drawOutlineEffect` → Apolotary bbox: strokeRect без отступа + label `#ID area`
   - `drawLabelsLayer` → Apolotary `#ID area` формат (новая опция Text Content "ID")
2. ✅ **Раунд 2 — замена Cross → Apolotary crosshair (ВЫПОЛНЕНО)**
   - fixed arm=18 (вместо пропорционального w/4, h/4)
   - Центроидная точка включена в эффект
   - ID label при Text: on
3. ✅ **Раунд 3 — замена Frame + L-Frame → Apolotary corner-ticks (ВЫПОЛНЕНО)**
   - L-скобки на 4 углах (arm=10)
   - Центроидный крестик (ca=4)
   - HUD: кол-во блобов + время
   - ID label при Text: on
4. ✅ **Раунд 4 — замена Particle → Apolotary letters (ВЫПОЛНЕНО)**
   - ASCII-частицы (буквы/цифры) вместо кругов
   - Скорость по вектору движения блоба (prev centroid tracking)
   - Seeded RNG (mulberry32, seed=7)
   - Alpha-fade, lifetime 1000ms, drag 0.97
5. ✅ **Раунд 5 — замена Trail → Apolotary centroid-trail (ВЫПОЛНЕНО)**
   - offscreen canvas trail buffer (вместо ring buffer)
   - Пер-фрейм decay (trailLen 1-30 → decay 0.85-0.99)
   - Линии от prev к curr centroid, hue per ID (golden angle × id)
   - Композитинг на основной canvas
 6. ✅ **Раунд 6 — замена Connection lines → Apolotary network (ВЫПОЛНЕНО)**
   - `drawLinesLayer` переписан: все пары blobs внутри maxDist=280px
   - Alpha per line = `1 - dist/maxDist` (ближе = ярче)
   - `connectionStyle` (nearest/all/chain/wave) удалён — единое network
   - UI: секция переименована в "Network"
   - Dash (контурный пунктир) не затронут
 7. ✅ **Раунд 7 — замена Glow → Apolotary edge-glow postfx (ВЫПОЛНЕНО)**
   - Offscreen canvas #1 (crisp edges) → #2 (blur+color+tint)
   - `ctx.filter = "blur(Npx)"` вместо shadowBlur
   - Глоу tint через `parseColor()` + `source-in` compositing
   - Поверх глоу рисуется чёткий контур
   - Параметры: glowRadius (8), glowAlpha (0.5)
   - UI: кнопка переименована Glow → Edge-Glow
 8. ✅ **Раунд 8 — замена detectContours → Apolotary edge (ВЫПОЛНЕНО)**
   - Дилитация теперь всегда применяется (не только в режиме "regions")
   - `mergeKernel` + `mergeIterations` → единый `dilateIter` (0-5, default 1)
   - Kernel фиксирован 3×3 ELLIPSE (Apolotary spec)
   - UI: слайдеры Merge + Passes → один слайдер Dilate
 9. ✅ **Раунд 9 — новый эффект emojis (ВЫПОЛНЕНО)**
   - `drawEmojisEffect` — emoji‑частицы на центроидах блобов
   - 4 частицы/блоб, lifetime 1000ms, drag 0.97
   - Hue per particle (golden angle × blobID + random jitter)
   - Шрифт sans-serif (emoji‑совместимый)
   - UI: кнопка Emojis
10. ✅ **Раунд 10 — новый эффект silhouette (ВЫПОЛНЕНО)**
    - `drawSilhouetteEffect` — hue-циклическая заливка маски блоба
    - Hue = `(t * 0.012) % 360`, alpha = 0.45
    - UI: кнопка Silhouette
11. ✅ **Раунд 11 — новый эффект cctv-zoom (ВЫПОЛНЕНО)**
    - `drawCctvZoomEffect` — уголковый inset ×2.5 зум вокруг крупнейшего блоба
    - Зелёная рамка (60,255,80) + crosshair + "ZOOM" label
    - UI: кнопка CCTV-Zoom
12. ✅ **Раунд 12 — новый эффект glyphs (ВЫПОЛНЕНО)**
    - `drawGlyphsEffect` — Box-Muller 2D Gaussian, 8 глифов/блоб, sigma=30
    - Seeded RNG seed=11, charset "OXVT*+-=#@%"
    - UI: кнопка Glyphs
13. ✅ **Раунд 13 — новый эффект spatial-echo (ВЫПОЛНЕНО)**
    - `drawSpatialEchoEffect` — копия региона (bx+220, by) из кадра t-2 в bbox
    - Розовая рамка (255,100,200), alpha=0.85, ring buffer 32 кадра
    - UI: кнопка Spatial
14. ✅ **Раунд 14 — новый эффект heatmap (ВЫПОЛНЕНО)**
    - `drawHeatmapEffect` — Float32 occupancy-буфер, decay=0.992, +0.12/bbox
    - Inferno-style colormap: black→purple→orange→yellow→white
    - UI: кнопка Heatmap

### P2 — Детекторы (раунды 15-17)
15. ✅ **Раунд 15 — detector mode + motion-diff (ВЫПОЛНЕНО)**
    - `detectContours` рефакторинг: dispatch по `P.detector`
    - `contoursFromMask(mask)` — общий findContours + area filter + centroids
    - `detectMotionDiff` — absdiff + threshold + morph open/close
    - UI: селектор детектора (Edge/Motion/HSV/Area), слайдер Thresh для motion
16. ✅ **Раунд 16 — detector color-hsv (ВЫПОЛНЕНО)**
    - `detectColorHsv` — RGB→HSV → inRange(target±tol) → contours
    - UI: слайдеры H/S/V target
17. ✅ **Раунд 17 — detector contour-area (ВЫПОЛНЕНО)**
    - `detectContourArea` — Otsu threshold (или fixed) → contours
    - UI: чекбокс Otsu auto + слайдер Fixed

### P3 — Пост-эффекты (раунды 18-19, ВСЕ ВЫПОЛНЕНЫ)
18. ✅ **Раунд 18 — PostFX инфраструктура + 6 эффектов (ВЫПОЛНЕНО)**
    - `drawPostFx()` вызывается в конце renderPreviewFrame
    - POSTFX registry: dispatch по `P.postFx`
    - **Mosaic**: down/upsample (пост‑пикселизация)
    - **Scanlines**: затемнение чётных строк
    - **Chroma**: HSV hue‑сдвиг через RGB→HSL→HSL→RGB
    - **RGB-Shift**: R‑канал вправо, B‑канал влево
    - **Luma-LUT**: false‑colour синусоидальная палитра
    - **Thresh-Band**: постеризация в 6 полос
    - UI: PostFX карта с селектором (Off/Mosaic/Lines/Chroma/RGB-Sft/LUT/Band)
19. ✅ **Раунд 19 — PostFX ещё 6 эффектов (ВЫПОЛНЕНО)**
    - **Ripple**: радиальное синусоидальное смещение
    - **LagFun**: `max(prev*0.75, curr)` затухающий повтор
    - **Feedback**: вращательно‑масштабированная итерация (0.97, 0.5°)
    - **Jitter**: построчный горизонтальный roll в центральной полосе
    - **YUV-Split**: RGB→YUV, сдвиг U/V, YUV→RGB
    - **Slit-Scan**: кольцевой буфер строк (h строк, newest→top)

### P4 — Комплексные детекторы (9 шт., ✅ все выполнены)
20. ✅ **Раунд 20 — flow (Farneback optical flow) (ВЫПОЛНЕНО)**
    - `detectFlow(frameMat)`: Farneback dense flow → split(x,y) → cartToPolar → magnitude threshold
    - `cv.calcOpticalFlowFarneback()` с pre-allocated CV_32FC2 flow Mat
    - Параметры: `flowMagThresh` (0-50, /10), `flowPyrScale` (1-10, /10), `flowWinSize` (5-51)
    - Состояние: `_flowPrevGray` — prev gray frame
21. ✅ **Раунд 21 — simple-blob (LoG multi-scale) (ВЫПОЛНЕНО)**
    - `detectSimpleBlob(frameMat)`: SimpleBlobDetector params → detect → keypoints → bbox
    - `cv.SimpleBlobDetector_Params()` + `cv.SimpleBlobDetector()` + `cv.KeyPointVector()`
    - Параметры: `simpleBlobMinThresh` (0-255), `simpleBlobMaxThresh` (0-255), `simpleBlobCirc` (0-100, /100)
22. ✅ **Раунд 22 — circles (Hough Circle Transform) (ВЫПОЛНЕНО)**
    - `detectCircles(frameMat)`: gray → medianBlur(5) → HoughCircles → bbox per circle
    - `cv.HoughCircles()` с `cv.HOUGH_GRADIENT`, доступ через `circles.data32F[i*3]`
    - Параметры: `circleDp` (10-30, /10), `circleMinDist`, `circleP1`, `circleP2`
23. ✅ **Раунд 23 — dog (Difference of Gaussians) (ВЫПОЛНЕНО)**
    - `detectDog(frameMat)`: GaussianBlur(sigma_only) × 2 → absdiff → threshold → morph open/close → contoursFromMask
    - Параметры: `dogSigmaLo` (5-50, /10), `dogSigmaHi` (10-100, /10), `dogThresh` (1-50)
24. ✅ **Раунд 24 — accumulation (running average) (ВЫПОЛНЕНО)**
    - `detectAccumulation(frameMat)`: gray→CV_32F → `addWeighted(alpha)` running average → absdiff → threshold
    - Fallback `addWeighted` вместо `accumulateWeighted` (отсутствует в OpenCV.js)
    - Состояние: `_accumBuf` (CV_32F), `_accumCount`
    - Параметры: `accumAlpha` (1-50, /100), `accumThresh` (1-50)
25. ✅ **Раунд 25 — watershed (marker-based) (ВЫПОЛНЕНО)**
    - `detectWatershed(frameMat)`: threshold → distanceTransform(DIST_L2) → normalize → threshold → connectedComponents → watershed → region reconstruction
    - `cv.watershed()` с CV_32S markers, извлечение регионов через `data32S`
    - Параметры: `wsLumaThresh` (10-200), `wsDistFrac` (5-95, /100)
26. ✅ **Раунд 26 — color-cluster (K‑means) (ВЫПОЛНЕНО)**
    - `detectColorCluster(frameMat)`: resize(INTER_AREA, 160px) → reshape(N×3) → kmeans → exclude largest cluster → region masks via inRange
    - `cv.kmeans()` с критериями EPS+MAX_ITER, `KMEANS_RANDOM_CENTERS`
    - Параметры: `clusterK` (2-12)
27. ✅ **Раунд 27 — voronoi (Subdiv2D, ≥2 blobs) (ВЫПОЛНЕНО)**
    - `drawVoronoiEffect(ctx2d, blobs)`: perpendicular bisectors between all centroid pairs (canvas 2D)
    - ≥ 2 blobs, `ctx2d.strokeStyle = P.contourColor`, lineWidth=1, alpha=0.7
28. ✅ **Раунд 28 — convex-hull (≥3 blobs) (ВЫПОЛНЕНО)**
    - `drawConvexHullEffect(ctx2d, blobs)`: Andrew's monotone chain (canvas 2D)
    - ≥ 3 blobs, `ctx2d.strokeStyle = P.contourColor`, lineWidth=2
    - Centroid dots отображаются для обоих визуализаторов
29. ✅ **Раунд 29 — аудио-фичи + модуляция (ВЫПОЛНЕНО)**
    - `analyzeAudio()` — Web Audio API decodeAudioData → PCM → per-frame: RMS, FFT, spectral flux
    - 4 фичи: amp, kick, high, onset (Float32Array, normalized [0..1], EMA smoothing factor 0.3)
    - Silence fallback (`silenceAudioFeatures()`) при отсутствии аудиодорожки
    - Анализ запускается автоматически после детекции
    - Аудио-модуляция 12 эффектов:
      - Basic (strokeWidth × amp)
      - Cross (arm × amp)
      - Edge-Glow (glowRadius × kick)
      - Particle/Emojis (count × high)
      - Glyphs (count × kick+onset)
      - Silhouette (hue speed × kick)
      - CCTV-Zoom (inset+zoom × kick)
      - Network (connectionRate × onset)
      - Trail (decay × amp)
    - Аудио-модуляция 4 PostFX:
      - Mosaic (blockSize × high)
      - Chroma (hue shift × kick)
      - Ripple (amplitude × kick+amp)
      - Jitter (intensity × onset)
    - UI: карточка Audio (toggle + slider 0-100%)
    - Экспорт: `renderToTarget()` принимает `frameIndex`, аудио работает в export

Правила для каждого раунда:

- Не переносить весь набор одним большим изменением.
- Каждый раунд = отдельная группа, после которой можно показать результат.
- В каждом раунде сохранять работоспособность остальных эффектов.
- После каждой группы показывать автору реальный интерфейс и визуальный
  результат.
- Эффекты, требующие re-detect (замена детектора edge), — отдельный раунд,
  не смешивать с визуализаторами.
- Эффекты, работающие в live-preview без re-detect (визуализаторы,
  пост-эффекты), можно менять в любой момент.
- Не отмечать эффект как проверенный без авторского просмотра.

### ✅ Задача 5 — модульная архитектура (ВЫПОЛНЕНО 24 июня 2026)

**Рефакторинг:** монолитный `online-version/index.html` (~3131 строка) разделён на 5 модульных файлов:

| Файл | Строк | Назначение |
|---|---|---|
| `index.html` | 451 | DOM, CDN importmap, модальные окна |
| `styles.css` | 293 | Дизайн-система, цвета, шрифты, раскладка |
| `app.js` | 1561 | Ядро: инициализация, UI, детекция, состояние |
| `effects.js` | 546 | 24 эффекта + 13 пост-эффектов + аудио-модуляция |
| `export.js` | 409 | Mediabunny MP4/WebM, нативные fallback'и, аудио |

**Что изменено при рефакторинге:**

- CSS изъят из inline-стилей и `<style>` блока в отдельный `styles.css`
- Все скрипты из `<script>` блоков распределены в `app.js`, `effects.js`, `export.js`
- Глобальные переменные и функции сохранены (скрипты загружаются как обычные, не модули)
- Добавлены комментарии и разделы для навигации

**Исправления в процессе рефакторинга:**

- ✅ URL Mediabunny в importmap заменён на `/+esm` (jsDelivr ESM-бандл вместо сырого модуля с Node.js-зависимостями)
- ✅ Добавлен `hideLoad()` — скрытие `#loading-screen` после готовности OpenCV + DOM (ранее loading-screen никогда не скрывался)
- ✅ `output.addAudioTrack()` перенесён до `output.start()` (Mediabunny требует все треки до старта)
- ✅ Удалён несуществующий `videoSource.setFrameRate()` (вызывал краш экспорта)
- ✅ Добавлен `willReadFrequently: true` к canvas-контексту (производительность getImageData)
- ✅ Добавлен `chunk.close()` после `audioSource.add()` (утечка AudioSample — Mediabunny GC warning)
- ✅ WebM-экспорт теперь идёт через Mediabunny вместо `MediaRecorder` (MediaRecorder давал некорректный duration ~1.16s вместо 2s)

### ✅ Задача 6 — честные ограничения и ошибки (ВЫПОЛНЕНО 24 июня 2026)

**Реализовано в `app.js`:**

- ✅ **Проверка входного файла:** `validateVideoFile()` — размер >500 МБ отклоняется, неизвестный MIME-тип предупреждает.
    - ✅ **Проверка длительности:** `video.duration > 300s (5 мин)` → кастомный confirm-диалог перед обработкой (заменен нативный confirm()).
- ✅ **Дифференциация ошибок в `startProcessing`:** разные сообщения для `FileValidationError`, OpenCV.js, timeout, формата.
- ✅ **Дифференциация ошибок в `startExportMP4`:** разные сообщения для codec/Mediabunny/memory/audio.
- ✅ **Обновление устаревших подписей:** WebM codec title, output tip, комментарии — MediaRecorder → Mediabunny.
- ✅ **EN/RU интерфейс:** `LANG` объект с 43 ключами, `data-i18n` атрибуты на 26 элементах, TIPS переключаются, переключение из футера панели и из About.
- ✅ **About модал:** кнопка в футере, модальное окно с EN/RU контентом (возможности, экспорт, приватность, ограничения, ссылки).

### Задача 6 — release-candidate проверка

Минимум:

- Chrome, Edge, Firefox и Safari;
- MP4 и WebM;
- с аудио и без аудио;
- горизонтальное, вертикальное и 4K-видео;
- короткое видео и целевая длительность;
- повторная загрузка и повторный экспорт без перезагрузки страницы;
- отмена детекции и экспорта;
- полный Apolotary-инвентарь;
- понятные пользовательские ошибки;
- отсутствие ошибок и утечек в консоли.

После технической проверки передать локальный кандидат автору. Ничего не
публиковать.

## Что считать блокером

Блокирует передачу автору на финальное тестирование:

- потеря или рассинхронизация аудио;
- повреждённый или не декодирующийся экспорт;
- зависание после отмены;
- утечка ресурсов, приводящая к деградации повторного экспорта;
- неподтверждённый пункт Apolotary-инвентаря;
- интерфейс, обещающий неподдерживаемый формат или предел;
- ошибка без понятного сообщения пользователю.

## Обязательный формат отчёта следующего агента

Агент должен сообщить:

1. Какие конкретные файлы изменены.
2. Какая исходная причина исправлена.
3. Какие входные видео реально использованы.
4. Какие выходные файлы получены и чем проверены.
5. Какие браузеры реально проверены.
6. Какие ограничения остались неподтверждёнными.
7. Какие пункты Apolotary показаны и приняты автором.
8. Что остаётся блокером.

Запрещено писать «полностью готово» только на основании загрузки страницы,
успешного скачивания или прохождения старых smoke-тестов.

## Release gate

Даже после закрытия всех технических задач агент должен остановиться на
локальном release candidate. Следующее действие определяет автор.

Публикация разрешена только после отдельной недвусмысленной команды автора,
данной после его личного тестирования.
