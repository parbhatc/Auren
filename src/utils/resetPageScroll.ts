/** Restore document scrolling after full-screen trade terminal (mobile). */
export function resetPageScroll(): void {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')
  html.style.overflow = ''
  html.style.height = ''
  body.style.overflow = ''
  body.style.height = ''
  body.style.position = ''
  if (root) {
    root.style.overflow = ''
    root.style.height = ''
  }
  document.querySelectorAll('.tv-symbol__dropdown.is-portaled').forEach((el) => el.remove())
  window.scrollTo(0, 0)
}
