# Apolotary Inventory — Полный инвентарь эффектов

> Источник: https://github.com/Apolotary/blob-tracker
> Оригинал: Python 3 + opencv-contrib-python + librosa + Pillow
> Версия: main (12 commits), май 2026
> Дата инвентаризации: 23 июня 2026

Apolotary — Hermes Agent skill для blob‑трекинга с 16 детекторами, 15 визуализаторами,
13 пост‑эффектами. Настоящий документ фиксирует каждый элемент
для переноса в blob_tracker online-version.

Условные обозначения статуса:

| Статус | Значение |
|--------|----------|
| ❌ not started | не начато |
| 🟡 in progress | в процессе реализации |
| ✅ round N | заменено в раунде N (см. IMPLEMENTATION-BRIEF.md) |
| 🔄 replace | существует в blob_tracker, но работает плохо — заменить Apolotary-версией |
| ✅ done | реализовано и проверено тестами |
| 👁 done + author | реализовано и подтверждено автором |
| ⛔ wontport | не переносится (технические ограничения) |

---

## 1. Детекторы (16)

### Интерфейс

```python
det = get_detector("mog2", **params)
blobs, mask = det(frame_bgr)    # blobs = list[{x, y, w, h, score, id}]
```

Базовые параметры (принимают все детекторы):

| Параметр | По умолч. | Описание |
|----------|-----------|----------|
| `min_area` | 900 | мин. площадь блоба (px²) |
| `max_area` | 400 000 | макс. площадь блоба (px²) |
| `max_n` | 14 | макс. блобов (по убыванию score) |

### 1.1 motion-diff

| Поле | Значение |
|------|----------|
| **Название** | `motion-diff` |
| **Тип** | детектор |
| **Алгоритм** | Разность кадров `absdiff(prev_gray, curr_gray)` + порог по `motion_thresh` + опционально OR с luma-маской. Морф. очистка → контуры. |
| **Параметры** | `motion_thresh=14`, `luma_thresh=60`, `use_luma=True` |
| **Данные/зависимости** | Два последовательных кадра |
| **OpenCV.js** | ✅ все вызовы доступны (`cv.absdiff`, `cv.threshold`, `cv.morphologyEx`) |
| **blob_tracker** | ✅ **раунд 15** — `detectMotionDiff`: absdiff, threshold, morph open/close |
| **Критерий** | Frame differencing с порогом — видимые контуры движения на статичном фоне |
| **Проверка автором** | ❌ |

### 1.2 mog2

| Поле | Значение |
|------|----------|
| **Название** | `mog2` |
| **Тип** | детектор |
| **Алгоритм** | Mixture‑of‑Gaussians фоновая модель. История 200 кадров. FG‑маска → `threshold(200)` → контуры. |
| **Параметры** | `history=200`, `var_threshold=25.0`, `detect_shadows=False` |
| **Данные/зависимости** | Накопление истории кадров |
| **OpenCV.js** | ❌ `createBackgroundSubtractorMOG2` отсутствует в OpenCV.js |
| **Портирование** | ⛔ **cannot port** — требуется ручная реализация per‑pixel GMM/median |
| **blob_tracker** | ⛔ wontport (manual JS impl possible) |
| **Проверка автором** | ❌ |

### 1.3 knn

| Поле | Значение |
|------|----------|
| **Название** | `knn` |
| **Тип** | детектор |
| **Алгоритм** | K‑nearest‑neighbours фоновая модель. Аналогичен MOG2. |
| **Параметры** | `history=200`, `dist2_threshold=400.0`, `detect_shadows=False` |
| **Данные/зависимости** | Накопление истории кадров |
| **OpenCV.js** | ❌ `createBackgroundSubtractorKNN` отсутствует |
| **Портирование** | ⛔ cannot port — та же проблема, что и mog2 |
| **blob_tracker** | ⛔ wontport (manual JS impl possible) |
| **Проверка автором** | ❌ |

### 1.4 flow

| Поле | Значение |
|------|----------|
| **Название** | `flow` |
| **Тип** | детектор |
| **Алгоритм** | Плотный оптический поток Farneback между prev/curr gray. Маска = magnitude > `mag_thresh`. |
| **Параметры** | `mag_thresh=1.2`, `pyr_scale=0.5`, `levels=3`, `winsize=21` |
| **Данные/зависимости** | Два последовательных кадра |
| **OpenCV.js** | ✅ `cv.calcOpticalFlowFarneback()` доступен |
| **blob_tracker** | ✅ **раунд 20** — `detectFlow`: Farneback → cartToPolar → magnitude threshold |
| **Критерий** | Векторное поле движения, маска там, где движение превышает порог |
| **Проверка автором** | ❌ |

### 1.5 color-hsv

| Поле | Значение |
|------|----------|
| **Название** | `color-hsv` |
| **Тип** | детектор |
| **Алгоритм** | HSV‑фильтр. Порог кадра по HSV‑диапазону вокруг `hsv_target` ± `hsv_tol`. H‑обёртка на границе 0/180. |
| **Параметры** | `hsv_target=(20, 200, 200)`, `hsv_tol=(15, 80, 80)` |
| **Данные/зависимости** | Один кадр |
| **OpenCV.js** | ✅ `cv.cvtColor(BGR2HSV)`, `cv.inRange()`, `cv.bitwise_or()` |
| **blob_tracker** | ✅ **раунд 16** — `detectColorHsv`: RGB→HSV, inRange(target±tol) |
| **Критерий** | Выделение областей по цвету без движения |
| **Проверка автором** | ❌ |

### 1.6 color-cluster

| Поле | Значение |
|------|----------|
| **Название** | `color-cluster` |
| **Тип** | детектор |
| **Алгоритм** | K‑means цветовая квантизация на низком разрешении (160 px). Исключение фонового (крупнейшего) кластера. Каждый остальной → маска → контуры. |
| **Параметры** | `k=6`, `sample_w=160` |
| **Данные/зависимости** | Один кадр |
| **OpenCV.js** | ✅ `cv.kmeans()`, `cv.resize()` (INTER_AREA + INTER_NEAREST) |
| **blob_tracker** | ✅ **раунд 26** — `detectColorCluster`: kmeans → исключение крупнейшего кластера |
| **Критерий** | Цветовые регионы, исключая доминирующий фон |
| **Проверка автором** | ❌ |

### 1.7 simple-blob

| Поле | Значение |
|------|----------|
| **Название** | `simple-blob` |
| **Тип** | детектор |
| **Алгоритм** | OpenCV SimpleBlobDetector — multi‑scale LoG. Каждый keypoint → квадратный bbox. Маска = залитые круги. |
| **Параметры** | `min_threshold=30`, `max_threshold=220`, `min_circularity=0.0`, `min_inertia=0.0`, `min_convexity=0.0` |
| **Данные/зависимости** | Один кадр (gray) |
| **OpenCV.js** | ✅ `cv.SimpleBlobDetector.create(params).detect()` |
| **blob_tracker** | ✅ **раунд 21** — `detectSimpleBlob`: SimpleBlobDetector → keypoints → bbox |
| **Критерий** | Круглые/овальные blobs разных масштабов |
| **Проверка автором** | ❌ |

### 1.8 dog

| Поле | Значение |
|------|----------|
| **Название** | `dog` |
| **Тип** | детектор |
| **Алгоритм** | Difference of Gaussians при σ_low/σ_high. Порог отклика → морф. очистка → контуры. |
| **Параметры** | `sigma_low=1.5`, `sigma_high=6.0`, `thresh=7.0` |
| **Данные/зависимости** | Один кадр (gray) |
| **OpenCV.js** | ✅ `cv.GaussianBlur()` с sigma-only (ksize=(0,0)) |
| **blob_tracker** | ✅ **раунд 23** — `detectDog`: DoG → threshold → morph → contoursFromMask |
| **Критерий** | Пятна на частоте DoG — текстура/детали среднего масштаба |
| **Проверка автором** | ❌ |

### 1.9 circles

| Поле | Значение |
|------|----------|
| **Название** | `circles` |
| **Тип** | детектор |
| **Алгоритм** | Hough Circle Transform. Квадратные bbox вокруг обнаруженных кругов. |
| **Параметры** | `dp=1.2`, `min_dist=40`, `param1=100`, `param2=30`, `min_radius=10`, `max_radius=120` |
| **Данные/зависимости** | Один кадр (gray, medianBlur) |
| **OpenCV.js** | ✅ `cv.HoughCircles()`, `cv.medianBlur()` |
| **blob_tracker** | ✅ **раунд 22** — `detectCircles`: HoughCircles → bbox per circle |
| **Критерий** | Круглые объекты (монеты, шары, капли) |
| **Проверка автором** | ❌ |

### 1.10 saliency-fine

| Поле | Значение |
|------|----------|
| **Название** | `saliency-fine` |
| **Тип** | детектор |
| **Алгоритм** | StaticSaliencyFineGrained — пространственно‑детальная карта заметности. |
| **Параметры** | `thresh=0.55` |
| **OpenCV.js** | ❌ требует `opencv-contrib-python` модуль `saliency` |
| **blob_tracker** | ⛔ wontport — требует кастомной сборки OpenCV.js WASM с contrib |
| **Проверка автором** | ❌ |

### 1.11 saliency-spec

| Поле | Значение |
|------|----------|
| **Название** | `saliency-spec` |
| **Тип** | детектор |
| **Алгоритм** | Spectral‑residual saliency — частотная "что необычно". |
| **Параметры** | `thresh=0.4` |
| **OpenCV.js** | ❌ требует `opencv-contrib-python` модуль `saliency` |
| **blob_tracker** | ⛔ wontport — та же проблема |
| **Проверка автором** | ❌ |

### 1.12 csrt

| Поле | Значение |
|------|----------|
| **Название** | `csrt` |
| **Тип** | детектор-трекер |
| **Алгоритм** | Multi‑target CSRT трекеры. Инициализация от motion‑diff, перезапуск каждые N кадров. |
| **Параметры** | `reseed_every=30`, `max_targets=6` |
| **OpenCV.js** | ❌ трекинг (`cv.TrackerCSRT`) отсутствует в OpenCV.js |
| **blob_tracker** | ⛔ wontport — существующий CentroidTracker выполняет ту же функцию |
| **Проверка автором** | ❌ |

### 1.13 edge

| Поле | Значение |
|------|----------|
| **Название** | `edge` |
| **Тип** | детектор |
| **Алгоритм** | Canny edge → dilate → morphology close → connected‑components. |
| **Параметры** | `canny_low=60`, `canny_high=160`, `dilate_iter=2` |
| **Данные/зависимости** | Один кадр (gray) |
| **OpenCV.js** | ✅ `cv.Canny()`, `cv.dilate()`, `cv.morphologyEx()` |
| **blob_tracker** | ✅ **раунд 8** — `detectContours` обновлён до Apolotary `edge`: dilate всегда, dilateIter 0-5 |
| **Критерий** | Контуры после Canny + морф. расширение |
| **Проверка автором** | ❌ |

### 1.14 accumulation

| Поле | Значение |
|------|----------|
| **Название** | `accumulation` |
| **Тип** | детектор |
| **Алгоритм** | Экспоненциальное скользящее среднее через `accumulateWeighted`. `absdiff(gray, accum)` → порог → маска движения. |
| **Параметры** | `alpha=0.10`, `thresh=18` |
| **Данные/зависимости** | Накопление кадров (stateful) |
| **OpenCV.js** | ⚠️ `cv.accumulateWeighted()` существует, но fallback: `accum = alpha*gray + (1-alpha)*accum` через `addWeighted` |
| **blob_tracker** | ✅ **раунд 24** — `detectAccumulation`: addWeighted running average → absdiff → threshold |
| **Критерий** | Движение на фоне медленно адаптирующейся модели |
| **Проверка автором** | ❌ |

### 1.15 watershed

| Поле | Значение |
|------|----------|
| **Название** | `watershed` |
| **Тип** | детектор |
| **Алгоритм** | Threshold → distance transform → marker‑based watershed. Разделение касающихся foreground‑областей. |
| **Параметры** | `luma_thresh=80`, `dist_thresh_frac=0.45` |
| **Данные/зависимости** | Один кадр |
| **OpenCV.js** | ✅ `cv.distanceTransform(DIST_L2)`, `cv.connectedComponents()`, `cv.watershed()` |
| **blob_tracker** | ✅ **раунд 25** — `detectWatershed`: distanceTransform → connectedComponents → watershed → region masks |
| **Критерий** | Разделение слипшихся объектов |
| **Проверка автором** | ❌ |

### 1.16 contour-area

| Поле | Значение |
|------|----------|
| **Название** | `contour-area` |
| **Тип** | детектор |
| **Алгоритм** | Чистый luma‑порог (Otsu или фиксированный) + connected components. Без движения. |
| **Параметры** | `thresh=0`, `invert=False`, `use_otsu=True` |
| **Данные/зависимости** | Один кадр |
| **OpenCV.js** | ✅ `cv.threshold()` с `cv.THRESH_OTSU` |
| **blob_tracker** | ✅ **раунд 17** — `detectContourArea`: Otsu / fixed threshold → contours |
| **Критерий** | Статичные области по яркости |
| **Проверка автором** | ❌ |

### IDTracker (cross-frame ID assignment)

| Поле | Значение |
|------|----------|
| **Название** | `IDTracker` (вспомогательный) |
| **Алгоритм** | Nearest‑centroid matching. Centroids текущего кадра → матчинг с предыдущими в `max_match_dist=80 px`. Новые ID для unmatched. |
| **OpenCV.js** | ✅ чистая математика |
| **blob_tracker** | ✅ **done** — `CentroidTracker` в `detectBlobs()` |
| **Критерий** | Стабильные ID блобов между кадрами |
| **Проверка автором** | ❌ |

---

## 2. Визуализаторы (15)

### Интерфейс

```python
v = get_visualizer("centroid-trail", **params)
v.setup(frame_h, frame_w)
canvas = v(canvas_bgr, blobs, mask, t=time_s)
```

### 2.1 bbox

| Поле | Значение |
|------|----------|
| **Название** | `bbox` |
| **Тип** | визуализатор |
| **Что делает** | Прямоугольники вокруг каждого блоба. Опциональный label. |
| **Параметры** | `color=(255,255,255) BGR`, `thickness=2`, `show_label=False` |
| **OpenCV.js** | ✅ `cv.rectangle()`, `cv.putText()` |
| **blob_tracker** | 🟡 **in progress** — эффект `Outline` заменён на Apolotary `bbox` (раунд 1). strokeRect + Apolotary label. |
| **Критерий** | Прямоугольные рамки с ID/label |
| **Проверка автором** | ❌ |

### 2.2 corner-ticks

| Поле | Значение |
|------|----------|
| **Название** | `corner-ticks` |
| **Тип** | визуализатор |
| **Что делает** | L‑образные скобки на каждом углу блоба + центроидная метка + ID/score. HUD с временем и количеством. |
| **Параметры** | `primary_color=(255,240,220)`, `accent_color=(40,255,80)`, `label=""` |
| **OpenCV.js** | ✅ `cv.line()`, `cv.putText()` |
| **blob_tracker** | 🟡 **in progress** — Frame + L-Frame → Apolotary `corner-ticks` (раунд 3): 4 угла, центроид, HUD, ID. |
| **Критерий** | L‑скобки с центроидным крестом и HUD |
| **Проверка автором** | ❌ |

### 2.3 crosshair

| Поле | Значение |
|------|----------|
| **Название** | `crosshair` |
| **Тип** | визуализатор |
| **Что делает** | Простой крест на центроиде + ID label. Минималистично. |
| **Параметры** | `color=(80,255,240)`, `arm=18` |
| **OpenCV.js** | ✅ `cv.line()` (крест), `cv.circle()` (точка), `cv.putText()` (ID) |
| **blob_tracker** | 🟡 **in progress** — эффект `Cross` заменён на Apolotary `crosshair` (раунд 2): fixed arm=18, центр. точка, ID label |
| **Критерий** | Крест в центре каждого блоба |
| **Проверка автором** | ❌ |

### 2.4 centroid-trail

| Поле | Значение |
|------|----------|
| **Название** | `centroid-trail` |
| **Тип** | визуализатор |
| **Что делает** | Накопительный буфер трейлов. Каждый blob ID → стабильный hue. Линии накапливаются во float32 буфере с затуханием `decay=0.965` (~2s tail). |
| **Параметры** | `decay=0.965`, `line_thickness=2` |
| **Состояние** | float32 буфер `_buf[h, w, 3]`, dict `_prev[tid] → (cx, cy)` |
| **Аудио** | `amp` → alpha blend (0.5 → 0.9) и толщина |
| **OpenCV.js** | ⚠️ портабельно: Float32Array буфер, `cv.addWeighted()`, hue→BGR через `cv.cvtColor`. ~14 MB на 1080p. |
| **blob_tracker** | 🟡 **in progress** — `Trail` заменён на Apolotary `centroid-trail` (раунд 5): offscreen canvas, decay, hue per ID |
| **Критерий** | Цветные trail‑линии с затуханием, разные цвета для разных ID |
| **Проверка автором** | ❌ |

### 2.5 network

| Поле | Значение |
|------|----------|
| **Название** | `network` |
| **Тип** | визуализатор |
| **Что делает** | Линии между ближайшими блобами. alpha падает с расстоянием. |
| **Параметры** | `color=(255,240,220)`, `max_distance=280`, `max_thickness=3` |
| **OpenCV.js** | ✅ чистая математика + `cv.line()` |
| **blob_tracker** | ✅ **раунд 6** — `drawLinesLayer` заменён на Apolotary `network`: все пары, alpha falloff, maxDist=280. Стили (nearest/all/chain/wave) удалены. UI → "Network" |
| **Критерий** | Соединительные линии с затуханием по расстоянию |
| **Проверка автором** | ❌ |

### 2.6 letters

| Поле | Значение |
|------|----------|
| **Название** | `letters` |
| **Тип** | визуализатор |
| **Что делает** | ASCII‑частицы. Каждый блоб порождает буквы вдоль вектора скорости. Буквы стареют за `lifetime` кадров с alpha‑затуханием. |
| **Параметры** | `lifetime=30`, `charset=A-Z a-z 0-9`, `seed=7` |
| **Состояние** | Массив частиц `[{x, y, vx, vy, ch, age}]`, prev‑centroid dict |
| **Аудио** | `high` → интенсивность спавна (0.30 → 0.90) |
| **OpenCV.js** | ✅ `cv.putText()` для ASCII |
| **blob_tracker** | 🟡 **in progress** — эффект `Particle` заменён на Apolotary `letters` (раунд 4): ASCII chars, velocity vector, seeded RNG |
| **Критерий** | Буквы, вылетающие из блобов по направлению движения |
| **Проверка автором** | ❌ |

### 2.7 emojis

| Поле | Значение |
|------|----------|
| **Название** | `emojis` |
| **Тип** | визуализатор |
| **Что делает** | Те же частицы, что letters, но цветные эмодзи вместо ASCII. |
| **Параметры** | `lifetime=30`, `charset="🌸🌺🌻🌷✨🎆🎇🌟⭐💫🌿"` |
| **OpenCV.js** | ❌ `cv.putText()` не поддерживает эмодзи |
| **Портирование** | HTML5 Canvas 2D `ctx.fillText()` с emoji‑шрифтами → композитинг с OpenCV Mat |
| **blob_tracker** | ✅ **раунд 9** — `drawEmojisEffect`: emoji particles, hue per particle, seeded RNG seed=9 |
| **Критерий** | Цветные эмодзи‑частицы на месте блобов |
| **Проверка автором** | ❌ |

### 2.8 glyphs

| Поле | Значение |
|------|----------|
| **Название** | `glyphs` |
| **Тип** | визуализатор |
| **Что делает** | Unicode‑созвездие вокруг каждого блоба. K глифов, разбросанных в 2D‑гауссовом облаке. |
| **Параметры** | `charset="OXVT*+-=#@%"`, `seed=11` |
| **OpenCV.js** | ✅ `cv.putText()` для ASCII. Gaussian через Box‑Muller в JS. |
| **blob_tracker** | ✅ **раунд 12** — `drawGlyphsEffect`, Box-Muller Gaussian, 8 glyphs/blob, seed=11 |
| **Критерий** | Глифы, разбросанные вокруг каждого блоба |
| **Проверка автором** | ❌ |

### 2.9 cctv-zoom

| Поле | Значение |
|------|----------|
| **Название** | `cctv-zoom` |
| **Тип** | визуализатор |
| **Что делает** | Угловой inset с увеличенным crop вокруг крупнейшего блоба. Зелёная рамка + crosshair + "ZOOM". |
| **Параметры** | `inset_w_frac=0.22`, `border_color=(60,255,80)` |
| **Аудио** | `amp` → размер inseta (0.8 → 1.2) |
| **OpenCV.js** | ✅ `cv.resize()`, `cv.rectangle()`, `cv.line()`, `cv.putText()`. Копирование региона через `copyTo()` / циклы. |
| **blob_tracker** | ✅ **раунд 11** — `drawCctvZoomEffect`, inset ×2.5, crosshair, ZOOM label |
| **Критерий** | Увеличенный фрагмент вокруг активного блоба в углу экрана |
| **Проверка автором** | ❌ |

### 2.10 silhouette

| Поле | Значение |
|------|----------|
| **Название** | `silhouette` |
| **Тип** | визуализатор |
| **Что делает** | Hue‑циклическая цветовая заливка маски блобов. Hue = `(t * 12) % 180`. Alpha‑blend. |
| **Параметры** | `alpha=0.45` |
| **OpenCV.js** | ✅ `cv.addWeighted()`, `cv.bitwise_and()`, `cv.cvtColor()` |
| **blob_tracker** | ✅ **раунд 10** — `drawSilhouetteEffect`, hue=(t*0.012)%360, alpha=0.45 |
| **Критерий** | Цветная полупрозрачная заливка silhouette |
| **Проверка автором** | ❌ |

### 2.11 outline

| Поле | Значение |
|------|----------|
| **Название** | `outline` |
| **Тип** | визуализатор |
| **Что делает** | Одиночная контурная линия вокруг маски блоба. |
| **Параметры** | `color=(255,255,255)`, `thickness=2` |
| **OpenCV.js** | ✅ `cv.findContours()`, `cv.drawContours()` |
| **blob_tracker** | 🟡 **in progress** — эффект `Basic`. Обновлён до Apolotary `outline` (раунд 1): lineCap, lineJoin, contour polyline |
| **Критерий** | Тонкий контур по внешнему краю |
| **Проверка автором** | ❌ |

### 2.12 voronoi

| Поле | Значение |
|------|----------|
| **Название** | `voronoi` |
| **Тип** | визуализатор |
| **Что делает** | Ячейки Вороного от центроидов блобов. Только рёбра через `Subdiv2D`. |
| **Параметры** | `color=(220,200,240)`, `thickness=1` |
| **Требования** | ≥ 2 блоба |
| **OpenCV.js** | ✅ `cv.Subdiv2D`, `cv.polylines()` |
| **blob_tracker** | ✅ **раунд 27** — `drawVoronoiEffect`: perpendicular bisectors between centroids (canvas 2D) |
| **Критерий** | Триангуляция/Вороного экрана от позиций блобов |
| **Проверка автором** | ❌ |

### 2.13 convex-hull

| Поле | Значение |
|------|----------|
| **Название** | `convex-hull` |
| **Тип** | визуализатор |
| **Что делает** | Единый выпуклый полигон, охватывающий все центроиды блобов. |
| **Параметры** | `color=(80,220,255)`, `thickness=2` |
| **Требования** | ≥ 3 блоба |
| **OpenCV.js** | ✅ `cv.convexHull()`, `cv.polylines()` |
| **blob_tracker** | ✅ **раунд 28** — `drawConvexHullEffect`: Andrew's monotone chain (canvas 2D) |
| **Критерий** | Один полигон вокруг всех активных блобов |
| **Проверка автором** | ❌ |

### 2.14 heatmap

| Поле | Значение |
|------|----------|
| **Название** | `heatmap` |
| **Тип** | визуализатор |
| **Что делает** | Долго накапливающийся occupancy‑буфер. Каждый bbox блоба увеличивает heat. Затухание за кадр (`decay=0.992`). Colour LUT + alpha‑blend. |
| **Параметры** | `decay=0.992`, `alpha=0.55`, `colormap=INFERNO` |
| **Состояние** | Float32 `_heat[h, w]` |
| **OpenCV.js** | ⚠️ `cv.applyColorMap()` доступен. Float32 буфер → `Float32Array` или `cv.Mat(CV_32F)`. |
| **blob_tracker** | ✅ **раунд 14** — `drawHeatmapEffect`, Float32 occupancy, decay=0.992, inferno colormap |
| **Критерий** | Тепловая карта активности блобов |
| **Проверка автором** | ❌ |

### 2.15 spatial-echo

| Поле | Значение |
|------|----------|
| **Название** | `spatial-echo` |
| **Тип** | визуализатор |
| **Что делает** | Каждый bbox блоба показывает пиксели из другой области того же кадра. Режимы: mirror, flip‑y, rotate, offset, random. Опциональный time‑shift (кадр из буфера). |
| **Параметры** | `mode="mirror"`, `offset=(220,0)`, `time_shift_frames=0`, `buf_len=32`, `alpha=1.0`, `border_color=(255,100,200)`, `border_thickness=2` |
| **Состояние** | Кольцевой буфер предыдущих кадров |
| **OpenCV.js** | ⚠️ портабельно: `copyTo()` с ROI, `addWeighted()` для alpha, `rectangle()` для рамки. Time‑shift буфер — чистый JS. |
| **blob_tracker** | ✅ **раунд 13** — `drawSpatialEchoEffect`, offset region copy, time-shift buffer 32 frames |
| **Критерий** | Фрагменты изображения из другого региона/кадра внутри bbox |
| **Проверка автором** | ❌ |

---

## 3. Пост-эффекты (13)

Интерфейс: `fx = get_postfx("rgb-shift", **params)`, `canvas = fx(canvas, blobs, mask, t=t)`

Все пост-эффекты глобальные (не зависят от блобов).

### 3.1 rgb-shift

| Поле | Значение |
|------|----------|
| **Описание** | Хроматическая аберрация — сдвиг R‑канала вправо, B‑канала влево. |
| **OpenCV.js** | ✅ `cv.warpAffine()` с трансляцией, `BORDER_REPLICATE` |
| **blob_tracker** | ✅ **round 19** — `postfxRgbShift`: R=+shift, G=unchanged, B=−shift, via ImageData |

### 3.2 yuv-split

| Поле | Значение |
|------|----------|
| **Описание** | NTSC chroma desync — горизонтальный сдвиг U/V каналов. |
| **OpenCV.js** | ⚠️ `cv.cvtColor(BGR2YUV)` есть, `np.roll()` → ручной сдвиг массива |
| **blob_tracker** | ✅ **round 19** — `postfxYuvSplit`: RGB→YUV, U/V per-pixel shift, YUV→RGB |

### 3.3 chroma-rotate

| Поле | Значение |
|------|----------|
| **Описание** | HSV hue‑сдвиг с вертикальной полосатостью. |
| **OpenCV.js** | ✅ `cv.cvtColor(BGR2HSV)` |
| **blob_tracker** | ✅ **round 18** — `postfxChromaRotate`: RGB→HSL, hue shift, HSL→RGB |

### 3.4 luma-lut

| Поле | Значение |
|------|----------|
| **Описание** | Kolorizer false‑colour LUT — синусоидальная палитра от luma. |
| **OpenCV.js** | ✅ LUT через `cv.LUT()` или вручную |
| **blob_tracker** | ✅ **round 18** — `postfxLumaLut`: sinusoidal R/G/B from luma |

### 3.5 sync-jitter

| Поле | Значение |
|------|----------|
| **Описание** | Построчный горизонтальный roll в горизонтальной полосе. |
| **OpenCV.js** | ⚠️ `np.roll()` per row → ручная имплементация |
| **blob_tracker** | ✅ **round 19** — `postfxSyncJitter`: sinusoidal per-row shift in central 30% band |

### 3.6 ripple

| Поле | Значение |
|------|----------|
| **Описание** | Радиальное синусоидальное смещение. |
| **OpenCV.js** | ✅ `cv.remap()` |
| **blob_tracker** | ✅ **round 19** — `postfxRipple`: radial sine displacement via ImageData remap |

### 3.7 mosaic

| Поле | Значение |
|------|----------|
| **Описание** | Пикселизация (downsample → nearest‑neighbour upscale). |
| **OpenCV.js** | ✅ `cv.resize(INTER_AREA)` + `cv.resize(INTER_NEAREST)` |
| **blob_tracker** | ✅ **round 18** — `postfxMosaic`: canvas putImageData down/upscale |

### 3.8 threshold-band

| Поле | Значение |
|------|----------|
| **Описание** | Стек постеризованных полос яркости. |
| **OpenCV.js** | ✅ `cv.threshold()`, `cv.addWeighted()` |
| **blob_tracker** | ✅ **round 18** — `postfxThreshBand`: 6‑band posterization from luma |

### 3.9 edge-glow

| Поле | Значение |
|------|----------|
| **Описание** | Canny rim‑light с сине/красным tint + blur. |
| **OpenCV.js** | ✅ `cv.Canny()`, `cv.dilate()`, `cv.GaussianBlur()`, `cv.addWeighted()` |
| **blob_tracker** | ✅ **раунд 7** — `Glow` заменён на `edge-glow`: offscreen canvas → blur → tint → crisp contour overlay. shadowBlur удалён |
| **Критерий** | Светящиеся края по всему кадру |

### 3.10 feedback

| Поле | Значение |
|------|----------|
| **Описание** | Вращательно‑масштабированная итерация предыдущего кадра. |
| **OpenCV.js** | ✅ `cv.getRotationMatrix2D()`, `cv.warpAffine(BORDER_REFLECT_101)`, `cv.addWeighted()` |
| **blob_tracker** | ✅ **round 19** — `postfxFeedback`: scale 0.97, rotate 0.5°, alpha 0.65 |

### 3.11 lagfun

| Поле | Значение |
|------|----------|
| **Описание** | `max(prev * retention, curr)` — затухающий повтор. |
| **OpenCV.js** | ✅ тривиальная математика |
| **blob_tracker** | ✅ **round 19** — `postfxLagfun`: `max(pixel, prevBuf*0.75)` |

### 3.12 scanlines

| Поле | Значение |
|------|----------|
| **Описание** | Затемнение чётных строк. |
| **OpenCV.js** | ✅ простые array‑ops |
| **blob_tracker** | ✅ **round 18** — `postfxScanlines`: multiply even rows by 0.65 |

### 3.13 slit-scan

| Поле | Значение |
|------|----------|
| **Описание** | Строка Y из буфера предыдущих кадров. Кольцевой буфер, per‑row замена. |
| **OpenCV.js** | ✅ чистый JS + array ops |
| **blob_tracker** | ✅ **round 19** — `postfxSlitScan`: ring buffer of h canvases, newest→top |

---

## 4. Сводка

### По типам

| Категория | Всего | ✅ round N | ❌ not started | ⛔ wontport |
|-----------|-------|------------|----------------|-------------|
| Детекторы | 16 | 14 (edge R8, motion‑diff R15, color‑hsv R16, contour‑area R17, IDTracker done, **flow R20**, **simple‑blob R21**, **circles R22**, **dog R23**, **accumulation R24**, **watershed R25**, **color‑cluster R26**, **voronoi R27**, **convex‑hull R28**)| 0 | 4 (mog2, knn, saliency‑fine, saliency‑spec) |
| Визуализаторы | 15 | 15 (все: bbox R1, outline R1, crosshair R2, corner‑ticks R3, letters R4, centroid‑trail R5, network R6, emojis R9, silhouette R10, cctv‑zoom R11, glyphs R12, spatial‑echo R13, heatmap R14, **voronoi R27**, **convex‑hull R28**) | 0 | 0 |
| Пост‑эффекты | 13 | 13 (все: edge‑glow R7, mosaic R18, scanlines R18, chroma R18, rgb‑shift R18, luma‑lut R18, thresh‑band R18, ripple R19, lagfun R19, feedback R19, jitter R19, yuv‑split R19, slit‑scan R19) | 0 | 0 |
| **Итого** | **44** | **44** | **0** | **4** |

### Визуальное соответствие с существующими эффектами

| Эффект blob_tracker | Аналог Apolotary | Статус |
|---------------------|------------------|--------|
| Basic | `outline` | ✅ **раунд 1** — contour polyline с lineCap/lineJoin |
| Outline | `bbox` | ✅ **раунд 1** — strokeRect + Apolotary label `#ID area` |
| Cross | `crosshair` | ✅ **раунд 2** — fixed arm 18px, center dot, ID label |
| L-Frame | `corner‑ticks` | ✅ **раунд 3** — L-скобки, центроид, HUD, ID |
| Particle | `letters` | ✅ **раунд 4** — ASCII chars, velocity vector, seeded RNG |
| Trail | `centroid‑trail` | ✅ **раунд 5** — offscreen canvas, decay, hue per ID |
| Connection lines | `network` | ✅ **раунд 6** — alpha falloff, maxDist=280, все пары |
| Glow | `edge‑glow` postfx | ✅ **раунд 7** — offscreen canvas blur, tint, crisp overlay |
| Label | label в bbox/corner‑ticks | 🟡 merged — Apolotary `#ID area` формат, встроен в bbox |
| Frame | `corner‑ticks` | ✅ **раунд 3** (тот же эффект) |
| Dash | — (контурный пунктир) | ⏳ **не network** — остаётся как есть |
| X-Frame | — (собственный) | 🟡 keep — нет аналога в Apolotary |
| Grid | — (собственный) | 🟡 keep — нет аналога в Apolotary |
| Scope | — (собственный) | 🟡 keep — нет аналога в Apolotary |
| Win2K | — (собственный) | 🟡 keep — нет аналога в Apolotary |
| Backdrop | — (собственный) | 🟡 keep — нет аналога в Apolotary |

---

## 5. Приоритетность портирования

**Принцип:** все существующие эффекты blob_tracker, у которых есть аналог
в Apolotary, заменяются на Apolotary-версию. Собственные эффекты без аналога
(X-Frame, Grid, Scope, Win2K, Backdrop) остаются как есть.

### P0 — Замена существующих эффектов на Apolotary ✅ (все выполнены)
Эти эффекты уже есть в интерфейсе, но работали плохо. Заменены на Apolotary-версии.

1. **`outline`** ✅ **раунд 1** — Basic → Apolotary outline (contour polyline, lineCap/lineJoin)
2. **`bbox`** ✅ **раунд 1** — Outline → Apolotary bbox (strokeRect + label `#ID area`)
3. **`corner-ticks`** ✅ **раунд 3** — Frame + L-Frame → L-скобки 4 угла + центроид + HUD + ID label
4. **`crosshair`** ✅ **раунд 2** — Cross → Apolotary crosshair (fixed arm=18, center dot, ID label)
5. **`letters`** ✅ **раунд 4** — Particle → ASCII chars, velocity vector, seeded RNG (seed=7)
6. **`centroid-trail`** ✅ **раунд 5** — Trail → offscreen canvas, decay 0.85-0.99, hue per ID (golden angle)
7. ✅ **`network`** — раунд 6: Connection lines → alpha falloff, maxDist=280, все пары (Dash не network)
 8. ✅ **`edge-glow` postfx** — раунд 7: Glow → offscreen canvas blur + tint + crisp contour
 9. ✅ **`edge` detector** — раунд 8: detectContours → dilate всегда, dilateIter 0-5

### P1 — Новые визуализаторы ✅ (все выполнены)
10. ✅ **`emojis`** — раунд 9: emoji particles, hue per particle, seeded RNG seed=9
11. ✅ **`silhouette`** — раунд 10: hue-цикл `(t*0.012)%360`, alpha=0.45
12. ✅ **`cctv-zoom`** — раунд 11: inset ×2.5, crosshair, "ZOOM" label
13. ✅ **`glyphs`** — раунд 12: Box-Muller Gaussian, 8 glyphs/blob, seed=11
14. ✅ **`spatial‑echo`** — раунд 13: offset region copy, time-shift buffer
15. ✅ **`heatmap`** — раунд 14: Float32 occupancy, decay=0.992, inferno colormap

### P2 — Новые детекторы ✅ (все выполнены)
16. ✅ **`motion-diff`** — раунд 15: absdiff + threshold + morph open/close
17. ✅ **`color-hsv`** — раунд 16: HSV inRange target±tol
18. ✅ **`contour-area`** — раунд 17: Otsu / fixed threshold → contours

### P3 — Пост-эффекты (все выполнены)
19. ✅ **`mosaic`** — round 18: down/upsample pixelation
20. ✅ **`scanlines`** — round 18: dark even rows
21. ✅ **`rgb‑shift`** — round 18: chromatic aberration (R→, B←)
22. ✅ **`chroma‑rotate`** — round 18: HSL hue shift
23. ✅ **`luma‑lut`** — round 18: sinusoidal false‑colour
24. ✅ **`threshold‑band`** — round 18: 6‑band posterization
25. ✅ **`ripple`** — round 19: radial sine displacement
26. ✅ **`lagfun`** — round 19: decaying `max(prev*0.75, curr)`
27. ✅ **`feedback`** — round 19: rotational‑scale iteration
28. ✅ **`sync‑jitter`** — round 19: horizontal per‑row roll
29. ✅ **`yuv‑split`** — round 19: NTSC U/V shift
30. ✅ **`slit‑scan`** — round 19: ring‑buffer row time‑shift

### P4 — Сложные/нишевые детекторы ✅ (все выполнены)
31. ✅ **`flow`** — **раунд 20**: Farneback optical flow → magnitude threshold → contours
32. ✅ **`simple‑blob`** — **раунд 21**: SimpleBlobDetector → keypoints → bboxes
33. ✅ **`circles`** — **раунд 22**: HoughCircles → bboxes
34. ✅ **`dog`** — **раунд 23**: Difference of Gaussians → threshold → morph
35. ✅ **`accumulation`** — **раунд 24**: addWeighted running average → absdiff → threshold
36. ✅ **`watershed`** — **раунд 25**: distanceTransform → connectedComponents → watershed
37. ✅ **`color‑cluster`** — **раунд 26**: K-means → exclude largest cluster → region masks
38. ✅ **`voronoi`** — **раунд 27**: perpendicular bisectors between centroids (canvas 2D)
39. ✅ **`convex‑hull`** — **раунд 28**: Andrew's monotone chain (canvas 2D)

### ⛔ Не переносится
40. **`mog2`** — нет в OpenCV.js
41. **`knn`** — нет в OpenCV.js
42. **`saliency‑fine`** — contrib, не в OpenCV.js
43. **`saliency‑spec`** — contrib, не в OpenCV.js
44. **`csrt`** — нет в OpenCV.js; CentroidTracker в JS адекватен

---

## 7. Ссылки на исходную реализацию

| Файл Apolotary | Содержание |
|----------------|------------|
| `scripts/detectors.py` | Все 16 детекторов |
| `scripts/visualizers.py` | Все 15 визуализаторов |
| `scripts/postfx.py` | Все 13 пост‑эффектов |
| `references/detector-flavors.md` | Документация детекторов |
| `references/viz-flavors.md` | Документация визуализаторов |
| `references/postfx-glossary.md` | Документация пост‑эффектов |

---

*Примечание: emojis визуализатор в Apolotary использует PIL (Python). В JS порте обязательно использовать Canvas 2D `fillText()` с emoji‑шрифтами, затем импорт пикселей в `cv.Mat` через `ctx.getImageData()`.*
