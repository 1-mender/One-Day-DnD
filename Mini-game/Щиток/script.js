const body = document.body

const elements = {
  statusLine: document.querySelector(".status-line"),
  stateBadge: document.getElementById("stateBadge"),
  roundCounter: document.getElementById("roundCounter"),
  currentStep: document.getElementById("currentStep"),
  statusMessage: document.getElementById("statusMessage"),
  timerLabel: document.getElementById("timerLabel"),
  voltageDial: document.getElementById("voltageDial"),
  voltageNeedle: document.getElementById("voltageNeedle"),
  voltageLabel: document.getElementById("voltageLabel"),
  voltageState: document.getElementById("voltageState"),
  powerIndicator: document.getElementById("powerIndicator"),
  alarmIndicator: document.getElementById("alarmIndicator"),
  ambientHint: document.getElementById("ambientHint"),
  restartButton: document.getElementById("restartButton"),
  overlay: document.getElementById("overlay"),
  overlayEyebrow: document.getElementById("overlayEyebrow"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  overlayRestartButton: document.getElementById("overlayRestartButton"),
  faultCounter: document.getElementById("faultCounter"),
  cabinet: document.getElementById("cabinet"),
  screenBeam: document.querySelector(".screen-beam"),
  screenGrime: document.querySelector(".screen-grime"),
  screenVignette: document.querySelector(".screen-vignette"),
}

const faultDots = Array.from(document.querySelectorAll(".fault-dot"))
const sparks = Array.from(document.querySelectorAll(".spark"))
const wireRuns = Array.from(document.querySelectorAll(".wire-run"))
const bundleCables = Array.from(document.querySelectorAll(".bundle-cable"))

const componentButtons = Array.from(document.querySelectorAll(".component"))
const components = Object.fromEntries(
  componentButtons.map((button) => {
    const action = button.dataset.action
    const image = button.querySelector("img")

    return [action, { button, image }]
  })
)

const keyMap = {
  KeyF: "fuse",
  KeyQ: "network",
  KeyW: "line",
  KeyE: "load",
}

const componentOrder = ["fuse", "network", "line", "load"]
const totalRounds = 5
const maxFaults = 3

const NODE_DEFS = {
  fuse: {
    shortLabel: "Пред.",
    stepLabel: "Предохранитель",
    ariaLabel: "Предохранитель",
  },
  network: {
    shortLabel: "Сеть",
    stepLabel: "Сеть",
    ariaLabel: "Сетевой ввод",
  },
  line: {
    shortLabel: "Линия",
    stepLabel: "Линия",
    ariaLabel: "Линия",
  },
  load: {
    shortLabel: "Нагрузка",
    stepLabel: "Нагрузка",
    ariaLabel: "Выключатель нагрузки",
  },
}

const scenarioLibrary = [
  {
    id: "tripped-breaker",
    label: "Контур I",
    badge: "Диагностика",
    victoryStatus: "Питание",
    victoryTitle: "Питание восстановлено",
    victoryText: "Сеть удержала ток. Контур снова дышит ровно.",
    timeLimit: 52,
    threatStart: 10,
    threatRate: 1.05,
    init: { fuse: true, network: false, line: false, load: false },
    intro: "Верни питание через сеть.",
    success: "Сеть удержала ток. Контур вернулся в строй.",
    wrong: "Щиток не любит, когда его будят вразнобой.",
    ambient: [
      "Тишина в коробе давит сильнее гула.",
      "Холодный металл ждёт щелчка.",
      "Пыль на шине дрожит от рук.",
    ],
    stages: [
      {
        action: "network",
        target: true,
        uiLabel: "Сеть",
        hint: "Включи сеть.",
        wrong: "Сначала сеть.",
      },
      {
        action: "line",
        target: true,
        uiLabel: "Линия",
        hint: "Подними линию.",
        wrong: "Линия ещё не готова.",
      },
      {
        action: "load",
        target: true,
        uiLabel: "Нагрузка",
        hint: "Подай нагрузку.",
        wrong: "Рано будить нагрузку.",
      },
    ],
  },
  {
    id: "short-line",
    label: "Контур II",
    badge: "Изоляция",
    victoryStatus: "Изолировано",
    victoryTitle: "Линия отсечена",
    victoryText: "Повреждённая ветка отрезана от живой сети. Щиток больше не кормит коротыш.",
    timeLimit: 46,
    threatStart: 22,
    threatRate: 1.32,
    init: { fuse: true, network: false, line: true, load: true },
    intro: "Отсеки больную линию.",
    success: "Повреждённая ветка отсечена. Сеть жива.",
    wrong: "Искра уходит в больную ветку.",
    ambient: [
      "За стеной трещит изоляция.",
      "Красный диод дышит чаще.",
      "Линия шепчет сухим треском.",
    ],
    stages: [
      {
        action: "load",
        target: false,
        uiLabel: "Нагрузка",
        hint: "Сними нагрузку.",
        wrong: "Сначала убери нагрузку.",
      },
      {
        action: "line",
        target: false,
        uiLabel: "Изоляция",
        hint: "Отключи линию.",
        wrong: "Линия ещё висит на щите.",
      },
      {
        action: "network",
        target: true,
        uiLabel: "Сеть",
        hint: "Верни сеть.",
        wrong: "Сначала отсечь линию.",
      },
    ],
    extraThreat(states) {
      let load = 0

      if (states.load) {
        load += 1.6
      }

      if (states.line) {
        load += 1.4
      }

      if (states.network && states.line) {
        load += 2.8
      }

      return load
    },
  },
  {
    id: "false-load",
    label: "Контур III",
    badge: "Контроль",
    victoryStatus: "Контроль",
    victoryTitle: "Цепь собрана",
    victoryText: "Ложная нагрузка снята, потом возвращена уже по живой линии.",
    timeLimit: 44,
    threatStart: 18,
    threatRate: 1.18,
    init: { fuse: true, network: true, line: false, load: true },
    intro: "Сними ложную нагрузку.",
    success: "Лишняя тяга сброшена. Линия снова слушается.",
    wrong: "Ложная нагрузка любит торопливые руки.",
    ambient: [
      "Правый край панели живёт отдельно.",
      "Ток уходит не туда.",
      "На нагрузке висит лишний голод.",
    ],
    stages: [
      {
        action: "load",
        target: false,
        uiLabel: "Нагрузка",
        hint: "Отключи нагрузку.",
        wrong: "Нагрузка ещё мешает.",
      },
      {
        action: "line",
        target: true,
        uiLabel: "Линия",
        hint: "Подними линию.",
        wrong: "Сначала тишина на нагрузке.",
      },
      {
        action: "load",
        target: true,
        uiLabel: "Возврат",
        hint: "Верни нагрузку.",
        wrong: "Линия ещё не живая.",
      },
    ],
    extraThreat(states) {
      return states.load && !states.line ? 1.9 : 0
    },
  },
  {
    id: "crossed-circuit",
    label: "Контур IV",
    badge: "Разводка",
    victoryStatus: "Собрано",
    victoryTitle: "Контур выправлен",
    victoryText: "Перепутанная цепь выровнена. Щиток снова держит правильный порядок.",
    timeLimit: 54,
    threatStart: 16,
    threatRate: 1.08,
    init: { fuse: false, network: true, line: false, load: true },
    intro: "Собери контур заново.",
    success: "Перепутанная цепь снова собрана по уму.",
    wrong: "Старые руки оставили после себя неверный порядок.",
    ambient: [
      "Старые метки спорят между собой.",
      "Щиток помнит чужую спешку.",
      "Под крышкой всё собрано криво.",
    ],
    stages: [
      {
        action: "network",
        target: false,
        uiLabel: "Сеть",
        hint: "Погаси сеть.",
        wrong: "Сначала нужна тишина.",
      },
      {
        action: "load",
        target: false,
        uiLabel: "Сброс",
        hint: "Сними нагрузку.",
        wrong: "Сбрось нагрузку.",
      },
      {
        action: "fuse",
        target: true,
        uiLabel: "Предохранитель",
        hint: "Верни предохранитель.",
        wrong: "Пока рано вставлять.",
      },
      {
        action: "network",
        target: true,
        uiLabel: "Сеть",
        hint: "Подними сеть.",
        wrong: "Сначала предохранитель.",
      },
      {
        action: "line",
        target: true,
        uiLabel: "Линия",
        hint: "Подними линию.",
        wrong: "Сначала сеть.",
      },
    ],
    extraThreat(states) {
      let load = 0

      if (states.network && states.load) {
        load += 1.4
      }

      if (!states.fuse && states.network) {
        load += 2.2
      }

      return load
    },
  },
  {
    id: "overheat",
    label: "Контур V",
    badge: "Охлаждение",
    victoryStatus: "Остыл",
    victoryTitle: "Перегрев снят",
    victoryText: "Металл выдохнул жар. Контур поднят без новой вспышки.",
    timeLimit: 58,
    threatStart: 18,
    threatRate: 0.94,
    init: { fuse: true, network: true, line: true, load: true },
    intro: "Сними жар с линии.",
    success: "Жар ушёл. Щиток снова держит форму.",
    wrong: "Металл ещё помнит перегрев и мстит за спешку.",
    ambient: [
      "От шины идёт сухой жар.",
      "Металл остывает слишком медленно.",
      "Внутри коробки сидит невидимый жар.",
    ],
    stages: [
      {
        action: "load",
        target: false,
        uiLabel: "Нагрузка",
        hint: "Сними нагрузку.",
        wrong: "Жар держит нагрузка.",
      },
      {
        action: "line",
        target: false,
        uiLabel: "Линия",
        hint: "Отключи линию.",
        wrong: "Линия ещё горяча.",
      },
      {
        action: "network",
        target: false,
        uiLabel: "Сеть",
        hint: "Погаси сеть.",
        wrong: "Сеть ещё жива.",
      },
      {
        type: "wait",
        seconds: 3.6,
        uiLabel: "Остывание",
        hint: "Не трогай щиток.",
        wrong: "Рано. Щиток остывает.",
      },
      {
        action: "network",
        target: true,
        uiLabel: "Сеть",
        hint: "Верни сеть.",
        wrong: "Остывание не закончено.",
      },
      {
        action: "line",
        target: true,
        uiLabel: "Линия",
        hint: "Верни линию.",
        wrong: "Линия ещё не готова.",
      },
    ],
    extraThreat(states, stageIndex) {
      let load = 0

      if (states.load) {
        load += 1.1
      }

      if (states.line) {
        load += 0.6
      }

      if (states.network) {
        load += 0.35
      }

      if (stageIndex === 3 && (states.network || states.line || states.load)) {
        load += 2
      }

      return load
    },
  },
]

const audioFiles = {
  room: "Sound/803970__ixwolf__abandoned-basement-drone.wav",
  hum: "Sound/320871__joedeshon__electrical_hum_01.wav",
  industrial: "Sound/427504__solarphasing__industrial-noises-ambient-sound-1.wav",
  fluorescent: "Sound/399365__stocksnapper__old-fluorescent-fixture.wav",
  network: "Sound/139970__jessepash__switchbigpower.wav",
  line: "Sound/404049__deathscyp__breaker-1.wav",
  load: "Sound/556627__cookiespolicy__power-switch-on.wav",
  fuse: "Sound/31595__freqman__toggle-switches.wav",
  spark: "Sound/169666__knova__electricspark.wav",
  crackle: "Sound/32682__freqman__lowvolt-sparks.wav",
}

const loops = {
  room: createLoop(audioFiles.room),
  hum: createLoop(audioFiles.hum),
  industrial: createLoop(audioFiles.industrial),
}

const oneShotPools = {}

const state = {
  scenarioOrder: [],
  roundIndex: 0,
  scenario: null,
  states: defaultComponentState(),
  stageIndex: 0,
  faults: 0,
  threat: 0,
  timeLeft: 0,
  active: false,
  roundWon: false,
  gameOver: false,
  blackout: false,
  overlayMode: "restart",
  lastTick: performance.now(),
  messageText: "",
  messageKind: "hint",
  messageUntil: 0,
  waitProgress: 0,
  nextSparkAt: 0,
  nextFlickerAt: 0,
  nextHintAt: 0,
  introPlayed: false,
  userActivatedAudio: false,
  pendingTimeouts: [],
}

let tickHandle = 0

bindEvents()
applyNodeLabels()
resetCampaign()
playIntroSequence()
attemptAmbientAutoplay()
startTicker()

function bindEvents() {
  componentButtons.forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action))
  })

  elements.restartButton.addEventListener("click", () => resetCampaign())
  elements.overlayRestartButton.addEventListener("click", handleOverlayAction)

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return
    }

    if (event.code === "KeyR") {
      resetCampaign()
      return
    }

    const action = keyMap[event.code]

    if (action) {
      event.preventDefault()
      handleAction(action)
    }
  })

  const unlockOnce = () => {
    unlockAudio()
    window.removeEventListener("pointerdown", unlockOnce, true)
    window.removeEventListener("touchstart", unlockOnce, true)
    window.removeEventListener("keydown", unlockOnce, true)
  }

  window.addEventListener("pointerdown", unlockOnce, true)
  window.addEventListener("touchstart", unlockOnce, true)
  window.addEventListener("keydown", unlockOnce, true)
}

function defaultComponentState() {
  return {
    fuse: false,
    network: false,
    line: false,
    load: false,
  }
}

function applyNodeLabels() {
  Object.entries(NODE_DEFS).forEach(([key, meta]) => {
    const component = components[key]
    const step = document.getElementById(`step-${key}`)

    if (component) {
      component.button.setAttribute("aria-label", meta.ariaLabel)
      const label = component.button.querySelector("span")

      if (label) {
        label.textContent = meta.shortLabel
      }
    }

    if (step) {
      step.textContent = meta.stepLabel
    }
  })
}

function createLoop(src) {
  const audio = new Audio(src)
  audio.loop = true
  audio.preload = "auto"
  audio.volume = 0

  return {
    audio,
    targetVolume: 0,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function shuffle(list) {
  const copy = [...list]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = current
  }

  return copy
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds))
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0")
  const seconds = String(safe % 60).padStart(2, "0")

  return `${minutes}:${seconds}`
}

function currentScenario() {
  return state.scenario
}

function currentStage() {
  return state.scenario?.stages[state.stageIndex] ?? null
}

function roundDifficulty() {
  return 1 + state.roundIndex * 0.04
}

function resetCampaign() {
  clearScheduledTasks()
  hideOverlay()
  state.scenarioOrder = shuffle(scenarioLibrary).slice(0, totalRounds)
  state.roundIndex = 0
  body.classList.remove("is-blackout", "is-surging", "is-shaking", "is-flickering")
  state.blackout = false
  startRound()
}

function startRound() {
  clearScheduledTasks()
  const scenario = state.scenarioOrder[state.roundIndex]

  state.scenario = scenario
  state.states = { ...scenario.init }
  state.stageIndex = 0
  state.faults = 0
  state.threat = clamp(scenario.threatStart + state.roundIndex * 2, 0, 100)
  state.timeLeft = clamp(scenario.timeLimit - state.roundIndex * 1.5, 24, 65)
  state.active = true
  state.roundWon = false
  state.gameOver = false
  state.blackout = false
  state.waitProgress = 0
  state.lastTick = performance.now()
  state.messageText = scenario.intro
  state.messageKind = "hint"
  state.messageUntil = performance.now() + 3200
  state.nextSparkAt = performance.now() + 1200
  state.nextFlickerAt = performance.now() + 2800
  state.nextHintAt = performance.now() + 6800

  body.classList.remove("is-blackout", "is-surging", "is-shaking", "is-flickering")
  elements.ambientHint.textContent = pick(scenario.ambient)
  hideOverlay()
  syncUI()
  syncAudioBed()
}

function advanceRound() {
  if (state.roundIndex >= totalRounds - 1) {
    resetCampaign()
    return
  }

  state.roundIndex += 1
  startRound()
}

function handleOverlayAction() {
  if (state.overlayMode === "next-round") {
    advanceRound()
    return
  }

  resetCampaign()
}

function handleAction(action) {
  if (!state.active || state.gameOver || state.roundWon || state.blackout) {
    return
  }

  unlockAudio()

  const stage = currentStage()

  if (!stage) {
    return
  }

  if (stage.type === "wait") {
    punish(stage.wrong, 10, action)
    return
  }

  const nextValue = proposeActionState(action)
  const isExpectedAction = stage.action === action
  const isCorrectChange = isExpectedAction && stage.target === nextValue

  if (nextValue === null) {
    playActionSound(action, 0.42)
    nudgeComponent(action, "is-current")
    setTransientMessage("Узел уже на месте.", 1100, "neutral")
    syncUI()
    return
  }

  if (!isCorrectChange) {
    playActionSound(action, 0.7)
    punish(stage.wrong || state.scenario.wrong, 10, action)
    return
  }

  state.states[action] = nextValue
  playActionSound(action, 1)

  if (isCorrectChange) {
    state.stageIndex += 1
    state.threat = clamp(state.threat - 8, 0, 100)
    state.waitProgress = 0
    setTransientMessage(nextClue(), 2100, "hint")

    if (state.stageIndex >= state.scenario.stages.length) {
      completeRound()
      return
    }

    syncUI()
    return
  }
}

function proposeActionState(action) {
  if (action === "fuse") {
    return state.states.fuse ? null : true
  }

  return !state.states[action]
}

function punish(message, threatSpike, action) {
  state.faults += 1
  state.threat = clamp(state.threat + threatSpike, 0, 100)
  setTransientMessage(message, 2100, "error")
  playOneShot("spark", { volume: 0.62, maxDuration: 450 })
  playOneShot("crackle", { volume: 0.22, maxDuration: 520 })
  sparkBurst(action === "line" || action === "load" ? "right" : "left")
  flicker()
  shake()

  if (action) {
    nudgeComponent(action, "is-error")
  }

  if (state.faults >= maxFaults) {
    triggerFailure("faults")
    return
  }

  syncUI()
}

function completeRound() {
  state.active = false
  state.roundWon = true
  state.threat = clamp(state.threat - 18, 0, 100)
  state.messageText = state.scenario.victoryText || state.scenario.success
  state.messageKind = "success"
  state.messageUntil = performance.now() + 4800
  shake(120)
  syncUI()

  const lastRound = state.roundIndex >= totalRounds - 1

  scheduleTask(() => {
    if (lastRound) {
      state.overlayMode = "restart"
      showOverlay({
        type: "victory",
        eyebrow: "Цикл замкнут",
        title: state.scenario.victoryTitle || "Питание удержано",
        text: "Все контуры пережили эту ночь. Щиток больше не орёт в темноту.",
        cap: "Новый",
        main: "Цикл",
      })
      return
    }

    state.overlayMode = "next-round"
    showOverlay({
      type: "victory",
      eyebrow: `Раунд ${state.roundIndex + 1} удержан`,
      title: state.scenario.victoryTitle || "Контур стабилен",
      text: state.scenario.victoryText || "Щиток пережил эту неисправность. Следующая проблема уже шевелится за стеной.",
      cap: "Дальше",
      main: "Раунд",
    })
  }, 650)
}

function triggerFailure(reason) {
  if (state.gameOver) {
    return
  }

  state.active = false
  state.gameOver = true
  state.blackout = true
  body.classList.add("is-surging", "is-shaking")
  playOneShot("spark", { volume: 0.8, maxDuration: 700 })
  playOneShot("crackle", { volume: 0.38, maxDuration: 900 })
  sparkBurst("both")
  syncAudioBed()
  syncUI()

  scheduleTask(() => {
    body.classList.remove("is-surging")
  }, 170)

  scheduleTask(() => {
    body.classList.add("is-blackout")
  }, 260)

  scheduleTask(() => {
    const failureCopy = {
      faults: {
        eyebrow: "Короткое замыкание",
        title: "Щиток сорвался",
        text: "Три неверных щелчка разбудили всё худшее сразу. Свет ослепил, потом исчез.",
      },
      timeout: {
        eyebrow: "Промедление",
        title: "Коридор подошёл ближе",
        text: "Ты тянул слишком долго. Щиток не успел, а тьма успела первой.",
      },
      threat: {
        eyebrow: "Перегрузка",
        title: "Контур сгорел",
        text: "Угроза росла быстрее рук. Панель захлебнулась в собственной искре.",
      },
    }[reason]

    state.overlayMode = "restart"
    showOverlay({
      type: "gameover",
      eyebrow: failureCopy.eyebrow,
      title: failureCopy.title,
      text: failureCopy.text,
      cap: "Новый",
      main: "Запуск",
    })
  }, 1100)
}

function nextClue() {
  const stage = currentStage()

  if (!stage) {
    return state.scenario.success
  }

  return stage.hint
}

function setTransientMessage(message, duration = 1800, kind = "hint") {
  state.messageText = message
  state.messageKind = kind
  state.messageUntil = performance.now() + duration
}

function scheduleTask(callback, delay) {
  const handle = window.setTimeout(() => {
    state.pendingTimeouts = state.pendingTimeouts.filter((item) => item !== handle)
    callback()
  }, delay)

  state.pendingTimeouts.push(handle)
  return handle
}

function clearScheduledTasks() {
  state.pendingTimeouts.forEach((handle) => clearTimeout(handle))
  state.pendingTimeouts = []
}

function startTicker() {
  clearInterval(tickHandle)
  tickHandle = window.setInterval(() => {
    updateRuntime()
    syncUI()
  }, 120)
}

function updateRuntime() {
  const now = performance.now()
  const delta = Math.min((now - state.lastTick) / 1000, 0.2)

  state.lastTick = now
  updateMicroMotion(now)

  if (!state.active || state.roundWon || state.gameOver) {
    syncAudioBed()
    return
  }

  state.timeLeft -= delta

  const scenario = currentScenario()
  const stage = currentStage()
  const threatRate = scenario.threatRate * roundDifficulty()
  const extraThreat = typeof scenario.extraThreat === "function"
    ? scenario.extraThreat(state.states, state.stageIndex)
    : 0

  state.threat = clamp(
    state.threat + delta * (threatRate + extraThreat + unsafeThreat() + state.faults * 0.18),
    0,
    100
  )

  if (stage?.type === "wait") {
    const cooled = !state.states.network && !state.states.line && !state.states.load

    if (cooled) {
      state.waitProgress += delta

      if (state.waitProgress >= stage.seconds) {
        state.stageIndex += 1
        state.threat = clamp(state.threat - 12, 0, 100)
        setTransientMessage(nextClue(), 2400, "hint")
      }
    } else {
      state.waitProgress = 0
    }
  }

  if (now >= state.nextSparkAt) {
    ambientSpark(now)
  }

  if (now >= state.nextFlickerAt) {
    ambientFlicker(now)
  }

  if (now >= state.nextHintAt) {
    rotateAmbientHint(now)
  }

  if (state.timeLeft <= 0) {
    triggerFailure("timeout")
    return
  }

  if (state.threat >= 100) {
    triggerFailure("threat")
  }

  syncAudioBed()
}

function unsafeThreat() {
  let load = 0

  if (!state.states.fuse && state.states.network) {
    load += 2.4
  }

  if (state.states.load && !state.states.line) {
    load += 1.8
  }

  if (state.states.line && !state.states.network) {
    load += 0.7
  }

  if (state.states.load && state.states.network && !state.states.line) {
    load += 1.3
  }

  return load
}

function ambientSpark(now) {
  const threat = state.threat
  const activeSide = threat > 65 ? "both" : Math.random() > 0.5 ? "left" : "right"

  if (threat > 28 || state.states.line || state.states.load) {
    sparkBurst(activeSide)
    playOneShot("crackle", {
      volume: clamp(0.1 + threat / 240, 0.1, 0.34),
      maxDuration: 380,
    })
  }

  state.nextSparkAt = now + (threat > 70 ? 900 + Math.random() * 1200 : 1800 + Math.random() * 2600)
}

function ambientFlicker(now) {
  if (state.threat > 34 || state.states.network) {
    flicker()

    if (state.threat > 58) {
      playOneShot("fluorescent", {
        volume: 0.1 + state.threat / 500,
        maxDuration: 780,
      })
    }
  }

  state.nextFlickerAt = now + (state.threat > 72 ? 1300 + Math.random() * 1400 : 2500 + Math.random() * 2600)
}

function rotateAmbientHint(now) {
  const bank = [
    ...currentScenario().ambient,
    state.threat > 72 ? "Темнота уже дышит в щель щитка." : "Тонкий гул держится под металлом.",
    state.timeLeft < 12 ? "Времени осталось меньше, чем терпения у панели." : "Щиток ждёт не слов, а правильного ритма.",
  ]

  elements.ambientHint.textContent = pick(bank)
  state.nextHintAt = now + 6200 + Math.random() * 2600
}

function updateMicroMotion(now) {
  const threatFactor = clamp(state.threat / 100, 0, 1)
  const swayA = Math.sin(now / 540) * (0.8 + threatFactor * 1.6)
  const swayB = Math.cos(now / 630) * (0.6 + threatFactor * 1.2)

  wireRuns.forEach((wire, index) => {
    const sign = index % 2 === 0 ? 1 : -1
    wire.style.transform = `rotate(${(swayA + swayB * sign) * 0.65}deg)`
  })

  bundleCables.forEach((wire, index) => {
    const drift = Math.sin(now / (420 + index * 60)) * (0.14 + threatFactor * 0.22)
    wire.style.transform = `rotate(${(-4 + index * 2) + drift}deg)`
  })
}

function isNetworkLive() {
  return state.states.fuse && state.states.network
}

function isLineLive() {
  return isNetworkLive() && state.states.line
}

function isLoadLive() {
  return isLineLive() && state.states.load
}

function hasLineNoise() {
  const scenarioId = currentScenario().id
  const networkLive = isNetworkLive()

  if (!networkLive) {
    return false
  }

  if (scenarioId === "short-line") {
    return state.states.line
  }

  if (scenarioId === "overheat") {
    return state.states.network || state.states.line || state.states.load
  }

  return state.states.load && !state.states.line
}

function computeVoltage() {
  return isLineLive() ? 220 : 0
}

function syncUI() {
  const stage = currentStage()
  const voltage = computeVoltage()
  const networkLive = isNetworkLive()
  const lineLive = isLineLive()
  const lineNoise = hasLineNoise()
  const noiseActive = Boolean(lineNoise && !state.roundWon && !state.gameOver)
  const threat = clamp(state.threat, 0, 100)
  const safeTime = Math.max(0, state.timeLeft)
  const waitSecondsLeft = stage?.type === "wait"
    ? Math.max(0, stage.seconds - state.waitProgress)
    : 0
  const isMessageActive = performance.now() < state.messageUntil
  const message = performance.now() < state.messageUntil
    ? state.messageText
    : stage?.hint || currentScenario().intro
  const angle = -68 + (voltage / 220) * 136

  elements.stateBadge.textContent = deriveStatus()
  elements.roundCounter.textContent = `${state.roundIndex + 1} / ${totalRounds}`
  elements.currentStep.textContent = stage?.uiLabel || currentScenario().label
  elements.statusMessage.textContent = stage?.type === "wait"
    ? `${message} ${waitSecondsLeft.toFixed(1)}с`
    : message
  elements.timerLabel.textContent = formatTime(safeTime)
  elements.timerLabel.classList.toggle("is-critical", safeTime <= 12 || threat >= 78)
  elements.voltageLabel.textContent = `${voltage}В`
  elements.voltageState.textContent = lineLive
    ? "ЛИНИЯ"
    : noiseActive
      ? "ШУМ"
      : "ТИХО"
  elements.voltageDial.setAttribute(
    "aria-label",
    noiseActive
      ? `Напряжение линии: ${voltage} вольт. Аварийный шум на линии.`
      : `Напряжение линии: ${voltage} вольт.`,
  )
  elements.voltageNeedle.style.setProperty("--needle-angle", `${angle}deg`)
  elements.voltageNeedle.style.transform = `translateX(-50%) rotate(${angle}deg)`
  elements.ambientHint.textContent ||= pick(currentScenario().ambient)

  componentOrder.forEach((action) => {
    const component = components[action]
    const isOn = state.states[action]
    const isCurrent = Boolean(state.active && !state.roundWon && !state.gameOver && stage?.type !== "wait" && stage?.action === action)

    component.button.classList.toggle("is-active", isOn)
    component.button.classList.toggle("is-current", isCurrent)
    component.image.src = isOn ? component.image.dataset.on : component.image.dataset.off
  })

  elements.powerIndicator.classList.toggle("is-live", networkLive && !state.blackout)
  elements.alarmIndicator.dataset.level = String(Math.max(state.faults, threat >= 75 ? 2 : threat >= 45 ? 1 : 0))
  elements.faultCounter.textContent = `${state.faults} / ${maxFaults}`

  faultDots.forEach((dot, index) => {
    dot.classList.toggle("is-live", index < state.faults)
  })

  elements.voltageDial.classList.toggle("is-live", lineLive && threat < 50 && !state.roundWon)
  elements.voltageDial.classList.toggle("is-noisy", noiseActive)
  elements.voltageDial.classList.toggle("is-quiet", !lineLive && !noiseActive && !state.roundWon && !state.gameOver)
  elements.voltageDial.classList.toggle("is-threat", threat >= 45 && threat < 82 && !state.gameOver)
  elements.voltageDial.classList.toggle("is-overload", threat >= 82 || state.gameOver)
  elements.voltageDial.classList.toggle("is-restored", state.roundWon)

  body.classList.toggle("power-live", networkLive && !state.blackout)
  body.classList.toggle("threat-low", threat >= 35 && threat < 68)
  body.classList.toggle("threat-high", threat >= 68 && !state.roundWon)
  body.classList.toggle("cooldown-stage", Boolean(state.active && stage?.type === "wait"))

  elements.statusLine.classList.toggle("is-error", isMessageActive && state.messageKind === "error")
  elements.statusLine.classList.toggle("is-success", state.roundWon || (isMessageActive && state.messageKind === "success"))
  elements.statusLine.classList.toggle("is-neutral", isMessageActive && state.messageKind === "neutral")
  elements.statusLine.classList.toggle("is-cooldown", Boolean(state.active && stage?.type === "wait"))

  const dim = clamp(1 - threat / 155, 0.42, 1)
  const contrast = 1 + threat / 160
  const beam = state.blackout ? 0 : clamp(0.82 - threat / 280, 0.28, 0.92)
  const grime = clamp(0.34 + threat / 150, 0.34, 0.82)
  const vignette = clamp(0.78 + threat / 120, 0.78, 1.16)

  elements.cabinet.style.filter = `brightness(${dim}) contrast(${contrast})`
  elements.screenBeam.style.opacity = String(beam)
  elements.screenGrime.style.opacity = String(grime)
  elements.screenVignette.style.opacity = String(vignette)

  syncAudioBed()
}

function deriveStatus() {
  if (state.gameOver) {
    return "Авария"
  }

  if (state.roundWon) {
    return currentScenario().victoryStatus || "Стабильно"
  }

  if (currentStage()?.type === "wait") {
    return "Остывание"
  }

  if (state.threat >= 72) {
    return "Паника"
  }

  if (state.threat >= 38) {
    return "Тревога"
  }

  return currentScenario().badge
}

function showOverlay({ type, eyebrow, title, text, cap, main }) {
  elements.overlay.classList.remove("hidden", "is-victory", "is-gameover")
  elements.overlay.classList.add(type === "gameover" ? "is-gameover" : "is-victory")
  elements.overlayEyebrow.textContent = eyebrow
  elements.overlayTitle.textContent = title
  elements.overlayText.textContent = text
  elements.overlayRestartButton.querySelector(".restart-cap").textContent = cap
  elements.overlayRestartButton.querySelector(".restart-main").textContent = main
}

function hideOverlay() {
  elements.overlay.classList.add("hidden")
  elements.overlay.classList.remove("is-victory", "is-gameover")
}

function nudgeComponent(action, className) {
  const component = components[action]

  if (!component) {
    return
  }

  component.button.classList.remove(className)
  void component.button.offsetWidth
  component.button.classList.add(className)

  setTimeout(() => {
    component.button.classList.remove(className)
  }, 420)
}

function shake(duration = 180) {
  body.classList.remove("is-shaking")
  void body.offsetWidth
  body.classList.add("is-shaking")

  setTimeout(() => {
    body.classList.remove("is-shaking")
  }, duration)
}

function flicker(duration = 190) {
  body.classList.remove("is-flickering")
  void body.offsetWidth
  body.classList.add("is-flickering")

  setTimeout(() => {
    body.classList.remove("is-flickering")
  }, duration)
}

function sparkBurst(side) {
  const targets = side === "both"
    ? sparks
    : sparks.filter((spark) => spark.classList.contains(`spark-${side}`))

  targets.forEach((spark) => {
    spark.classList.remove("is-active")
    void spark.offsetWidth
    spark.classList.add("is-active")
  })
}

function playIntroSequence() {
  if (state.introPlayed) {
    return
  }

  state.introPlayed = true
  body.classList.add("intro-playing")

  setTimeout(() => {
    body.classList.remove("intro-playing")
  }, 1750)
}

function attemptAmbientAutoplay() {
  startAudioBed()
}

function unlockAudio() {
  state.userActivatedAudio = true
  startAudioBed()
}

function startAudioBed() {
  startLoop("room")
  startLoop("hum")
  startLoop("industrial")
}

async function startLoop(name) {
  const loop = loops[name]

  if (!loop) {
    return false
  }

  try {
    await loop.audio.play()
    return true
  } catch {
    return false
  }
}

function syncAudioBed() {
  const threat = clamp(state.threat / 100, 0, 1)
  const powerFactor = state.states.network ? 1 : 0.3
  const blackout = state.blackout ? 1 : 0

  setLoopVolume("room", blackout ? 0.05 : 0.1 + threat * 0.06)
  setLoopVolume("hum", blackout ? 0 : (state.states.fuse && state.states.network ? 0.035 + threat * 0.03 * powerFactor : 0.008))
  setLoopVolume("industrial", blackout ? 0.018 : threat > 0.35 ? 0.008 + threat * 0.035 : 0)
}

function setLoopVolume(name, value) {
  const loop = loops[name]

  if (!loop) {
    return
  }

  loop.targetVolume = clamp(value, 0, 0.22)
  loop.audio.volume += (loop.targetVolume - loop.audio.volume) * 0.24
}

function getOneShotAudio(name) {
  const src = audioFiles[name]

  if (!src) {
    return null
  }

  if (!oneShotPools[name]) {
    oneShotPools[name] = []
  }

  const pool = oneShotPools[name]
  const reusable = pool.find((audio) => audio.paused || audio.ended)

  if (reusable) {
    reusable.currentTime = 0
    return reusable
  }

  if (pool.length < 4) {
    const audio = new Audio(src)
    audio.preload = "auto"
    audio._stopTimeout = null
    pool.push(audio)
    return audio
  }

  if (pool[0]._stopTimeout) {
    clearTimeout(pool[0]._stopTimeout)
    pool[0]._stopTimeout = null
  }

  pool[0].pause()
  pool[0].currentTime = 0
  return pool[0]
}

function playActionSound(action, volumeFactor) {
  const map = {
    fuse: { name: "fuse", volume: 0.36, maxDuration: 340 },
    network: { name: "network", volume: 0.42, maxDuration: 860 },
    line: { name: "line", volume: 0.44, maxDuration: 420 },
    load: { name: "load", volume: 0.34, maxDuration: 340 },
  }

  const sound = map[action]

  if (!sound) {
    return
  }

  playOneShot(sound.name, {
    volume: sound.volume * volumeFactor,
    maxDuration: sound.maxDuration,
  })
}

function playOneShot(name, options = {}) {
  if (!state.userActivatedAudio) {
    return
  }

  const audio = getOneShotAudio(name)

  if (!audio) {
    return
  }

  if (audio._stopTimeout) {
    clearTimeout(audio._stopTimeout)
    audio._stopTimeout = null
  }

  audio.pause()
  audio.currentTime = 0
  audio.volume = clamp(options.volume ?? 0.3, 0, 1)
  audio.play().catch(() => {})

  if (options.maxDuration) {
    audio._stopTimeout = setTimeout(() => {
      audio.pause()
      audio.currentTime = 0
      audio._stopTimeout = null
    }, options.maxDuration)
  }
}
