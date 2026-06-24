import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { schedulePageScrollReset } from '../../utils/resetPageScroll'

/** Clear BWC / trade-terminal scroll locks whenever the route changes. */
export function RouteScrollRestore() {
  const { pathname } = useLocation()

  useEffect(() => {
    schedulePageScrollReset()
  }, [pathname])

  return null
}
