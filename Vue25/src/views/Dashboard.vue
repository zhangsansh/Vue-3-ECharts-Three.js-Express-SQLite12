<template>
  <div class="twin-page" :class="`theme-${modelTheme}`">
    <City3D ref="cityRef" :theme="modelTheme" :theme-data="themePayload" @select="onSelect" />

    <header class="hud top">
      <div class="brand">
        <div class="mark"></div>
        <div>
          <h1>{{ themeStore.settings.headerTitle }}</h1>
          <p>3D Digital Twin · {{ currentTheme.label }}</p>
        </div>
      </div>

      <div class="theme-switch">
        <button
          v-for="t in themes"
          :key="t.key"
          :class="{ active: modelTheme === t.key }"
          @click="switchTheme(t.key)"
        >
          <i :style="{ background: t.color }"></i>
          {{ t.label }}
        </button>
      </div>

      <div class="nav">
        <a
          v-for="m in menus"
          :key="m.path"
          href="javascript:;"
          class="link"
          :class="{ active: m.path === '/dashboard' }"
          @click.prevent="goPage(m.path)"
        >{{ m.title }}</a>
        <button class="link danger" @click="logout">退出</button>
      </div>
    </header>

    <aside class="hud side glass-panel">
      <div class="panel-title">{{ currentTheme.label }} · 主题数据</div>
      <div class="desc">{{ currentTheme.desc }}</div>
      <div class="kpis">
        <div class="kpi" v-for="k in summary" :key="k.label">
          <div class="v">{{ k.value }}</div>
          <div class="l">{{ k.label }}</div>
        </div>
      </div>
      <div class="panel-title mt">场景组件</div>
      <ul class="comp-list">
        <li v-for="c in currentTheme.components" :key="c">
          <span class="dot"></span>{{ c }}
        </li>
      </ul>
      <div class="panel-title mt">展示效果</div>
      <ul class="comp-list soft">
        <li v-for="e in currentTheme.effects" :key="e">{{ e }}</li>
      </ul>
      <p class="tip">鼠标拖拽或方向键/WASD 旋转俯仰 · Q/E 或滚轮缩放 · 点击模型查看数据</p>
    </aside>

    <aside class="hud detail glass-panel" v-if="selected" :class="selected.status">
      <div class="detail-head">
        <div>
          <div class="panel-title">{{ selected.name }}</div>
          <div class="type-tag">{{ selected.category }} · {{ selected.type }}</div>
        </div>
        <span class="status-pill">{{ statusText(selected.status) }}</span>
      </div>

      <div class="hero-value">
        <b>{{ selected.value }}</b>
        <small>{{ selected.unit }}</small>
      </div>

      <div class="metric-grid">
        <div class="metric" v-for="m in selected.metrics || []" :key="m.label">
          <div class="mv">{{ m.value }}</div>
          <div class="ml">{{ m.label }}</div>
        </div>
      </div>

      <div class="rows">
        <div><span>所属区域</span><b>{{ selected.district || '—' }}</b></div>
        <div class="full"><span>数据说明</span><b>{{ selected.remark }}</b></div>
        <div><span>交互特效</span><b>{{ effectLabel(selected.effect) }}</b></div>
      </div>

      <div class="effect-bar">
        <div class="bar-fill" :style="{ width: barWidth }"></div>
      </div>

      <button class="close" @click="closeDetail">关闭</button>
    </aside>

    <footer class="hud bottom">
      <div class="meta">用户：{{ userStore.user?.username }} · {{ roleLabel }}</div>
      <div class="meta">当前主题：{{ currentTheme.label }} · {{ now }}</div>
    </footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import City3D from '@/components/City3D.vue'
import { getOverview, getTableData } from '@/api'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const themeStore = useThemeStore()
const userStore = useUserStore()
const cityRef = ref(null)

const modelTheme = ref(themeStore.settings.modelTheme || 'city')
const selected = ref(null)
const overview = ref(null)
const cityMetrics = ref([])
const trafficRows = ref([])
const envRows = ref([])
const energyRows = ref([])
const eventRows = ref([])
const now = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
let timer

const themes = [
  {
    key: 'city',
    label: '城市全景',
    color: '#3de7ff',
    components: ['玻璃幕墙建筑群', '发光屋顶', '孪生中枢塔', '城市网格基座'],
    effects: ['建筑高亮描边', '中枢晶体旋转', '选中光柱与脉冲环'],
    desc: '展示城市空间结构、建筑负荷与人口关联运行态势。',
    category: '城市'
  },
  {
    key: 'traffic',
    label: '智慧交通',
    color: '#ffb020',
    components: ['快速路网', '智能车辆流', '自适应信号灯', '调度中枢'],
    effects: ['车辆持续流动', '信号灯相位闪烁', '道路点击流量反馈'],
    desc: '聚焦路网拥堵、车速、车流与路口信控的实时孪生。',
    category: '交通'
  },
  {
    key: 'energy',
    label: '能源孪生',
    color: '#2bffb0',
    components: ['风电机组', '光伏阵列', '储能舱', '源网荷储中枢'],
    effects: ['风机叶片旋转', '光伏高亮反射', '储能波纹反馈'],
    desc: '呈现发电、储能与调度负荷的源网荷储一体化视图。',
    category: '能源'
  },
  {
    key: 'environment',
    label: '生态环境',
    color: '#7dffb3',
    components: ['植被群落', '空气监测站', '生态水体', '环境中枢'],
    effects: ['植被呼吸缩放', '监测站晶体自转', '水体选中涟漪'],
    desc: '覆盖绿化、空气质量与水体的生态环境监测场景。',
    category: '环境'
  },
  {
    key: 'security',
    label: '城市安防',
    color: '#ff4f7a',
    components: ['高点摄像头', '电子围栏', '巡检无人机', '安防指挥中枢'],
    effects: ['摄像头扫视', '围栏呼吸发光', '无人机环形巡航'],
    desc: '构建视频、周界与低空巡防一体化的安防孪生体系。',
    category: '安防'
  }
]

const allMenus = [
  { path: '/dashboard', title: '3D孪生', perm: 'dashboard' },
  { path: '/charts/ops', title: '运行监测', perm: 'charts' },
  { path: '/charts/analysis', title: '专题分析', perm: 'charts' },
  { path: '/charts/advanced', title: '三维关系', perm: 'charts' },
  { path: '/data', title: '数据管理', perm: 'data' },
  { path: '/users', title: '用户管理', perm: 'users' },
  { path: '/style', title: '样式设置', perm: 'settings' },
  { path: '/db', title: '数据库', perm: 'db' },
  { path: '/predict', title: '智能预测', perm: 'predict' }
]

const menus = computed(() => allMenus.filter((m) => userStore.hasPerm(m.perm)))
const currentTheme = computed(() => themes.find((t) => t.key === modelTheme.value) || themes[0])
const roleLabel = computed(
  () => ({ admin: '管理员', editor: '编辑员', viewer: '访客' }[userStore.role] || userStore.role)
)

const themePayload = computed(() => {
  if (modelTheme.value === 'traffic') {
    return {
      nodes: trafficRows.value.slice(0, 30).map((r) => ({
        name: r.road_name,
        value: r.congestion,
        unit: '拥堵指数',
        district: r.district,
        status: r.congestion > 0.7 ? 'critical' : r.congestion > 0.45 ? 'warning' : 'normal',
        remark: `${r.road_name} 第${r.hour}时通行数据`,
        extra: { speed: r.speed, volume: r.volume }
      }))
    }
  }
  if (modelTheme.value === 'environment') {
    return {
      nodes: envRows.value.slice(0, 24).map((r) => ({
        name: r.station,
        value: r.aqi,
        unit: 'AQI',
        district: r.station,
        status: r.aqi > 100 ? 'critical' : r.aqi > 70 ? 'warning' : 'normal',
        remark: `${r.station} 空气质量监测`,
        extra: { pm25: r.pm25, temp: r.temperature }
      }))
    }
  }
  if (modelTheme.value === 'energy') {
    return {
      nodes: energyRows.value.slice(0, 20).map((r) => ({
        name: r.building,
        value: Math.round(r.electricity),
        unit: 'kWh',
        district: r.district,
        status: r.electricity > 4000 ? 'warning' : 'normal',
        remark: `${r.building} 能源负荷`,
        extra: { water: r.water, gas: r.gas }
      }))
    }
  }
  if (modelTheme.value === 'security') {
    return {
      nodes: eventRows.value.slice(0, 20).map((r) => ({
        name: r.title,
        value: ({ 低: 1, 中: 2, 高: 3, 紧急: 4 }[r.level] || 1) * 270,
        unit: 'P',
        district: r.location,
        status: r.level === '紧急' || r.level === '高' ? 'critical' : r.level === '中' ? 'warning' : 'normal',
        remark: r.description || r.type,
        extra: { type: r.type, level: r.level }
      }))
    }
  }
  return {
    nodes: cityMetrics.value.slice(0, 48).map((r) => ({
      name: r.name,
      value: r.value,
      unit: r.unit,
      district: r.district,
      status: r.status,
      remark: r.remark,
      extra: {
        load: Math.min(99, Math.round(Number(r.value) / 12)),
        population: Math.round(800 + Number(r.value) * 3)
      }
    }))
  }
})

const summary = computed(() => {
  const nodes = themePayload.value.nodes || []
  if (modelTheme.value === 'traffic') {
    const avgCong = nodes.length
      ? (nodes.reduce((s, i) => s + Number(i.value || 0), 0) / nodes.length).toFixed(2)
      : '--'
    const avgSpeed = nodes.length
      ? Math.round(nodes.reduce((s, i) => s + Number(i.extra?.speed || 0), 0) / nodes.length)
      : '--'
    return [
      { label: '道路样本', value: nodes.length },
      { label: '平均拥堵', value: avgCong },
      { label: '平均车速', value: avgSpeed },
      { label: '预警路段', value: nodes.filter((n) => n.status !== 'normal').length }
    ]
  }
  if (modelTheme.value === 'environment') {
    const avg = nodes.length ? Math.round(nodes.reduce((s, i) => s + Number(i.value || 0), 0) / nodes.length) : '--'
    return [
      { label: '监测站', value: nodes.length },
      { label: '平均AQI', value: avg },
      { label: '优良站', value: nodes.filter((n) => n.status === 'normal').length },
      { label: '告警站', value: nodes.filter((n) => n.status !== 'normal').length }
    ]
  }
  if (modelTheme.value === 'energy') {
    const total = nodes.reduce((s, i) => s + Number(i.value || 0), 0)
    return [
      { label: '场站数', value: nodes.length },
      { label: '总负荷', value: Math.round(total) },
      { label: '高负荷', value: nodes.filter((n) => n.status === 'warning').length },
      { label: '主题', value: '能源' }
    ]
  }
  if (modelTheme.value === 'security') {
    return [
      { label: '事件/点位', value: nodes.length },
      { label: '高风险', value: nodes.filter((n) => n.status === 'critical').length },
      { label: '中风险', value: nodes.filter((n) => n.status === 'warning').length },
      { label: '正常', value: nodes.filter((n) => n.status === 'normal').length }
    ]
  }
  const avg = nodes.length ? Math.round(nodes.reduce((s, i) => s + Number(i.value || 0), 0) / nodes.length) : 0
  return [
    { label: '建筑节点', value: nodes.length },
    { label: '均值指数', value: avg },
    { label: '预警', value: nodes.filter((n) => n.status === 'warning').length },
    { label: '紧急', value: nodes.filter((n) => n.status === 'critical').length }
  ]
})

const barWidth = computed(() => {
  if (!selected.value) return '0%'
  const n = Number(selected.value.value)
  if (Number.isNaN(n)) return '66%'
  if (selected.value.unit === '拥堵指数') return `${Math.min(100, n * 100)}%`
  if (selected.value.unit === '% SOC' || String(selected.value.unit).includes('%')) return `${Math.min(100, n)}%`
  return `${Math.min(100, Math.max(12, n % 100))}%`
})

function statusText(s) {
  return { normal: '正常', warning: '预警', critical: '紧急' }[s] || s || '正常'
}

function effectLabel(effect) {
  return (
    {
      'city-glow': '建筑高亮 + 光柱',
      'core-pulse': '中枢脉冲 + 晶体辉光',
      'traffic-flow': '路网流量反馈',
      'vehicle-trail': '车辆轨迹高亮',
      'signal-flash': '信号相位闪烁',
      'energy-spin': '风机加速旋转反馈',
      'solar-shine': '光伏反射高亮',
      'storage-wave': '储能波纹',
      'eco-breathe': '生态呼吸缩放',
      'eco-scan': '监测扫描',
      'water-ripple': '水面涟漪',
      'security-scan': '安防扫描束',
      'fence-pulse': '围栏脉冲',
      'drone-orbit': '无人机锁定'
    }[effect] || '选中光效'
  )
}

function switchTheme(key) {
  modelTheme.value = key
  selected.value = null
  cityRef.value?.clearSelect?.()
}

function onSelect(item) {
  selected.value = item
}

function closeDetail() {
  selected.value = null
  cityRef.value?.clearSelect?.()
}

async function goPage(path) {
  if (!path) return
  try {
    cityRef.value?.destroy?.()
  } catch {
    /* ignore */
  }
  await nextTick()
  router.push(path).catch(() => {})
}

function logout() {
  try {
    cityRef.value?.destroy?.()
  } catch {
    /* ignore */
  }
  userStore.logout()
  router.push('/login')
}

onMounted(async () => {
  await themeStore.load()
  modelTheme.value = themeStore.settings.modelTheme || modelTheme.value
  timer = setInterval(() => {
    now.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }, 1000)
  try {
    const [ov, metrics, traffic, env, energy, events] = await Promise.all([
      getOverview(),
      getTableData('city_metrics', { page: 1, pageSize: 80 }),
      getTableData('traffic_data', { page: 1, pageSize: 40 }),
      getTableData('environment_data', { page: 1, pageSize: 30 }),
      getTableData('energy_data', { page: 1, pageSize: 30 }),
      getTableData('events', { page: 1, pageSize: 30 })
    ])
    overview.value = ov.data
    cityMetrics.value = metrics.data.list || []
    trafficRows.value = traffic.data.list || []
    envRows.value = env.data.list || []
    energyRows.value = energy.data.list || []
    eventRows.value = events.data.list || []
  } catch {
    /* empty */
  }
})

onBeforeUnmount(() => {
  clearInterval(timer)
  try {
    cityRef.value?.destroy?.()
  } catch {
    /* ignore */
  }
})
</script>

<style scoped lang="scss">
.twin-page {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #06101c 0%, #0a1628 100%);
  &.theme-traffic {
    background: linear-gradient(180deg, #1a1006 0%, #120c08 100%);
  }
  &.theme-energy {
    background: linear-gradient(180deg, #061510 0%, #0a1a14 100%);
  }
  &.theme-environment {
    background: linear-gradient(180deg, #07181c 0%, #0a1e1a 100%);
  }
  &.theme-security {
    background: linear-gradient(180deg, #16080e 0%, #12060a 100%);
  }
}

.hud {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  * {
    pointer-events: auto;
  }
}

.top {
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1.1fr 1.5fr 1.2fr;
  gap: 12px;
  align-items: start;
  padding: 14px 18px;
  background: linear-gradient(180deg, rgba(4, 16, 32, 0.78), transparent);
}

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  .mark {
    width: 36px;
    height: 36px;
    border: 2px solid var(--sc-primary);
    background: linear-gradient(135deg, var(--sc-primary), transparent 60%);
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  }
  h1 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 2px;
    color: var(--sc-primary);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--sc-muted);
  }
}

.theme-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 40, 80, 0.5);
    border: 1px solid var(--sc-border);
    color: var(--sc-muted);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    letter-spacing: 1px;
    i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    &.active {
      color: #041018;
      background: var(--sc-primary);
      border-color: var(--sc-primary);
    }
  }
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  position: relative;
  z-index: 20;
}
.link {
  text-decoration: none;
  color: var(--sc-muted);
  background: rgba(4, 24, 48, 0.55);
  border: 1px solid var(--sc-border);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  position: relative;
  z-index: 21;
}
.link:hover,
.link.active {
  color: var(--sc-primary);
  border-color: var(--sc-primary);
}
.link.danger {
  color: #ff8fa3;
}

.side,
.detail {
  top: 100px;
  width: 300px;
  padding: 14px;
  max-height: calc(100vh - 160px);
  overflow: auto;
  backdrop-filter: blur(10px);
}
.side {
  left: 18px;
}
.detail {
  right: 18px;
  border-color: rgba(0, 212, 255, 0.45);
  animation: slideIn 0.28s ease;
}
.detail.warning {
  border-color: rgba(255, 170, 0, 0.55);
}
.detail.critical {
  border-color: rgba(255, 79, 122, 0.6);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--sc-muted);
  margin-bottom: 12px;
}
.kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.kpi {
  text-align: center;
  padding: 10px 6px;
  border: 1px solid rgba(0, 212, 255, 0.18);
  background: rgba(0, 40, 80, 0.25);
  .v {
    color: var(--sc-accent);
    font-size: 20px;
  }
  .l {
    margin-top: 4px;
    color: var(--sc-muted);
    font-size: 12px;
  }
}
.mt {
  margin-top: 14px;
}
.comp-list {
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--sc-text);
  line-height: 1.9;
  font-size: 13px;
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sc-primary);
    box-shadow: 0 0 8px var(--sc-primary);
  }
  &.soft li {
    color: var(--sc-muted);
    font-size: 12px;
    padding-left: 2px;
  }
}
.tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--sc-muted);
}

.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.type-tag {
  margin-top: 4px;
  font-size: 12px;
  color: var(--sc-muted);
}
.status-pill {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--sc-border);
  color: var(--sc-accent);
}
.detail.warning .status-pill {
  color: #ffaa00;
  border-color: rgba(255, 170, 0, 0.45);
}
.detail.critical .status-pill {
  color: #ff4f7a;
  border-color: rgba(255, 79, 122, 0.45);
}

.hero-value {
  margin: 12px 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  b {
    font-size: 34px;
    color: var(--sc-primary);
    letter-spacing: 1px;
  }
  small {
    color: var(--sc-muted);
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.metric {
  text-align: center;
  padding: 8px 4px;
  background: rgba(0, 40, 80, 0.28);
  border: 1px solid rgba(0, 212, 255, 0.15);
  .mv {
    color: var(--sc-accent);
    font-size: 13px;
  }
  .ml {
    margin-top: 4px;
    font-size: 11px;
    color: var(--sc-muted);
  }
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    span {
      color: var(--sc-muted);
      flex-shrink: 0;
    }
    b {
      color: var(--sc-text);
      text-align: right;
      font-weight: 500;
    }
  }
  .full {
    flex-direction: column;
    b {
      text-align: left;
      margin-top: 4px;
      line-height: 1.5;
    }
  }
}

.effect-bar {
  margin-top: 14px;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sc-primary), var(--sc-accent));
    transition: width 0.35s ease;
  }
}

.close {
  margin-top: 14px;
  width: 100%;
  background: transparent;
  border: 1px solid var(--sc-border);
  color: var(--sc-muted);
  padding: 8px;
  cursor: pointer;
}
.bottom {
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  padding: 10px 18px;
  background: linear-gradient(0deg, rgba(4, 16, 32, 0.75), transparent);
  .meta {
    color: var(--sc-muted);
    font-size: 12px;
  }
}

@media (max-width: 1100px) {
  .top {
    grid-template-columns: 1fr;
  }
  .side,
  .detail {
    width: min(300px, calc(100vw - 24px));
  }
}
</style>
