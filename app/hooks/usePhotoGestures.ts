import { useCallback, useRef, useState } from 'react'

/** Where a double tap lands, and as far as a pinch may go. */
const DOUBLE_TAP_SCALE = 2.5
const MAX_SCALE = 4
/** Below this the photo is effectively unzoomed; snap it back to rest. */
const REST_SCALE = 1.02
/** Two taps this close in time and place are one gesture. */
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 30
/** Past this much finger travel, a tap was a drag and not a tap. */
const TAP_SLOP = 10
/** Before this, a vertical drag has not committed to anything. */
const CLAIM_PX = 8
/** Drag this far, or flick this fast, and the photo is being dismissed. */
const DISMISS_PX = 110
const DISMISS_VELOCITY = 0.6

export type Zoom = { scale: number; x: number; y: number }

/** The photo's resting box: its size before any zoom, and where its middle is. */
export type Frame = { width: number; height: number; cx: number; cy: number }

type Point = { x: number; y: number }

const REST: Zoom = { scale: 1, x: 0, y: 0 }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Touch gestures for a full-screen photo: pinch and double tap to zoom, drag
 * to pan, drag away to close.
 *
 * All of it is ours, and it has to be, because the web has no primitive for
 * zooming *an element*. The browser can zoom a page — that is the visual
 * viewport, it is pinch-only, and nothing can drive it from script — but a
 * photo viewer needs the photo to zoom while the controls around it stay put,
 * and needs a double tap to do it. Chrome on Android settles the second
 * question by itself: it turns double-tap-to-zoom off on any page whose
 * viewport says `width=device-width`, which is the tag that makes this site
 * responsive at all.
 *
 * So there is one zoom here and everything drives it. The first version had
 * two — a double tap moved a CSS transform while a pinch went to the browser
 * — and the seam showed the moment anyone tried to adjust a double-tapped
 * photo with two fingers: the gesture reached neither.
 *
 * What is left to the platform is sideways travel. The track is a scroll-snap
 * scroller declaring `touch-action: pan-x`, so swiping between photographs
 * keeps the browser's own momentum, snapping and rubber-band, and everything
 * else — vertical drags, second fingers — arrives here untouched. No
 * `preventDefault`, no racing the compositor.
 *
 * Mouse and pen are ignored. A drag with a mouse is far likelier to be an
 * attempt to select than a request to close, and the × and arrows are there.
 */
export function usePhotoGestures({
  index,
  getFrame,
  onDismiss,
}: {
  /** Which photo is showing. Changing it drops any zoom. */
  index: number
  /** The current photo's resting box, for keeping a zoomed photo in frame. */
  getFrame: () => Frame | null
  /** The drag passed the threshold; play the exit and unmount. */
  onDismiss: (direction: number) => void
}) {
  const [dragY, setDragY] = useState(0)
  const [zoom, setZoom] = useState<Zoom | null>(null)

  /** Every finger currently down, by pointer id. */
  const touches = useRef(new Map<number, Point>())
  /** The single-finger gesture in progress, if any. */
  const drag = useRef<{ from: Point; at: number; zoom: Zoom } | null>(null)
  const claimed = useRef(false)
  /** The two-finger gesture in progress, if any. */
  const pinch = useRef<{ spread: number; anchor: Point; zoom: Zoom } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)

  // A photo swiped to is a photo at its own scale. Adjusted during render
  // rather than in an effect: an effect would paint the new photograph at the
  // old zoom for one frame and then correct it, which is a visible flinch on
  // exactly the gesture meant to feel smooth.
  const [shownIndex, setShownIndex] = useState(index)
  if (shownIndex !== index) {
    setShownIndex(index)
    setZoom(null)
    setDragY(0)
  }

  /**
   * Keep a scaled photo covering its own frame.
   *
   * Past this offset the photograph has been dragged off its own edge and the
   * backdrop shows through the side, which reads as a rendering fault rather
   * than as panning.
   */
  const contain = useCallback((next: Zoom, frame: Frame): Zoom => {
    const limitX = Math.max(0, (frame.width * (next.scale - 1)) / 2)
    const limitY = Math.max(0, (frame.height * (next.scale - 1)) / 2)
    return {
      scale: next.scale,
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    }
  }, [])

  /**
   * The offset that keeps a point of the photograph under the finger holding
   * it.
   *
   * With `transform: translate(x, y) scale(s)` about the centre, a point `p`
   * measured from that centre in the photo's own unscaled coordinates lands on
   * screen at `centre + p·s + (x, y)`. Solving that for the offset is what
   * makes a pinch grow out of the gap between two fingers rather than out of
   * the middle of the picture — and what stops the image sliding away from
   * under them as it grows.
   */
  const anchored = useCallback(
    (local: Point, scale: number, onScreen: Point, frame: Frame): Zoom => ({
      scale,
      x: onScreen.x - frame.cx - local.x * scale,
      y: onScreen.y - frame.cy - local.y * scale,
    }),
    [],
  )

  /** Screen point -> the photo's own unscaled coordinates, from its centre. */
  const toLocal = useCallback((onScreen: Point, current: Zoom, frame: Frame): Point => {
    return {
      x: (onScreen.x - frame.cx - current.x) / current.scale,
      y: (onScreen.y - frame.cy - current.y) / current.scale,
    }
  }, [])

  const beginPinch = useCallback(() => {
    const points = [...touches.current.values()]
    const frame = getFrame()
    if (points.length < 2 || !frame) return
    const [a, b] = points as [Point, Point]
    const current = zoom ?? REST
    // The gesture starts fresh, so a drag underway is abandoned rather than
    // left to apply its last offset once a finger lifts.
    drag.current = null
    claimed.current = false
    setDragY(0)
    pinch.current = {
      spread: Math.max(1, distance(a, b)),
      anchor: toLocal(midpoint(a, b), current, frame),
      zoom: current,
    }
  }, [zoom, getFrame, toLocal])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== 'touch') return
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (touches.current.size >= 2) {
        beginPinch()
        return
      }
      drag.current = {
        from: { x: event.clientX, y: event.clientY },
        at: event.timeStamp,
        zoom: zoom ?? REST,
      }
      claimed.current = false
    },
    [zoom, beginPinch],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!touches.current.has(event.pointerId)) return
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      const frame = getFrame()
      if (!frame) return

      const two = pinch.current
      if (two && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()] as [Point, Point]
        const scale = Math.min(
          MAX_SCALE,
          Math.max(1, (two.zoom.scale * distance(a, b)) / two.spread),
        )
        // Both at once: the spread sets the scale and the midpoint carries the
        // photo, so two fingers zoom and pan in the same motion the way they
        // do everywhere else on a phone.
        setZoom(contain(anchored(two.anchor, scale, midpoint(a, b), frame), frame))
        return
      }

      const one = drag.current
      if (!one || touches.current.size !== 1) return
      const dx = event.clientX - one.from.x
      const dy = event.clientY - one.from.y

      if (zoom) {
        setZoom(
          contain({ scale: zoom.scale, x: one.zoom.x + dx, y: one.zoom.y + dy }, frame),
        )
        return
      }

      // `touch-action: pan-x` means a horizontal gesture never reaches this
      // handler; the comparison is for the diagonal case, where the browser
      // has not taken it and the intent is still a swipe.
      if (!claimed.current && Math.abs(dy) > CLAIM_PX && Math.abs(dy) > Math.abs(dx)) {
        claimed.current = true
      }
      if (claimed.current) setDragY(dy)
    },
    [zoom, getFrame, contain, anchored],
  )

  const release = useCallback(
    (event: React.PointerEvent) => {
      const wasTouched = touches.current.delete(event.pointerId)
      if (!wasTouched || event.pointerType !== 'touch') return

      if (pinch.current) {
        if (touches.current.size >= 2) {
          // A third finger left; carry on from where the remaining two are.
          beginPinch()
          return
        }
        pinch.current = null
        // Whatever finger is still down did not start this gesture, so it has
        // no baseline to drag from. Without clearing it, lifting one finger
        // makes the photo leap to wherever the other one happens to be.
        drag.current = null
        claimed.current = false
        setZoom((current) => (current && current.scale <= REST_SCALE ? null : current))
        return
      }

      const one = drag.current
      drag.current = null
      if (!one) return

      const dx = event.clientX - one.from.x
      const dy = event.clientY - one.from.y

      if (claimed.current) {
        claimed.current = false
        const elapsed = Math.max(1, event.timeStamp - one.at)
        const flung = Math.abs(dy) / elapsed > DISMISS_VELOCITY
        // Up as well as down. A photograph held at the bottom of a phone is as
        // likely to be flicked away upward, and refusing that direction reads
        // as the gesture being broken rather than as a rule.
        if (Math.abs(dy) > DISMISS_PX || flung) onDismiss(Math.sign(dy) || 1)
        else setDragY(0)
        return
      }

      if (Math.hypot(dx, dy) > TAP_SLOP) return

      const previous = lastTap.current
      const isDoubleTap =
        previous !== null &&
        event.timeStamp - previous.t < DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < DOUBLE_TAP_PX

      if (!isDoubleTap) {
        lastTap.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }
        return
      }
      lastTap.current = null

      if (zoom) {
        setZoom(null)
        return
      }

      const frame = getFrame()
      if (!frame) return
      // Zoom towards the tapped point rather than the middle. Scaling about
      // the centre magnifies whatever happened to be there, which is rarely
      // what anybody just pointed at.
      const at = { x: event.clientX, y: event.clientY }
      const local = toLocal(at, REST, frame)
      setZoom(contain(anchored(local, DOUBLE_TAP_SCALE, at, frame), frame))
    },
    [zoom, getFrame, contain, anchored, toLocal, beginPinch, onDismiss],
  )

  const onPointerCancel = useCallback((event: React.PointerEvent) => {
    // The browser took the gesture — a horizontal swipe, usually. Let it.
    touches.current.delete(event.pointerId)
    if (touches.current.size === 0) {
      pinch.current = null
      drag.current = null
      claimed.current = false
      setDragY(0)
    }
  }, [])

  return {
    dragY,
    zoom,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel,
    },
  }
}
