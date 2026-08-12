import React, { useCallback } from 'react'

/**
 * Unified pointer-based drag & drop for page cards (mouse + touch).
 *
 * - Mouse / pen: drag starts once the pointer travels a small threshold.
 * - Touch: drag starts after a long press (moving beyond the tolerance
 *   before the timer fires cancels the drag so normal scrolling works).
 * - While a drag is active a `touchmove` preventDefault handler is attached
 *   to the document (non-passive) so the page does not scroll under the
 *   finger; it is removed as soon as the drag ends.
 * - Targets are resolved with document.elementFromPoint against elements
 *   carrying a data-page-index attribute; visual feedback reuses the
 *   existing `is-dragging` / `drag-over` classes.
 * - Dragging near the top/bottom edge of the #main container auto-scrolls.
 */

const LONG_PRESS_MS = 300
const TOUCH_MOVE_TOLERANCE = 10
const MOUSE_START_THRESHOLD = 6
const EDGE_SCROLL_ZONE = 72
const EDGE_SCROLL_MAX_SPEED = 18

type DropHandler = (sourceIndex: number, targetIndex: number) => void

interface Session {
  pointerId: number
  isTouch: boolean
  sourceIndex: number
  sourceEl: HTMLElement
  onDrop: DropHandler
  startX: number
  startY: number
  x: number
  y: number
  grabOffsetX: number
  grabOffsetY: number
  started: boolean
  longPressTimer: number | null
  ghost: HTMLElement | null
  overEl: HTMLElement | null
  overIndex: number | null
  scrollContainer: HTMLElement | null
  rafId: number | null
}

let session: Session | null = null

const preventTouchMove = (e: TouchEvent) => {
  e.preventDefault()
}

const suppressNextClick = () => {
  const suppress = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', suppress, { capture: true, once: true })
  // drop the guard shortly after in case no click follows this drag
  setTimeout(() => {
    window.removeEventListener('click', suppress, { capture: true })
  }, 120)
}

const suppressContextMenu = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
}

function findCardAt(x: number, y: number): { el: HTMLElement; index: number } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (!el) return null
  const card = el.closest('[data-page-index]') as HTMLElement | null
  if (!card) return null
  const index = Number(card.dataset.pageIndex)
  if (!Number.isInteger(index) || index < 0) return null
  return { el: card, index }
}

function createGhost(s: Session) {
  const rect = s.sourceEl.getBoundingClientRect()
  const ghost = document.createElement('div')
  ghost.className = 'page-drag-ghost'
  ghost.style.width = `${rect.width}px`
  ghost.style.height = `${rect.height}px`

  const clone = s.sourceEl.cloneNode(true) as HTMLElement
  clone.classList.remove('is-dragging', 'drag-over')
  clone.style.width = '100%'
  clone.style.height = '100%'
  ghost.appendChild(clone)

  document.body.appendChild(ghost)
  s.ghost = ghost
  positionGhost(s)
}

function positionGhost(s: Session) {
  if (s.ghost) {
    s.ghost.style.transform = `translate(${s.x - s.grabOffsetX}px, ${s.y - s.grabOffsetY}px)`
  }
}

function updateOverTarget(s: Session) {
  const found = findCardAt(s.x, s.y)
  const nextEl = found && found.index !== s.sourceIndex ? found.el : null
  const nextIndex = nextEl && found ? found.index : null

  if (s.overEl !== nextEl) {
    s.overEl?.classList.remove('drag-over')
    nextEl?.classList.add('drag-over')
    s.overEl = nextEl
  }
  s.overIndex = nextIndex
}

function tickAutoScroll() {
  const s = session
  if (!s || !s.started) return

  const container = s.scrollContainer
  if (container) {
    const rect = container.getBoundingClientRect()
    let dy = 0
    if (s.y < rect.top + EDGE_SCROLL_ZONE) {
      dy = -Math.min(1, (rect.top + EDGE_SCROLL_ZONE - s.y) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX_SPEED
    } else if (s.y > rect.bottom - EDGE_SCROLL_ZONE) {
      dy = Math.min(1, (s.y - (rect.bottom - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE) * EDGE_SCROLL_MAX_SPEED
    }
    if (dy !== 0) {
      container.scrollTop += dy
      // scrolling shifts the cards under the stationary pointer
      updateOverTarget(s)
    }
  }

  s.rafId = requestAnimationFrame(tickAutoScroll)
}

function activateDrag(s: Session) {
  s.started = true
  s.sourceEl.classList.add('is-dragging')
  createGhost(s)

  document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true })
  window.addEventListener('contextmenu', suppressContextMenu, true)
  document.body.style.userSelect = 'none'
  ;(document.body.style as any).webkitUserSelect = 'none'

  if (s.isTouch && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(15) } catch { /* not critical */ }
  }

  s.scrollContainer = document.getElementById('main')
  s.rafId = requestAnimationFrame(tickAutoScroll)
  updateOverTarget(s)
}

function endSession(commit: boolean) {
  const s = session
  if (!s) return
  session = null

  if (s.longPressTimer !== null) {
    window.clearTimeout(s.longPressTimer)
  }
  if (s.rafId !== null) {
    cancelAnimationFrame(s.rafId)
  }

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)

  if (!s.started) return

  document.removeEventListener('touchmove', preventTouchMove, { capture: true } as EventListenerOptions)
  document.body.style.userSelect = ''
  ;(document.body.style as any).webkitUserSelect = ''

  s.ghost?.remove()
  s.sourceEl.classList.remove('is-dragging')
  s.overEl?.classList.remove('drag-over')
  // belt and braces: clear any stale classes left by mid-drag re-renders
  document.querySelectorAll('.card.is-dragging, .card.drag-over').forEach(el => {
    el.classList.remove('is-dragging', 'drag-over')
  })

  suppressNextClick()
  // remove the contextmenu guard on the next tick: on touch devices the
  // browser may fire contextmenu right after pointerup of a long press
  setTimeout(() => {
    window.removeEventListener('contextmenu', suppressContextMenu, true)
  }, 0)

  if (commit && s.overIndex !== null && s.overIndex !== s.sourceIndex) {
    s.onDrop(s.sourceIndex, s.overIndex)
  }
}

function onPointerMove(e: PointerEvent) {
  const s = session
  if (!s || e.pointerId !== s.pointerId) return

  s.x = e.clientX
  s.y = e.clientY

  if (!s.started) {
    const dist = Math.hypot(s.x - s.startX, s.y - s.startY)
    if (s.isTouch) {
      // finger wandered before the long press fired -> user is scrolling
      if (dist > TOUCH_MOVE_TOLERANCE) {
        endSession(false)
      }
    } else if (dist > MOUSE_START_THRESHOLD) {
      activateDrag(s)
    }
    return
  }

  e.preventDefault()
  positionGhost(s)
  updateOverTarget(s)
}

function onPointerUp(e: PointerEvent) {
  const s = session
  if (!s || e.pointerId !== s.pointerId) return
  endSession(true)
}

function onPointerCancel(e: PointerEvent) {
  const s = session
  if (!s || e.pointerId !== s.pointerId) return
  endSession(false)
}

export interface UsePageDragOptions {
  pageIndex: number | null | undefined
  draggable: boolean
  onDrop: DropHandler
}

export function usePageDrag(options: UsePageDragOptions) {
  const { pageIndex, draggable, onDrop } = options

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggable || pageIndex === null || pageIndex === undefined) return
    if (session) return
    // primary button only; ignore presses on inner controls (zoom button)
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return

    const sourceEl = e.currentTarget as HTMLElement
    const rect = sourceEl.getBoundingClientRect()
    const isTouch = e.pointerType !== 'mouse'

    const s: Session = {
      pointerId: e.pointerId,
      isTouch,
      sourceIndex: pageIndex,
      sourceEl,
      onDrop,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
      started: false,
      longPressTimer: null,
      ghost: null,
      overEl: null,
      overIndex: null,
      scrollContainer: null,
      rafId: null,
    }
    session = s

    if (isTouch) {
      s.longPressTimer = window.setTimeout(() => {
        if (session === s && !s.started) {
          activateDrag(s)
        }
      }, LONG_PRESS_MS)
    }

    try {
      sourceEl.setPointerCapture(e.pointerId)
    } catch { /* capture is best-effort; window listeners still work */ }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }, [pageIndex, draggable, onDrop])

  return { onPointerDown }
}
