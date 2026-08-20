const express = require('express')
const ExcelJS = require('exceljs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db')
const { auth, requirePerm } = require('../middleware/auth')

const router = express.Router()
const upload = multer({ dest: path.join(__dirname, '../uploads') })
const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const TABLES = {
  city_metrics: {
    label: '城市指标',
    columns: ['id', 'name', 'category', 'value', 'unit', 'district', 'date', 'status', 'remark', 'created_at'],
    writable: ['name', 'category', 'value', 'unit', 'district', 'date', 'status', 'remark']
  },
  traffic_data: {
    label: '交通数据',
    columns: ['id', 'road_name', 'congestion', 'speed', 'volume', 'district', 'hour', 'date', 'created_at'],
    writable: ['road_name', 'congestion', 'speed', 'volume', 'district', 'hour', 'date']
  },
  environment_data: {
    label: '环境数据',
    columns: ['id', 'station', 'aqi', 'pm25', 'pm10', 'co', 'no2', 'so2', 'o3', 'temperature', 'humidity', 'date', 'created_at'],
    writable: ['station', 'aqi', 'pm25', 'pm10', 'co', 'no2', 'so2', 'o3', 'temperature', 'humidity', 'date']
  },
  energy_data: {
    label: '能源数据',
    columns: ['id', 'building', 'electricity', 'water', 'gas', 'district', 'date', 'created_at'],
    writable: ['building', 'electricity', 'water', 'gas', 'district', 'date']
  },
  events: {
    label: '城市事件',
    columns: ['id', 'title', 'type', 'level', 'location', 'lat', 'lng', 'status', 'description', 'created_at'],
    writable: ['title', 'type', 'level', 'location', 'lat', 'lng', 'status', 'description']
  }
}

router.get('/stats/overview', auth(), (req, res) => {
  const metrics = db.prepare('SELECT category, AVG(value) as avg_value, COUNT(*) as cnt FROM city_metrics GROUP BY category').all()
  const traffic = db.prepare('SELECT hour, AVG(congestion) as congestion, AVG(speed) as speed, SUM(volume) as volume FROM traffic_data GROUP BY hour ORDER BY hour').all()
  const env = db.prepare('SELECT station, AVG(aqi) as aqi, AVG(pm25) as pm25 FROM environment_data GROUP BY station').all()
  const energy = db.prepare('SELECT building, AVG(electricity) as electricity, AVG(water) as water, AVG(gas) as gas FROM energy_data GROUP BY building').all()
  const events = db.prepare('SELECT type, level, status, COUNT(*) as cnt FROM events GROUP BY type, level, status').all()
  const districts = db.prepare('SELECT district, AVG(value) as value FROM city_metrics GROUP BY district').all()
  res.json({ code: 0, data: { metrics, traffic, env, energy, events, districts } })
})

router.get('/tables', auth(), requirePerm('data'), (req, res) => {
  res.json({
    code: 0,
    data: Object.entries(TABLES).map(([key, meta]) => ({ key, label: meta.label, columns: meta.columns }))
  })
})

router.get('/:table', auth(), (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const keyword = (req.query.keyword || '').trim()
  let where = ''
  const params = []
  if (keyword) {
    const likeCols = meta.writable.filter((c) => typeof c === 'string')
    where = `WHERE ${likeCols.map((c) => `${c} LIKE ?`).join(' OR ')}`
    likeCols.forEach(() => params.push(`%${keyword}%`))
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM ${req.params.table} ${where}`).get(...params).c
  const rows = db
    .prepare(`SELECT * FROM ${req.params.table} ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
  res.json({ code: 0, data: { list: rows, total, page, pageSize } })
})

router.post('/:table', auth(), requirePerm('data'), (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  const body = req.body || {}
  const cols = meta.writable.filter((c) => body[c] !== undefined)
  if (!cols.length) return res.status(400).json({ code: 400, message: '无有效字段' })
  const placeholders = cols.map(() => '?').join(',')
  const info = db
    .prepare(`INSERT INTO ${req.params.table} (${cols.join(',')}) VALUES (${placeholders})`)
    .run(...cols.map((c) => body[c]))
  res.json({ code: 0, data: { id: info.lastInsertRowid }, message: '新增成功' })
})

router.put('/:table/:id', auth(), requirePerm('data'), (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  const body = req.body || {}
  const cols = meta.writable.filter((c) => body[c] !== undefined)
  if (!cols.length) return res.status(400).json({ code: 400, message: '无有效字段' })
  const sets = cols.map((c) => `${c}=?`).join(',')
  db.prepare(`UPDATE ${req.params.table} SET ${sets} WHERE id=?`).run(...cols.map((c) => body[c]), Number(req.params.id))
  res.json({ code: 0, message: '更新成功' })
})

router.delete('/:table/:id', auth(), requirePerm('data'), (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  db.prepare(`DELETE FROM ${req.params.table} WHERE id=?`).run(Number(req.params.id))
  res.json({ code: 0, message: '删除成功' })
})

router.get('/:table/export', auth(), requirePerm('data'), async (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  const rows = db.prepare(`SELECT * FROM ${req.params.table} ORDER BY id DESC`).all()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(meta.label)
  sheet.columns = meta.columns.map((c) => ({ header: c, key: c, width: 16 }))
  rows.forEach((r) => sheet.addRow(r))
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.table}.xlsx`)
  await workbook.xlsx.write(res)
  res.end()
})

router.post('/:table/import', auth(), requirePerm('data'), upload.single('file'), async (req, res) => {
  const meta = TABLES[req.params.table]
  if (!meta) return res.status(400).json({ code: 400, message: '无效数据表' })
  if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件' })
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(req.file.path)
    const sheet = workbook.worksheets[0]
    const headers = []
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col] = String(cell.value)
    })
    const insertCols = meta.writable.filter((c) => headers.includes(c))
    if (!insertCols.length) return res.status(400).json({ code: 400, message: 'Excel列不匹配' })
    const stmt = db.prepare(
      `INSERT INTO ${req.params.table} (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`
    )
    const tx = db.transaction((items) => {
      for (const item of items) stmt.run(...item)
    })
    const items = []
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values = insertCols.map((c) => {
        const idx = headers.indexOf(c)
        return row.getCell(idx).value
      })
      items.push(values)
    })
    tx(items)
    fs.unlinkSync(req.file.path)
    res.json({ code: 0, message: `成功导入 ${items.length} 条` })
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.status(500).json({ code: 500, message: e.message })
  }
})

module.exports = router
