const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'smart_city.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'viewer',
  permissions TEXT DEFAULT '["dashboard","charts"]',
  avatar TEXT,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS city_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  value REAL,
  unit TEXT,
  district TEXT,
  date TEXT,
  status TEXT DEFAULT 'normal',
  remark TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS traffic_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  road_name TEXT,
  congestion REAL,
  speed REAL,
  volume INTEGER,
  district TEXT,
  hour INTEGER,
  date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS environment_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station TEXT,
  aqi INTEGER,
  pm25 REAL,
  pm10 REAL,
  co REAL,
  no2 REAL,
  so2 REAL,
  o3 REAL,
  temperature REAL,
  humidity REAL,
  date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS energy_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building TEXT,
  electricity REAL,
  water REAL,
  gas REAL,
  district TEXT,
  date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  type TEXT,
  level TEXT,
  location TEXT,
  lat REAL,
  lng REAL,
  status TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS db_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  type TEXT DEFAULT 'sqlite',
  host TEXT,
  port INTEGER,
  database_name TEXT,
  username TEXT,
  password TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS predict_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_type TEXT,
  params TEXT,
  result TEXT,
  image_path TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`)

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10)
    const viewerHash = bcrypt.hashSync('viewer123', 10)
    const editorHash = bcrypt.hashSync('editor123', 10)
    const insert = db.prepare(
      `INSERT INTO users (username, password, phone, role, permissions) VALUES (?, ?, ?, ?, ?)`
    )
    insert.run(
      'admin',
      hash,
      '13800000001',
      'admin',
      JSON.stringify(['dashboard', 'charts', 'data', 'users', 'settings', 'predict', 'db'])
    )
    insert.run(
      'editor',
      editorHash,
      '13800000002',
      'editor',
      JSON.stringify(['dashboard', 'charts', 'data', 'predict'])
    )
    insert.run(
      'viewer',
      viewerHash,
      '13800000003',
      'viewer',
      JSON.stringify(['dashboard', 'charts'])
    )
  }

  const metricCount = db.prepare('SELECT COUNT(*) as c FROM city_metrics').get().c
  if (metricCount === 0) {
    const districts = ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '通州区', '昌平区', '大兴区']
    const categories = ['人口', '交通', '能源', '安防', '环境', '经济']
    const insert = db.prepare(
      `INSERT INTO city_metrics (name, category, value, unit, district, date, status, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const today = new Date().toISOString().slice(0, 10)
    for (let i = 0; i < 80; i++) {
      const cat = categories[i % categories.length]
      const dist = districts[i % districts.length]
      insert.run(
        `${cat}指标${i + 1}`,
        cat,
        Math.round(Math.random() * 1000 + 50),
        cat === '人口' ? '万人' : cat === '交通' ? '辆' : '单位',
        dist,
        today,
        ['normal', 'warning', 'critical'][i % 3],
        `${dist}${cat}监测数据`
      )
    }
  }

  const trafficCount = db.prepare('SELECT COUNT(*) as c FROM traffic_data').get().c
  if (trafficCount === 0) {
    const roads = ['长安街', '二环路', '三环路', '四环路', '五环路', '中关村大街', '建国路', '阜成路']
    const districts = ['东城区', '西城区', '朝阳区', '海淀区']
    const insert = db.prepare(
      `INSERT INTO traffic_data (road_name, congestion, speed, volume, district, hour, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const today = new Date().toISOString().slice(0, 10)
    for (let h = 0; h < 24; h++) {
      for (const road of roads) {
        insert.run(
          road,
          +(Math.random() * 0.9 + 0.1).toFixed(2),
          +(Math.random() * 60 + 10).toFixed(1),
          Math.floor(Math.random() * 2000 + 200),
          districts[h % districts.length],
          h,
          today
        )
      }
    }
  }

  const envCount = db.prepare('SELECT COUNT(*) as c FROM environment_data').get().c
  if (envCount === 0) {
    const stations = ['奥体中心', '万寿西宫', '东四', '天坛', '农展馆', '官园', '海淀区万柳', '丰台花园']
    const insert = db.prepare(
      `INSERT INTO environment_data (station, aqi, pm25, pm10, co, no2, so2, o3, temperature, humidity, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
      for (const s of stations) {
        insert.run(
          s,
          Math.floor(Math.random() * 150 + 20),
          +(Math.random() * 80 + 5).toFixed(1),
          +(Math.random() * 120 + 10).toFixed(1),
          +(Math.random() * 2).toFixed(2),
          +(Math.random() * 80 + 10).toFixed(1),
          +(Math.random() * 30 + 2).toFixed(1),
          +(Math.random() * 100 + 20).toFixed(1),
          +(Math.random() * 20 + 5).toFixed(1),
          +(Math.random() * 40 + 30).toFixed(1),
          date
        )
      }
    }
  }

  const energyCount = db.prepare('SELECT COUNT(*) as c FROM energy_data').get().c
  if (energyCount === 0) {
    const buildings = ['智慧大厦A', '政务中心', '数据中心', '交通枢纽', '医院综合体', '商业综合体', '学校园区', '产业园']
    const districts = ['东城区', '西城区', '朝阳区', '海淀区', '丰台区']
    const insert = db.prepare(
      `INSERT INTO energy_data (building, electricity, water, gas, district, date) VALUES (?, ?, ?, ?, ?, ?)`
    )
    for (let d = 0; d < 14; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
      for (const b of buildings) {
        insert.run(
          b,
          +(Math.random() * 5000 + 500).toFixed(1),
          +(Math.random() * 800 + 50).toFixed(1),
          +(Math.random() * 300 + 20).toFixed(1),
          districts[Math.floor(Math.random() * districts.length)],
          date
        )
      }
    }
  }

  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c
  if (eventCount === 0) {
    const types = ['交通事故', '火灾预警', '拥堵告警', '设备故障', '环境异常', '安保事件']
    const levels = ['低', '中', '高', '紧急']
    const insert = db.prepare(
      `INSERT INTO events (title, type, level, location, lat, lng, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (let i = 0; i < 20; i++) {
      insert.run(
        `${types[i % types.length]}#${i + 1}`,
        types[i % types.length],
        levels[i % levels.length],
        `城区监测点${i + 1}`,
        39.9 + Math.random() * 0.2,
        116.3 + Math.random() * 0.3,
        ['待处理', '处理中', '已完成'][i % 3],
        '智慧城市数字孪生监测事件'
      )
    }
  }

  const settingCount = db.prepare('SELECT COUNT(*) as c FROM system_settings').get().c
  if (settingCount === 0) {
    const defaults = {
      themeName: '智慧城市蓝',
      primaryColor: '#00d4ff',
      accentColor: '#00ffa3',
      bgColor: '#0a1628',
      panelBg: 'rgba(6, 30, 60, 0.55)',
      fontFamily: '"Orbitron", "DIN Alternate", "Microsoft YaHei", sans-serif',
      fontSize: '14',
      chartTheme: 'dark',
      modelTheme: 'city',
      headerTitle: '智慧城市数字孪生可视化平台'
    }
    const insert = db.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?)`)
    for (const [k, v] of Object.entries(defaults)) {
      insert.run(k, v)
    }
  }

  const dbCfgCount = db.prepare('SELECT COUNT(*) as c FROM db_config').get().c
  if (dbCfgCount === 0) {
    db.prepare(
      `INSERT INTO db_config (name, type, host, port, database_name, username, password, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('本地SQLite', 'sqlite', 'localhost', 0, dbPath, '', '', 1)
  }
}

seed()

module.exports = db
