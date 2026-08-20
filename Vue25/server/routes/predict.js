const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db')
const { auth, requirePerm } = require('../middleware/auth')

const router = express.Router()
const uploadDir = path.join(__dirname, '../uploads/predict')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'])
const MAX_SIZE = 5 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext) ? ext : '.png'
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('仅支持 JPG / PNG / WEBP / GIF / BMP 图片'))
    }
    cb(null, true)
  }
})

const MODEL_WEIGHTS = {
  traffic: {
    trafficFlow: 0.42,
    population: 0.18,
    temperature: 0.12,
    humidity: 0.08,
    energyLoad: 0.08,
    image: 0.12
  },
  energy: {
    energyLoad: 0.4,
    temperature: 0.18,
    population: 0.12,
    trafficFlow: 0.1,
    humidity: 0.08,
    image: 0.12
  },
  environment: {
    humidity: 0.22,
    temperature: 0.22,
    population: 0.16,
    trafficFlow: 0.12,
    energyLoad: 0.1,
    image: 0.18
  },
  risk: {
    trafficFlow: 0.22,
    energyLoad: 0.2,
    population: 0.18,
    temperature: 0.12,
    humidity: 0.1,
    image: 0.18
  }
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n))
}

function normalizeTemp(t) {
  // 舒适温度约 18~26，偏离越大风险越高
  const comfort = 22
  return clamp(Math.abs(Number(t) - comfort) * 4.2)
}

function normalizeHumidity(h) {
  // 40~60 较优，偏离增加风险
  const v = Number(h)
  if (v >= 40 && v <= 60) return 20
  if (v < 40) return clamp(20 + (40 - v) * 1.2)
  return clamp(20 + (v - 60) * 1.1)
}

function parseImageFeatures(raw) {
  if (!raw) return null
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return {
      brightness: clamp(Number(data.brightness) || 50),
      contrast: clamp(Number(data.contrast) || 40),
      warmRatio: clamp(Number(data.warmRatio) || 30),
      greenRatio: clamp(Number(data.greenRatio) || 20),
      edgeDensity: clamp(Number(data.edgeDensity) || 35),
      width: Number(data.width) || 0,
      height: Number(data.height) || 0
    }
  } catch {
    return null
  }
}

function imageRiskByModel(modelType, img) {
  if (!img) return { score: 35, detail: '未上传图片，仅使用数值参数推演' }
  let score = 30
  const notes = []

  if (modelType === 'traffic') {
    // 边缘密度高、暖色偏多 → 车流/拥堵迹象更强
    score = img.edgeDensity * 0.45 + img.warmRatio * 0.3 + (100 - img.brightness) * 0.15 + img.contrast * 0.1
    notes.push('道路纹理与暖色占比用于估算拥堵强度')
  } else if (modelType === 'energy') {
    // 亮度高、对比强 → 设施/工业负荷线索
    score = img.brightness * 0.35 + img.contrast * 0.35 + img.edgeDensity * 0.2 + img.warmRatio * 0.1
    notes.push('亮度与对比度用于估算能源设施活跃度')
  } else if (modelType === 'environment') {
    // 绿色占比高 → 风险降低；偏暗/偏暖 → 风险上升
    score = (100 - img.greenRatio) * 0.4 + (100 - img.brightness) * 0.25 + img.warmRatio * 0.2 + img.contrast * 0.15
    notes.push('绿色占比与亮度用于估算生态质量')
  } else {
    score = img.edgeDensity * 0.25 + img.warmRatio * 0.25 + (100 - img.brightness) * 0.2 + img.contrast * 0.15 + (100 - img.greenRatio) * 0.15
    notes.push('综合纹理、色温与植被线索估算风险')
  }

  return { score: clamp(score), detail: notes.join('；') }
}

function getBaseline(modelType) {
  try {
    const rows = db
      .prepare(
        `SELECT result FROM predict_history WHERE model_type = ? ORDER BY id DESC LIMIT 12`
      )
      .all(modelType)
    if (!rows.length) return null
    const scores = rows
      .map((r) => {
        try {
          return Number(JSON.parse(r.result || '{}').score)
        } catch {
          return null
        }
      })
      .filter((n) => Number.isFinite(n))
    if (!scores.length) return null
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return +avg.toFixed(2)
  } catch {
    return null
  }
}

function buildSeries(score, modelType, seasonFactor) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    // 季节波动：交通暑期/节假日、能源冬夏、环境春秋更稳
    let seasonal = 1
    if (modelType === 'traffic') seasonal = 1 + Math.sin(((month - 2) / 12) * Math.PI * 2) * 0.12
    if (modelType === 'energy') seasonal = 1 + Math.cos(((month - 1) / 12) * Math.PI * 2) * 0.16
    if (modelType === 'environment') seasonal = 1 + Math.sin(((month - 4) / 12) * Math.PI * 2) * 0.1
    if (modelType === 'risk') seasonal = 1 + Math.sin((month / 12) * Math.PI * 2) * 0.14
    const trend = 1 - i * 0.012
    const value = clamp(score * seasonal * trend * seasonFactor + (i % 3 === 0 ? 1.2 : -0.6))
    return { month: `${month}月`, value: +value.toFixed(2) }
  })
}

function predict(payload, file) {
  const modelType = ['traffic', 'energy', 'environment', 'risk'].includes(payload.modelType)
    ? payload.modelType
    : 'traffic'
  const weights = MODEL_WEIGHTS[modelType]

  const t = Number(payload.temperature)
  const h = Number(payload.humidity)
  const p = clamp(Number(payload.population) / 2) // 0~200 -> 0~100
  const f = clamp(Number(payload.trafficFlow))
  const e = clamp(Number(payload.energyLoad))
  const th = Math.min(1, Math.max(0, Number(payload.threshold)))

  const tempRisk = normalizeTemp(t)
  const humRisk = normalizeHumidity(h)
  const img = parseImageFeatures(payload.imageFeatures)
  const imageEval = imageRiskByModel(modelType, img)

  // 加权融合（确定性，仅保留极小噪声以模拟观测误差）
  const weighted =
    f * weights.trafficFlow +
    e * weights.energyLoad +
    p * weights.population +
    tempRisk * weights.temperature +
    humRisk * weights.humidity +
    imageEval.score * weights.image

  const thresholdBoost = 0.85 + th * 0.3
  const baseline = getBaseline(modelType)
  const baselineBlend = baseline == null ? weighted : weighted * 0.82 + baseline * 0.18
  const noise = ((Math.sin(t * 12.9898 + h * 78.233 + f * 37.719) * 43758.5453) % 1) * 1.6 - 0.8
  const score = +clamp(baselineBlend * thresholdBoost + noise).toFixed(2)

  // 置信度：有图、参数完整、有历史基线时更高
  let confidence = 72
  if (img) confidence += 12
  if (baseline != null) confidence += 8
  if (file) confidence += 4
  confidence = clamp(confidence + (1 - Math.abs(noise)) * 3, 60, 98)

  const level = score >= 75 ? '偏高风险' : score >= 50 ? '中等风险' : '低风险'
  const factors = [
    { name: '交通流量', weight: weights.trafficFlow, value: f, contribution: +(f * weights.trafficFlow).toFixed(2) },
    { name: '能源负荷', weight: weights.energyLoad, value: e, contribution: +(e * weights.energyLoad).toFixed(2) },
    { name: '人口密度', weight: weights.population, value: p, contribution: +(p * weights.population).toFixed(2) },
    { name: '温度风险', weight: weights.temperature, value: +tempRisk.toFixed(2), contribution: +(tempRisk * weights.temperature).toFixed(2) },
    { name: '湿度风险', weight: weights.humidity, value: +humRisk.toFixed(2), contribution: +(humRisk * weights.humidity).toFixed(2) },
    { name: '图像特征', weight: weights.image, value: +imageEval.score.toFixed(2), contribution: +(imageEval.score * weights.image).toFixed(2) }
  ].sort((a, b) => b.contribution - a.contribution)

  const adviceMap = {
    traffic:
      score >= 75
        ? '建议启动高峰限流与绿波协调，优先疏导高拥堵路段。'
        : score >= 50
          ? '建议动态调整信号配时，关注主干道排队长度。'
          : '路网运行平稳，可维持常规信控策略。',
    energy:
      score >= 75
        ? '建议执行削峰填谷与储能放电，降低峰值负荷风险。'
        : score >= 50
          ? '建议优化楼宇空调用能，错峰安排高耗能作业。'
          : '能源负荷可控，可持续推进能效优化。',
    environment:
      score >= 75
        ? '建议加强扬尘与排放管控，提升绿化与水体养护强度。'
        : score >= 50
          ? '建议加密空气站巡检，关注温湿度耦合污染风险。'
          : '生态环境指标良好，保持常规监测即可。',
    risk:
      score >= 75
        ? '综合风险偏高，建议联动交通、能源、安防进行联合调度。'
        : score >= 50
          ? '存在阶段性风险波动，建议提高重点区域巡查频次。'
          : '综合风险较低，可持续优化孪生预警阈值。'
  }

  return {
    score,
    level,
    confidence: +confidence.toFixed(1),
    baseline,
    modelType,
    series: buildSeries(score, modelType, 1),
    factors,
    imageAnalysis: img
      ? {
          ...img,
          riskScore: imageEval.score,
          summary: imageEval.detail
        }
      : {
          summary: imageEval.detail
        },
    accuracy: {
      method: '加权融合 + 历史基线校准 + 图像特征修正',
      residualNoise: +Math.abs(noise).toFixed(3),
      thresholdFactor: +thresholdBoost.toFixed(3)
    },
    advice: adviceMap[modelType],
    image: file ? `/uploads/predict/${file.filename}` : null
  }
}

function runHandler(req, res) {
  try {
    const result = predict(req.body || {}, req.file)
    db.prepare(
      `INSERT INTO predict_history (model_type, params, result, image_path, user_id) VALUES (?, ?, ?, ?, ?)`
    ).run(
      result.modelType,
      JSON.stringify({
        temperature: Number(req.body.temperature),
        humidity: Number(req.body.humidity),
        population: Number(req.body.population),
        trafficFlow: Number(req.body.trafficFlow),
        energyLoad: Number(req.body.energyLoad),
        threshold: Number(req.body.threshold),
        imageFeatures: parseImageFeatures(req.body.imageFeatures)
      }),
      JSON.stringify(result),
      result.image,
      req.user.id
    )
    res.json({ code: 0, data: result, message: '预测完成' })
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message || '预测失败' })
  }
}

router.post('/run', auth(), requirePerm('predict'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5MB' : err.message
      return res.status(400).json({ code: 400, message: msg })
    }
    return runHandler(req, res)
  })
})

router.get('/history', auth(), requirePerm('predict'), (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, model_type, params, result, image_path, created_at FROM predict_history WHERE user_id=? OR ?=? ORDER BY id DESC LIMIT 50'
    )
    .all(req.user.id, req.user.role, 'admin')
    .map((r) => ({
      ...r,
      params: JSON.parse(r.params || '{}'),
      result: JSON.parse(r.result || '{}')
    }))
  res.json({ code: 0, data: rows })
})

module.exports = router
