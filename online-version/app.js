// ============================
// BLOB TRACKER — Core Application
// ============================

let cvReady = false;
let all_frame_data = [];
let isProcessing = false;
let cancelRequested = false;
let isExporting = false;
let currentVideoURL = null;
let currentVideoName = null;
let detectionReady = false;
let lastDetectedParams = null;

const DETECTION_PARAM_KEYS = new Set([
  "detector", "colorChannel", "useGPU",
  "cannyLow", "cannyHigh", "blurKernel",
  "blobMin", "blobMax",
  "mergeKernel",
]);

function saveDetectedParamsSnapshot() {
  lastDetectedParams = {};
  if (typeof P === "object" && P) {
    for (const k of DETECTION_PARAM_KEYS) {
      lastDetectedParams[k] = P[k];
    }
  }
}

function checkIsDetectionDirty() {
  if (!detectionReady || !lastDetectedParams || typeof P !== "object" || !P) return false;
  for (const k of DETECTION_PARAM_KEYS) {
    if (lastDetectedParams[k] !== P[k]) return true;
  }
  return false;
}

const PROCESSING_FPS_DEFAULT = 30;
let sourceFps = null;

const I18N = {
  en: {
    title: "Blob Tracker",
    loadingTitle: "Loading Blob Tracker…",
    loadingText: "Initializing OpenCV.js and preparing rendering pipeline…",
    loadingTagline: "Everything looks better with blob tracking effect on it",
    opencvLoadingAttempt: "Loading OpenCV.js from CDN {attempt}/{total}…",
    opencvErrorTitle: "OpenCV.js failed to load",
    opencvErrorBody: "All OpenCV CDNs are unavailable. Check your internet connection and try again.",
    retryOpenCv: "Retry",
    dropTitle: "Drop a video file anywhere",
    dropTitleDrag: "Release to upload video",
    dropSubtitle: "MP4, WebM, MOV - max 500 MB",
    dropHint: "or choose a file manually",
    uploadVideo: "Upload Video",
    trySample: "Try Sample Video",
    trySampleTitle: "Generate and load a demo video with animated blobs",
    generatingSample: "Creating demo…",
    changeVideo: "Change Video",
    changeVideoTitle: "Load a different video file",
    sampleNotSupported: "Media recording is not supported in this browser. Please upload a video file instead.",
    sampleError: "Failed to create demo video: {msg}",
    confirmAbortProcessing: "Abort current processing to change video?",
    appTitle: "Blob Tracker",
    appSubtitle: "Everything looks better with blob tracking effect on it",
    tabTrack: "Track",
    tabQuick: "Quick",
    tabStyle: "Style",
    tabDetect: "Detect",
    tabExport: "Export",
    quickStart: "Quick Start",
    quickStartToggleAria: "Toggle Quick Start guide",
    guideUpload: "Upload a video or drop it onto the stage.",
    guideFind: "Choose detection sensitivity and object size.",
    guideStyle: "Pick a visual style.",
    guideDetect: "Click Start detection when settings are ready.",
    guideExport: "Review and export the tracked video.",
    findObjects: "Find Objects",
    sensitivity: "Sensitivity",
    objectSize: "Object Size",
    detector: "Detector",
    basicEffects: "Basic Effects",
    connection: "Connection",
    lineStyle: "Line Style",
    connectionRate: "Connection Rate",
    strokeWidth: "Stroke Width",
    mute: "Mute",
    unmute: "Unmute",
    blobSize: "Blob Size",
    detection: "Detection",
    colorChannel: "Color Channel",
    gpuAcceleration: "GPU Acceleration",
    grouping: "Grouping",
    text: "Text",
    textToggle: "Show text",
    textPosition: "Text Position",
    textContentLabel: "Text Content",
    fontSize: "Font Size",
    color: "Color",
    centroid: "Centroid",
    showDots: "Show dots",
    output: "Output",
    outputFps: "Output FPS",
    codec: "Codec",
    mobileAudioNotice: "Heads up: on mobile browsers (especially iOS Safari) the exported video will likely have no sound. Mobile WebCodecs can't decode most audio codecs. For audio, export on a desktop browser.",
    low: "Low",
    normal: "Normal",
    high: "High",
    small: "Small",
    medium: "Medium",
    large: "Large",
    custom: "Custom",
    edge: "Edge",
    motion: "Motion",
    area: "Area",
    none: "None",
    full: "Full",
    red: "Red",
    greenShort: "Grn",
    blueShort: "Blu",
    min: "Min",
    max: "Max",
    merge: "Cluster Distance",
    edgeSensitivity: "Edge Sensitivity",
    edgeCrispness: "Edge Crispness",
    smoothing: "Smoothing",
    clusterDistance: "Cluster Distance",
    cannyLow: "Edge Sensitivity",
    cannyHigh: "Edge Crispness",
    blur: "Smoothing",
    center: "Center",
    top: "Top",
    bottom: "Bottom",
    random: "Random",
    position: "Position",
    count: "Count",
    source: "Source",
    preview: "Preview",
    resetDefaults: "Reset to defaults",
    copyDebugLog: "Copy debug log",
    copied: "Copied",
    startDetection: "Start detection",
    startDetectionTitle: "Start blob detection with current settings",
    redetect: "Re-detect",
    redetectTitle: "Re-run blob detection with current settings",
    redetectNeededTitle: "Settings changed — re-detection recommended",
    exportVideoBtn: "⬇ Export",
    exportVideoTitle: "Export video with tracked effects",
    sourceFpsLoading: "Source FPS: - (loading…)",
    sourceFpsEmpty: "Source FPS: -",
    sourceFpsValue: "Source FPS: {fps}",
    sourceFpsExport: "Source FPS: {fps} -> Export: {exportFps} fps",
    outputFpsConfirm: "Your current FPS is {current}. Do you want to {direction} it to {target} FPS? This will take some time and start re-processing.",
    outputFpsIncrease: "increase",
    outputFpsDecrease: "decrease",
    fpsConfirmTitle: "Confirm FPS change",
    confirm: "Confirm",
    cancel: "Cancel",
    fileTooLarge: "File is too large (max 500 MB).",
    unrecognizedFile: "Unrecognized file type. Try opening anyway?",
    unsupportedVideo: "Unsupported video format. Please use MP4, WebM, or MOV.",
    openCvLoading: "OpenCV.js is still loading - wait then retry.",
    failedProcess: "Failed to process video:\n{msg}",
    redetectFailed: "Re-detect failed: {msg}",
    cancelling: "Cancelling…",
    cancellingExport: "Cancelling export…",
    detecting: "Detecting…",
    detectionCancelled: "Detection cancelled",
    loadingVideo: "Loading video…",
    detectingFps: "Detecting source frame rate…",
    redetecting: "Re-detecting…",
    probingFrame: "Probing current frame…",
    probeReady: "Current frame preview: {count} blobs",
    probeSkippedMotion: "Motion detector needs full Re-detect",
    probeUnavailable: "Pause playback to preview detection changes",
    errorPrefix: "Error: ",
    resetTitle: "Reset to default",
    colorAria: "Color: {color}",
    colorPickerAria: "Pick color",
    colorHexAria: "Hex color code",
    tipFindAria: "Help: Find Objects",
    tipDetectorAria: "Help: Detector",
    tipBlobAria: "Help: Blob Size",
    tipDetectAria: "Help: Detection",
    tipEffectsAria: "Help: Basic Effects",
    tipConnectionAria: "Help: Connection",
    tipColorAria: "Help: Color",
    tipTextAria: "Help: Text",
    tipBlobMinAria: "Help: Minimum blob size",
    tipBlobMaxAria: "Help: Maximum blob size",
    tipColorChannelAria: "Help: Color Channel",
    tipGpuAria: "Help: GPU Acceleration",
    tipCannyLowAria: "Help: Edge Sensitivity",
    tipCannyHighAria: "Help: Edge Crispness",
    tipBlurAria: "Help: Smoothing",
    tipMergeAria: "Help: Cluster Distance",
    tipCentroidAria: "Help: Centroid",
    tipShowDotsAria: "Help: Show dots",
    smallTitle: "For small objects and details. Works best with high sensitivity.",
    nearestTitle: "Nearest neighbors",
    allTitle: "All connections",
    chainTitle: "Chain",
    waveTitle: "Waveform",
    effectBasic: "Contour",
    effectCross: "Cross",
    effectFrame: "Frame",
    effectGrid: "Grid",
    effectParticle: "Particle",
    effectDash: "Dash",
    effectScope: "Scope",
    effectBackdrop: "Backdrop",
    effectEmojis: "Emojis",
    effectHeatmap: "Heatmap",
    effectHull: "Hull",
    visualStyle: "Visual Style",
    styleNeon: "Neon",
    styleNeonTitle: "Neon — Electric contour glow",
    styleGhost: "Ghost",
    styleGhostTitle: "Ghost — Translucent silhouette phantom",
    styleMatrix: "Matrix",
    styleMatrixTitle: "Matrix — Digital code cascade",
    styleRainbow: "Rainbow",
    styleRainbowTitle: "Rainbow — Chromatic spectrum glow",
    styleFire: "Fire",
    styleFireTitle: "Fire — Rising flame embers",
    styleSparkles: "Sparkles",
    styleSparklesTitle: "Sparkles — Glittering star particles",
    styleCrt: "CRT",
    styleCrtTitle: "CRT — Retro scanline display",
    styleHalftone: "Halftone",
    styleHalftoneTitle: "Halftone — Offset dot raster grid",
    styleComic: "Comic",
    styleComicTitle: "Comic — Pop-art graphic framing",
    styleThermal: "Thermal",
    styleThermalTitle: "Thermal — Thermography heat gradient",
    styleBlueprint: "Blueprint",
    styleBlueprintTitle: "Blueprint — Technical drafting grid",
    styleGlowEdge: "Glow Edge",
    styleGlowEdgeTitle: "Glow Edge — High-contrast edge highlight",
    styleStarTrail: "Star Trail",
    styleStarTrailTitle: "Star Trail — Cosmic shooting star path",
    styleWireframe: "Wireframe",
    styleWireframeTitle: "Wireframe — 3D polygon mesh",
    styleLiquid: "Liquid",
    styleLiquidTitle: "Liquid — Dynamic fluid wave morph",
    fullscreenTitle: "Toggle Fullscreen (F)",
    playAction: "Play (Space)",
    pauseAction: "Pause (Space)",
    stepBackAction: "Step Back (←)",
    stepFwdAction: "Step Forward (→)",
    stepBackTitle: "Step Back 1 Frame (←)",
    stepFwdTitle: "Step Forward 1 Frame (→)",
    playTitle: "Play / pause (Space)",
    videoPlaybackError: "Video playback error: {msg}",
    videoCorrupted: "The video could not be loaded or has invalid duration.",
    videoTimeout: "Video failed to load within timeout period.",
    resetConfirmMessage: "Reset all tracking and styling settings to default values?",
  },
  ru: {
    title: "Blob Tracker",
    loadingTitle: "Загружаем Blob Tracker…",
    loadingText: "Запускаем OpenCV.js и готовим рендеринг…",
    loadingTagline: "Everything looks better with blob tracking effect on it",
    opencvLoadingAttempt: "Загружаем OpenCV.js с CDN {attempt}/{total}…",
    opencvErrorTitle: "Не удалось загрузить OpenCV.js",
    opencvErrorBody: "Все CDN OpenCV недоступны. Проверьте подключение к интернету и попробуйте снова.",
    retryOpenCv: "Повторить",
    dropTitle: "Перетащите видео сюда",
    dropTitleDrag: "Отпустите видео для загрузки",
    dropSubtitle: "MP4, WebM, MOV - до 500 МБ",
    dropHint: "или выберите файл вручную",
    uploadVideo: "Загрузить видео",
    trySample: "Демо-видео",
    trySampleTitle: "Сгенерировать и открыть демо-видео с анимированными объектами",
    generatingSample: "Создание демо…",
    changeVideo: "Сменить видео",
    changeVideoTitle: "Выбрать другой видеофайл",
    sampleNotSupported: "Запись видео не поддерживается в этом браузере. Пожалуйста, загрузите видеофайл.",
    sampleError: "Не удалось создать демо-видео: {msg}",
    confirmAbortProcessing: "Прервать текущую обработку и сменить видео?",
    appTitle: "Blob Tracker",
    appSubtitle: "Everything looks better with blob tracking effect on it",
    tabTrack: "Трекинг",
    tabQuick: "Старт",
    tabStyle: "Стиль",
    tabDetect: "Детект",
    tabExport: "Экспорт",
    quickStart: "Быстрый старт",
    quickStartToggleAria: "Свернуть или развернуть Быстрый старт",
    guideUpload: "Загрузите видео или перетащите его на рабочее поле.",
    guideFind: "Выберите чувствительность и размер объектов.",
    guideStyle: "Выберите визуальный стиль.",
    guideDetect: "Нажмите «Запустить детекцию», когда настройки готовы.",
    guideExport: "Проверьте результат и экспортируйте видео.",
    findObjects: "Поиск объектов",
    sensitivity: "Чувствительность",
    objectSize: "Размер объектов",
    detector: "Детектор",
    basicEffects: "Базовые эффекты",
    connection: "Связи",
    lineStyle: "Тип линий",
    connectionRate: "Плотность связей",
    strokeWidth: "Толщина линии",
    mute: "Выкл звук",
    unmute: "Вкл звук",
    blobSize: "Размер blob-объектов",
    detection: "Детекция",
    colorChannel: "Канал цвета",
    gpuAcceleration: "Ускорение GPU",
    grouping: "Группировка",
    text: "Текст",
    textToggle: "Показывать текст",
    textPosition: "Положение текста",
    textContentLabel: "Содержимое текста",
    fontSize: "Размер шрифта",
    color: "Цвет",
    centroid: "Центроид",
    showDots: "Показывать точки",
    output: "Экспорт",
    outputFps: "FPS экспорта",
    codec: "Кодек",
    mobileAudioNotice: "Внимание: в мобильных браузерах (особенно iOS Safari) экспортируемое видео, скорее всего, будет без звука — мобильный WebCodecs не умеет декодировать большинство аудиокодеков. Чтобы получить видео со звуком, экспортируйте в десктоп-браузере.",
    low: "Низкая",
    normal: "Баланс",
    high: "Высокая",
    small: "Малые",
    medium: "Средние",
    large: "Крупные",
    custom: "Свои",
    edge: "Контур",
    motion: "Движение",
    area: "Площадь",
    none: "Нет",
    full: "Полная",
    red: "Красн",
    greenShort: "Зел",
    blueShort: "Син",
    min: "Мин",
    max: "Макс",
    merge: "Дистанция объединения",
    edgeSensitivity: "Чувствительность границ",
    edgeCrispness: "Четкость границ",
    smoothing: "Сглаживание",
    clusterDistance: "Дистанция объединения",
    cannyLow: "Чувствительность границ",
    cannyHigh: "Четкость границ",
    blur: "Сглаживание",
    center: "Центр",
    top: "Сверху",
    bottom: "Снизу",
    random: "Случайно",
    position: "Координаты",
    count: "Номер",
    source: "Исходный",
    preview: "Превью",
    resetDefaults: "Сбросить настройки",
    copyDebugLog: "Скопировать лог",
    copied: "Скопировано",
    startDetection: "Запустить детекцию",
    startDetectionTitle: "Запустить детекцию с текущими настройками",
    redetect: "Re-detect",
    redetectTitle: "Повторить детекцию с текущими настройками",
    redetectNeededTitle: "Параметры изменены — рекомендуется повторный детект",
    exportVideoBtn: "⬇ Экспорт",
    exportVideoTitle: "Экспортировать видео с эффектами трекинга",
    sourceFpsLoading: "FPS источника: - (определяем…)",
    sourceFpsEmpty: "FPS источника: -",
    sourceFpsValue: "FPS источника: {fps}",
    sourceFpsExport: "FPS источника: {fps} -> экспорт: {exportFps} fps",
    outputFpsConfirm: "Текущий FPS: {current}. Хотите {direction} его до {target} FPS? Это займет время и запустит повторную обработку.",
    outputFpsIncrease: "увеличить",
    outputFpsDecrease: "уменьшить",
    fpsConfirmTitle: "Подтвердите смену FPS",
    confirm: "Подтвердить",
    cancel: "Отмена",
    fileTooLarge: "Файл слишком большой (максимум 500 МБ).",
    unrecognizedFile: "Тип файла не распознан. Все равно попробовать открыть?",
    unsupportedVideo: "Формат видео не поддерживается. Используйте MP4, WebM или MOV.",
    openCvLoading: "OpenCV.js еще загружается - подождите и попробуйте снова.",
    failedProcess: "Не удалось обработать видео:\n{msg}",
    redetectFailed: "Повторная детекция не удалась: {msg}",
    cancelling: "Отменяем…",
    cancellingExport: "Отменяем экспорт…",
    detecting: "Детекция…",
    detectionCancelled: "Детекция отменена",
    loadingVideo: "Загружаем видео…",
    detectingFps: "Определяем частоту кадров…",
    redetecting: "Повторная детекция…",
    probingFrame: "Пробуем текущий кадр…",
    probeReady: "Превью текущего кадра: {count} объектов",
    probeSkippedMotion: "Детектор движения требует полного Re-detect",
    probeUnavailable: "Поставьте видео на паузу для превью детекции",
    errorPrefix: "Ошибка: ",
    resetTitle: "Сбросить к значению по умолчанию",
    colorAria: "Цвет: {color}",
    colorPickerAria: "Выбрать цвет",
    colorHexAria: "Hex-код цвета",
    tipFindAria: "Справка: Поиск объектов",
    tipDetectorAria: "Справка: Детектор",
    tipBlobAria: "Справка: Размер объектов",
    tipDetectAria: "Справка: Детекция",
    tipEffectsAria: "Справка: Базовые эффекты",
    tipConnectionAria: "Справка: Связи",
    tipColorAria: "Справка: Цвет",
    tipTextAria: "Справка: Текст",
    tipBlobMinAria: "Справка: минимальный размер blob-объекта",
    tipBlobMaxAria: "Справка: максимальный размер blob-объекта",
    tipColorChannelAria: "Справка: канал цвета",
    tipGpuAria: "Справка: ускорение GPU",
    tipCannyLowAria: "Справка: Чувствительность границ",
    tipCannyHighAria: "Справка: Четкость границ",
    tipBlurAria: "Справка: Сглаживание",
    tipMergeAria: "Справка: Дистанция объединения",
    tipCentroidAria: "Справка: Центроид",
    tipShowDotsAria: "Справка: показывать точки",
    smallTitle: "Для маленьких объектов и деталей. Лучше работает с высокой чувствительностью.",
    nearestTitle: "Ближайшие соседи",
    allTitle: "Все связи",
    chainTitle: "Цепочка",
    waveTitle: "Волна",
    effectBasic: "Контур",
    effectCross: "Крест",
    effectFrame: "Рамка",
    effectGrid: "Сетка",
    effectParticle: "Частицы",
    effectDash: "Пунктир",
    effectScope: "Прицел",
    effectBackdrop: "Фон",
    effectEmojis: "Эмодзи",
    effectHeatmap: "Теплокарта",
    effectHull: "Оболочка",
    visualStyle: "Визуальный стиль",
    styleNeon: "Неон",
    styleNeonTitle: "Неон — Электрическое свечение контуров",
    styleGhost: "Призрак",
    styleGhostTitle: "Призрак — Полупрозрачный силуэт",
    styleMatrix: "Матрица",
    styleMatrixTitle: "Матрица — Каскад цифрового кода",
    styleRainbow: "Радуга",
    styleRainbowTitle: "Радуга — Спектральное переливчатое свечение",
    styleFire: "Огонь",
    styleFireTitle: "Огонь — Восходящие языки пламени и искры",
    styleSparkles: "Искры",
    styleSparklesTitle: "Искры — Мерцающие звездные частицы",
    styleCrt: "ЭЛТ",
    styleCrtTitle: "ЭЛТ — Ретро-монитор со сканлайнами",
    styleHalftone: "Полутон",
    styleHalftoneTitle: "Полутон — Растровая сетка точек",
    styleComic: "Комикс",
    styleComicTitle: "Комикс — Графическое поп-арт обрамление",
    styleThermal: "Тепловизор",
    styleThermalTitle: "Тепловизор — Термографический градиент тепла",
    styleBlueprint: "Чертёж",
    styleBlueprintTitle: "Чертёж — Инженерная координатная сетка",
    styleGlowEdge: "Свечение",
    styleGlowEdgeTitle: "Свечение — Контрастная подсветка границ",
    styleStarTrail: "Комета",
    styleStarTrailTitle: "Комета — Хвост падающей звезды",
    styleWireframe: "Каркас",
    styleWireframeTitle: "Каркас — 3D полигональная сетка",
    styleLiquid: "Жидкость",
    styleLiquidTitle: "Жидкость — Динамическая волновая форма",
    fullscreenTitle: "Полноэкранный режим (F)",
    playAction: "Воспроизведение (Space)",
    pauseAction: "Пауза (Space)",
    stepBackAction: "Шаг назад (←)",
    stepFwdAction: "Шаг вперед (→)",
    stepBackTitle: "Шаг назад на 1 кадр (←)",
    stepFwdTitle: "Шаг вперед на 1 кадр (→)",
    playTitle: "Воспроизведение / пауза (Space)",
    videoPlaybackError: "Ошибка воспроизведения видео: {msg}",
    videoCorrupted: "Не удалось загрузить видео или файл имеет некорректную длительность.",
    videoTimeout: "Время ожидания загрузки видео истекло.",
    resetConfirmMessage: "Сбросить все параметры трекинга и стилей на значения по умолчанию?",
  },
};

const TIP_TEXTS = {
  en: {
    "tip-find": "Quickly configures Edge detection thresholds and smoothing for your subject.\n• Sensitivity: Low suits high-contrast or noisy footage; Normal handles balanced everyday video; High catches faint silhouettes and subtle boundaries.\n• Object Size: Filters out specks (Small) or limits tracking to prominent subjects (Large).\nTip: For tiny or fast-moving items, pair High sensitivity with Small size.",
    "tip-detector": "Selects the computer vision algorithm used to isolate targets on each frame:\n• Edge: Canny gradient analysis. Best for subjects with sharp visual outlines against backgrounds.\n• Motion: Frame-differencing. Isolates actively moving elements while ignoring static backgrounds (requires Re-detect).\n• HSV: Color-range segmentation. Isolates pixels matching a specific color hue/saturation regardless of lighting variations (ideal for colorful items like balls or cars).\n• Area: Luminance thresholding. Detects connected bright or dark regions where the subject contrasts cleanly with the background.",
    "tip-blob": "Area threshold filter based on pixel count (width × height of detected contour).\n• Min: Eliminates dust, specular glints, and compression noise.\n• Max: Excludes giant background areas, floor planes, and frame borders.",
    "tip-detect": "Fine-tune edge detection pipeline parameters:\n1. Smoothing (Blur): Suppress video grain, sensor noise, and micro-flicker.\n2. Edge Sensitivity: Lower to capture subtle boundaries; raise to ignore background texture.\n3. Edge Crispness: Raise to enforce strong edge continuity; lower for looser contours.\n4. Cluster Distance: Merge fragmented contours into a cohesive tracked object.",
    "tip-blob-min": "Minimum blob area in pixels.\n• Raise (e.g. 500–2000 px) to filter out texture noise, foliage jitter, and tiny floating particles.\n• Lower (e.g. 50–200 px) to track small elements like balls, birds, or facial features.",
    "tip-blob-max": "Maximum blob area in pixels.\n• Lower to prevent the entire screen background, shadows, or walls from forming a giant blob.\n• Raise when tracking close-up subjects that fill a significant portion of the camera frame.",
    "tip-color-channel": "Specifies which color channel is converted to grayscale before edge detection:\n• Lum (Luminance): Perceptually weighted brightness (default) — reliable for most scenes.\n• Red / Grn / Blu: Isolates high contrast in specific chromatic channels when a colored subject blends into the overall brightness of the background.",
    "tip-gpu": "Hardware acceleration via WebGL2 shaders for video processing and preview rendering.\n• Keeps frame rates smooth and reduces CPU usage.\n• Leave enabled unless your device exhibits browser WebGL context loss or visual artifacts.",
    "tip-canny-low": "Adjusts which subtle brightness contrasts trigger contours (Canny lower hysteresis threshold).\n• Lower values (0–40): Catch faint, subtle edges, but can introduce sensor noise and background grain.\n• Higher values (60–120): Isolate dominant edges and eliminate clutter, but may miss softer outlines.",
    "tip-canny-high": "Sets the threshold required to validate and anchor an edge (Canny upper hysteresis threshold).\n• Lower values (80–120): Produce more continuous boundaries on softer or backlit subjects.\n• Higher values (150–220): Keep only sharp, high-contrast silhouettes with maximum confidence.",
    "tip-blur": "Gaussian blur kernel size applied before contour analysis.\n• Low (1–3 px): Retains fine textures, sharp corners, and thin lines.\n• High (7–15 px): Blurs away compression artifacts, ISO grain, and temporal flicker for cleaner tracking.",
    "tip-merge": "Morphological closing radius that bridges nearby contour segments into a unified blob.\n• 1 = No clustering (raw individual segments).\n• 3–9 px = Merges fragmented outlines of a single person, animal, or vehicle into one tracked target.",
    "tip-centroid": "Calculates the geometric center of mass (centroid) for each tracked contour.\n• Serves as the anchor point for connection lines, distance metrics, and coordinates.\n• Enable dot display to inspect tracking stability across frame transitions.",
    "tip-show-dots": "Renders a solid target indicator at each detected object's centroid.\n• On: Helpful during tuning to verify whether targets are properly centered and tracked.\n• Off: Recommended for final render when you only want outline effects without dot markers.",
    "tip-effects": "Visual rendering style applied to detected objects:\n• Contour / Hull / Voronoi: Organic geometric outlines hugging detected edges.\n• Frame / L-Frame / X-Frame / Grid: Technical UI framing, target boxes, and grid overlays.\n• Cross / Scope: Precision reticles, crosshairs, and tracking markers.\n• Particle / Emojis: Expressive scatter and icon overlays.\n• Heatmap / Backdrop: Density gradients and high-contrast silhouette fills.",
    "tip-connection": "Dynamic vector linkages drawn between detected centroids:\n• Line Style: Graph topologies (Nearest neighbor pairs, All-to-all mesh, Sequential chain, Sine wave).\n• Connection Rate: Probability (0.0–1.0) controlling density and number of active links.\n• Stroke Width: Rendered line weight in screen pixels.",
    "tip-color": "Global accent color applied to all overlay elements (contours, reticles, text, and linkages).\n• Choose from curated studio swatches, use the color picker, or enter a 6-digit hex code (#RRGGBB).",
    "tip-text": "Telemetry text overlays rendered alongside each tracked object:\n• Content: Random hex telemetry codes, live normalized screen coordinates [X, Y], or sequential blob ID.\n• Position: Anchor location relative to bounding box (Center, Top, Bottom).\n• Font Size: Monospace typography scale (8–20 px).",
  },
  ru: {
    "tip-find": "Быстрая настройка порогов детектора границ и сглаживания под ваш сюжет.\n• Чувствительность: Низкая подходит для высококонтрастных или шумных кадров; Баланс — оптимальный универсальный режим; Высокая улавливает тонкие силуэты и слабые границы.\n• Размер объектов: Отсекает мелкий сор (Малые) или фокусирует трекинг только на крупных объектах (Большие).\nСовет: Для мелких или быстрых объектов выбирайте «Высокая» + «Малые».",
    "tip-detector": "Выбор алгоритма компьютерного зрения для поиска объектов на каждом кадре:\n• Контур (Edge): Анализ градиентов Canny. Идеален для объектов с четкими очертаниями на фоне.\n• Движение (Motion): Межкадровое вычитание. Находит только движущиеся объекты и игнорирует статичный фон (требует полный Re-detect).\n• HSV: Цветовая сегментация. Находит пиксели заданного цветового диапазона (оттенок/насыщенность) независимо от перепадов яркости (отлично для цветных предметов: мячей, машин, одежды).\n• Площадь (Area): Яркостная бинаризация. Находит связанные светлые или темные области, заметно контрастирующие с окружением.",
    "tip-blob": "Фильтр площади объектов по количеству пикселей внутри контура.\n• Мин: Отсекает пыль, блики и мелкий шум сжатия видео.\n• Макс: Исключает огромные плоскости фона, пол и границы кадра.",
    "tip-detect": "Точная настройка конвейера детекции границ:\n1. Сглаживание: Подавляет шум матрицы, зерно и мерцание перед поиском краев.\n2. Чувствительность границ: Снижайте для слабых контуров; повышайте, чтобы отсечь текстуру фона.\n3. Четкость границ: Повышайте для уверенных непрерывных линий; снижайте для мягких контуров.\n4. Дистанция объединения: Склеивает разрозненные сегменты контура в единый объект.",
    "tip-blob-min": "Минимальная площадь объекта в пикселях.\n• Повышайте (500–2000 px), чтобы отфильтровать шум листвы, мелкую рябь и частицы.\n• Снижайте (50–200 px) для отслеживания мелких объектов: мячей, птиц, деталей лица.",
    "tip-blob-max": "Максимальная площадь объекта в пикселях.\n• Снижайте, если фон, тени или стены захватываются как один гигантский объект.\n• Повышайте, когда главный объект находится близко к камере и занимает большую часть экрана.",
    "tip-color-channel": "Определяет, какой цветовой канал анализируется перед поиском контуров:\n• Lum (Яркость): Взвешенная яркость кадра (по умолчанию) — подходит для большинства сцен.\n• Red / Grn / Blu: Выделяет максимальный контраст в отдельном спектре, если объект сливается с фоном по общей яркости.",
    "tip-gpu": "Аппаратное ускорение через шейдеры WebGL2 для обработки кадров и отрисовки превью.\n• Обеспечивает плавную частоту кадров и разгружает процессор.\n• Оставляйте включенным, кроме редких случаев сбоев WebGL или графических артефактов в браузере.",
    "tip-canny-low": "Определяет, какие перепады яркости запускают построение контура (нижний порог Canny).\n• Меньшие значения (0–40): Улавливают слабые, полупрозрачные границы, но могут добавлять шум.\n• Большие значения (60–120): Оставляют только явные перепады и убирают сор, но могут терять мягкие силуэты.",
    "tip-canny-high": "Задает порог подтверждения и фиксации границы объекта (верхний порог Canny).\n• Меньшие значения (80–120): Формируют более связные контуры на мягких или контровых объектах.\n• Большие значения (150–220): Оставляют только предельно резкие, контрастные контуры с максимальной четкостью.",
    "tip-blur": "Размер ядра сглаживания (фильтр Гаусса) перед анализом контуров.\n• Малый (1–3 px): Сохраняет тонкие детали, резкие углы и тонкие линии.\n• Большой (7–15 px): Сглаживает артефакты сжатия, шум ISO и мерцание кадров для более стабильного трекинга.",
    "tip-merge": "Радиус морфологического объединения, соединяющий близко расположенные контуры в один blob-объект.\n• 1 = Без объединения (каждый контур отслеживается отдельно).\n• 3–9 px = Объединяет разорванные части одного человека, силуэта или машины в единый целый объект.",
    "tip-centroid": "Вычисляет геометрический центр тяжести (центроид) каждого отслеживаемого контура.\n• Служит опорной точкой для соединительных линий, замеров дистанции и координат.\n• Включите отображение точек для визуальной проверки устойчивости трекинга.",
    "tip-show-dots": "Отрисовывает контрастный маркер в центре каждого найденного объекта.\n• Вкл: Полезно при настройке, чтобы убедиться в точности привязки трекера.\n• Выкл: Рекомендуется для финального экспорта, чтобы оставить только контурные эффекты.",
    "tip-effects": "Визуальный стиль оформления найденных объектов:\n• Контур / Оболочка / Voronoi: Органические очертания и геометрические оболочки по краям объектов.\n• Рамка / L-Frame / X-Frame / Сетка: Техничный интерфейс, видоискатели и координатные сетки.\n• Крест / Прицел: Высокоточные перекрестия и прицельные маркеры.\n• Частицы / Эмодзи: Динамические частицы и иконки.\n• Теплокарта / Фон: Цветовые градиенты плотности и контрастная заливка силуэтов.",
    "tip-connection": "Динамические векторные связи между центроидами найденных объектов:\n• Тип линий: Топология графа связей (Ближайшие соседи, Полная сеть, Цепочка, Синусоида).\n• Плотность связей: Доля связанных объектов (0.0 — отключено, 1.0 — все объекты связаны).\n• Толщина линии: Ширина отрисовываемой линии в пикселях.",
    "tip-color": "Основной акцентный цвет для всех визуальных эффектов (контуров, рамок, текста и линий).\n• Выберите готовый оттенок из палитры, используйте пипетку или введите hex-код (#RRGGBB).",
    "tip-text": "Телеметрические текстовые метки рядом с каждым отслеживаемым объектом:\n• Содержимое: Случайные шестнадцатеричные коды, текущие координаты [X, Y] или порядковый номер ID.\n• Положение: Точка привязки относительно объекта (По центру, Сверху, Снизу).\n• Размер шрифта: Кегль моноширинного шрифта (8–20 px).",
  },
};

function detectBrowserLanguage() {
  const navLangs = (typeof navigator !== "undefined" && navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [typeof navigator !== "undefined" ? (navigator.language || "en") : "en"];
  return navLangs.some(l => typeof l === "string" && l.toLowerCase().startsWith("ru")) ? "ru" : "en";
}

const savedLang = typeof localStorage !== "undefined" ? localStorage.getItem("blobTrackerLang") : null;
let currentLang = savedLang || detectBrowserLanguage();
if (!I18N[currentLang]) currentLang = "en";

const numberFormatCache = new Map();
function formatNumber(num, fractionDigits = 0) {
  if (!Number.isFinite(num)) return "0";
  const key = `${currentLang || "en"}-${fractionDigits}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(currentLang || "en", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
      numberFormatCache.set(key, formatter);
    } catch {
      return num.toFixed(fractionDigits);
    }
  }
  return formatter.format(num);
}

function t(key, vars = {}) {
  let text = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll("{" + k + "}", String(v));
  return text;
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  document.querySelectorAll(".lang-bar button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === currentLang);
  });
  document.querySelectorAll(".sreset").forEach(btn => {
    btn.title = t("resetTitle");
    btn.setAttribute("aria-label", t("resetTitle"));
  });
  document.querySelectorAll(".cs").forEach(sw => {
    const color = rgbToHex(sw.style.background || "");
    if (color) setColorSwatchLabel(sw, color);
  });
  const colorPicker = document.getElementById("color-picker");
  const colorHex = document.getElementById("color-hex");
  if (colorPicker) colorPicker.setAttribute("aria-label", t("colorPickerAria"));
  if (colorHex) colorHex.setAttribute("aria-label", t("colorHexAria"));
  syncOpenCvLoadingText();
  updateOutputFpsInfo();
  updateDetectionActions();
  updatePlaybackUi();
}

function syncOpenCvLoadingText() {
  const status = window.__openCvStatus;
  if (!status || cvReady || status.failed || status.attempt < 1) return;
  const el = document.getElementById("loading-text");
  if (el) el.textContent = t("opencvLoadingAttempt", { attempt: status.attempt, total: status.total });
}

function updateDetectionActions() {
  const isDirty = detectionReady && checkIsDetectionDirty();
  if (redetectBtn) {
    const key = detectionReady ? "redetect" : "startDetection";
    const titleKey = isDirty ? "redetectNeededTitle" : (detectionReady ? "redetectTitle" : "startDetectionTitle");
    const labelSpan = redetectBtn.querySelector(".action-btn__text") || redetectBtn;
    labelSpan.textContent = t(key);
    redetectBtn.title = t(titleKey);
    redetectBtn.disabled = isProcessing || isExporting || !currentVideoURL;
    redetectBtn.classList.toggle("needs-redetect", Boolean(isDirty));
    const badge = document.getElementById("dirty-badge");
    if (badge) {
      badge.hidden = !isDirty;
      badge.title = t("redetectNeededTitle");
    }
  }
  if (exportBtn) {
    exportBtn.disabled = !detectionReady || isProcessing || isExporting;
    const exportSpan = exportBtn.querySelector(".action-btn__text") || exportBtn;
    exportSpan.textContent = t("exportVideoBtn");
    exportBtn.title = t("exportVideoTitle");
  }
}

function setupLanguageControls() {
  document.querySelectorAll(".lang-bar button").forEach(btn => {
    btn.addEventListener("click", () => {
      currentLang = btn.dataset.lang === "ru" ? "ru" : "en";
      localStorage.setItem("blobTrackerLang", currentLang);
      applyLanguage();
    });
  });
}

function updateUrlParams(updates = {}) {
  try {
    if (typeof window === "undefined" || !window.location || typeof history === "undefined") return;
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    }
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

function switchToTab(target) {
  const tabs = document.querySelectorAll(".panel-tab");
  const sections = document.querySelectorAll("[data-panel-section]");
  tabs.forEach(t => {
    const isActive = t.dataset.tabTarget === target;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  sections.forEach(section => { section.hidden = section.dataset.panelSection !== target; });
  updateUrlParams({ tab: target });
}

function setupPanelTabs() {
  const tabs = document.querySelectorAll(".panel-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      switchToTab(tab.dataset.tabTarget);
    });
  });
}

function getEffectiveFps() {
  if (P.outputFps === "source") return sourceFps || PROCESSING_FPS_DEFAULT;
  const n = Number(P.outputFps);
  return (isFinite(n) && n > 0) ? n : PROCESSING_FPS_DEFAULT;
}

function updateOutputFpsInfo() {
  const el = document.getElementById("output-fps-info");
  if (!el) return;
  if (P.outputFps === "source") {
    el.textContent = sourceFps ? t("sourceFpsValue", { fps: formatNumber(sourceFps, 2) }) : t("sourceFpsLoading");
  } else {
    el.textContent = sourceFps
      ? t("sourceFpsExport", { fps: formatNumber(sourceFps, 2), exportFps: P.outputFps })
      : t("sourceFpsExport", { fps: "-", exportFps: P.outputFps });
  }
}

const MAX_PREVIEW_DIM = 540;

// ============================
// STATE
// ============================
let P = {
  selectedEffect: "neon",
  connectionStyle: "nearest",
  connectionRate: 0.5,
  strokeWidth: 2,
  contourColor: "#f3ac03",
  cannyLow: 50,
  cannyHigh: 150,
  blurKernel: 5,
  blobMin: 300,
  blobMax: 200000,
  textEnabled: true,
  textPosition: "center",
  textContent: "random",
  fontSize: 12,
  centroidEnabled: false,
  mergeKernel: 1,
  colorChannel: 0,
  useGPU: true,
  outputFps: "source",
  outputCodec: "h264",
  detector: "edge",
  // PostFX
  postFx: "off",
};

const DEFAULTS = { ...P };

const COLORS = [
  "#ffffff","#f3ac03","#ef4444","#f59e0b","#84cc16","#22c55e","#06b6d4","#3b82f6","#8b5cf6",
  "#ec4899","#000000","#d4d4d4","#9a9a9a","#666666","#333333","#1a1a1a","#a855f7","#6366f1"
];

const COLOR_NAMES = {
  "#ffffff": { en: "White", ru: "Белый" },
  "#f3ac03": { en: "Gold", ru: "Золотой" },
  "#ef4444": { en: "Red", ru: "Красный" },
  "#f59e0b": { en: "Amber", ru: "Янтарный" },
  "#84cc16": { en: "Lime", ru: "Лаймовый" },
  "#22c55e": { en: "Green", ru: "Зеленый" },
  "#06b6d4": { en: "Cyan", ru: "Циан" },
  "#3b82f6": { en: "Blue", ru: "Синий" },
  "#8b5cf6": { en: "Violet", ru: "Фиолетовый" },
  "#ec4899": { en: "Pink", ru: "Розовый" },
  "#000000": { en: "Black", ru: "Черный" },
  "#d4d4d4": { en: "Light gray", ru: "Светло-серый" },
  "#9a9a9a": { en: "Gray", ru: "Серый" },
  "#666666": { en: "Dark gray", ru: "Темно-серый" },
  "#333333": { en: "Charcoal", ru: "Угольный" },
  "#1a1a1a": { en: "Near black", ru: "Почти черный" },
  "#a855f7": { en: "Purple", ru: "Пурпурный" },
  "#6366f1": { en: "Indigo", ru: "Индиго" },
};

let appReady = false;
function hideLoad() {
  if (!cvReady || !appReady) return;
  const el = document.getElementById("loading-screen");
  if (el) { el.style.display = "none"; }
}
function onCvReady() {
  cvReady = true;
  hideLoad();
  log("opencv", "OpenCV.js loaded", { url: window.__openCvStatus && window.__openCvStatus.url });
  console.log("OpenCV loaded");
}
function onCvError(error) {
  log("opencv", "OpenCV.js failed to load", { error: error || "all CDNs failed" });
  console.error("OpenCV failed", error || "all CDNs failed");
}

// ============================
// WEBGL GPU PIPELINE
// ============================
const GPU = {
  gl: null, programBlurH: null, programBlurV: null, programSobel: null,
  programThreshold: null, programExtract: null, programDilate: null,
  framebuffer: null, framebuffer2: null, textureA: null, textureB: null, quadVao: null,
  width: 0, height: 0, ready: false,
};

function initGPU() {
  const c = document.createElement("canvas");
  const gl = c.getContext("webgl2", { premultipliedAlpha: false, alpha: false });
  if (!gl) { console.warn("WebGL2 not available — GPU pipeline disabled"); return; }
  GPU.gl = gl;
  GPU.ready = true;
  const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  GPU.quadVao = { buf, attrLoc: 0 };
  GPU.programBlurH = compileProgram(gl, VERT_QUAD, FRAG_BLUR_H);
  GPU.programBlurV = compileProgram(gl, VERT_QUAD, FRAG_BLUR_V);
  GPU.programSobel = compileProgram(gl, VERT_QUAD, FRAG_SOBEL);
  GPU.programThreshold = compileProgram(gl, VERT_QUAD, FRAG_THRESHOLD);
  GPU.programExtract = compileProgram(gl, VERT_QUAD, FRAG_EXTRACT);
  GPU.programDilate = compileProgram(gl, VERT_QUAD, FRAG_DILATE);
  log("gpu", "GPU pipeline initialized (WebGL2)");
}

function gpuEnsureSize(w, h) {
  if (!GPU.ready || (GPU.width === w && GPU.height === h)) return;
  const gl = GPU.gl;
  GPU.width = w; GPU.height = h;
  gl.canvas.width = w; gl.canvas.height = h;
  if (GPU.textureA) gl.deleteTexture(GPU.textureA);
  if (GPU.textureB) gl.deleteTexture(GPU.textureB);
  if (GPU.framebuffer) gl.deleteFramebuffer(GPU.framebuffer);
  if (GPU.framebuffer2) gl.deleteFramebuffer(GPU.framebuffer2);
  GPU.textureA = createTexture(gl, w, h);
  GPU.textureB = createTexture(gl, w, h);
  GPU.framebuffer = createFramebuffer(gl, GPU.textureA);
  GPU.framebuffer2 = createFramebuffer(gl, GPU.textureB);
}

function createTexture(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFramebuffer(gl, texture) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return fb;
}

function uploadCanvas(gl, tex, canvas) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
}

function uploadMaskToTexture(gl, tex, w, h, data) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
}

function gpuDilate(w, h, radius) {
  if (!GPU.ready || !GPU.programDilate) return false;
  if (radius < 1) return true;
  const gl = GPU.gl;
  const r = Math.min(16, Math.max(1, radius | 0));
  renderToTexture(gl, GPU.programDilate, GPU.textureB, GPU.framebuffer, w, h,
    { u_resolution: [w, h], u_radius: r });
  renderToTexture(gl, GPU.programDilate, GPU.textureA, GPU.framebuffer2, w, h,
    { u_resolution: [w, h], u_radius: r });
  return true;
}

function readMaskFromTexture(w, h) {
  const gl = GPU.gl;
  const pixels = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.framebuffer2);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = pixels[i * 4];
  return out;
}

function renderToTexture(gl, program, inputTex, outputFb, w, h, uniforms) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, outputFb);
  gl.viewport(0, 0, w, h);
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, inputTex);
  gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  if (uniforms) {
    for (const [name, val] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name);
      if (loc === null) continue;
      if (typeof val === "number") gl.uniform1f(loc, val);
      else if (Number.isInteger(val)) gl.uniform1i(loc, val);
      else if (Array.isArray(val) && val.length === 2) gl.uniform2f(loc, val[0], val[1]);
      else if (Array.isArray(val) && val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, GPU.quadVao.buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s); return null;
  }
  return s;
}

function compileProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "a_position");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(p)); return null;
  }
  return p;
}

function gpuCanny(srcCanvas, cannyLow, cannyHigh, blurSigma) {
  if (!GPU.ready) return null;
  const gl = GPU.gl;
  const w = srcCanvas.width, h = srcCanvas.height;
  gpuEnsureSize(w, h);
  uploadCanvas(gl, GPU.textureA, srcCanvas);
  renderToTexture(gl, GPU.programExtract, GPU.textureA, GPU.framebuffer2, w, h,
    { u_resolution: [w, h], u_channel: P.colorChannel });
  renderToTexture(gl, GPU.programBlurH, GPU.textureB, GPU.framebuffer, w, h,
    { u_resolution: [w, h], u_sigma: blurSigma });
  renderToTexture(gl, GPU.programBlurV, GPU.textureA, GPU.framebuffer2, w, h,
    { u_resolution: [w, h], u_sigma: blurSigma });
  renderToTexture(gl, GPU.programSobel, GPU.textureB, GPU.framebuffer, w, h,
    { u_resolution: [w, h] });
  renderToTexture(gl, GPU.programThreshold, GPU.textureA, GPU.framebuffer2, w, h,
    { u_resolution: [w, h], u_thresholds: [cannyLow, cannyHigh] });
  const pixels = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GPU.framebuffer2);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const edgeMap = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = pixels[i * 4];
    if (v >= 128) edgeMap[i] = v > 200 ? 255 : 128;
    else edgeMap[i] = 0;
  }
  return edgeMap;
}

// ============================
// DOM REFERENCES
// ============================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");
const dropZone = document.getElementById("drop-zone");
const dropTitle = document.querySelector(".drop-title");
const canvasWrap = document.getElementById("canvas-wrap");
const progressBar = document.getElementById("progress-bar");
const progressTrack = document.getElementById("progress-track");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const exportOverlay = document.getElementById("export-overlay");
const exportBtn = document.getElementById("export-btn");
const redetectBtn = document.getElementById("redetect-btn");
const exportStatus = document.getElementById("export-status");
const probeStatus = document.getElementById("probe-status");
const playbackControls = document.getElementById("playback-controls");
const playToggle = document.getElementById("play-toggle") || document.getElementById("play-btn");
const playBtn = playToggle;
const stepBackBtn = document.getElementById("step-back-btn");
const stepFwdBtn = document.getElementById("step-fwd-btn");
const muteToggle = document.getElementById("mute-toggle");
const timeline = document.getElementById("timeline");
const timeReadout = document.getElementById("time-readout");
const sampleVideoBtn = document.getElementById("sample-video-btn");
const changeVideoBtn = document.getElementById("change-video-btn");

if (typeof document !== "undefined" && playToggle && !document.getElementById("play-btn")) {
  const _origGetElementById = document.getElementById.bind(document);
  document.getElementById = function(id) {
    if (id === "play-btn") return _origGetElementById("play-btn") || playToggle;
    return _origGetElementById(id);
  };
}
const exportCanvas = document.createElement("canvas");
const exportCtx = exportCanvas.getContext("2d", { willReadFrequently: true });

let timelineDragging = false;
let currentFrameProbe = null;
let liveProbeTimer = null;
let liveProbeRunId = 0;
let pendingProbeOnPause = false;

// ============================
// CANCEL BUTTONS
// ============================
const cancelDetectBtn = document.getElementById("cancel-detect");
function showCancelDetect() { if (cancelDetectBtn) cancelDetectBtn.classList.add("visible"); }
function hideCancelDetect() { if (cancelDetectBtn) cancelDetectBtn.classList.remove("visible"); }
if (cancelDetectBtn) {
  cancelDetectBtn.addEventListener("click", () => {
    if (!isProcessing) return;
    cancelRequested = true;
    cancelDetectBtn.disabled = true;
    progressLabel.textContent = t("cancelling");
    log("detect", "Cancel requested by user");
  });
}

const cancelExportBtn = document.getElementById("cancel-export");
function showCancelExport() { if (cancelExportBtn) cancelExportBtn.classList.add("visible"); }
function hideCancelExport() { if (cancelExportBtn) cancelExportBtn.classList.remove("visible"); }
if (cancelExportBtn) {
  cancelExportBtn.addEventListener("click", () => {
    if (!isExporting) return;
    isExporting = false;
    cancelExportBtn.disabled = true;
    progressLabel.textContent = t("cancellingExport");
    log("export", "Cancel requested by user");
    stopExport();
  });
}

// ============================
// DEBUG LOGGER
// ============================
const LOG_MAX = 300;
const logBuffer = [];
function log(tag, msg, extra) {
  const entry = { t: new Date().toISOString(), tag, msg, ...(extra || {}) };
  if (extra && extra.params) entry.params = cleanParams(extra.params);
  logBuffer.push(entry);
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
  localStorage.setItem("blb_log", JSON.stringify(logBuffer));
}
function cleanParams(p) {
  const c = {};
  for (const [k,v] of Object.entries(p)) {
    if (typeof v !== "function" && !(v instanceof HTMLElement) && !(v instanceof CanvasRenderingContext2D)) c[k] = v;
  }
  return c;
}
function getLogText() {
  let out = "=== BLOB TRACKER DEBUG LOG ===\n";
  out += `Generated: ${new Date().toISOString()}\n`;
  out += `UserAgent: ${navigator.userAgent}\n`;
  out += "cvReady: " + cvReady + "\n\n";
  for (const e of logBuffer) {
    out += `[${e.t}] [${e.tag}] ${e.msg}`;
    if (e.error) out += " | error: " + e.error;
    if (e.params) out += " | params: " + JSON.stringify(e.params);
    out += "\n";
  }
  return out;
}
log("init", "App started");

// ============================
// TELEMETRY
// ============================
const Telemetry = {
  el: null, windowSize: 30, frameTimes: [], blobSamples: [],
  dropped: 0, total: 0, peak: 0, targetFrameMs: 1000 / 60, visible: false,
  show() { this.visible = true; if (this.el) this.el.classList.add("visible"); },
  hide() { this.visible = false; if (this.el) this.el.classList.remove("visible"); },
  reset() { this.frameTimes.length = 0; this.blobSamples.length = 0; this.dropped = 0; this.total = 0; this.peak = 0; },
  setTargetFps(fps) { this.targetFrameMs = (fps && fps > 0) ? (1000 / fps) : 16.67; },
  record(blobCount) {
    const now = performance.now();
    if (this.frameTimes.length) {
      const dt = now - this.frameTimes[this.frameTimes.length - 1];
      this.frameTimes.push(now);
      if (this.frameTimes.length > this.windowSize + 1) this.frameTimes.shift();
      if (dt > this.targetFrameMs * 2) this.dropped++;
      this.total++;
      if (blobCount > this.peak) this.peak = blobCount;
    } else {
      this.frameTimes.push(now);
    }
    this.blobSamples.push(blobCount);
    if (this.blobSamples.length > this.windowSize) this.blobSamples.shift();
  },
  render() {
    if (!this.visible || !this.el) return;
    let fps = 0;
    if (this.frameTimes.length > 1) {
      const span = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
      if (span > 0) fps = ((this.frameTimes.length - 1) * 1000) / span;
    }
    const avgBlobs = this.blobSamples.length
      ? this.blobSamples.reduce((s, n) => s + n, 0) / this.blobSamples.length : 0;
    const dropPct = this.total > 0 ? (this.dropped / this.total) * 100 : 0;
    this.el.innerHTML =
      '<span id="track-status" class="telemetry-badge"><span class="telemetry-dot"></span>LIVE</span>' +
      '<span id="fps-badge" class="telemetry-badge"><b>' + formatNumber(fps, 1) + '</b> fps</span>' +
      '<span id="active-blobs-badge" class="telemetry-badge">blobs <b>' + formatNumber(avgBlobs, 1) + '</b> <span class="t-dim">(peak ' + this.peak + ')</span></span>' +
      (dropPct > 0 ? '<span id="drop-badge" class="telemetry-badge t-dim">drop <b>' + formatNumber(dropPct, 0) + '%</b></span>' : '');
  },
};

// ============================
// HISTORY (undo/redo)
// ============================
const History = {
  past: [], future: [], max: 50, applying: false,
  snapshot() { const snap = {}; for (const k of Object.keys(DEFAULTS)) snap[k] = P[k]; return snap; },
  commit() { if (this.applying) return; this.past.push(this.snapshot()); if (this.past.length > this.max) this.past.shift(); this.future.length = 0; },
  restore(snap) {
    this.applying = true;
    try {
      for (const k of Object.keys(DEFAULTS)) { if (snap[k] !== undefined && P[k] !== snap[k]) P[k] = snap[k]; }
      syncControlsFromP();
    } finally { this.applying = false; }
  },
  undo() { if (!this.past.length) return false; this.future.push(this.snapshot()); if (this.future.length > this.max) this.future.shift(); const snap = this.past.pop(); this.restore(snap); return true; },
  redo() { if (!this.future.length) return false; this.past.push(this.snapshot()); if (this.past.length > this.max) this.past.shift(); const snap = this.future.pop(); this.restore(snap); return true; },
  clear() { this.past.length = 0; this.future.length = 0; },
};

window.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox")) return;
  if (t && t.tagName === "TEXTAREA") return;
  if (t && t.isContentEditable) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key !== "z" && key !== "y") return;
  e.preventDefault();
  if (e.shiftKey) History.redo();
  else if (key === "z" && History.undo()) {}
  else if (key === "y" && History.redo()) {}
});

// ============================
// UI HELPERS
// ============================
function setupSeg(container, stateKey, parse) {
  const el = document.getElementById(container);
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      let next = parse ? parse(btn.dataset.val) : btn.dataset.val;
      if (typeof next === "number" && !Number.isFinite(next)) {
        next = DEFAULTS[stateKey] !== undefined ? DEFAULTS[stateKey] : 0;
      }
      if (P[stateKey] === next) return;
      History.commit();
      el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      P[stateKey] = next;
      handleParamChanged(stateKey);
    });
  });
}

function showAppConfirm(message) {
  const dialog = document.getElementById("fps-confirm");
  const messageEl = document.getElementById("fps-confirm-message");
  const confirmBtn = dialog?.querySelector("[data-dialog-confirm]");
  const cancelEls = dialog?.querySelectorAll("[data-dialog-cancel]");
  if (!dialog || !messageEl || !confirmBtn || !cancelEls || typeof dialog.showModal !== "function") {
    return Promise.resolve(confirm(message));
  }

  const previousFocus = document.activeElement;
  messageEl.textContent = message;

  return new Promise(resolve => {
    let settled = false;
    const close = (result) => {
      if (settled) return;
      settled = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelEls.forEach(el => el.removeEventListener("click", onCancel));
      dialog.removeEventListener("cancel", onCancelEvent);
      dialog.removeEventListener("click", onBackdropClick);
      if (dialog.open) {
        dialog.close();
      }
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
      resolve(result);
    };

    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    const onCancelEvent = (e) => {
      e.preventDefault();
      close(false);
    };
    const onBackdropClick = (e) => {
      if (e.target === dialog) close(false);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelEls.forEach(el => el.addEventListener("click", onCancel));
    dialog.addEventListener("cancel", onCancelEvent);
    dialog.addEventListener("click", onBackdropClick);

    dialog.showModal();
    confirmBtn.focus();
  });
}

function setupOutputFpsControls() {
  const el = document.getElementById("output-fps");
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const next = String(btn.dataset.val);
      if (P.outputFps === next) return;
      const targetFps = Number(next);
      const currentFps = sourceFps || getEffectiveFps();
      if (currentVideoURL && Number.isFinite(targetFps) && Number.isFinite(currentFps) && Math.abs(currentFps - targetFps) > 0.01) {
        const direction = targetFps > currentFps ? t("outputFpsIncrease") : t("outputFpsDecrease");
        const confirmed = await showAppConfirm(t("outputFpsConfirm", {
          current: formatNumber(currentFps, 2),
          target: targetFps,
          direction,
        }));
        if (!confirmed) return;
      }
      History.commit();
      el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      P.outputFps = next;
      handleParamChanged("outputFps");
      if (detectionReady && currentVideoURL && !isProcessing) {
        log("detect", "Output FPS changed, re-detecting", { newFps: P.outputFps, effectiveFps: getEffectiveFps() });
        reDetect();
      }
      Telemetry.setTargetFps(getEffectiveFps());
      updateOutputFpsInfo();
    });
  });
}

function setupIconRow(container, stateKey) {
  const el = document.getElementById(container);
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.value;
      if (P[stateKey] === next) return;
      History.commit();
      el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      P[stateKey] = next;
      handleParamChanged(stateKey);
    });
  });
}

function setupGrid(container, stateKey) {
  const el = document.getElementById(container);
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.style || btn.dataset.val;
      if (P[stateKey] === next) return;
      History.commit();
      el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      P[stateKey] = next;
      handleParamChanged(stateKey);
    });
  });
}

function setupToggle(id, stateKey) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    if (P[stateKey] === el.checked) return;
    History.commit();
    P[stateKey] = el.checked;
    handleParamChanged(stateKey);
  });
}

// ============================
// UI: sync from P (undo/redo restoration)
// ============================
function syncControlsFromP() {
  const map = [
    ["connection-rate", "connectionRate", "val", parseFloat],
    ["text-position", "textPosition", "val", String],
    ["text-content", "textContent", "val", String],
    ["font-size", "fontSize", "val", parseInt],
    ["connection-style", "connectionStyle", "value", String],
    ["style-grid", "selectedEffect", "style", String],
    ["basic-effects", "selectedEffect", "val", String],
    ["sensitivity-preset", "_sensitivity", "preset", String],
    ["object-size-preset", "_objectSize", "size", String],
    ["detector-mode", "detector", "val", String],
    ["color-channel", "colorChannel", "val", parseInt],
    ["output-fps", "outputFps", "val", String],
    ["output-codec", "outputCodec", "val", String],
  ];
  for (const [id, key, attr, parse] of map) {
    const el = document.getElementById(id);
    if (!el) continue;
    const want = String(P[key] === undefined ? "" : P[key]).toLowerCase();
    el.querySelectorAll("button").forEach(b => {
      const rawVal = b.dataset[attr] || (attr === "style" ? b.dataset.val : b.dataset.style);
      const v = String(parse(rawVal || "")).toLowerCase();
      const isActive = (v === want) || (want === "neon" && v === "basic") || (want === "basic" && v === "neon");
      b.classList.toggle("active", isActive);
    });
  }
  const tmap = [
    ["text-enabled", "textEnabled"],
    ["centroid-enabled", "centroidEnabled"],
    ["gpu-toggle", "useGPU"],
  ];
  for (const [id, key] of tmap) {
    const el = document.getElementById(id);
    if (el) el.checked = !!P[key];
  }
  const smap = [
    ["stroke-width", "strokeWidth", "stroke-width-val", v => v + "px"],
    ["blob-min", "blobMin", "blob-min-val", v => v],
    ["blob-max", "blobMax", "blob-max-val", v => v >= 1000 ? Math.round(v / 1000) + "k" : v],
    ["canny-low", "cannyLow", "canny-low-val", v => v],
    ["canny-high", "cannyHigh", "canny-high-val", v => v],
    ["blur-kernel", "blurKernel", "blur-kernel-val", v => v],
    ["merge-kernel", "mergeKernel", "merge-kernel-val", v => v],
  ];
  for (const [id, key, valId, fmt] of smap) {
    const el = document.getElementById(id);
    const ve = document.getElementById(valId);
    if (!el) continue;
    if (document.activeElement !== el) el.value = P[key];
    if (ve) ve.textContent = fmt(P[key]);
  }
  syncColorControls();
  updateOutputFpsInfo();
  Telemetry.setTargetFps(getEffectiveFps());
}

function rgbToHex(rgb) {
  if (!rgb || rgb[0] !== "r") return rgb;
  const m = rgb.match(/\d+/g); if (!m) return rgb;
  return "#" + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
}

function getColorName(color) {
  const names = COLOR_NAMES[color];
  return names ? (names[currentLang] || names.en) : color;
}

function getColorSwatchLabel(color) {
  return getColorName(color) + " (" + color + ")";
}

function setColorSwatchLabel(sw, color) {
  const label = getColorSwatchLabel(color);
  sw.title = label;
  sw.setAttribute("aria-label", label);
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const withHash = raw[0] === "#" ? raw : "#" + raw;
  const hex = withHash.toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function syncColorControls(force) {
  const color = normalizeHexColor(P.contourColor) || DEFAULTS.contourColor;
  const pal = document.getElementById("color-palette");
  if (pal) {
    pal.querySelectorAll(".cs").forEach(s => {
      const cur = rgbToHex(s.style.background || "");
      s.classList.toggle("active", cur === color);
    });
  }
  const picker = document.getElementById("color-picker");
  const hex = document.getElementById("color-hex");
  if (picker) picker.value = color;
  if (hex && (force || document.activeElement !== hex)) {
    hex.value = color;
    hex.classList.remove("invalid");
  }
}

function applyContourColor(value, commit) {
  const color = normalizeHexColor(value);
  if (!color) return false;
  if (P.contourColor === color) {
    syncColorControls(true);
    return true;
  }
  if (commit) History.commit();
  P.contourColor = color;
  syncColorControls(true);
  handleParamChanged("contourColor");
  return true;
}

// ============================
// UI: sliders
// ============================
function setupSlider(id, stateKey, valId, format) {
  const el = document.getElementById(id);
  const ve = document.getElementById(valId);
  if (!el) return;
  const fmt = (v) => format ? format(v) : v;
  const minVal = parseFloat(el.min);
  const maxVal = parseFloat(el.max);
  const row = el.closest(".srow");
  if (row) {
    // Redundant .smin/.smax removed for clean, uncluttered layout
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "sreset";
    reset.title = t("resetTitle");
    reset.setAttribute("aria-label", t("resetTitle"));
    reset.textContent = "⟲";
    reset.addEventListener("click", () => {
      const def = DEFAULTS[stateKey];
      if (def === undefined) return;
      el.value = def;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    row.appendChild(reset);
  }
  el.addEventListener("input", () => {
    let v = parseFloat(el.value);
    if (!Number.isFinite(v)) {
      v = DEFAULTS[stateKey] !== undefined ? DEFAULTS[stateKey] : (parseFloat(el.min) || 0);
      el.value = v;
    }
    if (P[stateKey] === v) return;
    History.commit();
    P[stateKey] = v;
    if (ve) ve.textContent = fmt(v);

    if (stateKey === "blobMin" && Number.isFinite(P.blobMax) && v > P.blobMax) {
      setSliderValue("blob-max", "blobMax", v, "blob-max-val", formatBlobMax);
    } else if (stateKey === "blobMax" && Number.isFinite(P.blobMin) && v < P.blobMin) {
      setSliderValue("blob-min", "blobMin", v, "blob-min-val");
    } else if (stateKey === "cannyLow" && Number.isFinite(P.cannyHigh) && v > P.cannyHigh) {
      setSliderValue("canny-high", "cannyHigh", v, "canny-high-val");
    } else if (stateKey === "cannyHigh" && Number.isFinite(P.cannyLow) && v < P.cannyLow) {
      setSliderValue("canny-low", "cannyLow", v, "canny-low-val");
    }

    handleParamChanged(stateKey);
  });
}

// ============================
// UI: color palette
// ============================
function buildPalette() {
  const el = document.getElementById("color-palette");
  if (!el) return;
  el.innerHTML = "";
  COLORS.forEach(c => {
    const sw = document.createElement("div");
    sw.className = "cs" + (c === P.contourColor ? " active" : "");
    sw.style.background = c;
    sw.role = "button";
    sw.tabIndex = 0;
    setColorSwatchLabel(sw, c);
    sw.addEventListener("click", () => {
      if (P.contourColor === c) return;
      applyContourColor(c, true);
    });
    sw.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sw.click(); }
    });
    el.appendChild(sw);
  });
  syncColorControls();
}

function setupColorInput() {
  const picker = document.getElementById("color-picker");
  const hex = document.getElementById("color-hex");
  if (!picker || !hex) return;

  const applyPickerColor = () => {
    applyContourColor(picker.value, true);
  };
  picker.addEventListener("input", applyPickerColor);
  picker.addEventListener("change", applyPickerColor);

  hex.addEventListener("input", () => {
    const color = normalizeHexColor(hex.value);
    hex.classList.toggle("invalid", !color);
    if (color) applyContourColor(color, true);
  });

  hex.addEventListener("change", () => {
    const color = normalizeHexColor(hex.value);
    if (!color) {
      hex.value = normalizeHexColor(P.contourColor) || DEFAULTS.contourColor;
      hex.classList.remove("invalid");
      syncColorControls(true);
      return;
    }
    hex.value = color;
    hex.classList.remove("invalid");
    applyContourColor(color, true);
  });

  hex.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      hex.blur();
    }
  });

  syncColorControls();
}

// ============================
// UI: friendly detection presets
// ============================
function formatBlobMax(v) { return v >= 1000 ? Math.round(v / 1000) + "k" : v; }

function setSliderValue(id, stateKey, value, valId, format) {
  const el = document.getElementById(id);
  const ve = document.getElementById(valId);
  if (!el) return;
  let numVal = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(numVal)) {
    numVal = DEFAULTS[stateKey] !== undefined ? DEFAULTS[stateKey] : (parseFloat(el.min) || 0);
  }
  el.value = numVal;
  P[stateKey] = numVal;
  if (ve) ve.textContent = format ? format(numVal) : numVal;
}

function setupPresetRow(container, dataKey, onSelect) {
  const el = document.getElementById(container);
  if (!el) return;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      History.commit();
      el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(btn.dataset[dataKey]);
      handlePresetChanged(container);
    });
  });
}

// ============================
// UI: init
// ============================
function setupControls() {
  setupPresetRow("sensitivity-preset", "preset", preset => {
    const values = {
      low: { cannyLow: 80, cannyHigh: 200, blurKernel: 7 },
      normal: { cannyLow: 50, cannyHigh: 150, blurKernel: 3 },
      high: { cannyLow: 30, cannyHigh: 100, blurKernel: 3 },
    }[preset];
    if (!values) return;
    setSliderValue("canny-low", "cannyLow", values.cannyLow, "canny-low-val");
    setSliderValue("canny-high", "cannyHigh", values.cannyHigh, "canny-high-val");
    setSliderValue("blur-kernel", "blurKernel", values.blurKernel, "blur-kernel-val");
  });
  setupPresetRow("object-size-preset", "size", size => {
    const values = { small: { min: 10, max: 8000 }, medium: { min: 50, max: 50000 }, large: { min: 300, max: 200000 } };
    if (size === "custom") return;
    setSliderValue("blob-min", "blobMin", values[size].min, "blob-min-val");
    setSliderValue("blob-max", "blobMax", values[size].max, "blob-max-val", formatBlobMax);
  });

  setupSeg("connection-rate", "connectionRate", parseFloat);
  setupSeg("text-position", "textPosition", String);
  setupSeg("text-content", "textContent", String);
  setupSeg("font-size", "fontSize", parseInt);
  setupIconRow("connection-style", "connectionStyle");
  setupGrid("style-grid", "selectedEffect");
  setupGrid("basic-effects", "selectedEffect");
  setupSeg("detector-mode", "detector", String);
  setupToggle("text-enabled", "textEnabled");
  setupToggle("centroid-enabled", "centroidEnabled");
  setupToggle("gpu-toggle", "useGPU");
  setupSeg("color-channel", "colorChannel", parseInt);
  setupOutputFpsControls();
  setupSeg("output-codec", "outputCodec", String);

  setupSlider("stroke-width", "strokeWidth", "stroke-width-val", v => v+"px");
  setupSlider("blob-min", "blobMin", "blob-min-val", v => v);
  setupSlider("blob-max", "blobMax", "blob-max-val", v => (v>=1000?Math.round(v/1000)+"k":v));
  setupSlider("canny-low", "cannyLow", "canny-low-val", v => v);
  setupSlider("canny-high", "cannyHigh", "canny-high-val", v => v);
  setupSlider("blur-kernel", "blurKernel", "blur-kernel-val", v => v);
  setupSlider("merge-kernel", "mergeKernel", "merge-kernel-val", v => v);

  buildPalette();
  setupColorInput();

  document.getElementById("reset-btn")?.addEventListener("click", async () => {
    const confirmed = await showAppConfirm(t("resetConfirmMessage"));
    if (!confirmed) return;
    History.commit();
    document.querySelectorAll(".seg button:first-child, .icon-btn:first-child, .gbtn:first-child, .lbtn:first-child, .style-btn:first-child").forEach(b => {
      b.parentElement.querySelectorAll("button").forEach(bb => bb.classList.remove("active"));
      b.classList.add("active");
    });
    P = { ...DEFAULTS };
    document.querySelectorAll("input[type='checkbox']").forEach(cb => {
      if (cb.id === "text-enabled") cb.checked = true;
      else cb.checked = false;
    });
    document.getElementById("stroke-width").value = 2;
    document.getElementById("blob-min").value = 300;
    document.getElementById("blob-max").value = 200000;
    document.getElementById("canny-low").value = 50;
    document.getElementById("canny-high").value = 150;
    document.getElementById("blur-kernel").value = 5;
    document.getElementById("merge-kernel").value = 1;
    document.getElementById("stroke-width-val").textContent = "2px";
    document.getElementById("blob-min-val").textContent = "300";
    document.getElementById("blob-max-val").textContent = "200k";
    document.getElementById("canny-low-val").textContent = "50";
    document.getElementById("canny-high-val").textContent = "150";
    document.getElementById("blur-kernel-val").textContent = "5";
    document.getElementById("merge-kernel-val").textContent = "1";
    document.querySelectorAll("#color-channel button").forEach(b => b.classList.toggle("active", b.dataset.val === "0"));
    document.querySelectorAll("#output-fps button").forEach(b => b.classList.toggle("active", b.dataset.val === "source"));
    document.querySelectorAll("#output-codec button").forEach(b => b.classList.toggle("active", b.dataset.val === "h264"));
    document.getElementById("gpu-toggle").checked = true;
    buildPalette();
    clearCurrentFrameProbe();
    scheduleCurrentFrameProbe();
    log("params", "Reset to defaults");
  });

  document.getElementById("debug-log-btn")?.addEventListener("click", () => {
    const text = getLogText();
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("debug-log-btn");
      btn.textContent = t("copied");
      setTimeout(() => { btn.textContent = t("copyDebugLog"); }, 2500);
      log("debug", "Log copied to clipboard");
    }).catch(() => {
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "blob-tracker-debug-log.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      log("debug", "Log downloaded as file");
    });
  });

  log("init", "Controls initialized");
}

// ============================
// FILE LOADING & DEMO GENERATION
// ============================
let dragCounter = 0;
function setDropActive(active) {
  if (dropZone) {
    dropZone.classList.toggle("drag-over", active);
    dropZone.classList.toggle("drag-active", active);
  }
  if (dropTitle) dropTitle.textContent = active ? t("dropTitleDrag") : t("dropTitle");
}

const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

window.addEventListener("dragenter", e => {
  e.preventDefault();
  dragCounter++;
  setDropActive(true);
});
window.addEventListener("dragover", e => {
  e.preventDefault();
  setDropActive(true);
});
window.addEventListener("dragleave", () => {
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) setDropActive(false);
});
window.addEventListener("drop", e => {
  e.preventDefault();
  dragCounter = 0;
  setDropActive(false);
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.startsWith("video/")) loadFile(file);
});

if (dropZone) {
  dropZone.addEventListener("click", e => {
    if (e.target.closest("button")) return;
    fileInput.click();
  });
  dropZone.addEventListener("keydown", e => {
    if (e.target === dropZone && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      fileInput.click();
    }
  });
}

if (uploadBtn) {
  uploadBtn.addEventListener("click", () => fileInput.click());
}

if (fileInput) {
  fileInput.addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (file && file.type.startsWith("video/")) loadFile(file);
  });
}

if (changeVideoBtn) {
  changeVideoBtn.addEventListener("click", () => {
    if (isProcessing) {
      if (!confirm(t("confirmAbortProcessing"))) return;
      cancelRequested = true;
    }
    if (activeFpsDetectorCancel) {
      try { activeFpsDetectorCancel(); } catch (e) {}
      activeFpsDetectorCancel = null;
    }
    if (video && !video.paused) {
      video.pause();
    }
    if (fileInput) {
      fileInput.value = "";
      fileInput.click();
    }
  });
}

let cachedSampleBlob = null;
let isGeneratingSample = false;

function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidateTypes = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=avc1",
    "video/mp4"
  ];
  for (const t of candidateTypes) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

async function generateSampleVideo() {
  if (cachedSampleBlob) return cachedSampleBlob;

  if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error(t("sampleNotSupported"));
  }
  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) {
    throw new Error(t("sampleNotSupported"));
  }

  const width = 640;
  const height = 360;
  const fps = 30;
  const totalFrames = 75; // 2.5 seconds at 30fps

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const sCtx = offscreen.getContext("2d", { alpha: false });
  if (!sCtx) throw new Error("Could not initialize 2D context for demo video.");

  // 3 distinct organic bouncing blobs with different harmonic shapes, speeds, and sizes
  const demoBlobs = [
    {
      x: 170, y: 150,
      vx: 3.2, vy: 2.2,
      baseR: 44,
      freq: 3,
      amp: 8,
      speed: 4.2,
      fill: "#ffffff"
    },
    {
      x: 470, y: 220,
      vx: -2.8, vy: 2.3,
      baseR: 34,
      freq: 4,
      amp: 6,
      speed: -3.6,
      fill: "#f8fafc"
    },
    {
      x: 320, y: 90,
      vx: 2.4, vy: -3.0,
      baseR: 24,
      freq: 5,
      amp: 5,
      speed: 4.8,
      fill: "#f1f5f9"
    }
  ];

  const stream = offscreen.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2500000
  });

  const chunks = [];
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        cachedSampleBlob = blob;
        resolve(blob);
      } catch (err) {
        reject(err);
      }
    };
    recorder.onerror = err => reject(err);
  });

  recorder.start();

  const dt = 1 / fps;
  const frameDelay = Math.round(1000 / fps);

  for (let f = 0; f < totalFrames; f++) {
    const t = f * dt;

    // Background: deep dark slate
    sCtx.fillStyle = "#0c0f14";
    sCtx.fillRect(0, 0, width, height);

    // Subtle dark ground plane to add physical presence
    sCtx.fillStyle = "#080a0e";
    sCtx.fillRect(0, height - 32, width, 32);

    // Render each organic blob
    for (const b of demoBlobs) {
      b.x += b.vx;
      b.y += b.vy;

      const pad = b.baseR + 14;
      if (b.x < pad) { b.x = pad; b.vx = Math.abs(b.vx); }
      if (b.x > width - pad) { b.x = width - pad; b.vx = -Math.abs(b.vx); }
      if (b.y < pad) { b.y = pad; b.vy = Math.abs(b.vy); }
      if (b.y > height - pad - 32) { b.y = height - pad - 32; b.vy = -Math.abs(b.vy); }

      sCtx.beginPath();
      const numPoints = 36;
      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const deform = Math.sin(theta * b.freq + t * b.speed) * b.amp +
                       Math.cos(theta * 2 - t * 2.4) * (b.amp * 0.5);
        const r = Math.max(8, b.baseR + deform);
        const px = b.x + Math.cos(theta) * r;
        const py = b.y + Math.sin(theta) * r;
        if (i === 0) sCtx.moveTo(px, py);
        else sCtx.lineTo(px, py);
      }
      sCtx.closePath();

      sCtx.fillStyle = b.fill;
      sCtx.fill();
      sCtx.lineWidth = 2;
      sCtx.strokeStyle = "#ffffff";
      sCtx.stroke();
    }

    await new Promise(r => setTimeout(r, frameDelay));
  }

  recorder.stop();
  return await recordingPromise;
}

async function loadSampleVideo() {
  if (isGeneratingSample) return;
  isGeneratingSample = true;

  const btn = sampleVideoBtn || document.getElementById("sample-video-btn");
  const origHtml = btn ? btn.innerHTML : "";

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:-1px;"></span><span>${t("generatingSample")}</span>`;
  }

  try {
    const blob = await generateSampleVideo();
    const ext = (blob.type && blob.type.includes("mp4")) ? "mp4" : "webm";
    const mimeBase = ext === "mp4" ? "video/mp4" : "video/webm";
    const sampleFile = new File([blob], `sample_blobs.${ext}`, {
      type: mimeBase
    });
    loadFile(sampleFile);
  } catch (err) {
    const msg = (err && err.message) || String(err);
    log("video", "Failed to load sample video", { error: msg });
    alert(t("sampleError", { msg }));
  } finally {
    isGeneratingSample = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

if (sampleVideoBtn) {
  sampleVideoBtn.addEventListener("click", loadSampleVideo);
}

function loadFile(file) {
  // File validation
  if (file.size > 500 * 1024 * 1024) {
    alert(t("fileTooLarge"));
    return;
  }
  if (!file.type.startsWith("video/") && file.type) {
    if (!confirm(t("unrecognizedFile"))) return;
  }
  const mimeBase = (file.type || "").split(";")[0].trim().toLowerCase();
  if (mimeBase === "video/mp4" || mimeBase === "video/webm" || mimeBase === "video/quicktime" || !mimeBase) {
    currentVideoName = file.name;
    currentVideoFile = file;
    prepareVideo(URL.createObjectURL(file));
  } else {
    alert(t("unsupportedVideo"));
  }
}

let currentVideoFile = null;

function trackedFilename(ext) {
  const base = (currentVideoName || "contour_vfx")
    .replace(/\.[^/.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim() || "contour_vfx";
  return base + "_tracked." + ext;
}

// ============================
// VIDEO LOADING
// ============================
function loadVideoMetadata(videoEl, url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      videoEl.onloadedmetadata = null;
      videoEl.onerror = null;
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(t("videoTimeout") || ("Video failed to load within " + Math.round(timeoutMs / 1000) + " s.")));
    }, timeoutMs);

    videoEl.onloadedmetadata = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!Number.isFinite(videoEl.duration) || videoEl.duration <= 0) {
        reject(new Error(t("videoCorrupted") || "Video has invalid or zero duration."));
        return;
      }
      resolve();
    };

    videoEl.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(t("videoCorrupted") || "Failed to load video: format not supported or file unavailable."));
    };

    videoEl.src = url;
  });
}

function seekVideo(videoEl, time, maxTries = 500) {
  return new Promise((resolve) => {
    const dur = (Number.isFinite(videoEl.duration) && videoEl.duration > 0) ? videoEl.duration : 0;
    const safeTime = Math.max(0, Math.min(Number.isFinite(time) ? time : 0, Math.max(0, dur - 0.001)));
    let tries = 0;
    const check = () => {
      if (!videoEl.seeking || ++tries > maxTries) {
        videoEl.onseeked = null;
        resolve();
        return;
      }
      setTimeout(check, 10);
    };
    videoEl.onseeked = check;
    try {
      videoEl.currentTime = safeTime;
    } catch (e) {
      resolve();
      return;
    }
    check();
  });
}

function recoverFromFatal(msg) {
  isProcessing = false;
  detectionReady = false;
  if (activeFpsDetectorCancel) {
    try { activeFpsDetectorCancel(); } catch (e) {}
    activeFpsDetectorCancel = null;
  }
  updateDetectionActions();
  if (progressBar) progressBar.classList.remove("visible");
  if (progressLabel) progressLabel.textContent = t("errorPrefix") + msg;
  if (dropZone) dropZone.classList.remove("hidden");
  if (canvasWrap) canvasWrap.style.display = "none";
  hidePlaybackControls();
}

window.addEventListener("unhandledrejection", (ev) => {
  const msg = String((ev.reason && ev.reason.message) || ev.reason);
  log("error", "Unhandled promise rejection", { reason: msg });
  if (isProcessing) recoverFromFatal(msg);
});

window.addEventListener("error", (ev) => {
  log("error", "Uncaught error", { message: ev.message, source: ev.filename, line: ev.lineno });
  if (isProcessing) recoverFromFatal(ev.message);
});

// ============================
// DETECT SOURCE FPS
// ============================
let activeFpsDetectorCancel = null;

function detectSourceFps(videoEl) {
  if (activeFpsDetectorCancel) {
    try { activeFpsDetectorCancel(); } catch (e) {}
    activeFpsDetectorCancel = null;
  }

  return new Promise((resolve) => {
    if (!videoEl || typeof videoEl.requestVideoFrameCallback !== "function") {
      resolve(30);
      return;
    }

    const times = [];
    let handle = null;
    let resolved = false;
    let safetyTimer = null;

    const cleanup = () => {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      if (handle != null && typeof videoEl.cancelVideoFrameCallback === "function") {
        try { videoEl.cancelVideoFrameCallback(handle); } catch (e) {}
        handle = null;
      }
      if (activeFpsDetectorCancel === cancelFn) {
        activeFpsDetectorCancel = null;
      }
    };

    const finish = (fps) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try { videoEl.pause(); } catch (e) {}
      const safe = (Number.isFinite(fps) && fps > 0 && fps < 240) ? fps : 30;
      resolve(Math.round(safe * 100) / 100);
    };

    const cancelFn = () => {
      finish(30);
    };
    activeFpsDetectorCancel = cancelFn;

    // Safety timeout: 3500ms max
    safetyTimer = setTimeout(() => {
      log("video", "detectSourceFps safety timeout reached", { capturedCount: times.length });
      if (times.length >= 6) {
        const dt = times[times.length - 1] - times[0];
        if (dt > 0) {
          const est = (times.length - 1) / dt;
          if (Number.isFinite(est) && est > 5 && est < 240) {
            finish(est);
            return;
          }
        }
      }
      finish(30);
    }, 3500);

    const handler = (now, metadata) => {
      if (resolved) return;
      if (metadata && typeof metadata.mediaTime === "number") {
        times.push(metadata.mediaTime);
      }
      if (times.length >= 12) {
        const dt = times[times.length - 1] - times[0];
        if (dt > 0) finish((times.length - 1) / dt);
        else finish(30);
      } else {
        try {
          handle = videoEl.requestVideoFrameCallback(handler);
        } catch (e) {
          finish(30);
        }
      }
    };

    try {
      handle = videoEl.requestVideoFrameCallback(handler);
      videoEl.muted = true;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => finish(30));
      }
    } catch (e) {
      finish(30);
    }
  });
}

// ============================
// BLOB DETECTION HELPERS
// ============================
function findBracketingFrames(time) {
  const data = all_frame_data;
  if (!data.length) return { prev: null, next: null };
  if (time <= data[0].time) return { prev: data[0], next: data[1] || data[0] };
  if (time >= data[data.length - 1].time) return { prev: data[data.length - 1], next: null };
  let lo = 0, hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid].time <= time) lo = mid; else hi = mid;
  }
  return { prev: data[lo], next: data[hi] };
}

function interpolateBlobs(prev, next, time) {
  if (!prev) return next ? next.blobs : [];
  if (!next || prev === next || Math.abs(prev.time - next.time) < 0.001) return prev.blobs;
  const t = (time - prev.time) / (next.time - prev.time);
  const map = new Map();
  for (const b of prev.blobs) map.set(b.id, b);
  for (const b of next.blobs) if (!map.has(b.id)) map.set(b.id, b);
  const result = [];
  for (const [, b] of map) {
    const p = prev.blobs.find(x => x.id === b.id);
    const n = next.blobs.find(x => x.id === b.id);
    if (p && n) {
      result.push({
        ...p, x: p.x + (n.x - p.x) * t, y: p.y + (n.y - p.y) * t,
        bx: p.bx + (n.bx - p.bx) * t, by: p.by + (n.by - p.by) * t,
        bw: p.bw + (n.bw - p.bw) * t, bh: p.bh + (n.bh - p.bh) * t,
        area: Math.round(p.area + (n.area - p.area) * t),
      });
    } else if (p) result.push({ ...p });
    else if (n) result.push({ ...n });
  }
  return result;
}

function getContourPts(b) { return b.pts || []; }

// ============================
// PLAYBACK + CURRENT FRAME PREVIEW
// ============================
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function setProbeStatus(text, visible = true) {
  if (!probeStatus) return;
  probeStatus.textContent = text || "";
  probeStatus.classList.toggle("visible", !!visible && !!text);
}

function clearCurrentFrameProbe() {
  currentFrameProbe = null;
  setProbeStatus("", false);
}

function showPlaybackControls() {
  if (playbackControls) playbackControls.classList.add("visible");
  updatePlaybackUi();
}

function hidePlaybackControls() {
  if (playbackControls) playbackControls.classList.remove("visible");
  pendingProbeOnPause = false;
  clearCurrentFrameProbe();
}

function updatePlaybackUi() {
  if (!video || !timeline || !timeReadout || !playToggle) return;
  const dur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
  const time = (Number.isFinite(video.currentTime) && video.currentTime > 0) ? Math.min(video.currentTime, dur) : 0;
  if (!timelineDragging) {
    timeline.value = dur > 0 ? String(Math.round((time / dur) * 1000)) : "0";
  }
  timeReadout.textContent = formatTime(time) + " / " + formatTime(dur);

  const isPaused = video.paused;
  playToggle.textContent = isPaused ? "▶" : "⏸";
  const playTx = isPaused ? t("playAction") : t("pauseAction");
  playToggle.title = playTx;
  playToggle.setAttribute("aria-label", playTx);

  if (stepBackBtn) {
    const sbTx = t("stepBackAction");
    stepBackBtn.title = sbTx;
    stepBackBtn.setAttribute("aria-label", sbTx);
  }
  if (stepFwdBtn) {
    const sfTx = t("stepFwdAction");
    stepFwdBtn.title = sfTx;
    stepFwdBtn.setAttribute("aria-label", sfTx);
  }

  if (muteToggle) {
    const muted = !!video.muted;
    muteToggle.textContent = muted ? "🔇" : "🔊";
    const key = muted ? "unmute" : "mute";
    const tx = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || (muted ? "Unmute" : "Mute");
    muteToggle.title = tx;
    muteToggle.setAttribute("aria-label", tx);
  }
}

function getCurrentPreviewBlobs(time) {
  if (currentFrameProbe && video.paused) {
    const tolerance = Math.max(0.08, 1 / Math.max(1, getEffectiveFps()));
    if (Math.abs(currentFrameProbe.time - time) <= tolerance) return currentFrameProbe.blobs;
  }
  const { prev, next } = findBracketingFrames(time);
  return interpolateBlobs(prev, next, time);
}

function renderCurrentFrame(options = {}) {
  if (!video || video.readyState < 2 || !canvas.width || !canvas.height) return [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const time = video.currentTime || 0;
  const blobs = getCurrentPreviewBlobs(time);

  drawEffectLayer(ctx, blobs);
  drawLinesLayer(ctx, blobs);
  drawCentroidDots(ctx, blobs);
  drawLabelsLayer(ctx, blobs);

  drawPostFx(ctx, canvas.width, canvas.height);

  if (options.recordTelemetry) {
    Telemetry.record(blobs.length);
    Telemetry.render();
  }
  updatePlaybackUi();
  return blobs;
}

window.renderCurrentFrame = renderCurrentFrame;

function renderPausedFrameSoon() {
  if (isProcessing || isExporting || !currentVideoURL) return;
  requestAnimationFrame(() => {
    if (!isProcessing && !isExporting && video.readyState >= 2) renderCurrentFrame();
  });
}

function handlePresetChanged(container) {
  if (container === "sensitivity-preset" || container === "object-size-preset") {
    scheduleCurrentFrameProbe();
    updateDetectionActions();
  }
}

function handleParamChanged(stateKey) {
  if (stateKey === "outputFps" || stateKey === "outputCodec") return;
  if (!currentVideoURL || isProcessing || isExporting) return;
  if (DETECTION_PARAM_KEYS.has(stateKey)) {
    scheduleCurrentFrameProbe();
    updateDetectionActions();
    return;
  }
  renderPausedFrameSoon();
}

function scheduleCurrentFrameProbe() {
  if (!currentVideoURL || isProcessing || isExporting) return;
  if (liveProbeTimer) clearTimeout(liveProbeTimer);
  clearCurrentFrameProbe();
  if (!video.paused) {
    pendingProbeOnPause = true;
    setProbeStatus(t("probeUnavailable"), true);
    return;
  }
  pendingProbeOnPause = false;
  if (P.detector === "motion") {
    setProbeStatus(t("probeSkippedMotion"), true);
    renderPausedFrameSoon();
    return;
  }
  setProbeStatus(t("probingFrame"), true);
  liveProbeTimer = setTimeout(runCurrentFrameProbe, 180);
}

function runCurrentFrameProbe() {
  liveProbeTimer = null;
  const runId = ++liveProbeRunId;
  if (!cvReady || !currentVideoURL || isProcessing || isExporting || !video.paused || video.readyState < 2) return;
  if (P.detector === "motion") {
    setProbeStatus(t("probeSkippedMotion"), true);
    return;
  }
  let mat = null;
  try {
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    mat = cv.imread(tempCanvas);
    const cts = detectContours(mat);
    if (runId !== liveProbeRunId) return;
    const tracker = new CentroidTracker(Math.hypot(canvas.width, canvas.height));
    const blobs = tracker.update(cts).map(b => ({ ...b }));
    currentFrameProbe = { time: video.currentTime || 0, blobs };
    renderCurrentFrame();
    setProbeStatus(t("probeReady", { count: blobs.length }), true);
    log("detect", "Current-frame probe complete", { time: currentFrameProbe.time, blobs: blobs.length, detector: P.detector });
  } catch (e) {
    setProbeStatus("Probe failed: " + e.message, true);
    log("detect", "Current-frame probe failed", { error: e.message });
  } finally {
    if (mat) mat.delete();
  }
}

async function togglePlay() {
  if (!video || !currentVideoURL || isProcessing || isExporting) return;
  if (video.paused) {
    clearCurrentFrameProbe();
    await video.play().catch(e => log("video", "Play failed", { error: e.message }));
  } else {
    video.pause();
    renderCurrentFrame();
  }
  updatePlaybackUi();
}

function stepVideo(forward = true, seconds = null) {
  if (!video || !currentVideoURL || isProcessing || isExporting) return;
  if (!video.paused) {
    video.pause();
  }
  clearCurrentFrameProbe();
  const fps = Math.max(1, sourceFps || 30);
  const delta = (typeof seconds === "number" && seconds > 0) ? seconds : (1 / fps);
  const dur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
  const cur = (Number.isFinite(video.currentTime) && video.currentTime > 0) ? video.currentTime : 0;
  const target = forward
    ? Math.min(Math.max(0, dur - 0.001), cur + delta)
    : Math.max(0, cur - delta);
  video.currentTime = target;
  updatePlaybackUi();
  renderPausedFrameSoon();
}

function toggleFullscreen() {
  const target = document.getElementById("canvas-wrap") || document.documentElement;
  if (!document.fullscreenElement) {
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function setupPlaybackControls() {
  if (!playToggle || !timeline) return;
  playToggle.addEventListener("click", togglePlay);

  if (stepBackBtn) {
    stepBackBtn.addEventListener("click", () => stepVideo(false));
  }
  if (stepFwdBtn) {
    stepFwdBtn.addEventListener("click", () => stepVideo(true));
  }
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", toggleFullscreen);
  }

  if (muteToggle) {
    muteToggle.addEventListener("click", () => {
      if (!currentVideoURL) return;
      video.muted = !video.muted;
      updatePlaybackUi();
    });
    video.addEventListener("volumechange", updatePlaybackUi);
    video.muted = false;
  }

  timeline.addEventListener("input", () => {
    if (!currentVideoURL || isProcessing || isExporting) return;
    timelineDragging = true;
    const dur = (Number.isFinite(video.duration) && video.duration > 0) ? video.duration : 0;
    const val = Number(timeline.value);
    const ratio = (Number.isFinite(val) && val >= 0) ? Math.min(1000, val) / 1000 : 0;
    const nextTime = dur > 0 ? ratio * dur : 0;
    video.pause();
    clearCurrentFrameProbe();
    video.currentTime = Math.min(Math.max(0, nextTime), Math.max(0, dur - 0.001));
    updatePlaybackUi();
  });

  timeline.addEventListener("change", () => {
    timelineDragging = false;
    renderPausedFrameSoon();
  });

  video.addEventListener("play", () => {
    clearCurrentFrameProbe();
    updatePlaybackUi();
  });
  video.addEventListener("pause", () => {
    updatePlaybackUi();
    if (pendingProbeOnPause && !isProcessing && !isExporting) {
      scheduleCurrentFrameProbe();
      return;
    }
    if (!isProcessing && !isExporting) renderPausedFrameSoon();
  });
  video.addEventListener("timeupdate", updatePlaybackUi);
  video.addEventListener("durationchange", updatePlaybackUi);
  video.addEventListener("seeked", () => {
    timelineDragging = false;
    if (!isProcessing && !isExporting && video.paused) renderCurrentFrame();
    updatePlaybackUi();
  });

  video.addEventListener("error", () => {
    if (!currentVideoURL) return;
    const err = video.error;
    const msg = err && err.message ? err.message : (err ? `Code ${err.code}` : "Unknown playback error");
    log("video", "Playback runtime error", { error: msg });
    recoverFromFatal(msg);
    alert(t("videoPlaybackError", { msg }));
  });

  window.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    const tag = activeEl && activeEl.tagName ? activeEl.tagName.toLowerCase() : "";
    const isInput = tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || (activeEl && activeEl.isContentEditable);

    if (e.key === "Escape") {
      hideActiveTip();
      clearTipHoverTimer();
      clearTipHideTimer();
      if (activeEl && typeof activeEl.blur === "function") {
        activeEl.blur();
      }
      return;
    }

    if (!video || !currentVideoURL || isProcessing || isExporting) return;

    if (e.key === " " || e.code === "Space") {
      if (isInput) return;
      e.preventDefault();
      togglePlay();
      return;
    }

    if (isInput) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepVideo(false, e.shiftKey ? 1.0 : null);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepVideo(true, e.shiftKey ? 1.0 : null);
      return;
    }

    if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.key === "j" || e.key === "J") {
      e.preventDefault();
      stepVideo(false, e.shiftKey ? 1.0 : null);
      return;
    }
    if (e.key === "l" || e.key === "L") {
      e.preventDefault();
      stepVideo(true, e.shiftKey ? 1.0 : null);
      return;
    }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
  });
}

// ============================
// CENTROID TRACKER
// ============================
class CentroidTracker {
  constructor(maxDist) {
    this.maxDist = maxDist;
    this.nextId = 1;
    this.tracks = new Map();
  }
  update(detections) {
    const tracks = this.tracks;
    const matched = new Set();
    for (const d of detections) {
      let bestId = null, bestDist = this.maxDist;
      for (const [id, t] of tracks) {
        if (matched.has(id)) continue;
        const dx = d.x - t.x, dy = d.y - t.y;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) { bestDist = dist; bestId = id; }
      }
      if (bestId !== null) {
        matched.add(bestId);
        const t = tracks.get(bestId);
        const ema = 0.6;
        t.x = d.x * (1 - ema) + t.x * ema;
        t.y = d.y * (1 - ema) + t.y * ema;
        t.bx = d.bx; t.by = d.by; t.bw = d.bw; t.bh = d.bh;
        t.area = d.area; t.pts = d.pts; t.missed = 0;
        d.id = bestId;
      } else {
        const id = this.nextId++;
        tracks.set(id, { x: d.x, y: d.y, bx: d.bx, by: d.by, bw: d.bw, bh: d.bh, area: d.area, pts: d.pts, missed: 0 });
        d.id = id;
      }
    }
    for (const [id, t] of tracks) {
      if (!matched.has(id)) {
        t.missed++;
        if (t.missed > 5) tracks.delete(id);
      }
    }
    return detections;
  }
}

// ============================
// DETECTION PIPELINE
// ============================
function contoursFromMask(mask) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const result = [];
  const minArea = Math.min(Number.isFinite(P.blobMin) ? P.blobMin : 0, Number.isFinite(P.blobMax) ? P.blobMax : Infinity);
  const maxArea = Math.max(Number.isFinite(P.blobMin) ? P.blobMin : 0, Number.isFinite(P.blobMax) ? P.blobMax : Infinity);
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    const rect = cv.boundingRect(c);
    const filterArea = Math.max(area, rect.width * rect.height);
    if (filterArea < minArea || filterArea > maxArea) continue;
    const m = cv.moments(c);
    let cx, cy;
    if (m.m00 === 0) { cx = rect.x + rect.width / 2; cy = rect.y + rect.height / 2; }
    else { cx = Math.round(m.m10 / m.m00); cy = Math.round(m.m01 / m.m00); }
    const pts = [];
    for (let j = 0; j < c.rows; j++) pts.push({ x: c.data32S[j * 2], y: c.data32S[j * 2 + 1] });
    result.push({ x: cx, y: cy, area: filterArea, bx: rect.x, by: rect.y, bw: rect.width, bh: rect.height, pts });
  }
  contours.delete();
  hierarchy.delete();
  return result;
}

function detectEdge(frameMat) {
  const cannyLow = Math.min(Number.isFinite(P.cannyLow) ? P.cannyLow : 50, Number.isFinite(P.cannyHigh) ? P.cannyHigh : 150);
  const cannyHigh = Math.max(Number.isFinite(P.cannyLow) ? P.cannyLow : 50, Number.isFinite(P.cannyHigh) ? P.cannyHigh : 150);
  if (P.useGPU && GPU.ready) {
    try {
      const edgeMap = gpuCanny(tempCanvas, cannyLow, cannyHigh, P.blurKernel / 3.0);
      if (edgeMap) {
        const w = tempCanvas.width, h = tempCanvas.height;
        const mat = new cv.Mat(h, w, cv.CV_8UC1);
        mat.data.set(edgeMap);
        const kernelClose = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        const closed = new cv.Mat();
        cv.morphologyEx(mat, closed, cv.MORPH_CLOSE, kernelClose);
        kernelClose.delete();
        let mask = closed;
        let mergeKernel = null;
        let gpuMask = null;
        if (P.mergeKernel > 1) {
          const mk = Math.max(1, Math.round(P.mergeKernel));
          const odd = mk % 2 === 0 ? mk + 1 : mk;
          const radius = Math.min(16, (odd - 1) >> 1);
          if (radius >= 1 && GPU.programDilate) {
            gpuEnsureSize(w, h);
            uploadMaskToTexture(GPU.gl, GPU.textureB, w, h, closed.data);
            const ok = gpuDilate(w, h, radius);
            if (ok) {
              const dilated = readMaskFromTexture(w, h);
              gpuMask = new cv.Mat(h, w, cv.CV_8UC1);
              gpuMask.data.set(dilated);
              mask = gpuMask;
            } else {
              mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
              mask = new cv.Mat();
              cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), 1);
            }
          } else {
            mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
            mask = new cv.Mat();
            cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), 1);
          }
        }
        mat.delete();
        const result = contoursFromMask(mask);
        if (mask !== closed) mask.delete();
        if (gpuMask) gpuMask.delete();
        if (mergeKernel) mergeKernel.delete();
        closed.delete();
        return result;
      }
    } catch (e) {
      log("gpu", "GPU pipeline failed, falling back to CPU", { error: e.message });
    }
  }
  const gray = new cv.Mat();
  if (P.colorChannel === 0) {
    cv.cvtColor(frameMat, gray, cv.COLOR_RGBA2GRAY);
  } else {
    const channels = new cv.MatVector();
    cv.split(frameMat, channels);
    const chIdx = [2, 1, 0, 3][P.colorChannel];
    const ch = channels.get(chIdx);
    gray.set(ch);
    for (let i = 0; i < channels.size(); i++) channels.get(i).delete();
    channels.delete();
  }
  const blurred = new cv.Mat();
  const ksize = P.blurKernel % 2 === 0 ? P.blurKernel + 1 : P.blurKernel;
  cv.GaussianBlur(gray, blurred, new cv.Size(ksize, ksize), 0, 0);
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, cannyLow, cannyHigh);
  gray.delete(); blurred.delete();

  const kernelClose = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const closed = new cv.Mat();
  cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernelClose);
  edges.delete(); kernelClose.delete();

  let mask = closed;
  let mergeKernel = null;
  if (P.mergeKernel > 1) {
    const mk = Math.max(1, Math.round(P.mergeKernel));
    const odd = mk % 2 === 0 ? mk + 1 : mk;
    mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
    mask = new cv.Mat();
    cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), 1);
  }
  const result = contoursFromMask(mask);
  if (mask !== closed) mask.delete();
  if (mergeKernel) mergeKernel.delete();
  closed.delete();
  return result;
}

function detectMotionDiff(frameMat) {
  const gray = new cv.Mat();
  cv.cvtColor(frameMat, gray, cv.COLOR_RGBA2GRAY);
  if (!detectMotionDiff._prev) { detectMotionDiff._prev = gray.clone(); gray.delete(); return []; }
  const diff = new cv.Mat();
  cv.absdiff(gray, detectMotionDiff._prev, diff);
  detectMotionDiff._prev.delete();
  detectMotionDiff._prev = gray.clone();
  const thresh = new cv.Mat();
  cv.threshold(diff, thresh, P.motionThresh || 30, 255, cv.THRESH_BINARY);
  diff.delete();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);
  cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, kernel);
  kernel.delete();
  const result = contoursFromMask(thresh);
  thresh.delete();
  return result;
}

function detectColorHsv(frameMat) {
  const hsv = new cv.Mat();
  cv.cvtColor(frameMat, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
  const lower = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [P.hsvH || 0, P.hsvS || 50, P.hsvV || 50, 0]);
  const upper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [P.hsvH2 || 180, P.hsvS2 || 255, P.hsvV2 || 255, 255]);
  const mask = new cv.Mat();
  cv.inRange(hsv, lower, upper, mask);
  hsv.delete(); lower.delete(); upper.delete();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
  kernel.delete();
  const result = contoursFromMask(mask);
  mask.delete();
  return result;
}

function detectContourArea(frameMat) {
  const gray = new cv.Mat();
  cv.cvtColor(frameMat, gray, cv.COLOR_RGBA2GRAY);
  const thresh = new cv.Mat();
  if (P.otsuAuto) {
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
  } else {
    cv.threshold(gray, thresh, P.fixedThresh || 128, 255, cv.THRESH_BINARY);
  }
  gray.delete();
  const result = contoursFromMask(thresh);
  thresh.delete();
  return result;
}

function detectContours(frameMat) {
  switch (P.detector) {
    case "motion": return detectMotionDiff(frameMat);
    case "hsv": return detectColorHsv(frameMat);
    case "area": return detectContourArea(frameMat);
    default: return detectEdge(frameMat);
  }
}

// ============================
// DETECT BLOBS
// ============================
async function detectBlobs() {
  isProcessing = true;
  cancelRequested = false;
  const t0 = performance.now();
  const fps = getEffectiveFps();
  log("detect", "detectBlobs started", { params: { ...P }, dim: canvas.width + "x" + canvas.height, effectiveFps: fps });
  const tf = Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration * fps) : 0;
  all_frame_data = [];
  let lastTs = Date.now();
  const tracker = new CentroidTracker(Math.hypot(canvas.width, canvas.height));

  let fastSink = null;
  let sampleIterator = null;
  let useFastDecoder = false;
  if (window.MediaCodecs && currentVideoFile) {
    try {
      const input = new window.MediaCodecs.Input({
        source: new window.MediaCodecs.BlobSource(currentVideoFile),
        formats: window.MediaCodecs.ALL_FORMATS,
      });
      const videoTrack = await input.getPrimaryVideoTrack();
      const decodable = videoTrack && (typeof videoTrack.canDecode !== "function" || await videoTrack.canDecode());
      if (videoTrack && decodable) {
        fastSink = new window.MediaCodecs.VideoSampleSink(videoTrack);
        const timestamps = Array.from({ length: tf + 1 }, (_, k) => k / fps);
        sampleIterator = fastSink.samplesAtTimestamps(timestamps)[Symbol.asyncIterator]();
        useFastDecoder = true;
        log("detect", "WebCodecs fast decoder initialized", { tf, fps });
      }
    } catch (err) {
      log("detect", "Fast decoder init failed, using video seek fallback", { error: String(err) });
      useFastDecoder = false;
    }
  }

  try {
    for (let i = 0; i <= tf; i++) {
      if (cancelRequested) {
        log("detect", "detectBlobs cancelled by user", { frame: i, total: tf });
        break;
      }

      let frameDrawn = false;
      if (useFastDecoder && sampleIterator) {
        try {
          const next = await sampleIterator.next();
          const sample = next && next.value;
          if (sample) {
            try {
              sample.draw(tempCtx, 0, 0, canvas.width, canvas.height);
              frameDrawn = true;
            } finally {
              sample.close();
            }
          }
        } catch (err) {
          log("detect", "Error reading fast sample frame " + i + ", falling back to video seek", { error: String(err) });
          useFastDecoder = false;
        }
      }

      if (!frameDrawn) {
        video.currentTime = i / fps;
        await new Promise(r => {
          let a = 0;
          const ch = () => {
            if (!video.seeking) r();
            else if (a++ > 500) r();
            else setTimeout(ch, 10);
          };
          video.onseeked = ch;
          ch();
        });
        if (cancelRequested) {
          log("detect", "detectBlobs cancelled by user", { frame: i, total: tf });
          break;
        }
        tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      if (cancelRequested) {
        log("detect", "detectBlobs cancelled by user", { frame: i, total: tf });
        break;
      }

      let mat;
      try {
        mat = cv.imread(tempCanvas);
      } catch (e) {
        log("detect", "cv.imread failed frame " + i);
        continue;
      }
      const cts = detectContours(mat);
      mat.delete();
      const blobs = tracker.update(cts);
      all_frame_data.push({ time: i / fps, blobs: structuredClone(blobs), frameIndex: i });
      const pc = Math.round(i / tf * 100);
      progressFill.style.width = pc + "%";
      if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(Math.max(0, Math.min(100, pc))));
      progressLabel.textContent = t("detecting") + " " + pc + "%";

      if (i % 4 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }

      const now = Date.now();
      if (now - lastTs > 10000) {
        log("detect", "Still running after 10s", { frame: i, total: tf, pct: pc });
        lastTs = now;
      }
    }
  } finally {
    isProcessing = false;
    if (sampleIterator && typeof sampleIterator.return === "function") {
      try {
        await sampleIterator.return();
      } catch (e) {}
    }
  }

  if (cancelRequested) {
    progressLabel.textContent = t("detectionCancelled");
  }
  const elapsed = formatNumber((performance.now() - t0) / 1000, 1);
  log("detect", "detectBlobs complete", {
    frames: all_frame_data.length,
    blobs_total: all_frame_data.reduce((s, f) => s + f.blobs.length, 0),
    elapsed_s: elapsed,
    cancelled: cancelRequested,
    decoder: useFastDecoder ? "webcodecs" : "video-seek",
  });
}

// ============================
// START PROCESSING
// ============================
async function prepareVideo(videoURL) {
  log("video", "prepareVideo called", { params: { ...P } });
  if (activeFpsDetectorCancel) {
    try { activeFpsDetectorCancel(); } catch (e) {}
    activeFpsDetectorCancel = null;
  }
  if (currentVideoURL && currentVideoURL !== videoURL && currentVideoURL.startsWith("blob:")) {
    try { URL.revokeObjectURL(currentVideoURL); } catch (e) {}
  }
  currentVideoURL = videoURL;
  all_frame_data = [];
  detectionReady = false;
  isProcessing = true;
  cancelRequested = false;
  updateDetectionActions();
  dropZone.classList.add("hidden");
  canvasWrap.style.display = "block";
  progressBar.classList.add("visible");
  progressFill.style.width = "0%";
  if (progressTrack) progressTrack.setAttribute("aria-valuenow", "0");
  progressLabel.textContent = t("loadingVideo");
  if (exportOverlay) exportOverlay.classList.remove("visible");
  hidePlaybackControls();
  Telemetry.hide();
  Telemetry.reset();
  try {
    await loadVideoMetadata(video, videoURL);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error("Video has zero frame size — file may be corrupted.");
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error(t("videoCorrupted") || "Video has zero or invalid duration — file may be corrupted.");
    }
    const scale = MAX_PREVIEW_DIM / Math.min(vw, vh);
    const targetW = Math.round(vw * scale), targetH = Math.round(vh * scale);
    canvas.width = targetW;
    canvas.height = targetH;
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    progressLabel.textContent = t("detectingFps");
    sourceFps = await detectSourceFps(video);
    log("video", "Detected source FPS", { sourceFps });
    updateOutputFpsInfo();
    await seekVideo(video, 0);
    video.loop = false;
    video.pause();
    renderCurrentFrame();
    if (exportOverlay) exportOverlay.classList.add("visible");
    showPlaybackControls();
    updateDetectionActions();
  } catch (e) {
    const msg = (e && e.message) || String(e);
    log("video", "prepareVideo failed", { error: msg });
    if (videoURL && videoURL.startsWith("blob:")) {
      try { URL.revokeObjectURL(videoURL); } catch (err) {}
      if (currentVideoURL === videoURL) currentVideoURL = null;
    }
    recoverFromFatal(msg);
    alert(t("failedProcess", { msg }));
  } finally {
    isProcessing = false;
    progressBar.classList.remove("visible");
    updateDetectionActions();
  }
}

async function startProcessing(videoURL) {
  if (!cvReady) { alert(t("openCvLoading")); return; }
  log("video", "startProcessing called", { params: { ...P } });
  if (activeFpsDetectorCancel) {
    try { activeFpsDetectorCancel(); } catch (e) {}
    activeFpsDetectorCancel = null;
  }
  if (currentVideoURL && currentVideoURL !== videoURL && currentVideoURL.startsWith("blob:")) {
    try { URL.revokeObjectURL(currentVideoURL); } catch (e) {}
  }
  currentVideoURL = videoURL;
  all_frame_data = [];
  detectionReady = false;
  updateDetectionActions();
  isProcessing = true;
  cancelRequested = false;
  dropZone.classList.add("hidden");
  canvasWrap.style.display = "block";
  progressBar.classList.add("visible");
  showCancelDetect();
  progressFill.style.width = "0%";
  if (progressTrack) progressTrack.setAttribute("aria-valuenow", "0");
  progressLabel.textContent = t("loadingVideo");
  if (exportOverlay) exportOverlay.classList.remove("visible");
  hidePlaybackControls();
  Telemetry.hide();
  Telemetry.reset();
  try {
    await loadVideoMetadata(video, videoURL);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error("Video has zero frame size — file may be corrupted.");
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error(t("videoCorrupted") || "Video has zero or invalid duration — file may be corrupted.");
    }
    const scale = MAX_PREVIEW_DIM / Math.min(vw, vh);
    const targetW = Math.round(vw * scale), targetH = Math.round(vh * scale);
    canvas.width = targetW;
    canvas.height = targetH;
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    progressLabel.textContent = t("detectingFps");
    sourceFps = await detectSourceFps(video);
    log("video", "Detected source FPS", { sourceFps });
    updateOutputFpsInfo();
    await detectBlobs();
    const _effFps = getEffectiveFps();
    for (let i = 0; i < all_frame_data.length; i++) all_frame_data[i].time = i / _effFps;
    detectionReady = !cancelRequested && all_frame_data.length > 0;
    if (detectionReady) saveDetectedParamsSnapshot();
    updateDetectionActions();
    await seekVideo(video, 0);
    if (exportOverlay) exportOverlay.classList.add("visible");
    showPlaybackControls();
    video.play();
    video.loop = true;
    Telemetry.setTargetFps(getEffectiveFps());
    Telemetry.show();
    requestAnimationFrame(drawLoop);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    log("video", "startProcessing failed", { error: msg });
    if (videoURL && videoURL.startsWith("blob:") && videoURL !== currentVideoURL) {
      try { URL.revokeObjectURL(videoURL); } catch (err) {}
    }
    recoverFromFatal(msg);
    alert(t("failedProcess", { msg }));
  } finally {
    isProcessing = false;
    progressBar.classList.remove("visible");
    hideCancelDetect();
    if (currentVideoURL && video.readyState >= 2) showPlaybackControls();
    updateDetectionActions();
  }
}

// ============================
// MAIN DRAW LOOP
// ============================
function drawLoop() {
  if (!video || video.readyState < 2) { requestAnimationFrame(drawLoop); return; }
  if (video.paused && !isExporting) { updatePlaybackUi(); requestAnimationFrame(drawLoop); return; }
  renderCurrentFrame({ recordTelemetry: true });

  requestAnimationFrame(drawLoop);
}

// ============================
// TOOLTIP SYSTEM
// ============================
let tipHoverTimer = null;
let tipHideTimer = null;
let activeTipAnchor = null;
let tooltipsInitialized = false;

function clearTipHoverTimer() {
  if (tipHoverTimer) {
    clearTimeout(tipHoverTimer);
    tipHoverTimer = null;
  }
}

function clearTipHideTimer() {
  if (tipHideTimer) {
    clearTimeout(tipHideTimer);
    tipHideTimer = null;
  }
}

function placeTip(popup, source) {
  const pad = 12; // 8-12px safe margin from viewport edge
  const gap = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  popup.style.left = "0px";
  popup.style.top = "0px";
  popup.style.transform = "none";
  const tipRect = popup.getBoundingClientRect();
  const tipW = tipRect.width;
  const tipH = tipRect.height;

  let anchorRect;
  if (source && typeof source.getBoundingClientRect === "function") {
    anchorRect = source.getBoundingClientRect();
  } else if (source && typeof source.clientX === "number" && typeof source.clientY === "number") {
    anchorRect = {
      left: source.clientX,
      right: source.clientX,
      top: source.clientY,
      bottom: source.clientY,
      width: 0,
      height: 0
    };
  } else {
    anchorRect = {
      left: vw / 2,
      right: vw / 2,
      top: vh / 2,
      bottom: vh / 2,
      width: 0,
      height: 0
    };
  }

  // --- Horizontal Placement ---
  // If anchor is on right half of viewport (sidebar panel), place to the left if space permits
  let x;
  const spaceLeft = anchorRect.left - gap;
  const spaceRight = vw - (anchorRect.right + gap);

  if (anchorRect.left > vw / 2) {
    if (spaceLeft >= tipW + pad) {
      x = anchorRect.left - gap - tipW;
    } else if (spaceRight >= tipW + pad) {
      x = anchorRect.right + gap;
    } else {
      x = vw - tipW - pad;
    }
  } else {
    if (spaceRight >= tipW + pad) {
      x = anchorRect.right + gap;
    } else if (spaceLeft >= tipW + pad) {
      x = anchorRect.left - gap - tipW;
    } else {
      x = pad;
    }
  }
  x = Math.max(pad, Math.min(x, vw - tipW - pad));

  // --- Vertical Placement ---
  let y = anchorRect.top;
  if (y + tipH > vh - pad) {
    const spaceAbove = anchorRect.top - gap;
    if (spaceAbove >= tipH + pad) {
      y = anchorRect.top - gap - tipH;
    } else {
      y = vh - tipH - pad;
    }
  }
  y = Math.max(pad, Math.min(y, vh - tipH - pad));

  popup.style.left = Math.round(x) + "px";
  popup.style.top = Math.round(y) + "px";
}

function isPopoverOpen(el) {
  if (!el) return false;
  try {
    return typeof el.matches === "function" && el.matches(":popover-open");
  } catch (_) {
    return false;
  }
}

function showTip(text, source) {
  const el = document.getElementById("tip-popup");
  const txt = document.getElementById("tip-popup-text");
  if (!el || !txt) return;
  clearTipHideTimer();

  if (activeTipAnchor && activeTipAnchor !== source && activeTipAnchor.style) {
    try { activeTipAnchor.style.anchorName = ""; } catch (_) {}
  }
  activeTipAnchor = source;
  if (source && source.style) {
    try { source.style.anchorName = "--active-tip"; } catch (_) {}
  }

  txt.textContent = text;
  el.setAttribute("aria-hidden", "false");
  el.classList.add("visible");

  if (typeof el.showPopover === "function") {
    try {
      if (!isPopoverOpen(el)) {
        el.showPopover();
      }
    } catch (_) {
      try { el.showPopover(); } catch (_) {}
    }
  }

  const supportsAnchor = typeof CSS !== "undefined" && typeof CSS.supports === "function" && (CSS.supports("anchor-name", "--a") || CSS.supports("anchor-name: --a"));
  if (supportsAnchor) {
    el.style.left = "";
    el.style.top = "";
  } else {
    requestAnimationFrame(() => placeTip(el, source));
  }
}

function hideTip(immediate = false) {
  clearTipHoverTimer();
  const el = document.getElementById("tip-popup");
  if (!el) return;
  clearTipHideTimer();

  const doHide = () => {
    if (activeTipAnchor && activeTipAnchor.style && activeTipAnchor.style.anchorName) {
      try { activeTipAnchor.style.anchorName = ""; } catch (_) {}
    }
    activeTipAnchor = null;

    if (typeof el.hidePopover === "function") {
      try {
        if (isPopoverOpen(el)) {
          el.hidePopover();
        }
      } catch (_) {
        try { el.hidePopover(); } catch (_) {}
      }
    }
    el.classList.remove("visible");
    el.setAttribute("aria-hidden", "true");
  };

  if (immediate) {
    doHide();
  } else {
    tipHideTimer = setTimeout(doHide, 120);
  }
}

function setupTooltips() {
  if (tooltipsInitialized) return;
  tooltipsInitialized = true;

  document.querySelectorAll(".tip").forEach(el => {
    if (!TIP_TEXTS.en[el.id]) return;
    el.setAttribute("aria-describedby", "tip-popup-text");
    const text = () => (TIP_TEXTS[currentLang] || TIP_TEXTS.en)[el.id];

    // Hover intent: 260ms delay before opening to avoid accidental flashes
    el.addEventListener("mouseenter", () => {
      clearTipHoverTimer();
      const popup = document.getElementById("tip-popup");
      const isAlreadyVisible = popup && (popup.classList.contains("visible") || isPopoverOpen(popup));
      if (isAlreadyVisible) {
        showTip(text(), el);
      } else {
        tipHoverTimer = setTimeout(() => {
          tipHoverTimer = null;
          showTip(text(), el);
        }, 260);
      }
    });

    el.addEventListener("mouseleave", () => {
      clearTipHoverTimer();
      hideTip();
    });

    // Keyboard & focus accessibility
    el.addEventListener("focus", () => {
      clearTipHoverTimer();
      showTip(text(), el);
    });

    el.addEventListener("blur", () => {
      clearTipHoverTimer();
      hideTip();
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const popup = document.getElementById("tip-popup");
        if (popup && (popup.classList.contains("visible") || isPopoverOpen(popup)) && activeTipAnchor === el) {
          hideTip(true);
        } else {
          showTip(text(), el);
        }
      } else if (e.key === "Escape") {
        hideTip(true);
      }
    });

    // Touch device support
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const popup = document.getElementById("tip-popup");
      if (popup && (popup.classList.contains("visible") || isPopoverOpen(popup)) && activeTipAnchor === el) {
        hideTip(true);
        return;
      }
      clearTipHoverTimer();
      showTip(text(), el);
      clearTipHideTimer();
      tipHideTimer = setTimeout(() => hideTip(true), 5000);
    });
  });

  // Global Escape key listener to instantly hide any visible tooltip
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideTip(true);
    }
  });

  // Re-position tooltip on window resize if active
  window.addEventListener("resize", () => {
    const supportsAnchor = typeof CSS !== "undefined" && typeof CSS.supports === "function" && (CSS.supports("anchor-name", "--a") || CSS.supports("anchor-name: --a"));
    if (supportsAnchor) return;
    const el = document.getElementById("tip-popup");
    if (el && (el.classList.contains("visible") || isPopoverOpen(el)) && activeTipAnchor) {
      placeTip(el, activeTipAnchor);
    }
  }, { passive: true });
}

// ============================
// QUICK START PROGRESSIVE DISCLOSURE
// ============================
function initQuickStartCollapse() {
  const qsCard = document.getElementById("quickstart-card");
  if (!qsCard) return;
  try {
    const saved = localStorage.getItem("bt_quickstart_open");
    if (saved === "false") {
      qsCard.open = false;
    } else if (saved === "true") {
      qsCard.open = true;
    }
  } catch (_) {}

  qsCard.addEventListener("toggle", () => {
    try {
      localStorage.setItem("bt_quickstart_open", qsCard.open ? "true" : "false");
    } catch (_) {}
  });
}

// ============================
// RE-DETECT
// ============================
async function reDetect() {
  if (!currentVideoURL) return;
  if (!video.src) return;
  const wasDetectionReady = detectionReady;
  log("detect", wasDetectionReady ? "Re-detect triggered" : "Detection triggered", { params: { ...P } });
  detectionReady = false;
  updateDetectionActions();
  video.pause();
  video.loop = false;
  hidePlaybackControls();
  isProcessing = true;
  cancelRequested = false;
  progressBar.classList.add("visible");
  showCancelDetect();
  progressFill.style.width = "0%";
  if (progressTrack) progressTrack.setAttribute("aria-valuenow", "0");
  progressLabel.textContent = t(wasDetectionReady ? "redetecting" : "detecting");
  if (exportOverlay) exportOverlay.style.display = "none";
  try {
    await detectBlobs();
    const _effFps = getEffectiveFps();
    for (let i = 0; i < all_frame_data.length; i++) all_frame_data[i].time = i / _effFps;
    detectionReady = !cancelRequested && all_frame_data.length > 0;
    if (detectionReady) saveDetectedParamsSnapshot();
    updateDetectionActions();
    await seekVideo(video, 0);
    if (exportOverlay) {
      exportOverlay.classList.add("visible");
      exportOverlay.style.display = "";
    }
    showPlaybackControls();
    video.play();
    video.loop = true;
  } catch (e) {
    log("detect", "Re-detect failed", { error: e.message });
    alert(t("redetectFailed", { msg: e.message }));
  } finally {
    isProcessing = false;
    progressBar.classList.remove("visible");
    hideCancelDetect();
    updateDetectionActions();
  }
  log("detect", "Re-detect complete", { frames: all_frame_data.length, elapsed_s: "—", cancelled: cancelRequested });
}

exportBtn.addEventListener("click", () => {
  if (isExporting || isProcessing) return;
  if (!detectionReady) {
    switchToTab("track");
    return;
  }
  switchToTab("export");
  startExport();
});

redetectBtn.addEventListener("click", async () => {
  if (isProcessing || !currentVideoURL) return;
  if (!video.src) return;
  if (detectionReady) await reDetect();
  else await startProcessing(currentVideoURL);
});

// ============================
// DRAW HELPERS (lines, dots, labels)
// ============================
function drawLinesLayer(ctx, blobs) {
  const rate = P.connectionRate;
  if (rate <= 0 || !blobs.length) return;
  const maxDist = 280;
  ctx.strokeStyle = P.contourColor;
  ctx.globalAlpha = rate;
  ctx.lineWidth = 0.5;
  const style = P.connectionStyle;
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i], b = blobs[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist) continue;
      if (style === "nearest" && j > i + 1) continue;
      if (style === "chain" && j !== i + 1) continue;
      const alpha = (1 - dist / maxDist) * rate;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  if (style === "wave") {
    ctx.globalAlpha = rate;
    ctx.lineWidth = 1;
    for (let i = 0; i < blobs.length - 1; i++) {
      const a = blobs[i], b = blobs[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist) continue;
      const cpY = (a.y + b.y) / 2 - 20;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, cpY, b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawCentroidDots(ctx, blobs) {
  if (!P.centroidEnabled) return;
  ctx.fillStyle = P.contourColor;
  for (const b of blobs) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawLabelsLayer(ctx, blobs) {
  if (!P.textEnabled) return;
  const pos = P.textPosition;
  const content = P.textContent;
  ctx.font = (P.fontSize || 12) + "px monospace";
  ctx.fillStyle = P.contourColor;
  ctx.textAlign = "center";
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  for (const b of blobs) {
    let text;
    if (content === "random") {
      text = String.fromCharCode(65 + (b.id || 0) % 26);
    } else if (content === "position") {
      text = Math.round(b.x) + "," + Math.round(b.y);
    } else {
      text = String(b.id || 0);
    }
    let tx = b.x, ty = b.y;
    if (pos === "top") ty = b.by - 4;
    else if (pos === "bottom") ty = b.by + b.bh + (P.fontSize || 12) + 2;
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
  }
}

// ============================
// POST-FX
// ============================
const POSTFX = [];

function drawPostFx(ctx, w, h) {
  if (P.postFx === "off" || !POSTFX.length) return;
  const fx = POSTFX.find(f => f.id === P.postFx);
  if (fx) fx.draw(ctx, w, h);
}

// ============================
// INIT
// ============================
function initApp() {
  if (window.__openCvReady) onCvReady();
  if (window.__openCvError) onCvError(window.__openCvStatus && window.__openCvStatus.error);
  setupLanguageControls();
  setupPanelTabs();
  setupControls();
  setupTooltips();
  initQuickStartCollapse();
  setupPlaybackControls();
  applyLanguage();
  initGPU();
  revealMobileAudioNotice();
  Telemetry.el = document.getElementById("telemetry");
  Telemetry.setTargetFps(PROCESSING_FPS_DEFAULT);

  // Warn before navigation if processing or exporting
  window.addEventListener("beforeunload", (e) => {
    if (isProcessing || (typeof isExporting !== "undefined" && isExporting)) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });

  // Deep linking: restore state from URL query parameters
  try {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");
    if (initialTab && ["track", "style", "export"].includes(initialTab)) {
      switchToTab(initialTab);
    }
  } catch {}

  if (location.protocol === "file:") {
    console.warn("Running from file:// — use a local server (e.g. `npx serve .`).");
  }
  window.PRESETS = {};
  log("init", "Legacy presets skipped; built-in UI presets are active");

  appReady = true;
  hideLoad();
  log("init", "App initialized");
}

function revealMobileAudioNotice() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    (ua.indexOf("Mac") !== -1 && "ontouchend" in document && !window.MSStream);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const el = document.getElementById("mobile-audio-notice");
  if (el) el.hidden = !isMobile;
}

document.addEventListener("DOMContentLoaded", initApp);
