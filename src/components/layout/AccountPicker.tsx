import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Beaker, Check, ChevronDown, Rewind, Wallet, X } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import './AccountPicker.css'

export interface AccountPickerOption {
  value: string
  label: string
  group: string
  description?: string
  status?: string
  platform?: 'tradesea' | 'tradingview' | 'practice' | 'replay'
}

interface AccountPickerProps {
  options: AccountPickerOption[]
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
}

function PlatformMark({
  platform,
  isDark,
}: {
  platform?: AccountPickerOption['platform']
  isDark: boolean
}) {
  return (
    <span
      className="auren-account-picker-mark"
      data-platform={platform}
      aria-hidden="true"
    >
      {platform === 'tradesea' ? (
        <img src="/brands/tradesea.svg" alt="" />
      ) : platform === 'tradingview' ? (
        <img
          src={`/brands/tradingview-${isDark ? 'white' : 'black'}.svg`}
          alt=""
        />
      ) : platform === 'replay' ? (
        <Rewind size={16} strokeWidth={1.6} />
      ) : platform === 'practice' ? (
        <Beaker size={16} strokeWidth={1.6} />
      ) : (
        <Wallet size={16} strokeWidth={1.6} />
      )}
    </span>
  )
}

export default function AccountPicker({
  options,
  value,
  onChange,
  emptyLabel = 'Select account',
}: AccountPickerProps) {
  const { isDark } = useTheme()
  const id = useId().replace(/:/g, '')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const previousValue = useRef(value)
  const [open, setOpen] = useState(false)
  const [activeValue, setActiveValue] = useState<string | null>(null)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 360,
    maxHeight: 440,
    ready: false,
  })
  const selected = options.find((option) => option.value === value)
  const groups = useMemo(() => {
    const result = new Map<string, AccountPickerOption[]>()
    for (const option of options)
      result.set(option.group, [...(result.get(option.group) ?? []), option])
    return [...result]
  }, [options])
  const navigationOptions = useMemo(
    () => groups.flatMap(([, entries]) => entries),
    [groups]
  )
  const optionId = (optionValue: string) =>
    `${id}-option-${options.findIndex((option) => option.value === optionValue)}`

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])
  const openPicker = (edge: 'selected' | 'first' | 'last' = 'selected') => {
    if (!options.length) return
    setActiveValue(
      edge === 'last'
        ? navigationOptions[navigationOptions.length - 1].value
        : edge === 'selected' && selected
          ? selected.value
          : navigationOptions[0].value
    )
    setOpen(true)
  }
  const choose = (option: AccountPickerOption) => {
    close(true)
    if (option.value !== value) onChange(option.value)
  }
  const updatePosition = useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect()
    if (!anchor) return
    const viewport = window.visualViewport
    const width = viewport?.width ?? window.innerWidth
    const height = viewport?.height ?? window.innerHeight
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const popupWidth = Math.max(0, Math.min(360, width - 24))
    const below = viewportTop + height - anchor.bottom - 12
    const above = anchor.top - viewportTop - 12
    const showAbove = below < 220 && above > below
    const maxHeight = Math.max(
      0,
      Math.min(440, (showAbove ? above : below) - 8)
    )
    const popupHeight = Math.min(
      popupRef.current?.getBoundingClientRect().height || 400,
      maxHeight
    )
    const left = Math.max(
      viewportLeft + 12,
      Math.min(anchor.left, viewportLeft + width - popupWidth - 12)
    )
    const desiredTop = showAbove
      ? Math.max(viewportTop + 12, anchor.top - popupHeight - 8)
      : anchor.bottom + 8
    const top = Math.max(
      viewportTop + 12,
      Math.min(desiredTop, viewportTop + height - popupHeight - 12)
    )
    setPosition((current) =>
      current.left === left &&
      current.top === top &&
      current.width === popupWidth &&
      current.maxHeight === maxHeight &&
      current.ready
        ? current
        : { left, top, width: popupWidth, maxHeight, ready: true }
    )
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    listRef.current?.focus()
  }, [open, updatePosition])
  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, options.length, groups.length, updatePosition])
  useEffect(() => {
    if (!open) return
    if (!options.some((option) => option.value === activeValue))
      setActiveValue(options[0]?.value ?? null)
  }, [open, options, activeValue])
  useEffect(() => {
    if (open && activeValue)
      optionRefs.current
        .get(activeValue)
        ?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeValue])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      )
        close(false)
    }
    document.addEventListener('pointerdown', outside, true)
    const layoutTransitionEnded = (event: TransitionEvent) => {
      if (event.propertyName === 'padding-left' || event.propertyName === 'width') updatePosition()
    }
    document.addEventListener('transitionend', layoutTransitionEnded, true)
    // The sidebar animates the header's width after a breakpoint change.
    // Follow its completed layout, not only the initial window resize event.
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition)
    if (triggerRef.current) {
      resizeObserver?.observe(triggerRef.current)
      const header = triggerRef.current.closest('header')
      if (header) resizeObserver?.observe(header)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.visualViewport?.addEventListener('resize', updatePosition)
    window.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('transitionend', layoutTransitionEnded, true)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.visualViewport?.removeEventListener('resize', updatePosition)
      window.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [open, close, updatePosition])
  useEffect(() => {
    if (previousValue.current !== value) {
      previousValue.current = value
      if (open)
        close(Boolean(popupRef.current?.contains(document.activeElement)))
    }
    if (open && !options.length) close(false)
  }, [value, open, options.length, close])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') {
      // Restore the logical tab origin before letting the browser move to the
      // next header control; the portal must not move tab order to document end.
      close(true)
      return
    }
    const target = event.target as HTMLElement
    const focusedOption = target?.closest?.(
      '[role="option"]'
    ) as HTMLElement | null
    if (target !== listRef.current && !focusedOption) return
    const focusedValue =
      focusedOption?.getAttribute('data-account-value') ?? activeValue
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const index = navigationOptions.findIndex(
        (option) => option.value === focusedValue
      )
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? navigationOptions.length - 1
            : event.key === 'ArrowDown'
              ? (index + 1) % navigationOptions.length
              : (index - 1 + navigationOptions.length) %
                navigationOptions.length
      setActiveValue(navigationOptions[next]?.value ?? null)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = options.find((item) => item.value === focusedValue)
      if (option) choose(option)
    }
  }

  return (
    <div className="auren-account-picker">
      <button
        ref={triggerRef}
        type="button"
        className="auren-account-picker-trigger"
        aria-label="Active account"
        aria-describedby={`${id}-label`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-dialog` : undefined}
        disabled={!options.length}
        onClick={() => (open ? close(true) : openPicker())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (open) listRef.current?.focus()
            else openPicker(event.key === 'ArrowUp' ? 'last' : 'selected')
          } else if (event.key === 'Escape' && open) close(true)
        }}
      >
        <PlatformMark platform={selected?.platform} isDark={isDark} />
        <span id={`${id}-label`} className="auren-account-picker-trigger-label">
          {selected?.label ||
            (options.length ? emptyLabel : 'No accounts available')}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={open ? 'is-open' : ''}
          aria-hidden="true"
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            id={`${id}-dialog`}
            role="dialog"
            aria-label="Choose account"
            className="auren-account-picker-popup"
            onKeyDown={handleKeyDown}
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
              visibility: position.ready ? 'visible' : 'hidden',
            }}
          >
            <div className="auren-account-picker-heading">
              <div>
                <h2>Accounts</h2>
                <p>Choose where you want to trade.</p>
              </div>
              <button
                type="button"
                aria-label="Close accounts"
                onClick={() => close(true)}
              >
                <X size={15} />
              </button>
            </div>
            <div
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              tabIndex={0}
              aria-activedescendant={
                options.some((option) => option.value === activeValue)
                  ? optionId(activeValue!)
                  : undefined
              }
              aria-label="Accounts"
              className="auren-account-picker-list"
            >
              {groups.map(([group, entries], groupIndex) => (
                <div
                  key={group}
                  role="group"
                  aria-labelledby={`${id}-group-${groupIndex}`}
                  className="auren-account-picker-group"
                >
                  <h3 id={`${id}-group-${groupIndex}`}>
                    {group || 'Accounts'}
                    <span>{entries.length}</span>
                  </h3>
                  {entries.map((option) => (
                    <button
                      key={option.value}
                      ref={(node) => {
                        if (node) optionRefs.current.set(option.value, node)
                        else optionRefs.current.delete(option.value)
                      }}
                      id={optionId(option.value)}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      data-account-value={option.value}
                      tabIndex={-1}
                      className={`auren-account-picker-option ${option.value === activeValue ? 'is-highlighted' : ''} ${option.value === value ? 'is-selected' : ''}`}
                      onPointerMove={() => setActiveValue(option.value)}
                      onFocus={() => setActiveValue(option.value)}
                      onClick={() => choose(option)}
                    >
                      <PlatformMark
                        platform={option.platform}
                        isDark={isDark}
                      />
                      <span className="auren-account-picker-copy">
                        <span className="auren-account-picker-option-label">
                          {option.label}
                        </span>
                        {option.description || option.status ? (
                          <span className="auren-account-picker-meta">
                            {option.description ? (
                              <span>{option.description}</span>
                            ) : null}
                            {option.status ? (
                              <span
                                className={`auren-account-picker-status ${/active|passed|connected/i.test(option.status) && !/inactive|disconnected/i.test(option.status) ? 'is-positive' : /blown|failed|breach|limit reached/i.test(option.status) ? 'is-negative' : ''}`}
                              >
                                {option.status}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      {option.value === value ? (
                        <Check
                          size={15}
                          strokeWidth={2}
                          className="auren-account-picker-check"
                          aria-hidden="true"
                        />
                      ) : (
                        <span />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="auren-account-picker-footer">
              <span role="status">
                {options.length} {options.length === 1 ? 'account' : 'accounts'}
              </span>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate <kbd>↵</kbd> select
              </span>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
