import { useEffect, useRef } from 'react'
import {
  getShortcutsWithCustomizations,
  getActiveShortcut,
} from '../utils/keyboardShortcutsStorage'
import { KeyboardShortcut, UseKeyboardShortcutsOptions, CustomizableShortcut } from '../types/settings'

/**
 * Professional keyboard shortcut hook
 * Manages keyboard shortcuts with conflict detection and proper event handling
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, ignoreInputElements = true } = options
  const shortcutsRef = useRef(shortcuts)

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      if (ignoreInputElements) {
        const target = event.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      // Load custom shortcuts to check for overrides
      const customShortcuts = getShortcutsWithCustomizations()
      const allShortcuts: CustomizableShortcut[] = []
      customShortcuts.forEach((cat) => {
        allShortcuts.push(...cat.shortcuts)
      })

      // Find matching shortcut
      const matchingShortcut = shortcutsRef.current.find((shortcut) => {
        // Check if shortcut is disabled
        if (shortcut.enabled === false) return false

        // If shortcut has an ID, check for custom override
        let activeKey = shortcut.key
        let activeCtrl = shortcut.ctrl
        let activeShift = shortcut.shift
        let activeAlt = shortcut.alt
        let activeMeta = shortcut.meta

        if (shortcut.shortcutId) {
          const customShortcut = allShortcuts.find((s) => s.id === shortcut.shortcutId)
          if (customShortcut) {
            if (customShortcut.enabled === false) return false
            const active = getActiveShortcut(customShortcut)
            activeKey = active.key
            activeCtrl = active.ctrl
            activeShift = active.shift
            activeAlt = active.alt
            activeMeta = active.meta
          }
        }

        const keyMatch = activeKey.toLowerCase() === event.key.toLowerCase()
        const ctrlMatch = !!activeCtrl === (event.ctrlKey || event.metaKey)
        const shiftMatch = activeShift === undefined || activeShift === event.shiftKey
        const altMatch = activeAlt === undefined || activeAlt === event.altKey
        const metaMatch = activeMeta === undefined || activeMeta === event.metaKey

        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
      })

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault !== false) {
          event.preventDefault()
        }
        if (matchingShortcut.stopPropagation) {
          event.stopPropagation()
        }
        matchingShortcut.action()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, ignoreInputElements])
}

/**
 * Format keyboard shortcut for display
 */
export const formatShortcut = (shortcut: Omit<KeyboardShortcut, 'action'>): string => {
  const parts: string[] = []
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
  }
  if (shortcut.alt) {
    parts.push('Alt')
  }
  if (shortcut.shift) {
    parts.push('Shift')
  }
  
  // Format the key
  let key = shortcut.key
  if (key === ' ') {
    key = 'Space'
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }
  parts.push(key)
  
  return parts.join(' + ')
}

