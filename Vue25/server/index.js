const express = require('express')
const cors = require('cors')
const path = require('path')
const authRoutes = require('./routes/auth')
const dataRoutes = require('./routes/data')
const settingsRoutes = require('./routes/settings')
const predictRoutes = require('./routes/predict')

require('./db')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/predict', predictRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'smart-city server ok', time: new Date().toISOString() })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ code: 500, message: err.message || '服务器错误' })
})

app.listen(PORT, () => {
  console.log(`Smart City API running at http://localhost:${PORT}`)
})
