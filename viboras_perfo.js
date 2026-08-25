// =========================
// Snake Digits - Optimized Smooth Version
// OpenProcessing / p5.js
// =========================

// ---------- 全局配置 ----------
const TOTAL_SNAKES = 14

// 蛇身长度
const SEGMENT_COUNT = 128
const HISTORY_GAP = 1
const BG_BRIGHTNESS = 95

let backgroundMode = 'dark' // "dark" or "light"
const BACKGROUND_THEMES = {
  dark: {
    bg: [220, 30, 8],
    boxFill: [190, 25, 18, 0.32],
    boxStroke: [170, 45, 78, 0.5],
    boxInnerStroke: [185, 35, 92, 0.3]
  },
  light: {
    bg: [0, 0, BG_BRIGHTNESS],
    boxFill: [170, 18, 100, 0.08],
    boxStroke: [150, 45, 70, 0.42],
    boxInnerStroke: [185, 35, 92, 0.3]
  }
}

const DISPLAY_COUNT_MIN = 5
const DISPLAY_COUNT_MAX = 5
const DIGIT_HOLD_TIME_MIN_MS = 5000
const DIGIT_HOLD_TIME_MAX_MS = 10000

// true: 固定时间脚本; false: 随机场景
const USE_FIXED_TIMELINE = false

// área de display: casi pantalla completa para que las letras sean grandes
const DIGIT_AREA_X0 = 0.02
const DIGIT_AREA_X1 = 0.98
const DIGIT_AREA_Y0 = 0.05
const DIGIT_AREA_Y1 = 0.78

// 框外普通蛇速度
const ROAM_SPEED_MIN = 1.6
const ROAM_SPEED_MAX = 2.0

// 框外蛇分布与避让
const INITIAL_MIN_DIST = 110
const ROAM_REPEL_DIST = 85
const ROAM_REPEL_STRENGTH = 0.1

// 被选中进入数字框的蛇的速度倍率
const APPROACH_SPEED_MUL = 1.55
const INSIDE_BOX_SPEED_MUL = 2.0
const FORM_TRACE_SPEED_MUL = 2.4
const MOVE_OUT_SPEED_MUL = 1.35

// 单帧最大位移限制
const MAX_SELECTED_STEP = 6.2
const MAX_FORM_TRACE_STEP = 7.8
const MAX_MOVE_OUT_STEP = 6.6

// 数字路径和入场路径预采样数量
const DIGIT_SAMPLE_COUNT = 240
const ENTRY_SAMPLE_COUNT = 180

// 入场阶段的蜿蜒游动参数
const ENTRY_WIGGLE_AMP = 12
const ENTRY_WIGGLE_FREQ_DIST = 0.055
const ENTRY_WIGGLE_FREQ_TIME = 6.5
const ENTRY_WIGGLE_ANGLE_AMP = 0.34

// 蛇退出数字框后，下一轮开始前的等待时间
const LEAVE_TO_NEXT_DELAY_MIN_MS = 1000
const LEAVE_TO_NEXT_DELAY_MAX_MS = 1500

// 每帧最多向历史中追加的点数
const MAX_APPEND_STEPS_PER_FRAME = 5

// 真实时间补偿上限，避免掉帧后“补偿过猛”导致视觉卡顿
const TIME_SCALE_MIN = 0.75
const TIME_SCALE_MAX = 1.35

// 颗粒显示参数
const PARTICLE_SIZE_SCALE = 1.0
const PARTICLE_HIGHLIGHT_SCALE = 0.24

// 绘制层轻量化：按蛇身区域自适应抽样绘制
const RENDER_FULL_UNTIL = 22
const RENDER_MID_UNTIL = 58
const RENDER_STEP_ROAM_MID = 2
const RENDER_STEP_ROAM_TAIL = 3
const RENDER_STEP_DIGIT_MID = 1
const RENDER_STEP_DIGIT_TAIL = 2
const HIGHLIGHT_FRONT_LIMIT = 34
const HIGHLIGHT_STRIDE = 4
const MIN_DRAW_DIAMETER = 1.6

// 鲜亮青绿色蛇身配色
const SNAKE_PALETTES = [
  { base: 95, accent: 145, head: 125 },
  { base: 120, accent: 175, head: 150 },
  { base: 145, accent: 190, head: 172 },
  { base: 165, accent: 205, head: 188 },
  { base: 105, accent: 175, head: 140 },
  { base: 135, accent: 185, head: 160 },
  { base: 82, accent: 135, head: 110 },
  { base: 155, accent: 210, head: 185 }
]

// 固定时间脚本示例
const TIMELINE = [
  { digits: [2] },
  { digits: [4, 5, 7] },
  { digits: [2, 9] },
  { digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
]

let snakes = []
let scheduler
let timelineIndex = 0
let themeToggleButton

// ---------- p5 ----------
function setup () {
  createCanvas(windowWidth, windowHeight)
  pixelDensity(1)
  colorMode(HSB, 360, 100, 100, 1)
  rectMode(CORNER)
  noStroke()

  for (let i = 0; i < TOTAL_SNAKES; i++) {
    let pos = getSparseRoamPos()
    snakes.push(new SnakeAgent(i, pos.x, pos.y))
  }

  scheduler = new SceneScheduler()
  scheduler.nextScene()
  createThemeToggleButton()
}

function draw () {
  const theme = getBackgroundTheme()
  background(theme.bg[0], theme.bg[1], theme.bg[2])

  drawDisplayAreaHint()
  scheduler.update()

  for (let s of snakes) {
    s.update()
    s.display()
  }
}

function windowResized () {
  resizeCanvas(windowWidth, windowHeight)
  positionThemeToggleButton()
  scheduler.forceRefreshScene()
}

function getBackgroundTheme () {
  return BACKGROUND_THEMES[backgroundMode] || BACKGROUND_THEMES.dark
}

function createThemeToggleButton () {
  themeToggleButton = createButton('')
  themeToggleButton.mousePressed(toggleBackgroundMode)
  positionThemeToggleButton()
  updateThemeToggleButton()
}

function toggleBackgroundMode () {
  backgroundMode = backgroundMode === 'dark' ? 'light' : 'dark'
  updateThemeToggleButton()
}

function positionThemeToggleButton () {
  if (!themeToggleButton) return
  themeToggleButton.position(width - 150, 20)
}

function updateThemeToggleButton () {
  if (!themeToggleButton) return

  if (backgroundMode === 'dark') {
    themeToggleButton.html('Switch to Light Mode')
    themeToggleButton.style('background', 'rgba(20, 28, 38, 0.72)')
    themeToggleButton.style('color', 'rgba(245, 248, 255, 0.95)')
    themeToggleButton.style('border', '1px solid rgba(180, 220, 220, 0.35)')
  } else {
    themeToggleButton.html('Switch to Dark Mode')
    themeToggleButton.style('background', 'rgba(255, 255, 255, 0.72)')
    themeToggleButton.style('color', 'rgba(30, 40, 50, 0.95)')
    themeToggleButton.style('border', '1px solid rgba(80, 130, 130, 0.30)')
  }

  themeToggleButton.style('padding', '8px 12px')
  themeToggleButton.style('border-radius', '16px')
  themeToggleButton.style('font-size', '13px')
  themeToggleButton.style('font-family', 'Arial, sans-serif')
  themeToggleButton.style('cursor', 'pointer')
  themeToggleButton.style('outline', 'none')
  themeToggleButton.style('backdrop-filter', 'blur(6px)')
  themeToggleButton.style('z-index', '10')
}

// deltaTime 真实时间补偿
function getTimeScale () {
  return constrain(deltaTime / 16.6667, TIME_SCALE_MIN, TIME_SCALE_MAX)
}

// 对 lerp 做时间补偿
function scaledLerpRate (rate, timeScale) {
  return 1 - pow(1 - rate, timeScale)
}

// 获取一个必定在数字框外的随机坐标
function getRandomRoamPos () {
  let x, y
  let bx0 = width * DIGIT_AREA_X0
  let bx1 = width * DIGIT_AREA_X1
  let by0 = height * DIGIT_AREA_Y0
  let by1 = height * DIGIT_AREA_Y1

  let inBox = true

  while (inBox) {
    x = random(width)
    y = random(height)

    if (x < bx0 || x > bx1 || y < by0 || y > by1) {
      inBox = false
    }
  }

  return createVector(x, y)
}

// 初始位置尽量稀疏
function getSparseRoamPos () {
  let bestPos = getRandomRoamPos()
  let bestScore = -1

  for (let attempt = 0; attempt < 80; attempt++) {
    let p = getRandomRoamPos()
    let minD = Infinity

    for (let s of snakes) {
      let d = dist(p.x, p.y, s.pos.x, s.pos.y)
      minD = min(minD, d)
    }

    if (snakes.length === 0) return p

    if (minD > bestScore) {
      bestScore = minD
      bestPos = p
    }

    if (minD > INITIAL_MIN_DIST) return p
  }

  return bestPos
}

// =========================
// 场景调度器
// =========================
class SceneScheduler {
  constructor () {
    this.sceneStart = millis()
    this.state = 'IDLE'
    this.holdEndTime = 0
    this.idleDelay = random(
      LEAVE_TO_NEXT_DELAY_MIN_MS,
      LEAVE_TO_NEXT_DELAY_MAX_MS
    )
    this.activeSnakes = []
  }

  update () {
    if (this.state === 'FORMING') {
      let allHolding = true

      for (let s of this.activeSnakes) {
        if (s.state !== 'HOLD_DIGIT') {
          allHolding = false
          break
        }
      }

      if (allHolding && this.activeSnakes.length > 0) {
        this.state = 'HOLDING'
        this.holdEndTime =
          millis() + random(DIGIT_HOLD_TIME_MIN_MS, DIGIT_HOLD_TIME_MAX_MS)
      }
    } else if (this.state === 'HOLDING') {
      if (millis() > this.holdEndTime) {
        for (let s of this.activeSnakes) {
          s.commandLeave()
        }

        this.state = 'WAITING_TO_CLEAR'
        this.sceneStart = millis()
      }
    } else if (this.state === 'WAITING_TO_CLEAR') {
      let anyActive = false

      for (let s of this.activeSnakes) {
        if (s.isInDigitState()) {
          anyActive = true
          break
        }
      }

      if (!anyActive) {
        this.state = 'IDLE'
        this.sceneStart = millis()
        this.idleDelay = random(
          LEAVE_TO_NEXT_DELAY_MIN_MS,
          LEAVE_TO_NEXT_DELAY_MAX_MS
        )
      }
    } else if (this.state === 'IDLE') {
      if (millis() - this.sceneStart > this.idleDelay) {
        this.nextScene()
      }
    }

    if (this.state !== 'IDLE' && millis() - this.sceneStart > 20000) {
      this.nextScene()
    }
  }

  nextScene () {
    let count = floor(random(DISPLAY_COUNT_MIN, DISPLAY_COUNT_MAX + 1))
    let digits = chooseDigits(count)

    this.sceneStart = millis()
    this.state = 'FORMING'
    this.activeSnakes = []

    let slots = buildDigitSlots(digits.length)

    for (let s of snakes) {
      s.clearDigitTask()
    }

    let assignments = chooseNearestSnakesForSlots(digits, slots)

    for (let item of assignments) {
      let snake = item.snake
      let digit = item.digit
      let slot = item.slot

      snake.assignDigit(digit, slot.x, slot.y, slot.size)
      this.activeSnakes.push(snake)
    }
  }

  forceRefreshScene () {
    this.sceneStart = 0
    this.state = 'IDLE'
    this.idleDelay = random(
      LEAVE_TO_NEXT_DELAY_MIN_MS,
      LEAVE_TO_NEXT_DELAY_MAX_MS
    )
  }
}

// =========================
// 蛇对象
// =========================
class SnakeAgent {
  constructor (id, x, y) {
    this.id = id
    this.state = 'ROAM'

    this.pos = createVector(x, y)

    this.macroHeading = random(TWO_PI)
    this.heading = this.macroHeading

    this.baseSpeed = random(ROAM_SPEED_MIN, ROAM_SPEED_MAX)

    let palette = SNAKE_PALETTES[id % SNAKE_PALETTES.length]
    this.baseHue = palette.base + random(-6, 6)
    this.accentHue = palette.accent + random(-8, 8)
    this.headHue = palette.head + random(-5, 5)

    this.satBase = random(82, 96)
    this.briBase = random(60, 76)

    this.phase = random(TWO_PI)
    this.pathWobble = random(1.3, 2.6)

    this.segments = []
    this.history = []
    this.renderMeta = []

    this.HISTORY_MAX = SEGMENT_COUNT * HISTORY_GAP + 42
    this.historyHead = 0

    for (let i = 0; i < this.HISTORY_MAX; i++) {
      this.history.push({
        x: this.pos.x,
        y: this.pos.y,
        angle: this.heading
      })
    }

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      let t = i / (SEGMENT_COUNT - 1)
      let w = lerp(10.8, 2.2, t)
      let h = w * 0.72
      let sizeMul = lerp(1.13, 0.84, t)
      let briOffset = lerp(18, -6, t)
      let highlight = i <= HIGHLIGHT_FRONT_LIMIT && i % HIGHLIGHT_STRIDE === 0

      this.segments.push({
        x: x,
        y: y,
        angle: this.heading,
        w: w,
        h: h
      })

      this.renderMeta.push({
        sizeMul: sizeMul,
        briOffset: briOffset,
        highlight: highlight
      })
    }

    this.segmentHistoryIndex = []
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      this.segmentHistoryIndex.push(
        constrain(floor(i * HISTORY_GAP), 0, this.HISTORY_MAX - 1)
      )
    }

    this.digit = null

    this.digitPath = null
    this.digitAngles = []
    this.digitTotalLen = 0

    this.entryPath = null
    this.entryAngles = []
    this.entryTotalLen = 0

    this.fullDigitHistory = []

    this.entryDist = 0
    this.lastEntryDist = 0

    this.traceDist = 0
    this.lastTraceDist = 0

    this.traceSpeed = 2.0
    this.sampleSpacing = 2.0

    this.releaseTarget = null
  }

  isInDigitState () {
    return this.state !== 'ROAM'
  }

  isInsideDigitBox (pad = 0) {
    let bx0 = width * DIGIT_AREA_X0
    let bx1 = width * DIGIT_AREA_X1
    let by0 = height * DIGIT_AREA_Y0
    let by1 = height * DIGIT_AREA_Y1

    return (
      this.pos.x > bx0 - pad &&
      this.pos.x < bx1 + pad &&
      this.pos.y > by0 - pad &&
      this.pos.y < by1 + pad
    )
  }

  getHistoryPoint (offset) {
    return this.history[(this.historyHead + offset) % this.HISTORY_MAX]
  }

  setHistoryPoint (offset, x, y, angle) {
    let p = this.history[(this.historyHead + offset) % this.HISTORY_MAX]
    p.x = x
    p.y = y
    p.angle = angle
  }

  clearDigitTask () {
    if (this.state === 'ROAM') return

    this.state = 'ROAM'
    this.digit = null

    this.digitPath = null
    this.digitAngles = []
    this.digitTotalLen = 0

    this.entryPath = null
    this.entryAngles = []
    this.entryTotalLen = 0

    this.fullDigitHistory = []

    this.entryDist = 0
    this.lastEntryDist = 0

    this.traceDist = 0
    this.lastTraceDist = 0

    this.releaseTarget = null
  }

  assignDigit (digit, cx, cy, size) {
    this.digit = digit

    let rawDigitPath = buildDigitPath(digit, cx, cy, size)
    this.digitPath = resamplePolylineByCount(rawDigitPath, DIGIT_SAMPLE_COUNT)
    this.digitTotalLen = computePathLength(this.digitPath)
    this.digitAngles = buildPathAngles(this.digitPath)

    let start = this.digitPath[0]
    let startAngle = this.digitAngles[0]

    let rawEntryPath = buildCurvedEntryPath(
      this.pos.x,
      this.pos.y,
      this.heading,
      start.x,
      start.y,
      startAngle,
      this.id
    )

    this.entryPath = resamplePolylineByCount(rawEntryPath, ENTRY_SAMPLE_COUNT)
    this.entryTotalLen = computePathLength(this.entryPath)
    this.entryAngles = buildPathAngles(this.entryPath)

    this.traceSpeed =
      (this.digitTotalLen / max(1, SEGMENT_COUNT * HISTORY_GAP)) *
      FORM_TRACE_SPEED_MUL

    this.sampleSpacing = max(
      1.25,
      this.digitTotalLen / max(1, this.HISTORY_MAX - 2)
    )

    this.fullDigitHistory = this.buildFullDigitHistoryTargets()

    this.entryDist = 0
    this.lastEntryDist = 0

    this.traceDist = 0
    this.lastTraceDist = 0

    this.state = 'ENTER_DIGIT'
  }

  commandLeave () {
    if (this.state === 'HOLD_DIGIT' || this.state === 'FORM_DIGIT') {
      this.syncHistoryFromSegments()

      this.pos.x = this.segments[0].x
      this.pos.y = this.segments[0].y
      this.heading = this.segments[0].angle

      this.state = 'MOVE_OUT'

      let bx0 = width * DIGIT_AREA_X0
      let bx1 = width * DIGIT_AREA_X1
      let by0 = height * DIGIT_AREA_Y0
      let by1 = height * DIGIT_AREA_Y1

      let dL = abs(this.pos.x - bx0)
      let dR = abs(this.pos.x - bx1)
      let dT = abs(this.pos.y - by0)
      let dB = abs(this.pos.y - by1)

      let minD = min(dL, dR, dT, dB)
      let tx = this.pos.x
      let ty = this.pos.y

      let pad = 60

      if (minD === dL) tx = bx0 - pad
      else if (minD === dR) tx = bx1 + pad
      else if (minD === dT) ty = by0 - pad
      else ty = by1 + pad

      this.releaseTarget = createVector(tx, ty)
      this.macroHeading = this.heading
    }
  }

  update () {
    let tScale = getTimeScale()
    let moved = false

    if (this.state === 'ROAM') {
      this.doRoam(tScale)
      moved = true
    } else if (this.state === 'ENTER_DIGIT') {
      this.lastEntryDist = this.entryDist

      let speedMul = this.isInsideDigitBox(10)
        ? INSIDE_BOX_SPEED_MUL
        : APPROACH_SPEED_MUL

      let step = this.baseSpeed * speedMul * tScale
      step = min(step, MAX_SELECTED_STEP)

      this.entryDist += step

      if (this.entryDist >= this.entryTotalLen) {
        this.entryDist = this.entryTotalLen
        this.state = 'FORM_DIGIT'

        this.traceDist = 0
        this.lastTraceDist = 0
      }

      let pose = this.getEntryWigglePose(this.entryDist)

      this.pos.x = pose.x
      this.pos.y = pose.y
      this.heading = pose.angle

      this.appendEntryTravelToHistory(this.lastEntryDist, this.entryDist)

      moved = false
    } else if (this.state === 'FORM_DIGIT') {
      this.lastTraceDist = this.traceDist

      let step = this.traceSpeed * tScale
      step = min(step, MAX_FORM_TRACE_STEP)

      this.traceDist += step

      if (this.traceDist >= this.digitTotalLen) {
        this.traceDist = this.digitTotalLen
        this.state = 'HOLD_DIGIT'
      }

      let pt = getPathPointAt(
        this.digitPath,
        this.digitTotalLen,
        this.traceDist
      )
      let angle = getPathAngleAt(
        this.digitAngles,
        this.digitTotalLen,
        this.traceDist
      )

      this.pos.x = pt.x
      this.pos.y = pt.y
      this.heading = angle

      this.appendTravelToHistory(
        this.digitPath,
        this.digitAngles,
        this.digitTotalLen,
        this.lastTraceDist,
        this.traceDist
      )

      moved = false
    } else if (this.state === 'HOLD_DIGIT') {
      this.relaxHistoryToFullDigit(0.1, tScale)
      moved = false
    } else if (this.state === 'MOVE_OUT') {
      moved = this.steerTo(
        this.releaseTarget.x,
        this.releaseTarget.y,
        0.1,
        20,
        MOVE_OUT_SPEED_MUL,
        tScale,
        MAX_MOVE_OUT_STEP
      )

      if (moved === 'ARRIVED') {
        this.clearDigitTask()
        moved = true
      }
    }

    if (moved === true) {
      this.pushHistoryPoint(this.pos.x, this.pos.y, this.heading)
    }

    this.applyHistoryToSegments(tScale)
  }

  // ---------- 入场路径上的蛇形摆动 ----------
  getEntryWigglePose (d) {
    let basePt = getPathPointAt(this.entryPath, this.entryTotalLen, d)
    let baseAngle = getPathAngleAt(this.entryAngles, this.entryTotalLen, d)

    let progress = constrain(d / max(1, this.entryTotalLen), 0, 1)
    let taper = sin(PI * progress)
    let now = millis() * 0.001

    let wave =
      sin(
        d * ENTRY_WIGGLE_FREQ_DIST + now * ENTRY_WIGGLE_FREQ_TIME + this.phase
      ) *
      ENTRY_WIGGLE_AMP *
      taper

    let angleWave =
      cos(
        d * ENTRY_WIGGLE_FREQ_DIST + now * ENTRY_WIGGLE_FREQ_TIME + this.phase
      ) *
      ENTRY_WIGGLE_ANGLE_AMP *
      taper

    let nx = -sin(baseAngle)
    let ny = cos(baseAngle)

    return {
      x: basePt.x + nx * wave,
      y: basePt.y + ny * wave,
      angle: baseAngle + angleWave
    }
  }

  // ---------- 入场阶段将“蜿蜒后的路径点”写入历史 ----------
  appendEntryTravelToHistory (fromDist, toDist) {
    if (!this.entryPath || this.entryTotalLen <= 0) return

    let span = max(0, toDist - fromDist)
    let steps = max(1, ceil(span / this.sampleSpacing))
    steps = min(steps, MAX_APPEND_STEPS_PER_FRAME)

    for (let k = 1; k <= steps; k++) {
      let d = lerp(fromDist, toDist, k / steps)
      d = constrain(d, 0, this.entryTotalLen)

      let pose = this.getEntryWigglePose(d)
      this.pushHistoryPoint(pose.x, pose.y, pose.angle)
    }
  }

  // ---------- 沿普通路径持续写入历史轨迹 ----------
  appendTravelToHistory (path, angles, totalLen, fromDist, toDist) {
    if (!path || totalLen <= 0) return

    let span = max(0, toDist - fromDist)
    let steps = max(1, ceil(span / this.sampleSpacing))
    steps = min(steps, MAX_APPEND_STEPS_PER_FRAME)

    for (let k = 1; k <= steps; k++) {
      let d = lerp(fromDist, toDist, k / steps)
      d = constrain(d, 0, totalLen)

      let p = getPathPointAt(path, totalLen, d)
      let a = getPathAngleAt(angles, totalLen, d)

      this.pushHistoryPoint(p.x, p.y, a)
    }
  }

  pushHistoryPoint (x, y, angle) {
    this.historyHead =
      (this.historyHead - 1 + this.HISTORY_MAX) % this.HISTORY_MAX
    let slot = this.history[this.historyHead]
    slot.x = x
    slot.y = y
    slot.angle = angle
  }

  // ---------- 预计算完整数字姿态 ----------
  buildFullDigitHistoryTargets () {
    let targets = []
    let bodyMaxIndex = max(1, (SEGMENT_COUNT - 1) * HISTORY_GAP)

    for (let j = 0; j < this.HISTORY_MAX; j++) {
      let r = constrain(j / bodyMaxIndex, 0, 1)
      let sampleDist = lerp(this.digitTotalLen, 0, r)

      let p = getPathPointAt(this.digitPath, this.digitTotalLen, sampleDist)
      let a = getPathAngleAt(this.digitAngles, this.digitTotalLen, sampleDist)

      targets.push({
        x: p.x,
        y: p.y,
        angle: a
      })
    }

    return targets
  }

  // ---------- 展示阶段向完整数字姿态靠拢 ----------
  relaxHistoryToFullDigit (alpha, tScale) {
    if (!this.fullDigitHistory || this.fullDigitHistory.length === 0) return

    let rate = scaledLerpRate(alpha, tScale)
    let hist = this.history
    let histHead = this.historyHead
    let histMax = this.HISTORY_MAX

    for (let j = 0; j < histMax; j++) {
      let h = hist[(histHead + j) % histMax]
      let target = this.fullDigitHistory[j]

      h.x = lerp(h.x, target.x, rate)
      h.y = lerp(h.y, target.y, rate)
      h.angle = lerpAngle(h.angle, target.angle, rate)
    }
  }

  // ---------- 将运动历史应用到蛇身 ----------
  applyHistoryToSegments (tScale) {
    let digitVisual = this.state === 'FORM_DIGIT' || this.state === 'HOLD_DIGIT'

    let followRate = scaledLerpRate(digitVisual ? 0.72 : 0.6, tScale)
    let angleRate = scaledLerpRate(digitVisual ? 0.52 : 0.4, tScale)

    let now = millis() * 0.001
    let hist = this.history
    let histHead = this.historyHead
    let histMax = this.HISTORY_MAX
    let segs = this.segments
    let indices = this.segmentHistoryIndex

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      let hPoint = hist[(histHead + indices[i]) % histMax]

      let px = hPoint.x
      let py = hPoint.y
      let pAngle = hPoint.angle

      if (digitVisual) {
        let headFactor = 1.0 + 0.35 * (1.0 - i / (SEGMENT_COUNT - 1))

        let sideWave =
          sin(now * 3.9 - i * 0.34 + this.phase) *
          this.pathWobble *
          0.2 *
          headFactor

        let nx = -sin(pAngle)
        let ny = cos(pAngle)

        px += nx * sideWave
        py += ny * sideWave
      }

      segs[i].x = lerp(segs[i].x, px, followRate)
      segs[i].y = lerp(segs[i].y, py, followRate)
      segs[i].angle = lerpAngle(segs[i].angle, pAngle, angleRate)
    }
  }

  // ---------- 退场前同步 history，防止跳变 ----------
  syncHistoryFromSegments () {
    let hist = this.history
    let histHead = this.historyHead
    let histMax = this.HISTORY_MAX

    for (let j = 0; j < histMax; j++) {
      let segIdx = constrain(
        floor(j / max(1, HISTORY_GAP)),
        0,
        SEGMENT_COUNT - 1
      )
      let seg = this.segments[segIdx]
      let p = hist[(histHead + j) % histMax]
      p.x = seg.x
      p.y = seg.y
      p.angle = seg.angle
    }
  }

  // ---------- 普通自然漫游 ----------
  doRoam (tScale) {
    let now = millis() * 0.001

    this.macroHeading +=
      map(noise(this.id, now * 0.35), 0, 1, -0.05, 0.05) * tScale

    let marginX = width * 0.05
    let marginY = height * 0.05
    let boundForceX = 0
    let boundForceY = 0

    if (this.pos.x < marginX) boundForceX = 1
    if (this.pos.x > width - marginX) boundForceX = -1
    if (this.pos.y < marginY) boundForceY = 1
    if (this.pos.y > height - marginY) boundForceY = -1

    let bx0 = width * DIGIT_AREA_X0
    let bx1 = width * DIGIT_AREA_X1
    let by0 = height * DIGIT_AREA_Y0
    let by1 = height * DIGIT_AREA_Y1

    let pad = 25

    // 普通游动蛇不能进入数字框
    if (
      this.pos.x > bx0 - pad &&
      this.pos.x < bx1 + pad &&
      this.pos.y > by0 - pad &&
      this.pos.y < by1 + pad
    ) {
      let cx = (bx0 + bx1) / 2
      let cy = (by0 + by1) / 2
      let away = atan2(this.pos.y - cy, this.pos.x - cx)

      this.macroHeading = lerpAngle(
        this.macroHeading,
        away,
        scaledLerpRate(0.16, tScale)
      )

      if (
        this.pos.x > bx0 &&
        this.pos.x < bx1 &&
        this.pos.y > by0 &&
        this.pos.y < by1
      ) {
        let dL = this.pos.x - bx0
        let dR = bx1 - this.pos.x
        let dT = this.pos.y - by0
        let dB = by1 - this.pos.y
        let minD = min(dL, dR, dT, dB)

        if (minD === dL) this.pos.x = bx0
        else if (minD === dR) this.pos.x = bx1
        else if (minD === dT) this.pos.y = by0
        else this.pos.y = by1
      }
    }

    if (boundForceX !== 0 || boundForceY !== 0) {
      let centerHeading = atan2(boundForceY, boundForceX)
      this.macroHeading = lerpAngle(
        this.macroHeading,
        centerHeading,
        scaledLerpRate(0.05, tScale)
      )
    }

    // 普通蛇之间避让
    const repelDistSq = ROAM_REPEL_DIST * ROAM_REPEL_DIST
    for (let other of snakes) {
      if (other === this || other.isInDigitState()) continue

      let dx = this.pos.x - other.pos.x
      let dy = this.pos.y - other.pos.y
      let dSq = dx * dx + dy * dy

      if (dSq > 0 && dSq < repelDistSq) {
        let d = sqrt(dSq)
        let away = atan2(dy, dx)
        let strength = map(d, 0, ROAM_REPEL_DIST, ROAM_REPEL_STRENGTH, 0)

        this.macroHeading = lerpAngle(
          this.macroHeading,
          away,
          scaledLerpRate(strength, tScale)
        )
      }
    }

    this.heading = this.macroHeading + sin(now * 7.2 + this.phase) * 0.55

    let roamSpeed = constrain(this.baseSpeed, ROAM_SPEED_MIN, ROAM_SPEED_MAX)

    this.pos.x += cos(this.heading) * roamSpeed * tScale
    this.pos.y += sin(this.heading) * roamSpeed * tScale
  }

  // ---------- 带缓震的定向移动，仅退场使用 ----------
  steerTo (
    tx,
    ty,
    turnRate,
    threshold,
    speedMul = 1.0,
    tScale = 1.0,
    maxStep = null
  ) {
    let d = dist(this.pos.x, this.pos.y, tx, ty)

    if (d < threshold) return 'ARRIVED'

    let desired = atan2(ty - this.pos.y, tx - this.pos.x)

    this.macroHeading = lerpAngle(
      this.macroHeading,
      desired,
      scaledLerpRate(turnRate, tScale)
    )

    let now = millis() * 0.001
    let slitherAmp = map(d, threshold, threshold + 100, 0, 0.5, true)

    this.heading = this.macroHeading + sin(now * 7.2 + this.phase) * slitherAmp

    let step = this.baseSpeed * speedMul * tScale

    if (maxStep !== null) {
      step = min(step, maxStep)
    }

    step = min(step, max(0, d - threshold * 0.35))

    this.pos.x += cos(this.heading) * step
    this.pos.y += sin(this.heading) * step

    return true
  }

  display () {
    let now = millis() * 0.001
    let inDigitState = this.isInDigitState()
    let digitHueShift = inDigitState ? (this.digit % 5) * 7 : 0

    for (let i = this.segments.length - 1; i >= 0; i--) {
      if (i > RENDER_FULL_UNTIL) {
        if (i <= RENDER_MID_UNTIL) {
          let stepMid = inDigitState
            ? RENDER_STEP_DIGIT_MID
            : RENDER_STEP_ROAM_MID
          if (i % stepMid !== 0) continue
        } else {
          let stepTail = inDigitState
            ? RENDER_STEP_DIGIT_TAIL
            : RENDER_STEP_ROAM_TAIL
          if (i % stepTail !== 0) continue
        }
      }

      let seg = this.segments[i]
      let meta = this.renderMeta[i]
      let t = i / (this.segments.length - 1)

      let wave = sin(now * 2.1 + i * 0.18 + this.phase)
      let hueMix = constrain(0.35 + t * 0.45 + wave * 0.12, 0, 1)

      let hueVal = lerp(this.baseHue, this.accentHue, hueMix)
      let satVal = this.satBase + wave * 4
      let briVal = this.briBase + meta.briOffset
      let alphaVal = 0.94

      if (inDigitState) {
        hueVal = lerp(this.accentHue, this.headHue + digitHueShift, hueMix)
        satVal = 94 + wave * 4
        briVal += 15
        alphaVal = 0.99
      }

      let d = seg.h * PARTICLE_SIZE_SCALE * meta.sizeMul
      if (d < MIN_DRAW_DIAMETER) continue

      fill(
        wrapHue(hueVal),
        constrain(satVal, 70, 100),
        constrain(briVal, 45, 100),
        alphaVal
      )
      circle(seg.x, seg.y, d)

      if (meta.highlight) {
        fill(
          wrapHue(hueVal + 16),
          constrain(satVal - 8, 60, 100),
          constrain(briVal + 12, 50, 100),
          0.34
        )
        circle(seg.x - d * 0.16, seg.y - d * 0.16, d * PARTICLE_HIGHLIGHT_SCALE)
      }
    }

    let head = this.segments[0]
    let headGlow = sin(now * 2.4 + this.phase) * 8

    fill(wrapHue(this.headHue + headGlow), 98, inDigitState ? 95 : 82, 0.98)
    circle(head.x, head.y, head.h * 0.94)

    fill(wrapHue(this.headHue + 25), 90, 34, 0.7)
    circle(head.x, head.y, head.h * 0.28)
  }
}

// =========================
// 辅助与工具函数
// =========================

function chooseNearestSnakesForSlots (digits, slots) {
  let available = [...snakes]
  let assignments = []

  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i]
    let slot = slots[i]

    let bestSnake = null
    let bestIdx = -1
    let bestScore = Infinity

    for (let j = 0; j < available.length; j++) {
      let s = available[j]

      let d = dist(s.pos.x, s.pos.y, slot.x, slot.y)
      let edgePenalty = s.isInsideDigitBox(80) ? 120 : 0
      let score = d + edgePenalty

      if (score < bestScore) {
        bestScore = score
        bestSnake = s
        bestIdx = j
      }
    }

    if (bestSnake) {
      assignments.push({
        snake: bestSnake,
        digit: digit,
        slot: slot
      })
      available.splice(bestIdx, 1)
    }
  }

  return assignments
}

function buildDigitSlots (count) {
  let slots = []
  let areaX0 = width * DIGIT_AREA_X0
  let areaX1 = width * DIGIT_AREA_X1
  let areaY0 = height * DIGIT_AREA_Y0
  let areaY1 = height * DIGIT_AREA_Y1

  let rows = count <= 5 ? 1 : 2 // 5 letras en una sola fila
  let cols = ceil(count / rows)
  let remaining = count

  for (let r = 0; r < rows; r++) {
    let itemsInRow = min(cols, remaining)
    let cellH = (areaY1 - areaY0) / rows
    let baseY = areaY0 + cellH * (r + 0.5)
    let rowW = areaX1 - areaX0
    let cellW = rowW / itemsInRow

    for (let c = 0; c < itemsInRow; c++) {
      let x = areaX0 + cellW * (c + 0.5)
      let y = baseY
      let size = min(cellW * 0.56, cellH * 0.8)

      x += random(-cellW * 0.03, cellW * 0.03)
      y += random(-cellH * 0.03, cellH * 0.03)

      slots.push({ x, y, size })
    }

    remaining -= itemsInRow
  }

  return slots
}

function chooseDigits (count) {
  // 10 = B, 11 = A, 12 = S, 13 = T  →  siempre forma "BASTA"
  return [10, 11, 12, 13, 11]
}

function drawDisplayAreaHint () {
  let x = width * DIGIT_AREA_X0
  let y = height * DIGIT_AREA_Y0
  let w = width * (DIGIT_AREA_X1 - DIGIT_AREA_X0)
  let h = height * (DIGIT_AREA_Y1 - DIGIT_AREA_Y0)
  const theme = getBackgroundTheme()

  push()

  noStroke()
  fill(theme.boxFill[0], theme.boxFill[1], theme.boxFill[2], theme.boxFill[3])
  rect(x, y, w, h, 18)

  noFill()
  stroke(
    theme.boxStroke[0],
    theme.boxStroke[1],
    theme.boxStroke[2],
    theme.boxStroke[3]
  )
  strokeWeight(2.2)
  rect(x, y, w, h, 18)

  stroke(
    theme.boxInnerStroke[0],
    theme.boxInnerStroke[1],
    theme.boxInnerStroke[2],
    theme.boxInnerStroke[3]
  )
  strokeWeight(1.0)
  rect(x + 6, y + 6, w - 12, h - 12, 14)

  pop()
}

function buildCurvedEntryPath (sx, sy, sheading, tx, ty, targetAngle, seed) {
  let pts = []
  let d = dist(sx, sy, tx, ty)

  let currentDir = createVector(cos(sheading), sin(sheading))
  let targetDir = createVector(cos(targetAngle), sin(targetAngle))

  let c1Len = constrain(d * 0.42, 60, 180)
  let c2Len = constrain(d * 0.34, 50, 160)

  let c1 = createVector(sx, sy).add(currentDir.mult(c1Len))
  let c2 = createVector(tx, ty).sub(targetDir.mult(c2Len))

  // 增加横向偏移，让入场路径自然弯曲
  let mainAngle = atan2(ty - sy, tx - sx)
  let nx = -sin(mainAngle)
  let ny = cos(mainAngle)

  let side = seed % 2 === 0 ? 1 : -1
  let offset = constrain(d * 0.18, 35, 110) * side

  c1.x += nx * offset * 0.7
  c1.y += ny * offset * 0.7
  c2.x += nx * offset * 0.5
  c2.y += ny * offset * 0.5

  pushBezier(pts, sx, sy, c1.x, c1.y, c2.x, c2.y, tx, ty, 90)

  return pts
}

function buildDigitPath (digit, cx, cy, size) {
  let pts = normalizedDigitStroke(digit)
  let sx = size * 0.62
  let sy = size * 0.94

  let out = []

  for (let p of pts) {
    out.push(createVector(cx + (p.x - 0.5) * sx, cy + (p.y - 0.5) * sy))
  }

  return out
}

function normalizedDigitStroke (d) {
  let pts = []

  const L = (x1, y1, x2, y2, steps = 20) => pushLine(pts, x1, y1, x2, y2, steps)

  const B = (x1, y1, cx1, cy1, cx2, cy2, x2, y2, steps = 28) =>
    pushBezier(pts, x1, y1, cx1, cy1, cx2, cy2, x2, y2, steps)

  switch (d) {
    case 0:
      B(0.52, 0.08, 0.2, 0.08, 0.16, 0.9, 0.5, 0.92, 34)
      B(0.5, 0.92, 0.82, 0.9, 0.84, 0.1, 0.52, 0.08, 34)
      break

    case 1:
      B(0.38, 0.2, 0.43, 0.08, 0.49, 0.08, 0.52, 0.16, 18)
      L(0.52, 0.16, 0.52, 0.9, 44)
      B(0.52, 0.9, 0.51, 0.94, 0.62, 0.92, 0.66, 0.88, 10)
      break

    case 2:
      B(0.24, 0.22, 0.3, 0.02, 0.72, 0.04, 0.74, 0.26, 28)
      B(0.74, 0.26, 0.76, 0.4, 0.58, 0.48, 0.46, 0.6, 22)
      B(0.46, 0.6, 0.3, 0.74, 0.23, 0.82, 0.21, 0.9, 16)
      L(0.21, 0.9, 0.78, 0.9, 22)
      break

    case 3:
      B(0.24, 0.18, 0.45, 0.02, 0.78, 0.08, 0.7, 0.34, 28)
      B(0.7, 0.34, 0.66, 0.46, 0.45, 0.46, 0.42, 0.5, 14)
      B(0.42, 0.5, 0.49, 0.5, 0.76, 0.56, 0.72, 0.82, 28)
      B(0.72, 0.82, 0.66, 0.98, 0.35, 0.94, 0.24, 0.8, 18)
      break

    case 4:
      L(0.7, 0.12, 0.7, 0.9, 40)
      L(0.22, 0.56, 0.74, 0.56, 20)
      B(0.22, 0.56, 0.3, 0.42, 0.47, 0.24, 0.64, 0.1, 22)
      break

    case 5:
      L(0.76, 0.12, 0.28, 0.12, 20)
      L(0.28, 0.12, 0.28, 0.46, 16)
      B(0.28, 0.46, 0.38, 0.48, 0.58, 0.46, 0.66, 0.46, 16)
      B(0.66, 0.46, 0.84, 0.52, 0.78, 0.9, 0.44, 0.9, 30)
      B(0.44, 0.9, 0.26, 0.9, 0.18, 0.78, 0.22, 0.66, 16)
      break

    case 6:
      B(0.7, 0.18, 0.56, 0.08, 0.32, 0.2, 0.26, 0.5, 24)
      B(0.26, 0.5, 0.24, 0.8, 0.48, 0.96, 0.68, 0.8, 26)
      B(0.68, 0.8, 0.82, 0.66, 0.74, 0.44, 0.52, 0.46, 22)
      B(0.52, 0.46, 0.34, 0.48, 0.3, 0.66, 0.42, 0.78, 18)
      break

    case 7:
      L(0.2, 0.12, 0.8, 0.12, 22)
      B(0.8, 0.12, 0.68, 0.34, 0.5, 0.58, 0.34, 0.92, 38)
      break

    case 8:
      B(0.5, 0.08, 0.24, 0.08, 0.22, 0.42, 0.5, 0.44, 28)
      B(0.5, 0.44, 0.78, 0.42, 0.76, 0.08, 0.5, 0.08, 28)
      B(0.5, 0.44, 0.18, 0.48, 0.18, 0.92, 0.5, 0.92, 32)
      B(0.5, 0.92, 0.82, 0.92, 0.82, 0.48, 0.5, 0.44, 32)
      break

    case 9:
      B(0.54, 0.1, 0.78, 0.1, 0.82, 0.44, 0.56, 0.46, 28)
      B(0.56, 0.46, 0.28, 0.48, 0.24, 0.1, 0.54, 0.1, 28)
      B(0.6, 0.44, 0.74, 0.52, 0.76, 0.76, 0.7, 0.94, 22)
      break

    case 10: // B – barra vertical + dos protuberancias derechas
      L(0.28, 0.1, 0.28, 0.9, 36)
      B(0.28, 0.9, 0.78, 0.9, 0.78, 0.54, 0.28, 0.5, 30)
      B(0.28, 0.5, 0.74, 0.46, 0.74, 0.12, 0.28, 0.1, 26)
      break

    case 11: // A – dos diagonales + trazo horizontal
      L(0.22, 0.9, 0.5, 0.08, 28)
      L(0.5, 0.08, 0.78, 0.9, 28)
      L(0.78, 0.9, 0.65, 0.56, 14)
      L(0.65, 0.56, 0.35, 0.56, 18)
      L(0.35, 0.56, 0.22, 0.9, 14)
      break

    case 12: // S – dos arcos opuestos
      B(0.74, 0.2, 0.78, 0.04, 0.22, 0.04, 0.22, 0.26, 30)
      B(0.22, 0.26, 0.24, 0.46, 0.76, 0.54, 0.78, 0.74, 28)
      B(0.78, 0.74, 0.78, 0.96, 0.22, 0.96, 0.26, 0.8, 28)
      break

    case 13: // T – barra horizontal + trazo vertical centrado
      L(0.18, 0.13, 0.82, 0.13, 26)
      L(0.82, 0.13, 0.5, 0.13, 14)
      L(0.5, 0.13, 0.5, 0.9, 36)
      break

    default:
      B(0.52, 0.08, 0.2, 0.08, 0.16, 0.9, 0.5, 0.92, 34)
      B(0.5, 0.92, 0.82, 0.9, 0.84, 0.1, 0.52, 0.08, 34)
      break
  }

  return pts
}

function pushLine (arr, x1, y1, x2, y2, steps) {
  for (let i = 0; i <= steps; i++) {
    arr.push(createVector(lerp(x1, x2, i / steps), lerp(y1, y2, i / steps)))
  }
}

function pushBezier (arr, x1, y1, cx1, cy1, cx2, cy2, x2, y2, steps = 30) {
  for (let i = 0; i <= steps; i++) {
    let t = i / steps
    let mt = 1 - t

    let x =
      mt * mt * mt * x1 +
      3 * mt * mt * t * cx1 +
      3 * mt * t * t * cx2 +
      t * t * t * x2

    let y =
      mt * mt * mt * y1 +
      3 * mt * mt * t * cy1 +
      3 * mt * t * t * cy2 +
      t * t * t * y2

    arr.push(createVector(x, y))
  }
}

function resamplePolylineByCount (points, count) {
  if (!points || points.length < 2) return points ? points.slice() : []

  let lens = [0]
  let total = 0

  for (let i = 1; i < points.length; i++) {
    total += p5.Vector.dist(points[i - 1], points[i])
    lens.push(total)
  }

  if (total < 1e-6) return points.slice()

  let out = []

  for (let k = 0; k < count; k++) {
    out.push(sampleOnPolyline(points, lens, (k / (count - 1)) * total))
  }

  return out
}

function sampleOnPolyline (points, lens, d) {
  if (d <= 0) return points[0].copy()
  if (d >= lens[lens.length - 1]) return points[points.length - 1].copy()

  let lo = 1
  let hi = lens.length - 1

  while (lo < hi) {
    let mid = (lo + hi) >> 1
    if (lens[mid] < d) lo = mid + 1
    else hi = mid
  }

  let idx = lo
  let d1 = lens[idx - 1]
  let d2 = lens[idx]
  let t = (d - d1) / max(1e-6, d2 - d1)

  return p5.Vector.lerp(points[idx - 1], points[idx], t)
}

function computePathLength (points) {
  let total = 0

  for (let i = 1; i < points.length; i++) {
    total += p5.Vector.dist(points[i - 1], points[i])
  }

  return total
}

function buildPathAngles (points) {
  let angles = []

  for (let i = 0; i < points.length; i++) {
    let p0 = points[max(0, i - 1)]
    let p1 = points[min(points.length - 1, i + 1)]
    angles.push(atan2(p1.y - p0.y, p1.x - p0.x))
  }

  return angles
}

function getPathPointAt (path, totalLen, d) {
  if (!path || path.length === 0 || totalLen <= 0) {
    return { x: 0, y: 0 }
  }

  let u = constrain(d / totalLen, 0, 1) * (path.length - 1)
  let i0 = floor(u)
  let i1 = min(i0 + 1, path.length - 1)
  let f = u - i0

  let p0 = path[i0]
  let p1 = path[i1]

  return {
    x: lerp(p0.x, p1.x, f),
    y: lerp(p0.y, p1.y, f)
  }
}

function getPathAngleAt (angles, totalLen, d) {
  if (!angles || angles.length === 0 || totalLen <= 0) {
    return 0
  }

  let u = constrain(d / totalLen, 0, 1) * (angles.length - 1)
  let i0 = floor(u)
  let i1 = min(i0 + 1, angles.length - 1)
  let f = u - i0

  return lerpAngle(angles[i0], angles[i1], f)
}

function lerpAngle (a, b, t) {
  let diff = atan2(sin(b - a), cos(b - a))
  return a + diff * t
}

function wrapHue (h) {
  h = h % 360
  if (h < 0) h += 360
  return h
}

function shuffleArray (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}
