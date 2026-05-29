import type { RefObject } from 'react'
import {
  getActiveShortcut,
  getShortcutsWithCustomizations,
} from '../../utils/keyboardShortcutsStorage'

function getKeyCode(key: string): number | null {
  const keyMap: Record<string, number> = {
    ' ': 32,
    ArrowRight: 39,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowDown: 40,
    Enter: 13,
    Escape: 27,
    Tab: 9,
    Backspace: 8,
    Delete: 46,
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90,
    '0': 48,
    '1': 49,
    '2': 50,
    '3': 51,
    '4': 52,
    '5': 53,
    '6': 54,
    '7': 55,
    '8': 56,
    '9': 57,
    '/': 191,
    '?': 191,
  }
  return keyMap[key] ?? null
}

type KeyboardHost = {
  containerRef: RefObject<HTMLDivElement>
  _keyboardListenerCleanup?: (() => void) | null
}

export function setupChartKeyboardShortcuts(widget: unknown): void {
  if (!widget) return

  const w = widget as {
    onChartReady?: (cb: () => void) => void
    onShortcut?: (shortcut: (string | number)[], cb: () => void) => void
  }

  try {
    w.onChartReady?.(() => {
      try {
        const shortcutsConfig = getShortcutsWithCustomizations()
        const allShortcuts: Array<{
          id: string
          enabled?: boolean
        }> = []

        shortcutsConfig.forEach((category) => {
          category.shortcuts.forEach((shortcut) => {
            if (shortcut.enabled !== false) {
              allShortcuts.push(shortcut)
            }
          })
        })

        allShortcuts.forEach((shortcut) => {
          try {
            const active = getActiveShortcut(shortcut as Parameters<typeof getActiveShortcut>[0])
            const keyCode = getKeyCode(active.key)
            if (keyCode === null) return

            const shortcutArray: (string | number)[] = []
            if (active.ctrl || active.meta) shortcutArray.push('ctrl')
            if (active.shift) shortcutArray.push('shift')
            if (active.alt) shortcutArray.push('alt')
            shortcutArray.push(keyCode)

            w.onShortcut?.(shortcutArray, () => {})
          } catch {
            /* skip invalid shortcut */
          }
        })
      } catch (error) {
        console.warn('Could not load shortcuts from settings:', error)
      }
    })
  } catch (error) {
    console.warn('Could not setup keyboard shortcuts:', error)
  }
}

export function setupChartContainerKeyboardListener(host: KeyboardHost): void {
  if (!host.containerRef.current) {
    setTimeout(() => setupChartContainerKeyboardListener(host), 100)
    return
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    const isBrowserShortcut =
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') ||
      ((event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'r') ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') ||
      event.key === 'F5' ||
      event.key === 'F12'

    if (isBrowserShortcut) return

    try {
      const shortcutsConfig = getShortcutsWithCustomizations()
      const allShortcuts: Parameters<typeof getActiveShortcut>[0][] = []
      shortcutsConfig.forEach((category) => {
        category.shortcuts.forEach((shortcut) => {
          if (shortcut.enabled !== false) allShortcuts.push(shortcut)
        })
      })

      const key = event.key.toLowerCase()
      const matchesShortcut = allShortcuts.some((shortcut) => {
        const active = getActiveShortcut(shortcut)
        const keyMatch = active.key.toLowerCase() === key
        const ctrlMatch = !!active.ctrl === (event.ctrlKey || event.metaKey)
        const shiftMatch = active.shift === undefined || active.shift === event.shiftKey
        const altMatch = active.alt === undefined || active.alt === event.altKey
        const metaMatch = active.meta === undefined || active.meta === event.metaKey
        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
      })

      if (matchesShortcut) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            which: event.which,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true,
          })
        )
      }
    } catch (error) {
      console.warn('Could not check shortcuts from settings:', error)
    }
  }

  host.containerRef.current.addEventListener('keydown', handleKeyDown, true)

  host._keyboardListenerCleanup = () => {
    host.containerRef.current?.removeEventListener('keydown', handleKeyDown, true)
  }
}
