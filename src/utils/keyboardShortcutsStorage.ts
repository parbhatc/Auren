import { CustomizableShortcut, ShortcutCategory } from '../types/settings'

// Re-export types for convenience
export type { CustomizableShortcut, ShortcutCategory }

/**
 * Default keyboard shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: ShortcutCategory[] = [
  {
    id: 'playback',
    name: 'Playback Controls',
    shortcuts: [
      {
        id: 'play-pause',
        category: 'playback',
        description: 'Play/Pause',
        defaultKey: ' ',
        enabled: true,
      },
      {
        id: 'next-candle',
        category: 'playback',
        description: 'Next Candle',
        defaultKey: 'ArrowRight',
        enabled: true,
      },
      {
        id: 'toggle-replay',
        category: 'playback',
        description: 'Toggle Replay',
        defaultKey: 'r',
        enabled: true,
      },
      {
        id: 'speed-1x',
        category: 'playback',
        description: 'Speed 1x',
        defaultKey: '1',
        enabled: true,
      },
      {
        id: 'speed-2x',
        category: 'playback',
        description: 'Speed 2x',
        defaultKey: '2',
        enabled: true,
      },
      {
        id: 'speed-4x',
        category: 'playback',
        description: 'Speed 4x',
        defaultKey: '4',
        enabled: true,
      },
      {
        id: 'speed-8x',
        category: 'playback',
        description: 'Speed 8x',
        defaultKey: '8',
        enabled: true,
      },
    ],
  },
  {
    id: 'trading',
    name: 'Trading Actions',
    shortcuts: [
      {
        id: 'buy',
        category: 'trading',
        description: 'Buy',
        defaultKey: 'b',
        enabled: true,
      },
      {
        id: 'sell',
        category: 'trading',
        description: 'Sell',
        defaultKey: 's',
        enabled: true,
      },
      {
        id: 'close-position',
        category: 'trading',
        description: 'Close Position',
        defaultKey: 'c',
        enabled: true,
      },
      {
        id: 'reverse-position',
        category: 'trading',
        description: 'Reverse Position',
        defaultKey: 'v',
        enabled: true,
      },
      {
        id: 'flatten-all',
        category: 'trading',
        description: 'Flatten All Positions',
        defaultKey: 'f',
        enabled: true,
      },
    ],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    shortcuts: [
      {
        id: 'show-shortcuts',
        category: 'navigation',
        description: 'Show Keyboard Shortcuts',
        defaultKey: '?',
        defaultShift: true,
        enabled: true,
      },
      {
        id: 'open-journal',
        category: 'navigation',
        description: 'Open Replay Journal',
        defaultKey: 'j',
        enabled: true,
      },
      {
        id: 'create-session',
        category: 'navigation',
        description: 'Create New Session',
        defaultKey: 'n',
        defaultCtrl: true,
        defaultMeta: true,
        enabled: true,
      },
    ],
  },
]

const STORAGE_KEY = 'custom_keyboard_shortcuts'

/**
 * Load custom shortcuts from localStorage
 */
export const loadCustomShortcuts = (): Record<string, Partial<CustomizableShortcut>> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading custom shortcuts:', error)
  }
  return {}
}

/**
 * Save custom shortcuts to localStorage
 */
export const saveCustomShortcuts = (shortcuts: Record<string, Partial<CustomizableShortcut>>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
  } catch (error) {
    console.error('Error saving custom shortcuts:', error)
  }
}

/**
 * Get all shortcuts with custom overrides applied
 */
export const getShortcutsWithCustomizations = (): ShortcutCategory[] => {
  const customShortcuts = loadCustomShortcuts()
  
  return DEFAULT_SHORTCUTS.map((category) => ({
    ...category,
    shortcuts: category.shortcuts.map((shortcut) => {
      const custom = customShortcuts[shortcut.id]
      if (custom) {
        return {
          ...shortcut,
          customKey: custom.customKey,
          customCtrl: custom.customCtrl,
          customShift: custom.customShift,
          customAlt: custom.customAlt,
          customMeta: custom.customMeta,
          enabled: custom.enabled !== undefined ? custom.enabled : shortcut.enabled,
        }
      }
      return shortcut
    }),
  }))
}

/**
 * Get the active key combination for a shortcut (custom or default)
 */
export const getActiveShortcut = (shortcut: CustomizableShortcut) => {
  return {
    key: shortcut.customKey || shortcut.defaultKey,
    ctrl: shortcut.customCtrl !== undefined ? shortcut.customCtrl : shortcut.defaultCtrl,
    shift: shortcut.customShift !== undefined ? shortcut.customShift : shortcut.defaultShift,
    alt: shortcut.customAlt !== undefined ? shortcut.customAlt : shortcut.defaultAlt,
    meta: shortcut.customMeta !== undefined ? shortcut.customMeta : shortcut.defaultMeta,
  }
}

/**
 * Update a shortcut's customization
 */
export const updateShortcutCustomization = (
  shortcutId: string,
  customization: Partial<CustomizableShortcut>
): void => {
  const customShortcuts = loadCustomShortcuts()
  customShortcuts[shortcutId] = {
    ...customShortcuts[shortcutId],
    ...customization,
  }
  saveCustomShortcuts(customShortcuts)
}

/**
 * Reset a shortcut to default
 */
export const resetShortcutToDefault = (shortcutId: string): void => {
  const customShortcuts = loadCustomShortcuts()
  delete customShortcuts[shortcutId]
  saveCustomShortcuts(customShortcuts)
}

/**
 * Reset all shortcuts to default
 */
export const resetAllShortcutsToDefault = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}

