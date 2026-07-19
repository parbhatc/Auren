import type { RefObject } from 'react'
import {
  getActiveShortcut,
  getShortcutsWithCustomizations,
} from '../../utils/keyboardShortcutsStorage'

type KeyboardHost = {
  containerRef: RefObject<HTMLDivElement>
  _keyboardListenerCleanup?: (() => void) | null
}

/**
 * Intentionally registers nothing with the BWC widget. BWC's onShortcut
 * registry binds a capture-phase keydown listener on `document` that calls
 * preventDefault + stopPropagation for every registered key — registering
 * our shortcuts there (even with a no-op callback, as this used to do)
 * swallowed every key before the app's own document-level handlers
 * (e.g. BacktesterChartView.handleKeyboardShortcut) could see it, leaving
 * all shortcuts dead. App shortcuts are handled by plain document keydown
 * listeners; keys must propagate to them untouched.
 */
export function setupChartKeyboardShortcuts(_widget: unknown): void {
  // no-op — see comment above
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
