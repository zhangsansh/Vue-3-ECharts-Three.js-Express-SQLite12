import { defineStore } from 'pinia'
import { getSettings, saveSettings } from '@/api'

const defaults = {
  themeName: '智慧城市蓝',
  primaryColor: '#00d4ff',
  accentColor: '#00ffa3',
  bgColor: '#0a1628',
  panelBg: 'rgba(6, 30, 60, 0.55)',
  fontFamily: '"Orbitron", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  fontSize: '14',
  chartTheme: 'dark',
  modelTheme: 'city',
  headerTitle: '智慧城市数字孪生可视化平台'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    settings: { ...defaults }
  }),
  actions: {
    applyCss() {
      const s = this.settings
      const root = document.documentElement
      root.style.setProperty('--sc-bg', s.bgColor)
      root.style.setProperty('--sc-panel', s.panelBg)
      root.style.setProperty('--sc-primary', s.primaryColor)
      root.style.setProperty('--sc-accent', s.accentColor)
      root.style.setProperty('--sc-font', s.fontFamily)
      root.style.setProperty('--sc-font-size', `${s.fontSize}px`)
      document.body.style.background = s.bgColor
    },
    async load() {
      try {
        const res = await getSettings()
        this.settings = { ...defaults, ...res.data }
        this.applyCss()
      } catch {
        this.applyCss()
      }
    },
    async save( partial ) {
      this.settings = { ...this.settings, ...partial }
      this.applyCss()
      await saveSettings(this.settings)
    },
    setLocal(partial) {
      this.settings = { ...this.settings, ...partial }
      this.applyCss()
    }
  }
})
