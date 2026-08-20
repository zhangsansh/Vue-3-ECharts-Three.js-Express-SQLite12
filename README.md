# 智慧城市数字孪生可视化平台

基于 **Vue 3 + ECharts + Three.js + Express + SQLite** 打造的智慧城市数字孪生可视化系统。  
面向城市运行监测、专题分析、数据管理与智能预测等场景，提供沉浸式 3D 孪生大屏与多类型数据可视化能力。

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [功能模块](#功能模块)
- [系统架构](#系统架构)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [安装与启动](#安装与启动)
- [演示账号与权限](#演示账号与权限)
- [页面说明](#页面说明)
- [3D 孪生大屏操作](#3d-孪生大屏操作)
- [智能预测说明](#智能预测说明)
- [后端接口概览](#后端接口概览)
- [数据库说明](#数据库说明)
- [样式与主题](#样式与主题)
- [常见问题](#常见问题)
- [开发建议](#开发建议)

---

## 项目简介

本系统将「数字孪生」理念与城市可视化大屏相结合：

1. **独立全屏 3D 孪生页**：按主题切换不同三维场景与组件，支持点击查看业务数据与特效反馈。  
2. **多页 ECharts 可视化**：覆盖堆叠面积、凹凸图、动态排序、热力图、主题河流、三维图、关系图等。  
3. **业务管理能力**：用户权限、数据 CRUD、Excel 导入导出、数据库连接配置、系统样式设置。  
4. **智能预测**：参数滑条调参 + 图片上传特征分析，输出得分、置信度、因子贡献与建议。

适合作为智慧城市 / 数字孪生 / 可视化大屏类课程设计、毕业设计或演示原型。

---

## 技术栈

### 前端

| 技术                       | 说明                    |
| -------------------------- | ----------------------- |
| Vue 3                      | 组合式 API 构建单页应用 |
| Vite 5                     | 开发构建工具            |
| Vue Router 4               | 路由与权限守卫          |
| Pinia                      | 用户态 / 主题态管理     |
| Element Plus               | 后台管理 UI 组件        |
| ECharts 6                  | 二维图表                |
| ECharts GL                 | 三维 / 高级图表         |
| Three.js                   | 数字孪生 3D 场景        |
| Axios                      | HTTP 请求               |
| Sass                       | 样式预处理              |
| Day.js / XLSX / file-saver | 时间与表格导入导出      |

### 后端

| 技术              | 说明               |
| ----------------- | ------------------ |
| Node.js + Express | REST API 服务      |
| better-sqlite3    | 本地 SQLite 数据库 |
| JSON Web Token    | 登录鉴权           |
| bcryptjs          | 密码加密           |
| Multer            | 图片上传           |
| ExcelJS           | Excel 导入导出     |
| Nodemon           | 开发热重启         |

---

## 功能模块

### 1. 登录与安全

- 深色科技风登录页（类 VS / 控制台风格）
- 图形验证码（SVG 动态生成，点击刷新）
- 支持 **用户名登录** / **手机号登录**
- JWT Token 鉴权，路由级权限拦截

### 2. 3D 数字孪生大屏（独立页面）

- 全屏沉浸式 Three.js 场景，不叠加业务 ECharts 图表
- 五大主题场景，组件与数据各不相同：
  - **城市全景**：建筑群、玻璃幕墙、发光屋顶、孪生中枢
  - **智慧交通**：路网、流动车辆、信号灯相位
  - **能源孪生**：风机、光伏、储能舱
  - **生态环境**：植被、监测站、生态湖
  - **城市安防**：摄像头、电子围栏、巡检无人机
- 点击模型：高亮、脉冲光环、光柱、数据详情卡
- 主题数据来自 SQLite 业务表（交通 / 环境 / 能源 / 事件等）

### 3. 数据可视化图表（分页）

- **运行监测**：堆叠面积、断轴柱状、堆叠柱状、瀑布图、动态排序柱、可滚动图例、虚线柱、嵌套环图等
- **专题分析**：安斯库姆四重奏、主题河流、象形柱、农历热力、相关矩阵、单轴散点、星云散点、矩阵微型条、运行示意地图等
- **三维关系**：径向树、关系图、依赖图、平行坐标、三维柱/散点、Bar3D、散点矩阵组合、大规模图网络等

### 4. 数据管理

- 多业务表切换（城市指标、交通、环境、能源、事件）
- 增删改查、关键词搜索、分页
- Excel 导出 / 导入
- 深色表格样式（消除默认白底）

### 5. 用户管理

- 用户新增 / 编辑 / 删除
- 角色：`admin` / `editor` / `viewer`
- 细粒度权限：`dashboard`、`charts`、`data`、`users`、`settings`、`predict`、`db`

### 6. 系统样式设置

- 系统标题、主色、强调色、背景色、面板透明度
- 字体族、字号滑条
- 默认 3D 主题
- 实时预览并持久化到数据库

### 7. 数据库连接设置

- 连接配置的增删改查
- SQLite 连接测试
- 预留 MySQL / PostgreSQL 配置字段（演示环境以 SQLite 为主）

### 8. 智能预测

- 模型类型：交通拥堵 / 能源负荷 / 环境质量 / 综合风险
- 参数滑条：温度、湿度、人口、交通、能源、阈值
- 图片拖拽上传、压缩、特征提取（亮度 / 对比度 / 暖色 / 绿占比 / 边缘密度）
- 加权融合 + 历史基线校准 + 图像特征修正
- 输出得分、等级、置信度、因子贡献、建议与历史记录

---

## 系统架构

```text
浏览器 (Vue3 SPA)
   │  /api 代理
   ▼
Express API (3001)
   │
   ├─ JWT 鉴权中间件
   ├─ 业务路由：auth / data / settings / predict
   └─ SQLite (server/data/smart_city.db)
         └─ 上传文件 (server/uploads)
```

- 开发环境：Vite Dev Server（5173）通过 proxy 转发 `/api`、`/uploads` 到后端。  
- 生产环境：可先 `npm run build`，再由 Nginx / 静态服务托管 `dist`，并反向代理 API。

---

## 目录结构

```text
Vue25/
├── public/                 # 静态资源
├── src/
│   ├── api/                # Axios 封装与接口定义
│   ├── components/
│   │   ├── City3D.vue      # Three.js 孪生场景
│   │   └── ChartPanel.vue  # ECharts 通用容器
│   ├── router/             # 路由与权限守卫
│   ├── stores/             # Pinia：用户 / 主题
│   ├── styles/             # 全局深色主题样式
│   ├── views/
│   │   ├── Login.vue
│   │   ├── Dashboard.vue   # 3D 孪生大屏（独立全屏）
│   │   ├── Layout.vue      # 管理端布局
│   │   ├── charts/         # 图表分页
│   │   ├── DataManage.vue
│   │   ├── UserManage.vue
│   │   ├── StyleSettings.vue
│   │   ├── DbSettings.vue
│   │   └── Predict.vue
│   ├── App.vue
│   └── main.js
├── server/
│   ├── index.js            # Express 入口
│   ├── db.js               # SQLite 初始化与种子数据
│   ├── middleware/auth.js
│   ├── routes/             # auth / data / settings / predict
│   ├── data/               # SQLite 库文件（运行后生成）
│   └── uploads/            # 上传文件目录
├── package.json            # 前端依赖
└── README.md
```

---

## 环境要求

- **Node.js**：建议 `20.x`（当前工程已按 Node 20 兼容 Vite 5 / better-sqlite3@11）
- **npm**：10+
- **操作系统**：Windows / macOS / Linux
- **浏览器**：Chrome / Edge 等现代浏览器（需支持 WebGL）

> 若 Node 版本过低或过高导致原生模块编译失败，请优先使用 Node 20 LTS。

---

## 安装与启动

### 1. 安装依赖

```bash
# 前端
npm install

# 后端
cd server
npm install
cd ..
```

### 2. 启动服务（两个终端）

```bash
# 终端 1：后端 API（默认 http://localhost:3001）
cd server
npm run dev

# 终端 2：前端（默认 http://localhost:5173）
npm run dev
```

### 3. 访问系统

浏览器打开：[http://localhost:5173](http://localhost:5173)

健康检查：

```bash
curl http://localhost:3001/api/health
```

### 4. 生产构建（前端）

```bash
npm run build
npm run preview
```

---

## 演示账号与权限

| 用户名 | 密码      | 手机号      | 角色   | 可用能力               |
| ------ | --------- | ----------- | ------ | ---------------------- |
| admin  | admin123  | 13800000001 | 管理员 | 全部功能               |
| editor | editor123 | 13800000002 | 编辑员 | 大屏、图表、数据、预测 |
| viewer | viewer123 | 13800000003 | 访客   | 大屏、图表             |

登录方式：

1. **账号登录**：用户名 + 密码 + 验证码  
2. **手机号登录**：手机号 + 密码 + 验证码  

权限标识说明：

| 权限码    | 含义           |
| --------- | -------------- |
| dashboard | 3D 孪生大屏    |
| charts    | 图表分页       |
| data      | 数据管理       |
| users     | 用户管理       |
| settings  | 样式设置       |
| predict   | 智能预测       |
| db        | 数据库连接设置 |

---

## 页面说明

| 路由               | 页面        | 说明                           |
| ------------------ | ----------- | ------------------------------ |
| `/login`           | 登录页      | 验证码、账号/手机号登录        |
| `/dashboard`       | 3D 孪生大屏 | 独立全屏，主题切换与模型交互   |
| `/charts/ops`      | 运行监测    | 运营类二维图表合集             |
| `/charts/analysis` | 专题分析    | 统计与专题图表合集             |
| `/charts/advanced` | 三维关系    | 三维图、关系图、依赖图等       |
| `/data`            | 数据管理    | 多表 CRUD + Excel              |
| `/users`           | 用户管理    | 角色与权限配置                 |
| `/style`           | 样式设置    | 颜色、字体、标题、默认 3D 主题 |
| `/db`              | 数据库设置  | 连接配置与测试                 |
| `/predict`         | 智能预测    | 参数调参 + 图片预测            |

---

## 3D 孪生大屏操作

| 操作     | 方式                                             |
| -------- | ------------------------------------------------ |
| 旋转视角 | 鼠标左键拖拽，或 `←` `→` / `A` `D`               |
| 俯仰视角 | 鼠标上下拖拽，或 `↑` `↓` / `W` `S`               |
| 缩放     | 鼠标滚轮，或 `Q`（拉远）/ `E`（拉近）            |
| 切换主题 | 顶部主题按钮                                     |
| 查看数据 | 点击场景中的可交互模型                           |
| 离开页面 | 右上角导航；离开前会自动销毁 WebGL，避免跳转卡顿 |

各主题绑定不同业务数据源，例如：

- 交通主题 ← `traffic_data`
- 环境主题 ← `environment_data`
- 能源主题 ← `energy_data`
- 安防主题 ← `events`
- 城市主题 ← `city_metrics`

---

## 智能预测说明

### 预测流程

1. 选择模型类型并调整参数滑条  
2. （可选）上传场景图片：自动校验、压缩、提取视觉特征  
3. 点击「开始预测」  
4. 后端按模型权重融合数值特征与图像特征，并结合历史基线校准  
5. 返回得分、风险等级、置信度、因子贡献、建议与曲线

### 上传限制

- 格式：JPG / PNG / WEBP / GIF / BMP  
- 大小：不超过 **5MB**  
- 前端会压缩为 JPEG 并提取特征后再提交

### 结果解读

- **score**：综合风险/负荷得分（0–100）  
- **level**：低风险 / 中等风险 / 偏高风险  
- **confidence**：置信度（有图、有历史基线时更高）  
- **factors**：各因子贡献排序  
- **imageAnalysis**：图像特征摘要

---

## 后端接口概览

基础地址：`http://localhost:3001/api`

| 方法                | 路径                       | 说明                 |
| ------------------- | -------------------------- | -------------------- |
| GET                 | `/health`                  | 服务健康检查         |
| GET                 | `/auth/captcha`            | 获取验证码           |
| POST                | `/auth/login`              | 登录                 |
| GET                 | `/auth/me`                 | 当前用户信息         |
| GET/POST/PUT/DELETE | `/auth/users`              | 用户管理（管理员）   |
| GET                 | `/data/tables`             | 数据表列表           |
| GET/POST/PUT/DELETE | `/data/:table`             | 业务表 CRUD          |
| GET                 | `/data/:table/export`      | 导出 Excel           |
| POST                | `/data/:table/import`      | 导入 Excel           |
| GET                 | `/data/stats/overview`     | 大屏汇总统计         |
| GET/PUT             | `/settings`                | 系统样式读写         |
| GET/POST/PUT/DELETE | `/settings/db-config`      | 数据库连接配置       |
| POST                | `/settings/db-config/test` | 连接测试             |
| POST                | `/predict/run`             | 执行预测（可带图片） |
| GET                 | `/predict/history`         | 预测历史             |

除登录与验证码外，其余接口需在 Header 携带：

```http
Authorization: Bearer <token>
```

---

## 数据库说明

- 引擎：SQLite  
- 默认文件：`server/data/smart_city.db`  
- 首次启动 `server/db.js` 会自动建表并写入演示数据

### 主要数据表

| 表名               | 用途                |
| ------------------ | ------------------- |
| `users`            | 用户、角色、权限    |
| `city_metrics`     | 城市综合指标        |
| `traffic_data`     | 交通拥堵/车速/流量  |
| `environment_data` | 空气质量与气象      |
| `energy_data`      | 建筑用电用水用气    |
| `events`           | 城市事件 / 安防相关 |
| `system_settings`  | 样式与系统配置      |
| `db_config`        | 数据库连接配置      |
| `predict_history`  | 预测历史记录        |

---

## 样式与主题

- 全局 CSS 变量控制主色、背景、面板透明度、字体  
- 管理页表格已覆盖 Element Plus 默认白底  
- 页面统一提供滚动条样式，内容过多时可完整滚动查看  
- 在「样式设置」中修改后立即预览，并保存到 `system_settings`

---

## 常见问题

### 1. 前端能打开，但登录失败 / 接口报错

请确认后端已启动（3001 端口），并检查：

```bash
curl http://localhost:3001/api/health
```

### 2. `better-sqlite3` 安装失败

多为 Node 版本或缺少编译环境导致。建议：

- 使用 Node 20 LTS  
- Windows 可安装 windows-build-tools / Visual Studio Build Tools  
- 重新执行 `cd server && npm install`

### 3. 3D 页面空白

- 确认浏览器开启硬件加速 / 支持 WebGL  
- 打开控制台查看是否有 WebGL 报错  
- 尝试切换主题或刷新页面

### 4. 页面跳转卡顿或点不动

当前版本已在离开 3D 页时销毁 WebGL 与事件监听。若仍异常：

- 硬刷新浏览器（Ctrl+F5）  
- 确认未同时开多个旧版后端进程占用端口

### 5. 验证码看不清

点击验证码图片即可刷新。

### 6. 上传图片预测失败

- 检查图片格式与大小（≤5MB）  
- 确认账号具备 `predict` 权限  
- 查看 `server/uploads/predict` 目录是否可写

---

## 开发建议

1. **前后端分离调试**：先保证 `/api/health` 正常，再联调页面。  
2. **权限扩展**：在用户管理中为角色勾选权限码即可，路由 `meta.perm` 已对接。  
3. **3D 扩展**：在 `City3D.vue` 中按主题增加组件与 `userData` 字段即可接入新业务数据。  
4. **图表扩展**：在 `src/views/charts/` 下新增页面，并在 `router/index.js`、侧边菜单中注册。  
5. **数据初始化**：删除 `server/data/smart_city.db` 后重启后端，可按种子逻辑重建演示数据。

---

## 脚本命令速查

```bash
# 前端开发
npm run dev

# 前端打包
npm run build

# 前端预览打包结果
npm run preview

# 后端开发（热重启）
cd server && npm run dev

# 后端直接启动
cd server && npm start
```

---

## 版本信息

- 项目名称：`smart-city-digital-twin`
- 版本：`1.0.0`
- 默认前端端口：`5173`
- 默认后端端口：`3001`

---

## 许可证

本项目用于学习、演示与二次开发。可按实际课程 / 项目要求自行约定使用范围。


<img width="2544" height="1411" alt="屏幕截图 2026-08-19 091528" src="https://github.com/user-attachments/assets/d15b4c02-3114-40c4-8363-326036c46e79" />

<img width="2543" height="1410" alt="屏幕截图 2026-08-19 091548" src="https://github.com/user-attachments/assets/8619702f-3aa3-4dce-9696-d779cc4fd5f3" />
<img width="2538" height="1403" alt="屏幕截图 2026-08-19 091554" src="https://github.com/user-attachments/assets/a495f29e-aa7b-4833-bca7-b65df837a19e" />
![Uploading 屏幕截图 2026-08-19 091554.png…]()
<img width="2536" height="1380" alt="屏幕截图 2026-08-19 091610" src="https://github.com/user-attachments/assets/2cad840c-5944-4b88-90ff-64a5c59b3c25" />
<img width="2503" height="1392" alt="屏幕截图 2026-08-19 091617" src="https://github.com/user-attachments/assets/08132974-6959-44a5-9d58-17db895d26ca" />
<img width="2436" height="1331" alt="屏幕截图 2026-08-19 091627" src="https://github.com/user-attachments/assets/84ad9dbd-c36d-44af-bbf2-c5ebb0612a65" />
<img width="2522" height="1383" alt="屏幕截图 2026-08-19 091632" src="https://github.com/user-attachments/assets/2dccb6e0-e9b9-4d93-b069-359285b6a2d5" />
<img width="2447" height="1365" alt="屏幕截图 2026-08-19 091636" src="https://github.com/user-attachments/assets/ca87a326-d1eb-4e9b-97eb-639b3ec95d6f" />
<img width="2535" height="1409" alt="屏幕截图 2026-08-19 091640" src="https://github.com/user-attachments/assets/4a5c0ed5-4459-4502-a869-21ab27b047d1" />
<img width="2541" height="1405" alt="屏幕截图 2026-08-19 091645" src="https://github.com/user-attachments/assets/434c8000-7494-4820-a9d9-d06d9e27a628" />
<img width="2544" height="1409" alt="屏幕截图 2026-08-19 091650" src="https://github.com/user-attachments/assets/c3af8488-e3d7-4f6b-865c-ee468a47b181" />

