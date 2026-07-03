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

const PROCESSING_FPS_DEFAULT = 30;
let sourceFps = null;

const I18N = {
  en: {
    title: "Contour VFX Overlay - Blob Tracker",
    loadingTitle: "Loading blob_tracker...",
    loadingText: "Initializing OpenCV.js and preparing rendering pipeline...",
    dropTitle: "Drop a video file anywhere",
    dropSubtitle: "MP4, WebM, MOV - max 500 MB",
    uploadVideo: "Upload Video",
    appTitle: "Contour VFX Overlay",
    appSubtitle: "Blob tracking editor for video overlays",
    tabQuick: "Quick",
    tabStyle: "Style",
    tabDetect: "Detect",
    tabExport: "Export",
    quickStart: "Quick Start",
    guideUpload: "Upload a video or drop it onto the stage.",
    guideFind: "Choose detection sensitivity and object size.",
    guideStyle: "Pick a visual style.",
    guideDetect: "Click Start detection when settings are ready.",
    guideExport: "Review and export the tracked video.",
    findObjects: "Find Objects",
    sensitivity: "Sensitivity",
    objectSize: "Object Size",
    detector: "Detector",
    videoSpeed: "Video Speed",
    basicEffects: "Basic Effects",
    connection: "Connection",
    lineStyle: "Line Style",
    connectionRate: "Connection Rate",
    strokeWidth: "Stroke Width",
    blobSize: "Blob Size",
    detection: "Detection",
    colorChannel: "Color Channel",
    gpuAcceleration: "GPU Acceleration",
    grouping: "Grouping",
    colorText: "Color & Text",
    text: "Text",
    textPosition: "Text Position",
    textContentLabel: "Text Content",
    fontSize: "Font Size",
    color: "Color",
    centroid: "Centroid",
    showDots: "Show dots",
    output: "Output",
    outputFps: "Output FPS",
    codec: "Codec",
    low: "Low",
    normal: "Normal",
    high: "High",
    tiny: "Tiny",
    small: "Small",
    medium: "Medium",
    large: "Large",
    custom: "Custom",
    edge: "Edge",
    motion: "Motion",
    area: "Area",
    none: "None",
    full: "Full",
    detail: "Detail",
    grouped: "Grouped",
    red: "Red",
    greenShort: "Grn",
    blueShort: "Blu",
    min: "Min",
    max: "Max",
    merge: "Merge",
    passes: "Passes",
    center: "Center",
    top: "Top",
    bottom: "Bottom",
    random: "Random",
    position: "Position",
    count: "Count",
    source: "Source",
    preview: "Preview",
    trail: "Trail",
    resetDefaults: "Reset to defaults",
    copyDebugLog: "Copy debug log",
    copied: "Copied",
    startDetection: "Start detection",
    startDetectionTitle: "Start blob detection with current settings",
    redetect: "Re-detect",
    redetectTitle: "Re-run blob detection with current settings",
    sourceFpsLoading: "Source FPS: - (loading...)",
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
    cancelling: "Cancelling...",
    cancellingExport: "Cancelling export...",
    detecting: "Detecting...",
    detectionCancelled: "Detection cancelled",
    loadingVideo: "Loading video...",
    detectingFps: "Detecting source frame rate...",
    redetecting: "Re-detecting...",
    probingFrame: "Probing current frame...",
    probeReady: "Current frame preview: {count} blobs",
    probeSkippedMotion: "Motion detector needs full Re-detect",
    probeUnavailable: "Pause playback to preview detection changes",
    errorPrefix: "Error: ",
    resetTitle: "Reset to default",
    colorAria: "Color: {color}",
    tipFindAria: "Help: Find Objects",
    tipBlobAria: "Help: Blob Size",
    tipDetectAria: "Help: Detection",
    tipOutputAria: "Help: Output",
    tinyTitle: "For small distant objects",
    smallTitle: "Small objects only",
    nearestTitle: "Nearest neighbors",
    allTitle: "All connections",
    chainTitle: "Chain",
    waveTitle: "Waveform",
    effectBasic: "Basic",
    effectCross: "Cross",
    effectLabel: "Label",
    effectFrame: "Frame",
    effectGrid: "Grid",
    effectParticle: "Particle",
    effectDash: "Dash",
    effectScope: "Scope",
    effectGlow: "Glow",
    effectBackdrop: "Backdrop",
    effectOutline: "Outline",
    effectTrail: "Trail",
    effectEmojis: "Emojis",
    effectSilhouette: "Silhouette",
    effectGlyphs: "Glyphs",
    effectSpatial: "Spatial",
    effectHeatmap: "Heatmap",
    effectHull: "Hull",
  },
  ru: {
    title: "Contour VFX Overlay - Blob Tracker",
    loadingTitle: "Загружаем blob_tracker...",
    loadingText: "Запускаем OpenCV.js и готовим рендеринг...",
    dropTitle: "Перетащите видео сюда",
    dropSubtitle: "MP4, WebM, MOV - до 500 МБ",
    uploadVideo: "Загрузить видео",
    appTitle: "Contour VFX Overlay",
    appSubtitle: "Редактор видео-оверлеев с трекингом объектов",
    tabQuick: "Старт",
    tabStyle: "Стиль",
    tabDetect: "Детект",
    tabExport: "Экспорт",
    quickStart: "Быстрый старт",
    guideUpload: "Загрузите видео или перетащите его на рабочее поле.",
    guideFind: "Выберите чувствительность и размер объектов.",
    guideStyle: "Выберите визуальный стиль.",
    guideDetect: "Нажмите «Запустить детекцию», когда настройки готовы.",
    guideExport: "Проверьте результат и экспортируйте видео.",
    findObjects: "Поиск объектов",
    sensitivity: "Чувствительность",
    objectSize: "Размер объектов",
    detector: "Детектор",
    videoSpeed: "Скорость видео",
    basicEffects: "Базовые эффекты",
    connection: "Связи",
    lineStyle: "Тип линий",
    connectionRate: "Плотность связей",
    strokeWidth: "Толщина линии",
    blobSize: "Размер blob-объектов",
    detection: "Детекция",
    colorChannel: "Канал цвета",
    gpuAcceleration: "Ускорение GPU",
    grouping: "Группировка",
    colorText: "Цвет и текст",
    text: "Текст",
    textPosition: "Положение текста",
    textContentLabel: "Содержимое текста",
    fontSize: "Размер шрифта",
    color: "Цвет",
    centroid: "Центроид",
    showDots: "Показывать точки",
    output: "Экспорт",
    outputFps: "FPS экспорта",
    codec: "Кодек",
    low: "Низкая",
    normal: "Нормальная",
    high: "Высокая",
    tiny: "Мелкие",
    small: "Малые",
    medium: "Средние",
    large: "Крупные",
    custom: "Свои",
    edge: "Грани",
    motion: "Движение",
    area: "Площадь",
    none: "Нет",
    full: "Полная",
    detail: "Детально",
    grouped: "Группами",
    red: "Красн",
    greenShort: "Зел",
    blueShort: "Син",
    min: "Мин",
    max: "Макс",
    merge: "Слияние",
    passes: "Проходы",
    center: "Центр",
    top: "Сверху",
    bottom: "Снизу",
    random: "Случайно",
    position: "Координаты",
    count: "Номер",
    source: "Исходный",
    preview: "Превью",
    trail: "Шлейф",
    resetDefaults: "Сбросить настройки",
    copyDebugLog: "Скопировать лог",
    copied: "Скопировано",
    startDetection: "Запустить детекцию",
    startDetectionTitle: "Запустить детекцию с текущими настройками",
    redetect: "Re-detect",
    redetectTitle: "Повторить детекцию с текущими настройками",
    sourceFpsLoading: "FPS источника: - (определяем...)",
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
    cancelling: "Отменяем...",
    cancellingExport: "Отменяем экспорт...",
    detecting: "Детекция...",
    detectionCancelled: "Детекция отменена",
    loadingVideo: "Загружаем видео...",
    detectingFps: "Определяем частоту кадров...",
    redetecting: "Повторная детекция...",
    probingFrame: "Пробуем текущий кадр...",
    probeReady: "Превью текущего кадра: {count} объектов",
    probeSkippedMotion: "Детектор движения требует полного Re-detect",
    probeUnavailable: "Поставьте видео на паузу для превью детекции",
    errorPrefix: "Ошибка: ",
    resetTitle: "Сбросить к значению по умолчанию",
    colorAria: "Цвет: {color}",
    tipFindAria: "Справка: Поиск объектов",
    tipBlobAria: "Справка: Размер объектов",
    tipDetectAria: "Справка: Детекция",
    tipOutputAria: "Справка: Экспорт",
    tinyTitle: "Для маленьких объектов вдали",
    smallTitle: "Только маленькие объекты",
    nearestTitle: "Ближайшие соседи",
    allTitle: "Все связи",
    chainTitle: "Цепочка",
    waveTitle: "Волна",
    effectBasic: "Базовый",
    effectCross: "Крест",
    effectLabel: "Метка",
    effectFrame: "Рамка",
    effectGrid: "Сетка",
    effectParticle: "Частицы",
    effectDash: "Пунктир",
    effectScope: "Прицел",
    effectGlow: "Свечение",
    effectBackdrop: "Фон",
    effectOutline: "Контур",
    effectTrail: "Шлейф",
    effectEmojis: "Эмодзи",
    effectSilhouette: "Силуэт",
    effectGlyphs: "Глифы",
    effectSpatial: "Пространство",
    effectHeatmap: "Теплокарта",
    effectHull: "Оболочка",
  },
};

const TIP_TEXTS = {
  en: {
    "tip-find": "Sensitivity presets adjust Canny thresholds and blur for different object types.\n- Low: clear, large objects\n- Normal: balanced default\n- High: faint edges\n- Tiny: small, distant blobs\n\nObject Size filters detected blob area.",
    "tip-blob": "Min / Max contour area in pixels.\nObjects outside this range are filtered out.\nUse Object Size presets for quick setup.",
    "tip-detect": "Canny edge detection parameters.\n- C-Low / C-High: edge thresholds\n- Blur: softens noise before detection\n- Color Channel: detect on one channel\n- GPU: WebGL2 acceleration when available",
    "tip-output": "Output FPS: Source, 30, or 60.\nExport keeps the source video's original width, height, and aspect ratio.\nCodec: MP4 or WebM.",
  },
  ru: {
    "tip-find": "Пресеты чувствительности меняют пороги Canny и размытие.\n- Низкая: четкие крупные объекты\n- Нормальная: сбалансированный режим\n- Высокая: слабые контуры\n- Мелкие: маленькие объекты вдали\n\nРазмер объектов отсекает лишние blob-области.",
    "tip-blob": "Мин / Макс - площадь контура в пикселях.\nОбъекты вне диапазона отфильтровываются.\nДля быстрого старта используйте пресеты размера.",
    "tip-detect": "Параметры Canny-детекции.\n- C-Low / C-High: пороги контуров\n- Blur: убирает шум перед поиском\n- Канал цвета: поиск по отдельному каналу\n- GPU: ускорение через WebGL2, если доступно",
    "tip-output": "FPS экспорта: исходный, 30 или 60.\nЭкспорт сохраняет исходную ширину, высоту и соотношение сторон видео.\nКодек: MP4 или WebM.",
  },
};

const savedLang = localStorage.getItem("blobTrackerLang");
let currentLang = savedLang || ((navigator.language || "").toLowerCase().startsWith("ru") ? "ru" : "en");
if (!I18N[currentLang]) currentLang = "en";

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
  document.querySelectorAll(".sreset").forEach(btn => { btn.title = t("resetTitle"); });
  document.querySelectorAll(".cs").forEach(sw => {
    const color = rgbToHex(sw.style.background || "");
    if (color) sw.setAttribute("aria-label", t("colorAria", { color }));
  });
  updateOutputFpsInfo();
  updateDetectionActions();
}

function updateDetectionActions() {
  if (redetectBtn) {
    const key = detectionReady ? "redetect" : "startDetection";
    const titleKey = detectionReady ? "redetectTitle" : "startDetectionTitle";
    redetectBtn.textContent = t(key);
    redetectBtn.title = t(titleKey);
  }
  if (exportBtn) exportBtn.disabled = !detectionReady;
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

function setupPanelTabs() {
  const tabs = document.querySelectorAll(".panel-tab");
  const sections = document.querySelectorAll("[data-panel-section]");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tabTarget;
      tabs.forEach(t => t.classList.toggle("active", t === tab));
      sections.forEach(section => { section.hidden = section.dataset.panelSection !== target; });
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
    el.textContent = sourceFps ? t("sourceFpsValue", { fps: sourceFps.toFixed(2) }) : t("sourceFpsLoading");
  } else {
    el.textContent = sourceFps
      ? t("sourceFpsExport", { fps: sourceFps.toFixed(2), exportFps: P.outputFps })
      : t("sourceFpsExport", { fps: "-", exportFps: P.outputFps });
  }
}

const MAX_PREVIEW_DIM = 540;

// ============================
// STATE
// ============================
let P = {
  playbackSpeed: 1,
  selectedEffect: "Basic",
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
  groupingMode: "contours",
  mergeKernel: 1,
  mergeIterations: 1,
  colorChannel: 0,
  useGPU: true,
  outputFps: "source",
  trailLength: 0,
  outputCodec: "h264",
  detector: "edge",
  // Audio reactivity
  audioEnabled: false,
  audioModulation: 50,
  // PostFX
  postFx: "off",
};

const DEFAULTS = { ...P };

const COLORS = [
  "#ffffff","#f3ac03","#ef4444","#f59e0b","#84cc16","#22c55e","#06b6d4","#3b82f6","#8b5cf6",
  "#ec4899","#000000","#d4d4d4","#9a9a9a","#666666","#333333","#1a1a1a","#a855f7","#6366f1"
];

let appReady = false;
function hideLoad() {
  if (!cvReady || !appReady) return;
  const el = document.getElementById("loading-screen");
  if (el) { el.style.display = "none"; }
}
function onCvReady() { cvReady = true; hideLoad(); console.log("OpenCV loaded"); }
function onCvError() { log("opencv", "OpenCV.js failed to load"); console.error("OpenCV failed"); }

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

function gpuDilate(w, h, radius, iterations) {
  if (!GPU.ready || !GPU.programDilate) return false;
  if (radius < 1 || iterations < 1) return true;
  const gl = GPU.gl;
  const r = Math.min(16, Math.max(1, radius | 0));
  for (let i = 0; i < iterations; i++) {
    renderToTexture(gl, GPU.programDilate, GPU.textureB, GPU.framebuffer, w, h,
      { u_resolution: [w, h], u_radius: r });
    renderToTexture(gl, GPU.programDilate, GPU.textureA, GPU.framebuffer2, w, h,
      { u_resolution: [w, h], u_radius: r });
  }
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
const canvasWrap = document.getElementById("canvas-wrap");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const exportOverlay = document.getElementById("export-overlay");
const exportBtn = document.getElementById("export-btn");
const redetectBtn = document.getElementById("redetect-btn");
const exportStatus = document.getElementById("export-status");
const probeStatus = document.getElementById("probe-status");
const playbackControls = document.getElementById("playback-controls");
const playToggle = document.getElementById("play-toggle");
const timeline = document.getElementById("timeline");
const timeReadout = document.getElementById("time-readout");
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
      '<b>' + fps.toFixed(1) + '</b> fps <span class="t-dim">·</span> ' +
      'blobs <b>' + avgBlobs.toFixed(1) + '</b> ' +
      '<span class="t-dim">(peak ' + this.peak + ')</span> <span class="t-dim">·</span> ' +
      'drop <b>' + dropPct.toFixed(0) + '%</b>';
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
      const next = parse(btn.dataset.val);
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
  if (!dialog || !messageEl || !confirmBtn || !cancelEls) return Promise.resolve(confirm(message));

  messageEl.textContent = message;
  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  confirmBtn.focus();

  return new Promise(resolve => {
    const close = (result) => {
      dialog.hidden = true;
      dialog.setAttribute("aria-hidden", "true");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelEls.forEach(el => el.removeEventListener("click", onCancel));
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    };
    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    const onKeydown = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    confirmBtn.addEventListener("click", onConfirm);
    cancelEls.forEach(el => el.addEventListener("click", onCancel));
    document.addEventListener("keydown", onKeydown);
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
          current: currentFps.toFixed(2),
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
      const next = btn.dataset.val;
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
    ["video-speed", "playbackSpeed", "val", parseFloat],
    ["connection-rate", "connectionRate", "val", parseFloat],
    ["text-position", "textPosition", "val", String],
    ["text-content", "textContent", "val", String],
    ["font-size", "fontSize", "val", parseInt],
    ["grouping-mode", "groupingMode", "val", String],
    ["connection-style", "connectionStyle", "value", String],
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
    const want = String(P[key] === undefined ? "" : P[key]);
    el.querySelectorAll("button").forEach(b => {
      const v = parse(b.dataset[attr]);
      b.classList.toggle("active", String(v) === want);
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
    ["merge-iterations", "mergeIterations", "merge-iterations-val", v => v],
    ["trail-length", "trailLength", "trail-length-val", v => v],
  ];
  for (const [id, key, valId, fmt] of smap) {
    const el = document.getElementById(id);
    const ve = document.getElementById(valId);
    if (!el) continue;
    if (document.activeElement !== el) el.value = P[key];
    if (ve) ve.textContent = fmt(P[key]);
  }
  const pal = document.getElementById("color-palette");
  if (pal) {
    pal.querySelectorAll(".cs").forEach(s => {
      const cur = rgbToHex(s.style.background || "");
      s.classList.toggle("active", cur === P.contourColor);
    });
  }
  updateOutputFpsInfo();
  Telemetry.setTargetFps(getEffectiveFps());
}

function rgbToHex(rgb) {
  if (!rgb || rgb[0] !== "r") return rgb;
  const m = rgb.match(/\d+/g); if (!m) return rgb;
  return "#" + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
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
    const minSpan = document.createElement("span");
    minSpan.className = "smin";
    minSpan.textContent = fmt(minVal);
    el.parentNode.insertBefore(minSpan, el);
    const maxSpan = document.createElement("span");
    maxSpan.className = "smax";
    maxSpan.textContent = fmt(maxVal);
    row.appendChild(maxSpan);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "sreset";
    reset.title = t("resetTitle");
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
    const v = parseFloat(el.value);
    if (P[stateKey] === v) return;
    History.commit();
    P[stateKey] = v;
    if (ve) ve.textContent = fmt(v);
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
    sw.setAttribute("aria-label", t("colorAria", { color: c }));
    sw.addEventListener("click", () => {
      if (P.contourColor === c) return;
      History.commit();
      P.contourColor = c;
      el.querySelectorAll(".cs").forEach(s => s.classList.remove("active"));
      sw.classList.add("active");
      handleParamChanged("contourColor");
    });
    sw.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sw.click(); }
    });
    el.appendChild(sw);
  });
}

// ============================
// UI: friendly detection presets
// ============================
function formatBlobMax(v) { return v >= 1000 ? Math.round(v / 1000) + "k" : v; }

function setSliderValue(id, stateKey, value, valId, format) {
  const el = document.getElementById(id);
  const ve = document.getElementById(valId);
  if (!el) return;
  el.value = value;
  P[stateKey] = value;
  if (ve) ve.textContent = format ? format(value) : value;
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
      tiny: { cannyLow: 20, cannyHigh: 80, blurKernel: 1, blobMin: 10, blobMax: 8000 },
    }[preset];
    if (!values) return;
    setSliderValue("canny-low", "cannyLow", values.cannyLow, "canny-low-val");
    setSliderValue("canny-high", "cannyHigh", values.cannyHigh, "canny-high-val");
    setSliderValue("blur-kernel", "blurKernel", values.blurKernel, "blur-kernel-val");
    if (values.blobMin != null) {
      setSliderValue("blob-min", "blobMin", values.blobMin, "blob-min-val");
      setSliderValue("blob-max", "blobMax", values.blobMax, "blob-max-val", formatBlobMax);
      document.querySelectorAll("#object-size-preset button").forEach(b => b.classList.toggle("active", b.dataset.size === "small"));
    }
  });
  setupPresetRow("object-size-preset", "size", size => {
    const values = { small: { min: 10, max: 8000 }, medium: { min: 50, max: 50000 }, large: { min: 300, max: 200000 } };
    if (size === "custom") return;
    setSliderValue("blob-min", "blobMin", values[size].min, "blob-min-val");
    setSliderValue("blob-max", "blobMax", values[size].max, "blob-max-val", formatBlobMax);
  });

  setupSeg("video-speed", "playbackSpeed", parseFloat);
  setupSeg("connection-rate", "connectionRate", parseFloat);
  setupSeg("text-position", "textPosition", String);
  setupSeg("text-content", "textContent", String);
  setupSeg("font-size", "fontSize", parseInt);
  setupSeg("grouping-mode", "groupingMode", String);
  setupIconRow("connection-style", "connectionStyle");
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
  setupSlider("merge-iterations", "mergeIterations", "merge-iterations-val", v => v);
  setupSlider("trail-length", "trailLength", "trail-length-val", v => v);

  buildPalette();

  document.getElementById("reset-btn")?.addEventListener("click", () => {
    document.querySelectorAll(".seg button:first-child, .icon-btn:first-child, .gbtn:first-child, .lbtn:first-child").forEach(b => {
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
    document.getElementById("merge-iterations").value = 1;
    document.getElementById("trail-length").value = 0;
    document.getElementById("stroke-width-val").textContent = "2px";
    document.getElementById("blob-min-val").textContent = "300";
    document.getElementById("blob-max-val").textContent = "200k";
    document.getElementById("canny-low-val").textContent = "50";
    document.getElementById("canny-high-val").textContent = "150";
    document.getElementById("blur-kernel-val").textContent = "5";
    document.getElementById("merge-kernel-val").textContent = "1";
    document.getElementById("merge-iterations-val").textContent = "1";
    document.getElementById("trail-length-val").textContent = "0";
    document.querySelectorAll("#grouping-mode button").forEach(b => b.classList.toggle("active", b.dataset.val === "contours"));
    document.querySelectorAll("#color-channel button").forEach(b => b.classList.toggle("active", b.dataset.val === "0"));
    document.querySelectorAll("#output-fps button").forEach(b => b.classList.toggle("active", b.dataset.val === "source"));
    document.querySelectorAll("#output-codec button").forEach(b => b.classList.toggle("active", b.dataset.val === "h264"));
    document.getElementById("gpu-toggle").checked = true;
    if (typeof TrailBuffer !== "undefined") TrailBuffer.clear();
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
      a.href = URL.createObjectURL(blob);
      a.download = "blob-tracker-debug-log.txt";
      a.click();
      log("debug", "Log downloaded as file");
    });
  });

  log("init", "Controls initialized");
}

// ============================
// FILE LOADING
// ============================
window.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
window.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
window.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("video/")) loadFile(file);
});
document.getElementById("upload-btn").addEventListener("click", () => document.getElementById("file-input").click());
document.getElementById("file-input").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file && file.type.startsWith("video/")) loadFile(file);
});

function loadFile(file) {
  // File validation
  if (file.size > 500 * 1024 * 1024) {
    alert(t("fileTooLarge"));
    return;
  }
  if (!file.type.startsWith("video/") && file.type) {
    if (!confirm(t("unrecognizedFile"))) return;
  }
  if (file.type === "video/mp4" || file.type === "video/webm" || file.type === "video/quicktime" || !file.type) {
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
    const cleanup = () => { clearTimeout(timer); videoEl.onloadedmetadata = null; videoEl.onerror = null; };
    const timer = setTimeout(() => {
      if (settled) return; settled = true; cleanup();
      reject(new Error("Video failed to load within " + Math.round(timeoutMs / 1000) + " s."));
    }, timeoutMs);
    videoEl.onloadedmetadata = () => { if (settled) return; settled = true; cleanup(); resolve(); };
    videoEl.onerror = () => { if (settled) return; settled = true; cleanup(); reject(new Error("Failed to load video: format not supported or file unavailable.")); };
    videoEl.src = url;
  });
}

function seekVideo(videoEl, time, maxTries = 500) {
  return new Promise((resolve) => {
    let tries = 0;
    const check = () => { if (!videoEl.seeking) return resolve(); if (tries++ > maxTries) return resolve(); setTimeout(check, 10); };
    videoEl.onseeked = check;
    videoEl.currentTime = time;
    check();
  });
}

function recoverFromFatal(msg) {
  isProcessing = false;
  detectionReady = false;
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
function detectSourceFps(videoEl) {
  return new Promise((resolve) => {
    if (typeof videoEl.requestVideoFrameCallback !== "function") { resolve(30); return; }
    const times = [];
    let handle = null;
    let resolved = false;
    const finish = (fps) => {
      if (resolved) return; resolved = true;
      if (handle != null) try { videoEl.cancelVideoFrameCallback(handle); } catch (e) {}
      try { videoEl.pause(); } catch (e) {}
      const safe = (isFinite(fps) && fps > 0 && fps < 240) ? fps : 30;
      resolve(Math.round(safe * 100) / 100);
    };
    const handler = (now, metadata) => {
      times.push(metadata.mediaTime);
      if (times.length >= 12) {
        const dt = times[times.length - 1] - times[0];
        if (dt > 0) finish((times.length - 1) / dt); else finish(30);
      } else {
        handle = videoEl.requestVideoFrameCallback(handler);
      }
    };
    handle = videoEl.requestVideoFrameCallback(handler);
    const wasPaused = videoEl.paused;
    videoEl.muted = true;
    videoEl.play().then(() => {}).catch(() => finish(30));
    setTimeout(() => { if (times.length < 2) finish(30); }, 5000);
    videoEl.addEventListener("seeked", () => { if (wasPaused) videoEl.pause(); }, { once: true });
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
const DETECTION_PARAM_KEYS = new Set([
  "detector", "colorChannel", "useGPU",
  "cannyLow", "cannyHigh", "blurKernel",
  "blobMin", "blobMax",
  "groupingMode", "mergeKernel", "mergeIterations",
]);

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
  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  if (!timelineDragging) {
    timeline.value = dur > 0 ? String(Math.round((time / dur) * 1000)) : "0";
  }
  timeReadout.textContent = formatTime(time) + " / " + formatTime(dur);
  playToggle.textContent = video.paused ? "▶" : "⏸";
  playToggle.title = video.paused ? "Play" : "Pause";
  playToggle.setAttribute("aria-label", playToggle.title);
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

  if (options.updateTrail && P.trailLength > 0 && P.selectedEffect === "Trail") {
    TrailBuffer.push(canvas);
  }

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
  }
}

function handleParamChanged(stateKey) {
  if (stateKey === "playbackSpeed" && video) video.playbackRate = P.playbackSpeed;
  if (stateKey === "outputFps" || stateKey === "outputCodec") return;
  if (!currentVideoURL || isProcessing || isExporting) return;
  if (DETECTION_PARAM_KEYS.has(stateKey)) {
    scheduleCurrentFrameProbe();
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

function setupPlaybackControls() {
  if (!playToggle || !timeline) return;
  playToggle.addEventListener("click", async () => {
    if (!currentVideoURL || isProcessing || isExporting) return;
    if (video.paused) {
      clearCurrentFrameProbe();
      await video.play().catch(e => log("video", "Play failed", { error: e.message }));
    } else {
      video.pause();
      renderCurrentFrame();
    }
    updatePlaybackUi();
  });

  timeline.addEventListener("input", () => {
    if (!currentVideoURL || isProcessing || isExporting) return;
    timelineDragging = true;
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const nextTime = dur > 0 ? (Number(timeline.value) / 1000) * dur : 0;
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
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    const rect = cv.boundingRect(c);
    const filterArea = Math.max(area, rect.width * rect.height);
    if (filterArea < P.blobMin || filterArea > P.blobMax) continue;
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
  if (P.useGPU && GPU.ready) {
    try {
      const edgeMap = gpuCanny(tempCanvas, P.cannyLow, P.cannyHigh, P.blurKernel / 3.0);
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
        if (P.groupingMode === "regions" && P.mergeKernel > 1) {
          const mk = Math.max(1, Math.round(P.mergeKernel));
          const odd = mk % 2 === 0 ? mk + 1 : mk;
          P.mergeKernel = odd;
          const iters = Math.max(1, Math.round(P.mergeIterations));
          const radius = Math.min(16, (odd - 1) >> 1);
          if (radius >= 1 && GPU.programDilate) {
            gpuEnsureSize(w, h);
            uploadMaskToTexture(GPU.gl, GPU.textureB, w, h, closed.data);
            const ok = gpuDilate(w, h, radius, iters);
            if (ok) {
              const dilated = readMaskFromTexture(w, h);
              gpuMask = new cv.Mat(h, w, cv.CV_8UC1);
              gpuMask.data.set(dilated);
              mask = gpuMask;
            } else {
              mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
              mask = new cv.Mat();
              cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), iters);
            }
          } else {
            mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
            mask = new cv.Mat();
            cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), iters);
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
  cv.Canny(blurred, edges, P.cannyLow, P.cannyHigh);
  gray.delete(); blurred.delete();

  const kernelClose = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const closed = new cv.Mat();
  cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernelClose);
  edges.delete(); kernelClose.delete();

  let mask = closed;
  let mergeKernel = null;
  if (P.groupingMode === "regions" && P.mergeKernel > 1) {
    const mk = Math.max(1, Math.round(P.mergeKernel));
    const odd = mk % 2 === 0 ? mk + 1 : mk;
    P.mergeKernel = odd;
    const iters = Math.max(1, Math.round(P.mergeIterations));
    mergeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd, odd));
    mask = new cv.Mat();
    cv.dilate(closed, mask, mergeKernel, new cv.Point(-1, -1), iters);
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
  const tf = Math.floor(video.duration * fps);
  all_frame_data = [];
  let lastTs = Date.now();
  const tracker = new CentroidTracker(Math.hypot(canvas.width, canvas.height));
  for (let i = 0; i <= tf; i++) {
    if (cancelRequested) { log("detect", "detectBlobs cancelled by user", { frame: i, total: tf }); break; }
    video.currentTime = i / fps;
    await new Promise(r => { let a = 0; const ch = () => { if (!video.seeking) r(); else if (a++ > 500) r(); else setTimeout(ch, 10); }; video.onseeked = ch; ch(); });
    if (cancelRequested) { log("detect", "detectBlobs cancelled by user", { frame: i, total: tf }); break; }
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let mat;
    try { mat = cv.imread(tempCanvas); } catch (e) { log("detect", "cv.imread failed frame " + i); continue; }
    const cts = detectContours(mat);
    mat.delete();
    const blobs = tracker.update(cts);
    all_frame_data.push({ time: i / fps, blobs: structuredClone(blobs), frameIndex: i });
    const pc = Math.round(i / tf * 100);
    progressFill.style.width = pc + "%";
    progressLabel.textContent = t("detecting") + " " + pc + "%";
    const now = Date.now();
    if (now - lastTs > 10000) { log("detect", "Still running after 10s", { frame: i, total: tf, pct: pc }); lastTs = now; }
  }
  if (cancelRequested) { progressLabel.textContent = t("detectionCancelled"); }
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log("detect", "detectBlobs complete", { frames: all_frame_data.length, blobs_total: all_frame_data.reduce((s, f) => s + f.blobs.length, 0), elapsed_s: elapsed, cancelled: cancelRequested });
}

// ============================
// START PROCESSING
// ============================
async function prepareVideo(videoURL) {
  log("video", "prepareVideo called", { params: { ...P } });
  if (currentVideoURL && currentVideoURL !== videoURL) URL.revokeObjectURL(currentVideoURL);
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
  progressLabel.textContent = t("loadingVideo");
  exportOverlay.classList.remove("visible");
  hidePlaybackControls();
  Telemetry.hide();
  Telemetry.reset();
  try {
    await loadVideoMetadata(video, videoURL);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error("Video has zero frame size — file may be corrupted.");
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
    exportOverlay.classList.add("visible");
    showPlaybackControls();
    updateDetectionActions();
  } catch (e) {
    const msg = (e && e.message) || String(e);
    log("video", "prepareVideo failed", { error: msg });
    recoverFromFatal(msg);
    alert(t("failedProcess", { msg }));
  } finally {
    isProcessing = false;
    progressBar.classList.remove("visible");
  }
}

async function startProcessing(videoURL) {
  if (!cvReady) { alert(t("openCvLoading")); return; }
  log("video", "startProcessing called", { params: { ...P } });
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
  progressLabel.textContent = t("loadingVideo");
  exportOverlay.classList.remove("visible");
  hidePlaybackControls();
  Telemetry.hide();
  Telemetry.reset();
  try {
    await loadVideoMetadata(video, videoURL);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error("Video has zero frame size — file may be corrupted.");
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
    updateDetectionActions();
    video.muted = true;
    await seekVideo(video, 0);
    exportOverlay.classList.add("visible");
    showPlaybackControls();
    video.playbackRate = P.playbackSpeed;
    video.play();
    video.loop = true;
    Telemetry.setTargetFps(getEffectiveFps());
    Telemetry.show();
    requestAnimationFrame(drawLoop);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    log("video", "startProcessing failed", { error: msg });
    recoverFromFatal(msg);
    alert(t("failedProcess", { msg }));
  } finally {
    isProcessing = false;
    progressBar.classList.remove("visible");
    hideCancelDetect();
    if (currentVideoURL && video.readyState >= 2) showPlaybackControls();
  }
}

// ============================
// MAIN DRAW LOOP
// ============================
function drawLoop() {
  if (!video || video.readyState < 2) { requestAnimationFrame(drawLoop); return; }
  if (video.paused && !isExporting) { updatePlaybackUi(); requestAnimationFrame(drawLoop); return; }
  renderCurrentFrame({ recordTelemetry: true, updateTrail: true });

  requestAnimationFrame(drawLoop);
}

// ============================
// TOOLTIP SYSTEM
// ============================
function placeTip(popup, source) {
  const pad = 12;
  const gap = 14;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (source && typeof source.clientX === "number" && typeof source.clientY === "number") {
    x = source.clientX + gap;
    y = source.clientY + gap;
  } else if (source && typeof source.getBoundingClientRect === "function") {
    const r = source.getBoundingClientRect();
    x = r.right + gap;
    y = r.top + Math.min(8, Math.max(0, r.height / 2));
  }
  popup.style.left = "0px";
  popup.style.top = "0px";
  popup.style.transform = "none";
  const rect = popup.getBoundingClientRect();
  x = Math.min(Math.max(pad, x), window.innerWidth - rect.width - pad);
  y = Math.min(Math.max(pad, y), window.innerHeight - rect.height - pad);
  popup.style.left = x + "px";
  popup.style.top = y + "px";
}

function showTip(text, source) {
  const el = document.getElementById("tip-popup");
  const txt = document.getElementById("tip-popup-text");
  if (!el || !txt) return;
  txt.textContent = text;
  el.classList.add("visible");
  clearTimeout(el._hideTimer);
  requestAnimationFrame(() => placeTip(el, source));
}

function hideTip() {
  const el = document.getElementById("tip-popup");
  if (!el) return;
  el._hideTimer = setTimeout(() => el.classList.remove("visible"), 200);
}

document.querySelectorAll(".tip").forEach(el => {
  if (!TIP_TEXTS.en[el.id]) return;
  const text = () => (TIP_TEXTS[currentLang] || TIP_TEXTS.en)[el.id];
  el.addEventListener("mouseenter", (e) => showTip(text(), e));
  el.addEventListener("mousemove", (e) => {
    const popup = document.getElementById("tip-popup");
    if (popup && popup.classList.contains("visible")) placeTip(popup, e);
  });
  el.addEventListener("mouseleave", hideTip);
  el.addEventListener("focus", () => showTip(text(), el));
  el.addEventListener("blur", hideTip);
  // Touch support
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const popup = document.getElementById("tip-popup");
    if (popup && popup.classList.contains("visible")) { hideTip(); return; }
    showTip(text(), e);
    // Auto-hide after 5 s
    const el2 = document.getElementById("tip-popup");
    if (el2) { clearTimeout(el2._hideTimer); el2._hideTimer = setTimeout(() => el2.classList.remove("visible"), 5000); }
  });
});

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
  progressLabel.textContent = t(wasDetectionReady ? "redetecting" : "detecting");
  exportOverlay.style.display = "none";
  try {
    await detectBlobs();
    const _effFps = getEffectiveFps();
    for (let i = 0; i < all_frame_data.length; i++) all_frame_data[i].time = i / _effFps;
    detectionReady = !cancelRequested && all_frame_data.length > 0;
    updateDetectionActions();
    video.muted = true;
    await seekVideo(video, 0);
    exportOverlay.classList.add("visible");
    exportOverlay.style.display = "";
    showPlaybackControls();
    video.playbackRate = P.playbackSpeed;
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

exportBtn.addEventListener("click", startExport);
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
// AUDIO FEATURES
// ============================
let _audioFeatures = null;

function silenceAudioFeatures() {
  _audioFeatures = { amp: new Float32Array(0), kick: new Float32Array(0), high: new Float32Array(0), onset: new Float32Array(0) };
}

function getAudioFeatures(frameIndex) {
  if (!_audioFeatures) return { amp: 0, kick: 0, high: 0, onset: 0 };
  const idx = Math.min(frameIndex, _audioFeatures.amp.length - 1);
  const get = (arr) => (arr && arr.length > idx) ? arr[idx] : 0;
  return { amp: get(_audioFeatures.amp), kick: get(_audioFeatures.kick), high: get(_audioFeatures.high), onset: get(_audioFeatures.onset) };
}

let _audioEma = { amp: 0, kick: 0, high: 0, onset: 0 };
function getSmoothedAudioFeatures(frameIndex) {
  const raw = getAudioFeatures(frameIndex);
  const f = 0.3;
  _audioEma.amp = _audioEma.amp * (1 - f) + raw.amp * f;
  _audioEma.kick = _audioEma.kick * (1 - f) + raw.kick * f;
  _audioEma.high = _audioEma.high * (1 - f) + raw.high * f;
  _audioEma.onset = _audioEma.onset * (1 - f) + raw.onset * f;
  return _audioEma;
}

async function analyzeAudio(file) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const sr = audio.sampleRate;
    const totalFrames = all_frame_data.length || 1;
    const fps = getEffectiveFps();
    const frameLen = Math.max(1, Math.round(sr / fps));
    const fftSize = 256;
    const totalSamples = audio.getChannelData(0).length;
    const numFrames = Math.min(totalFrames, Math.ceil(totalSamples / frameLen));
    const amp = new Float32Array(numFrames);
    const kick = new Float32Array(numFrames);
    const high = new Float32Array(numFrames);
    const onset = new Float32Array(numFrames);
    const channel = audio.getChannelData(0);
    let prevRms = 0;
    for (let i = 0; i < numFrames; i++) {
      const start = i * frameLen;
      const end = Math.min(start + frameLen, totalSamples);
      let sum = 0;
      for (let j = start; j < end; j++) sum += channel[j] * channel[j];
      const rms = Math.sqrt(sum / (end - start));
      amp[i] = Math.min(1, rms * 4);
      // FFT-based bands (simplified)
      const half = Math.min(fftSize / 2, (end - start) / 2);
      let lowSum = 0, highSum = 0;
      for (let j = 0; j < half; j++) {
        const val = Math.abs(channel[start + j] || 0);
        if (j < half * 0.1) lowSum += val;
        else highSum += val;
      }
      kick[i] = Math.min(1, lowSum / half * 8);
      high[i] = Math.min(1, highSum / half * 4);
      onset[i] = (i > 0 && rms > prevRms * 1.5) ? Math.min(1, (rms - prevRms) * 5) : 0;
      prevRms = rms;
    }
    _audioFeatures = { amp, kick, high, onset };
    ctx.close();
    log("audio", "Audio analysis complete", { frames: numFrames, sampleRate: sr });
  } catch (e) {
    console.warn("Audio analysis failed:", e);
    silenceAudioFeatures();
  }
}

// ============================
// INIT
// ============================
function initApp() {
  setupLanguageControls();
  setupPanelTabs();
  setupControls();
  setupPlaybackControls();
  applyLanguage();
  initGPU();
  Telemetry.el = document.getElementById("telemetry");
  Telemetry.setTargetFps(PROCESSING_FPS_DEFAULT);
  silenceAudioFeatures();

  if (location.protocol === "file:") {
    console.warn("Running from file:// — use a local server (e.g. `npx serve .`).");
  }
  window.PRESETS = {};
  log("init", "Legacy presets skipped; built-in UI presets are active");

  appReady = true;
  hideLoad();
  log("init", "App initialized");
}

document.addEventListener("DOMContentLoaded", initApp);
