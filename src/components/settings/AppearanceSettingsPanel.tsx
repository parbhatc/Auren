import { Check, Monitor, Moon, Paintbrush, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import type { AppearancePreset, ThemeMode } from '../../contexts/ThemeContext'

const MODES = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
] as const

const PRESETS = [
  {
    id: 'black', label: 'Black', description: 'Clean and minimal',
    dark: { background: '#09090B', panel: '#18181B', inset: '#111113', border: '#2B2B2F', accent: '#E4E4E7' },
    light: { background: '#FAFAFA', panel: '#FFFFFF', inset: '#F4F4F5', border: '#E4E4E7', accent: '#3F3F46' },
  },
  {
    id: 'graphite', label: 'Graphite', description: 'Soft neutral contrast',
    dark: { background: '#171719', panel: '#232326', inset: '#1C1C1F', border: '#3A3A40', accent: '#E4E4E7' },
    light: { background: '#EEEEEF', panel: '#FAFAFA', inset: '#E5E5E7', border: '#D4D4D8', accent: '#3F3F46' },
  },
  {
    id: 'slate', label: 'Slate', description: 'Cool tones and blue accents',
    dark: { background: '#0B1220', panel: '#142031', inset: '#101A29', border: '#29394D', accent: '#7DD3FC' },
    light: { background: '#F4F7FB', panel: '#FFFFFF', inset: '#EEF3F9', border: '#DCE5EF', accent: '#0369A1' },
  },
] as const

export default function AppearanceSettingsPanel() {
  const { isDark, themeMode, setThemeMode, appearancePreset, setAppearancePreset } = useTheme()

  return (
    <section className="auren-appearance-panel" aria-labelledby="appearance-settings-title">
      <div className="auren-appearance-heading">
        <span className="auren-appearance-heading-icon"><Paintbrush size={18} strokeWidth={1.6} aria-hidden /></span>
        <div>
          <h2 id="appearance-settings-title">Appearance</h2>
          <p>Choose a background and make the workspace feel like yours.</p>
        </div>
      </div>

      <div className="auren-appearance-control-row">
        <div><h3>Color mode</h3><p>{themeMode === 'system' ? `Following your device’s ${isDark ? 'dark' : 'light'} appearance.` : `${isDark ? 'Dark' : 'Light'} appearance is always on.`}</p></div>
        <div className="auren-appearance-modes" role="group" aria-label="Color mode">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={themeMode === id} onClick={() => setThemeMode(id as ThemeMode)} className={themeMode === id ? 'is-selected' : ''}><Icon size={14} strokeWidth={1.6} aria-hidden />{label}</button>
          ))}
        </div>
      </div>

      <div className="auren-appearance-presets-label"><h3>Background preset</h3><span>Previewed in {isDark ? 'dark' : 'light'} mode</span></div>
      <div className="auren-appearance-presets" role="group" aria-label="Background preset">
        {PRESETS.map((preset) => {
          const selected = appearancePreset === preset.id
          const preview = isDark ? preset.dark : preset.light
          return (
            <button key={preset.id} type="button" aria-pressed={selected} onClick={() => setAppearancePreset(preset.id as AppearancePreset)} className={`auren-appearance-preset ${selected ? 'is-selected' : ''}`}>
              <div className="auren-appearance-preview" style={{ backgroundColor: preview.background, borderColor: preview.border }} aria-hidden>
                <div className="auren-appearance-preview-rail" style={{ backgroundColor: preview.panel, borderColor: preview.border }}><span style={{ backgroundColor: preview.accent }} /><i style={{ backgroundColor: preview.border }} /><i style={{ backgroundColor: preview.border }} /><i style={{ backgroundColor: preview.border }} /></div>
                <div className="auren-appearance-preview-main"><span style={{ backgroundColor: preview.accent }} /><div className="auren-appearance-preview-cards"><i style={{ backgroundColor: preview.panel, borderColor: preview.border }} /><i style={{ backgroundColor: preview.panel, borderColor: preview.border }} /></div><div className="auren-appearance-preview-content" style={{ backgroundColor: preview.inset, borderColor: preview.border }}><span style={{ backgroundColor: preview.accent }} /><span style={{ backgroundColor: preview.border }} /><span style={{ backgroundColor: preview.border }} /></div></div>
                {selected ? <span className="auren-appearance-preview-check"><Check size={12} strokeWidth={2.5} /></span> : null}
              </div>
              <span className="auren-appearance-preset-name">{preset.label}</span><span className="auren-appearance-preset-description">{preset.description}</span>
            </button>
          )
        })}
      </div>
      <p className="auren-appearance-save-note">Changes apply immediately and are saved on this device.</p>
    </section>
  )
}
