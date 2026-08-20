<template>
  <div ref="wrapRef" class="city3d">
    <canvas ref="fxRef" class="fx-layer"></canvas>
    <div class="hint" v-if="!selected">鼠标拖拽 / 方向键旋转俯仰 · Q/E 缩放 · 滚轮缩放 · 点击查看数据</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  theme: { type: String, default: 'city' },
  themeData: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['select'])

const wrapRef = ref(null)
const fxRef = ref(null)
const selected = ref(null)

let renderer, scene, camera, animationId, raycaster, mouse
let interactive = []
let group = null
let effectGroup = null
let lights = []
let particles = null
let orbitAngle = 0.55
let orbitRadius = 48
let orbitHeight = 24
let isDragging = false
let dragMoved = false
let lastX = 0
let lastY = 0
let selectionHalo = null
let selectionBeam = null
let pulseTime = 0
let animatables = []
let clock = null
let alive = false
let rebuildTimer = null
const keys = Object.create(null)
const KEY_ROTATE = 0.035
const KEY_PITCH = 0.35
const KEY_ZOOM = 0.45

const THEMES = {
  city: {
    label: '城市全景',
    fog: 0x071526,
    ground: 0x0b1f38,
    accent: 0x3de7ff,
    secondary: 0x4f7cff,
    building: 0x1c4d72,
    emissive: 0x0a3558,
    skyGlow: '#0a2040'
  },
  traffic: {
    label: '智慧交通',
    fog: 0x1a1006,
    ground: 0x1c140a,
    accent: 0xffb020,
    secondary: 0xff6b35,
    building: 0x3a2a14,
    emissive: 0x5a3308,
    skyGlow: '#2a1808'
  },
  energy: {
    label: '能源孪生',
    fog: 0x061510,
    ground: 0x0a1f16,
    accent: 0x2bffb0,
    secondary: 0x00c2ff,
    building: 0x145a42,
    emissive: 0x0a4a35,
    skyGlow: '#062218'
  },
  environment: {
    label: '生态环境',
    fog: 0x07181c,
    ground: 0x0c2420,
    accent: 0x7dffb3,
    secondary: 0x5ec8ff,
    building: 0x1a5c4a,
    emissive: 0x0a4638,
    skyGlow: '#072420'
  },
  security: {
    label: '城市安防',
    fog: 0x16080e,
    ground: 0x1a0c14,
    accent: 0xff4f7a,
    secondary: 0xff9f43,
    building: 0x5a1a32,
    emissive: 0x4a1028,
    skyGlow: '#240814'
  }
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material.dispose()
    }
  })
}

function clearSceneContent() {
  try {
    if (group && scene) {
      disposeObject(group)
      scene.remove(group)
    }
    if (effectGroup && scene) {
      disposeObject(effectGroup)
      scene.remove(effectGroup)
    }
    if (particles && scene) {
      disposeObject(particles)
      scene.remove(particles)
    }
  } catch {
    /* ignore dispose race */
  }
  group = null
  effectGroup = null
  particles = null
  interactive = []
  animatables = []
  selectionHalo = null
  selectionBeam = null
}

function destroy() {
  alive = false
  if (rebuildTimer) {
    clearTimeout(rebuildTimer)
    rebuildTimer = null
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  Object.keys(keys).forEach((k) => {
    keys[k] = false
  })
  isDragging = false

  const dom = renderer?.domElement
  if (dom) {
    try {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointerleave', onPointerUp)
      dom.removeEventListener('wheel', onWheel)
    } catch {
      /* ignore */
    }
  }

  clearSceneContent()
  try {
    lights.forEach((l) => scene?.remove(l))
  } catch {
    /* ignore */
  }
  lights = []

  try {
    renderer?.dispose()
  } catch {
    /* ignore */
  }
  if (dom?.parentNode) {
    try {
      dom.parentNode.removeChild(dom)
    } catch {
      /* ignore */
    }
  }
  renderer = null
  scene = null
  camera = null
  selected.value = null
}


function mat(opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: opts.color ?? 0x224466,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0.35,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.35,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide
  })
}

function glass(color, opacity = 0.45) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.15,
    roughness: 0.08,
    transparent: true,
    opacity,
    emissive: color,
    emissiveIntensity: 0.22
  })
}

function addHit(mesh, data) {
  mesh.userData = {
    ...data,
    baseScale: mesh.scale.clone(),
    baseEmissive: mesh.material?.emissive ? mesh.material.emissive.getHex() : 0x000000,
    baseEmissiveIntensity: mesh.material?.emissiveIntensity ?? 0.3
  }
  interactive.push(mesh)
  group.add(mesh)
  return mesh
}

function createGround(theme) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(58, 96),
    mat({ color: theme.ground, metalness: 0.25, roughness: 0.9, emissive: theme.emissive, emissiveIntensity: 0.15 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  group.add(ground)

  const plate = new THREE.Mesh(
    new THREE.RingGeometry(46, 48, 96),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  )
  plate.rotation.x = -Math.PI / 2
  plate.position.y = 0.05
  group.add(plate)

  const inner = new THREE.Mesh(
    new THREE.RingGeometry(20, 20.35, 64),
    new THREE.MeshBasicMaterial({ color: theme.secondary, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
  )
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.06
  group.add(inner)

  const grid = new THREE.GridHelper(100, 50, theme.accent, 0x123048)
  grid.material.transparent = true
  grid.material.opacity = 0.22
  group.add(grid)
}

function createParticles(theme, count = 180) {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90
    positions[i * 3 + 1] = Math.random() * 28 + 1
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: theme.accent,
      size: 0.28,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    })
  )
  particles.userData.speed = 0.004 + Math.random() * 0.004
  scene.add(particles)
}

function createCore(theme, data) {
  const core = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.4, 16, 10),
    mat({ color: theme.building, emissive: theme.accent, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.22 })
  )
  body.position.y = 8
  core.add(body)

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.8, 0),
    glass(theme.accent, 0.7)
  )
  crystal.position.y = 18
  core.add(crystal)

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.08, 10, 64),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.8 })
  )
  torus.rotation.x = Math.PI / 2
  torus.position.y = 2
  core.add(torus)

  core.position.set(0, 0, 0)
  // hit proxy
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 18, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  hit.position.y = 9
  addHit(hit, data)
  group.add(core)
  animatables.push({ type: 'core', obj: core, crystal, torus })
  return core
}

function buildCity(theme, list) {
  const districts = ['中央商务区', '行政中心', '科技园区', '居住社区', '文旅街区', '物流枢纽']
  for (let i = 0; i < 48; i++) {
    const row = Math.floor(i / 8)
    const col = i % 8
    const x = (col - 3.5) * 5.2
    const z = (row - 2.5) * 5.2
    if (Math.hypot(x, z) < 7) continue

    const h = 4 + ((i * 17) % 16) + Math.random() * 3
    const building = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, h, 2.4),
      mat({ color: theme.building, emissive: theme.emissive, emissiveIntensity: 0.28, metalness: 0.62, roughness: 0.28 })
    )
    body.position.y = h / 2
    building.add(body)

    // glass facade strips
    for (let s = 0; s < 3; s++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(2.42, 0.12, 0.08),
        new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.55 })
      )
      strip.position.set(0, 1.2 + s * (h / 3.5), 1.22)
      building.add(strip)
    }

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 1.1),
      mat({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 })
    )
    roof.position.y = h + 0.2
    building.add(roof)

    building.position.set(x, 0, z)
    const item = list[i % list.length]
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, h + 0.6, 2.5),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.position.set(x, (h + 0.6) / 2, z)
    addHit(hit, {
      id: `city-${i}`,
      name: item.name,
      type: 'building',
      category: '城市建筑',
      value: item.value,
      unit: item.unit || '指数',
      district: item.district || districts[i % districts.length],
      status: item.status,
      load: item.extra?.load ?? Math.round(40 + Math.random() * 55),
      population: item.extra?.population ?? Math.round(800 + Math.random() * 5000),
      floors: Math.max(4, Math.round(h)),
      remark: item.remark || `${districts[i % districts.length]}孪生建筑节点`,
      effect: 'city-glow',
      metrics: [
        { label: '运行负荷', value: `${item.extra?.load ?? Math.round(40 + Math.random() * 55)}%` },
        { label: '楼层', value: `${Math.max(4, Math.round(h))}F` },
        { label: '关联人口', value: item.extra?.population ?? Math.round(800 + Math.random() * 5000) }
      ]
    })
    group.add(building)
  }

  createCore(theme, {
    id: 'city-core',
    name: '城市孪生中枢',
    type: 'core',
    category: '城市中枢',
    value: list.reduce((s, i) => s + Number(i.value || 0), 0),
    unit: '综合指数',
    district: '城市中心',
    status: 'normal',
    remark: '汇聚全市建筑、人口与运行状态的数字孪生核心',
    effect: 'core-pulse',
    metrics: [
      { label: '建筑节点', value: 48 },
      { label: '覆盖区域', value: 6 },
      { label: '健康度', value: '96%' }
    ]
  })
}

function buildTraffic(theme, list) {
  // highway cross
  const roads = [
    { w: 52, d: 3.2, x: 0, z: 0, name: '东西快速路' },
    { w: 3.2, d: 52, x: 0, z: 0, name: '南北快速路' },
    { w: 40, d: 2.2, x: 0, z: 14, name: '北环辅路' },
    { w: 40, d: 2.2, x: 0, z: -14, name: '南环辅路' }
  ]
  roads.forEach((r, i) => {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.18, r.d),
      mat({ color: 0x2a2418, emissive: theme.emissive, emissiveIntensity: 0.2, metalness: 0.15, roughness: 0.85 })
    )
    road.position.set(r.x, 0.1, r.z)
    addHit(road, {
      id: `road-${i}`,
      name: list[i]?.name || r.name,
      type: 'road',
      category: '路网',
      value: list[i]?.value ?? +(0.3 + Math.random() * 0.6).toFixed(2),
      unit: '拥堵指数',
      district: list[i]?.district || '主城区',
      status: list[i]?.status || (Math.random() > 0.7 ? 'warning' : 'normal'),
      speed: list[i]?.extra?.speed ?? Math.round(20 + Math.random() * 50),
      volume: list[i]?.extra?.volume ?? Math.round(400 + Math.random() * 1600),
      remark: list[i]?.remark || `${r.name}实时通行状态`,
      effect: 'traffic-flow',
      metrics: [
        { label: '平均车速', value: `${list[i]?.extra?.speed ?? Math.round(20 + Math.random() * 50)} km/h` },
        { label: '车流量', value: `${list[i]?.extra?.volume ?? Math.round(400 + Math.random() * 1600)} 辆/时` },
        { label: '通行能力', value: `${Math.round(60 + Math.random() * 35)}%` }
      ]
    })

    // lane marks
    const marks = new THREE.Mesh(
      new THREE.BoxGeometry(r.w > r.d ? r.w * 0.9 : 0.15, 0.02, r.w > r.d ? 0.15 : r.d * 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55 })
    )
    marks.position.set(r.x, 0.21, r.z)
    group.add(marks)
  })

  // cars
  for (let i = 0; i < 22; i++) {
    const car = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, 0.9),
      mat({ color: i % 3 === 0 ? theme.accent : theme.secondary, emissive: theme.emissive, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.3 })
    )
    body.position.y = 0.45
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.82), glass(0x88cfff, 0.45))
    cabin.position.set(-0.15, 0.85, 0)
    car.add(body, cabin)
    const lane = i % 2
    const pos = -22 + (i % 11) * 4
    car.position.set(lane ? pos : (Math.random() - 0.5) * 4, 0, lane ? (Math.random() - 0.5) * 1.2 : pos)
    if (!lane) car.rotation.y = Math.PI / 2

    const data = {
      id: `car-${i}`,
      name: `智能车辆 ${String(i + 1).padStart(2, '0')}`,
      type: 'vehicle',
      category: '车流单元',
      value: Math.round(25 + Math.random() * 60),
      unit: 'km/h',
      district: ['东向', '西向', '南向', '北向'][i % 4],
      status: Math.random() > 0.85 ? 'warning' : 'normal',
      remark: '联网车辆实时轨迹与速度反馈',
      effect: 'vehicle-trail',
      metrics: [
        { label: '瞬时速度', value: `${Math.round(25 + Math.random() * 60)} km/h` },
        { label: '电量/油量', value: `${Math.round(30 + Math.random() * 70)}%` },
        { label: '路径优先级', value: ['普通', '公交', '应急'][i % 3] }
      ]
    }
    // register body as interactive while keeping group for animation
    body.userData = {
      ...data,
      baseScale: body.scale.clone(),
      baseEmissive: body.material.emissive.getHex(),
      baseEmissiveIntensity: body.material.emissiveIntensity
    }
    interactive.push(body)
    group.add(car)
    animatables.push({ type: 'car', obj: car, lane, offset: i * 0.7, speed: 0.08 + Math.random() * 0.06 })
  }

  // signal lights
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 === 0 ? 4 : -4
    const sz = i < 2 ? 4 : -4
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 5.5, 10),
      mat({ color: 0x333333, metalness: 0.8, roughness: 0.3 })
    )
    pole.position.set(sx, 2.75, sz)
    group.add(pole)
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      mat({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.2 })
    )
    lamp.position.set(sx, 5.6, sz)
    addHit(lamp, {
      id: `signal-${i}`,
      name: `智能信号灯 ${i + 1}`,
      type: 'signal',
      category: '信控',
      value: ['红', '绿', '黄', '绿'][i],
      unit: '',
      district: '交叉口',
      status: 'normal',
      remark: '路口自适应信号控制与相位优化',
      effect: 'signal-flash',
      metrics: [
        { label: '当前相位', value: ['红灯', '绿灯', '黄灯', '绿灯'][i] },
        { label: '等待队列', value: `${Math.round(3 + Math.random() * 12)} 辆` },
        { label: '周期', value: `${Math.round(40 + Math.random() * 40)}s` }
      ]
    })
    animatables.push({ type: 'signal', obj: lamp, phase: i })
  }

  createCore(theme, {
    id: 'traffic-core',
    name: '交通调度中枢',
    type: 'core',
    category: '交通中枢',
    value: list.length ? +(list.reduce((s, i) => s + Number(i.value || 0), 0) / list.length).toFixed(2) : 0.45,
    unit: '平均拥堵',
    district: '指挥中心',
    status: 'normal',
    remark: '城市路网协同调度与拥堵研判核心',
    effect: 'core-pulse',
    metrics: [
      { label: '覆盖道路', value: roads.length },
      { label: '在线车辆', value: 22 },
      { label: '信号路口', value: 4 }
    ]
  })
}

function buildEnergy(theme, list) {
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 10 - 15
    const z = i < 4 ? -14 : 14
    const tower = new THREE.Group()
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.8, 9, 12),
      mat({ color: theme.building, emissive: theme.emissive, emissiveIntensity: 0.35, metalness: 0.75, roughness: 0.25 })
    )
    shaft.position.y = 4.5
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 16, 16),
      mat({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.2 })
    )
    hub.position.y = 9.2
    const blades = new THREE.Group()
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 0.18, 0.55),
        mat({ color: 0xdffcf0, emissive: theme.secondary, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3 })
      )
      blade.position.x = 3.1
      const pivot = new THREE.Group()
      pivot.rotation.z = (b * Math.PI * 2) / 3
      pivot.add(blade)
      blades.add(pivot)
    }
    blades.position.y = 9.2
    tower.add(shaft, hub, blades)
    tower.position.set(x, 0, z)
    group.add(tower)

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 12, 12), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(x, 6, z)
    addHit(hit, {
      id: `turbine-${i}`,
      name: list[i]?.name || `风电机组 ${i + 1}`,
      type: 'turbine',
      category: '风力发电',
      value: list[i]?.value ?? Math.round(180 + Math.random() * 420),
      unit: 'kW',
      district: list[i]?.district || '新能源区',
      status: list[i]?.status || 'normal',
      remark: list[i]?.remark || '风电叶片转速与出力实时孪生',
      effect: 'energy-spin',
      metrics: [
        { label: '实时出力', value: `${list[i]?.value ?? Math.round(180 + Math.random() * 420)} kW` },
        { label: '转速', value: `${Math.round(8 + Math.random() * 14)} rpm` },
        { label: '可用率', value: `${Math.round(88 + Math.random() * 10)}%` }
      ]
    })
    animatables.push({ type: 'turbine', obj: blades, speed: 0.05 + Math.random() * 0.04 })
  }

  for (let i = 0; i < 10; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.12, 2.4),
      mat({ color: 0x0b3d2e, emissive: theme.accent, emissiveIntensity: 0.35, metalness: 0.85, roughness: 0.18 })
    )
    panel.position.set((i % 5) * 5.2 - 10.4, 0.55, i < 5 ? 2 : -2)
    panel.rotation.x = -0.55
    addHit(panel, {
      id: `solar-${i}`,
      name: `光伏阵列 ${i + 1}`,
      type: 'solar',
      category: '光伏发电',
      value: Math.round(60 + Math.random() * 140),
      unit: 'kW',
      district: '光伏场站',
      status: 'normal',
      remark: '光伏板辐照强度与发电功率监测',
      effect: 'solar-shine',
      metrics: [
        { label: '发电功率', value: `${Math.round(60 + Math.random() * 140)} kW` },
        { label: '辐照度', value: `${Math.round(400 + Math.random() * 500)} W/m²` },
        { label: '板温', value: `${Math.round(28 + Math.random() * 20)}℃` }
      ]
    })
  }

  // energy storage tanks
  for (let i = 0; i < 4; i++) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 4.5, 20),
      mat({ color: theme.building, emissive: theme.secondary, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.25 })
    )
    tank.position.set(-18 + i * 4, 2.25, 0)
    addHit(tank, {
      id: `storage-${i}`,
      name: `储能舱 ${i + 1}`,
      type: 'storage',
      category: '储能系统',
      value: Math.round(40 + Math.random() * 55),
      unit: '% SOC',
      district: '储能站',
      status: Math.random() > 0.8 ? 'warning' : 'normal',
      remark: '电化学储能荷电状态与充放电策略',
      effect: 'storage-wave',
      metrics: [
        { label: 'SOC', value: `${Math.round(40 + Math.random() * 55)}%` },
        { label: '充放功率', value: `${Math.round(50 + Math.random() * 200)} kW` },
        { label: '循环次数', value: Math.round(200 + Math.random() * 800) }
      ]
    })
  }

  createCore(theme, {
    id: 'energy-core',
    name: '能源调度中枢',
    type: 'core',
    category: '能源中枢',
    value: list.reduce((s, i) => s + Number(i.value || 0), 0) || 2680,
    unit: 'kWh',
    district: '能源中心',
    status: 'normal',
    remark: '源网荷储一体化调度核心',
    effect: 'core-pulse',
    metrics: [
      { label: '风机', value: 8 },
      { label: '光伏阵列', value: 10 },
      { label: '储能舱', value: 4 }
    ]
  })
}

function buildEnvironment(theme, list) {
  // terrain soft mounds
  for (let i = 0; i < 6; i++) {
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(4 + Math.random() * 2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      mat({ color: 0x1a4a38, emissive: theme.emissive, emissiveIntensity: 0.2, metalness: 0.1, roughness: 0.9 })
    )
    mound.position.set((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30)
    group.add(mound)
  }

  for (let i = 0; i < 36; i++) {
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, 2.4, 8),
      mat({ color: 0x5a3a22, metalness: 0.1, roughness: 0.85 })
    )
    trunk.position.y = 1.2
    const leaves = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.15 + Math.random() * 0.4, 0),
      mat({ color: i % 2 ? theme.accent : 0x2f9e6a, emissive: theme.emissive, emissiveIntensity: 0.25, metalness: 0.15, roughness: 0.7 })
    )
    leaves.position.y = 2.9
    tree.add(trunk, leaves)
    const ang = Math.random() * Math.PI * 2
    const rad = 8 + Math.random() * 28
    tree.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad)
    group.add(tree)

    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(tree.position.x, 2.8, tree.position.z)
    addHit(hit, {
      id: `tree-${i}`,
      name: `生态单元 ${i + 1}`,
      type: 'vegetation',
      category: '绿化覆盖',
      value: list[i % list.length]?.value ?? Math.round(60 + Math.random() * 35),
      unit: '%',
      district: list[i % list.length]?.district || '公园绿带',
      status: 'normal',
      remark: '植被健康度与碳汇估算单元',
      effect: 'eco-breathe',
      metrics: [
        { label: '覆盖率', value: `${Math.round(60 + Math.random() * 35)}%` },
        { label: '碳汇', value: `${+(1 + Math.random() * 4).toFixed(1)} t` },
        { label: '湿度', value: `${Math.round(40 + Math.random() * 40)}%` }
      ]
    })
    animatables.push({ type: 'tree', obj: leaves, phase: Math.random() * Math.PI })
  }

  for (let i = 0; i < 6; i++) {
    const station = new THREE.Group()
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 1.2, 8),
      mat({ color: theme.building, emissive: theme.emissive, emissiveIntensity: 0.3, metalness: 0.55, roughness: 0.35 })
    )
    base.position.y = 0.6
    const sensor = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), glass(theme.secondary, 0.65))
    sensor.position.y = 2.1
    station.add(base, sensor)
    const ang = (i / 6) * Math.PI * 2
    station.position.set(Math.cos(ang) * 22, 0, Math.sin(ang) * 22)
    group.add(station)

    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(station.position.x, 1.8, station.position.z)
    const aqi = list[i]?.value ?? Math.round(25 + Math.random() * 90)
    addHit(hit, {
      id: `station-${i}`,
      name: list[i]?.name || `空气监测站 ${i + 1}`,
      type: 'station',
      category: '环境监测',
      value: aqi,
      unit: 'AQI',
      district: list[i]?.district || '监测点位',
      status: aqi > 100 ? 'critical' : aqi > 70 ? 'warning' : 'normal',
      remark: list[i]?.remark || 'AQI / PM2.5 / 温湿度综合传感',
      effect: 'eco-scan',
      metrics: [
        { label: 'AQI', value: aqi },
        { label: 'PM2.5', value: `${Math.round(8 + Math.random() * 60)} μg/m³` },
        { label: '温度', value: `${+(8 + Math.random() * 22).toFixed(1)}℃` }
      ]
    })
    animatables.push({ type: 'station', obj: sensor })
  }

  // lake
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    mat({
      color: 0x1a6a88,
      metalness: 0.35,
      roughness: 0.12,
      emissive: theme.secondary,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.82
    })
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(12, 0.12, -8)
  addHit(lake, {
    id: 'lake-1',
    name: '城市生态湖',
    type: 'water',
    category: '水体',
    value: +(6.5 + Math.random()).toFixed(1),
    unit: '水质等级',
    district: '滨水区',
    status: 'normal',
    remark: '水体透明度、溶解氧与水质等级监测',
    effect: 'water-ripple',
    metrics: [
      { label: '水质', value: 'II 类' },
      { label: '溶解氧', value: `${+(6 + Math.random() * 3).toFixed(1)} mg/L` },
      { label: '透明度', value: `${+(1.2 + Math.random()).toFixed(1)} m` }
    ]
  })

  createCore(theme, {
    id: 'eco-core',
    name: '生态环境中枢',
    type: 'core',
    category: '环境中枢',
    value: list.length ? Math.round(list.reduce((s, i) => s + Number(i.value || 0), 0) / list.length) : 58,
    unit: '综合指数',
    district: '生态中心',
    status: 'normal',
    remark: '绿化、空气、水体一体化数字孪生中枢',
    effect: 'core-pulse',
    metrics: [
      { label: '植被单元', value: 36 },
      { label: '监测站', value: 6 },
      { label: '水体', value: 1 }
    ]
  })
}

function buildSecurity(theme, list) {
  // city blocks low profile
  for (let i = 0; i < 12; i++) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2 + (i % 3), 4),
      mat({ color: theme.building, emissive: theme.emissive, emissiveIntensity: 0.22, metalness: 0.5, roughness: 0.4 })
    )
    const ang = (i / 12) * Math.PI * 2
    block.position.set(Math.cos(ang) * 12, 1.5, Math.sin(ang) * 12)
    group.add(block)
  }

  for (let i = 0; i < 10; i++) {
    const tower = new THREE.Group()
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 8, 10),
      mat({ color: 0x3a3a3a, emissive: theme.emissive, emissiveIntensity: 0.2, metalness: 0.8, roughness: 0.25 })
    )
    mast.position.y = 4
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.8),
      mat({ color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.25 })
    )
    head.position.y = 8.2
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), glass(0xffd0dc, 0.8))
    lens.position.set(0.55, 8.2, 0)
    tower.add(mast, head, lens)
    const ang = (i / 10) * Math.PI * 2
    tower.position.set(Math.cos(ang) * 24, 0, Math.sin(ang) * 24)
    tower.lookAt(0, 8, 0)
    group.add(tower)

    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 9, 10), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(tower.position.x, 4.5, tower.position.z)
    addHit(hit, {
      id: `cam-${i}`,
      name: list[i]?.name || `高点摄像头 ${i + 1}`,
      type: 'camera',
      category: '视频监控',
      value: list[i]?.value ?? 1080,
      unit: 'P',
      district: list[i]?.district || '周界防区',
      status: list[i]?.status || (Math.random() > 0.85 ? 'warning' : 'normal'),
      remark: list[i]?.remark || 'AI 视频结构化与异常行为识别',
      effect: 'security-scan',
      metrics: [
        { label: '分辨率', value: `${list[i]?.value ?? 1080}P` },
        { label: '在线率', value: `${Math.round(92 + Math.random() * 7)}%` },
        { label: '告警数', value: Math.round(Math.random() * 6) }
      ]
    })
    animatables.push({ type: 'camera', obj: head, lens, ang })
  }

  // fence
  const fence = new THREE.Mesh(
    new THREE.TorusGeometry(28, 0.12, 8, 80),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.65 })
  )
  fence.rotation.x = Math.PI / 2
  fence.position.y = 1.2
  addHit(fence, {
    id: 'fence-1',
    name: '电子围栏',
    type: 'fence',
    category: '周界安防',
    value: 99.2,
    unit: '% 完整度',
    district: '外环',
    status: 'normal',
    remark: '周界入侵检测与电子围栏完整性监测',
    effect: 'fence-pulse',
    metrics: [
      { label: '完整度', value: '99.2%' },
      { label: '防区数', value: 16 },
      { label: '今日触发', value: Math.round(Math.random() * 5) }
    ]
  })
  animatables.push({ type: 'fence', obj: fence })

  // drones
  for (let i = 0; i < 4; i++) {
    const drone = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.25, 1.2),
      mat({ color: theme.secondary, emissive: theme.accent, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.25 })
    )
    const ang = (i / 4) * Math.PI * 2
    drone.position.set(Math.cos(ang) * 16, 10 + i, Math.sin(ang) * 16)
    addHit(drone, {
      id: `drone-${i}`,
      name: `巡检无人机 ${i + 1}`,
      type: 'drone',
      category: '空中巡防',
      value: Math.round(70 + Math.random() * 25),
      unit: '% 电量',
      district: '空域A',
      status: 'normal',
      remark: '低空巡检与应急快速响应单元',
      effect: 'drone-orbit',
      metrics: [
        { label: '电量', value: `${Math.round(70 + Math.random() * 25)}%` },
        { label: '高度', value: `${10 + i}0 m` },
        { label: '任务', value: ['巡线', '盯防', '支援', '测绘'][i] }
      ]
    })
    animatables.push({ type: 'drone', obj: drone, ang, radius: 16, height: 10 + i })
  }

  createCore(theme, {
    id: 'sec-core',
    name: '安防指挥中枢',
    type: 'core',
    category: '安防中枢',
    value: list.length || 10,
    unit: '防区',
    district: '指挥中心',
    status: 'normal',
    remark: '视频、围栏、无人机一体化安防中枢',
    effect: 'core-pulse',
    metrics: [
      { label: '摄像头', value: 10 },
      { label: '无人机', value: 4 },
      { label: '围栏完整度', value: '99.2%' }
    ]
  })
}

function buildTheme(themeKey) {
  if (!alive || !scene) return
  clearSceneContent()
  selected.value = null
  emit('select', null)

  const theme = THEMES[themeKey] || THEMES.city
  scene.fog = new THREE.FogExp2(theme.fog, 0.014)
  scene.background = null
  if (wrapRef.value) wrapRef.value.style.setProperty('--glow', theme.skyGlow)

  group = new THREE.Group()
  effectGroup = new THREE.Group()
  scene.add(group)
  scene.add(effectGroup)

  createGround(theme)
  createParticles(theme, themeKey === 'environment' ? 220 : 160)

  const list = Array.isArray(props.themeData?.nodes) && props.themeData.nodes.length
    ? props.themeData.nodes
    : Array.from({ length: 24 }, (_, i) => ({
        name: `${theme.label}节点${i + 1}`,
        value: Math.round(50 + Math.random() * 400),
        unit: '',
        district: '主城区',
        status: ['normal', 'warning', 'critical'][i % 5 === 0 ? 1 : 0],
        remark: `${theme.label}监测数据`
      }))

  if (themeKey === 'traffic') buildTraffic(theme, list)
  else if (themeKey === 'energy') buildEnergy(theme, list)
  else if (themeKey === 'environment') buildEnvironment(theme, list)
  else if (themeKey === 'security') buildSecurity(theme, list)
  else buildCity(theme, list)

  // selection visuals
  selectionHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.55, 48),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  )
  selectionHalo.rotation.x = -Math.PI / 2
  selectionHalo.visible = false
  effectGroup.add(selectionHalo)

  selectionBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.35, 18, 12),
    new THREE.MeshBasicMaterial({ color: theme.secondary, transparent: true, opacity: 0.55 })
  )
  selectionBeam.visible = false
  effectGroup.add(selectionBeam)
}

function showSelectionEffect(obj, data) {
  const theme = THEMES[props.theme] || THEMES.city
  const pos = new THREE.Vector3()
  obj.getWorldPosition(pos)

  selectionHalo.visible = true
  selectionHalo.position.set(pos.x, 0.2, pos.z)
  const scale = Math.max(2, Math.min(6, 2.2 + Math.random()))
  selectionHalo.userData.baseScale = scale
  selectionHalo.scale.setScalar(scale)

  selectionBeam.visible = true
  selectionBeam.position.set(pos.x, 9, pos.z)
  selectionBeam.material.color.setHex(theme.accent)

  // reset previous emissive
  interactive.forEach((m) => {
    if (m.material?.emissive && m.userData.baseEmissive != null) {
      m.material.emissive.setHex(m.userData.baseEmissive)
      m.material.emissiveIntensity = m.userData.baseEmissiveIntensity
    }
    if (m.userData.baseScale) m.scale.copy(m.userData.baseScale)
  })

  if (obj.material?.emissive) {
    obj.material.emissive.setHex(0xffffff)
    obj.material.emissiveIntensity = 1.1
  }
  obj.scale.setScalar(1.08)
  pulseTime = 0

  // temporary spark ring burst
  const burst = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.7, 32),
    new THREE.MeshBasicMaterial({ color: theme.secondary, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  )
  burst.rotation.x = -Math.PI / 2
  burst.position.set(pos.x, 0.3, pos.z)
  effectGroup.add(burst)
  animatables.push({ type: 'burst', obj: burst, life: 0 })
}

function clearSelectionEffect() {
  if (selectionHalo) selectionHalo.visible = false
  if (selectionBeam) selectionBeam.visible = false
  interactive.forEach((m) => {
    if (m.material?.emissive && m.userData.baseEmissive != null) {
      m.material.emissive.setHex(m.userData.baseEmissive)
      m.material.emissiveIntensity = m.userData.baseEmissiveIntensity
    }
    if (m.userData.baseScale) m.scale.copy(m.userData.baseScale)
  })
}

function updateCamera() {
  camera.position.set(Math.cos(orbitAngle) * orbitRadius, orbitHeight, Math.sin(orbitAngle) * orbitRadius)
  camera.lookAt(0, 5, 0)
}

function init() {
  if (alive) destroy()
  alive = true
  const el = wrapRef.value
  if (!el) return
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || window.innerHeight
  clock = new THREE.Clock()

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 400)
  updateCamera()

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  el.appendChild(renderer.domElement)

  const hemi = new THREE.HemisphereLight(0x9ec9ff, 0x0a1520, 0.7)
  const dir = new THREE.DirectionalLight(0xffffff, 1.05)
  dir.position.set(25, 40, 15)
  const fill = new THREE.PointLight(0x4db8ff, 1.1, 120)
  fill.position.set(-10, 20, -10)
  const rim = new THREE.PointLight(0xffffff, 0.55, 80)
  rim.position.set(15, 12, 20)
  lights = [hemi, dir, fill, rim]
  lights.forEach((l) => scene.add(l))

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  const dom = renderer.domElement
  dom.addEventListener('pointerdown', onPointerDown)
  dom.addEventListener('pointermove', onPointerMove)
  dom.addEventListener('pointerup', onPointerUp)
  dom.addEventListener('pointerleave', onPointerUp)
  dom.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)

  buildTheme(props.theme)
  animate()
}

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function onKeyDown(e) {
  if (isTypingTarget(e.target)) return
  const code = e.code
  if (
    code === 'ArrowLeft' ||
    code === 'ArrowRight' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'KeyA' ||
    code === 'KeyD' ||
    code === 'KeyW' ||
    code === 'KeyS' ||
    code === 'KeyQ' ||
    code === 'KeyE'
  ) {
    keys[code] = true
    e.preventDefault()
  }
}

function onKeyUp(e) {
  keys[e.code] = false
}

function applyKeyboardOrbit() {
  let moved = false
  if (keys.ArrowLeft || keys.KeyA) {
    orbitAngle -= KEY_ROTATE
    moved = true
  }
  if (keys.ArrowRight || keys.KeyD) {
    orbitAngle += KEY_ROTATE
    moved = true
  }
  if (keys.ArrowUp || keys.KeyW) {
    orbitHeight = Math.min(42, orbitHeight + KEY_PITCH)
    moved = true
  }
  if (keys.ArrowDown || keys.KeyS) {
    orbitHeight = Math.max(10, orbitHeight - KEY_PITCH)
    moved = true
  }
  if (keys.KeyQ) {
    orbitRadius = Math.min(75, orbitRadius + KEY_ZOOM)
    moved = true
  }
  if (keys.KeyE) {
    orbitRadius = Math.max(24, orbitRadius - KEY_ZOOM)
    moved = true
  }
  if (moved) updateCamera()
}

function onPointerDown(e) {
  isDragging = true
  dragMoved = false
  lastX = e.clientX
  lastY = e.clientY
}

function onPointerMove(e) {
  if (!isDragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true
  lastX = e.clientX
  lastY = e.clientY
  orbitAngle += dx * 0.005
  orbitHeight = Math.min(42, Math.max(10, orbitHeight - dy * 0.04))
  updateCamera()
}

function onPointerUp(e) {
  const wasDrag = dragMoved
  isDragging = false
  if (!wasDrag) pick(e)
}

function onWheel(e) {
  orbitRadius = Math.min(75, Math.max(24, orbitRadius + e.deltaY * 0.025))
  updateCamera()
}

function pick(e) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(interactive, false)
  if (hits.length) {
    const obj = hits[0].object
    selected.value = { ...obj.userData }
    showSelectionEffect(obj, obj.userData)
    emit('select', selected.value)
  } else {
    selected.value = null
    clearSelectionEffect()
    emit('select', null)
  }
}

function animate() {
  if (!alive || !renderer || !scene || !camera) return
  animationId = requestAnimationFrame(animate)
  applyKeyboardOrbit()
  const t = clock ? clock.getElapsedTime() : 0
  pulseTime += 0.05

  if (particles) {
    particles.rotation.y += particles.userData.speed
    const pos = particles.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + 0.01
      if (y > 30) y = 1
      pos.setY(i, y)
    }
    pos.needsUpdate = true
  }

  if (selectionHalo?.visible) {
    selectionHalo.material.opacity = 0.55 + Math.sin(pulseTime * 4) * 0.3
    const base = selectionHalo.userData.baseScale || 2
    selectionHalo.scale.setScalar(base * (1 + Math.sin(pulseTime * 3) * 0.1))
    selectionBeam.material.opacity = 0.35 + Math.sin(pulseTime * 3) * 0.2
    selectionBeam.scale.y = 1 + Math.sin(pulseTime * 2) * 0.08
  }

  animatables = animatables.filter((a) => {
    if (a.type === 'burst') {
      a.life += 0.05
      a.obj.scale.setScalar(1 + a.life * 4)
      a.obj.material.opacity = Math.max(0, 0.95 - a.life)
      if (a.life > 1) {
        effectGroup.remove(a.obj)
        a.obj.geometry.dispose()
        a.obj.material.dispose()
        return false
      }
    } else if (a.type === 'car') {
      if (a.lane) {
        a.obj.position.x += a.speed
        if (a.obj.position.x > 24) a.obj.position.x = -24
      } else {
        a.obj.position.z += a.speed
        if (a.obj.position.z > 24) a.obj.position.z = -24
      }
    } else if (a.type === 'turbine') {
      a.obj.rotation.z += a.speed
    } else if (a.type === 'signal') {
      const phase = Math.floor((t + a.phase) % 3)
      const colors = [0xff3344, 0x33ff66, 0xffcc33]
      a.obj.material.color.setHex(colors[phase])
      a.obj.material.emissive.setHex(colors[phase])
    } else if (a.type === 'tree') {
      a.obj.scale.setScalar(1 + Math.sin(t * 1.5 + a.phase) * 0.04)
    } else if (a.type === 'station') {
      a.obj.rotation.y += 0.02
      a.obj.position.y = 2.1 + Math.sin(t * 2) * 0.12
    } else if (a.type === 'camera') {
      a.obj.rotation.y = Math.sin(t * 0.8 + a.ang) * 0.5
    } else if (a.type === 'fence') {
      a.obj.material.opacity = 0.4 + Math.sin(t * 2) * 0.25
    } else if (a.type === 'drone') {
      a.ang += 0.01
      a.obj.position.set(Math.cos(a.ang) * a.radius, a.height + Math.sin(t * 2) * 0.4, Math.sin(a.ang) * a.radius)
    } else if (a.type === 'core') {
      a.crystal.rotation.y += 0.02
      a.crystal.rotation.x += 0.01
      a.torus.scale.setScalar(1 + Math.sin(t * 2) * 0.06)
    }
    return true
  })

  try {
    renderer.render(scene, camera)
  } catch {
    alive = false
  }
}

function onResize() {
  if (!alive || !wrapRef.value || !camera || !renderer) return
  const w = wrapRef.value.clientWidth
  const h = wrapRef.value.clientHeight
  if (!w || !h) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function scheduleRebuild() {
  if (!alive || !scene) return
  if (rebuildTimer) clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null
    if (alive && scene) buildTheme(props.theme)
  }, 120)
}

watch(
  () => props.theme,
  (v) => {
    if (alive && scene) buildTheme(v)
  }
)

watch(
  () => props.themeData,
  () => scheduleRebuild(),
  { deep: true }
)

onMounted(() => init())
onBeforeUnmount(() => destroy())

defineExpose({
  clearSelect() {
    selected.value = null
    clearSelectionEffect()
  },
  destroy
})
</script>

<style scoped>
.city3d {
  position: absolute;
  inset: 0;
  z-index: 0;
  cursor: grab;
  --glow: #0a2040;
  background:
    radial-gradient(ellipse at 50% 20%, color-mix(in srgb, var(--glow) 70%, transparent), transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(0, 40, 80, 0.35), transparent 50%);
}
.city3d:active {
  cursor: grabbing;
}
.fx-layer {
  display: none;
}
.hint {
  position: absolute;
  left: 50%;
  bottom: 42px;
  transform: translateX(-50%);
  z-index: 2;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--sc-muted);
  background: rgba(4, 20, 40, 0.6);
  border: 1px solid var(--sc-border);
  pointer-events: none;
  letter-spacing: 1px;
  backdrop-filter: blur(6px);
}
</style>
