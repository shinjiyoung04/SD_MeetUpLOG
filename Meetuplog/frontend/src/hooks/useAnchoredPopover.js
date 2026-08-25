import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

const clamp = (
  value,
  min,
  max,
) => {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  )
}

const useAnchoredPopover = ({
  open,
  anchorElement,
  floatingRef,
  mode = 'side',
  preferredSide = 'right',
  width = 286,
  estimatedHeight = 250,
  gap = 10,
  viewportGap = 12,
  mobileBreakpoint = 767,
  refreshKey,
}) => {
  const [
    state,
    setState,
  ] = useState({
    style: undefined,
    side: preferredSide,
    mobile: false,
  })

  const scheduledFrameRef =
    useRef(null)

  const updatePosition =
    useCallback(() => {
      if (
        !open ||
        !anchorElement ||
        typeof window ===
          'undefined'
      ) {
        return
      }

      const viewportWidth =
        window.innerWidth

      const viewportHeight =
        window.innerHeight

      if (
        viewportWidth <=
        mobileBreakpoint
      ) {
        setState((previous) => (
          previous.mobile &&
          previous.side === preferredSide &&
          previous.style === undefined
            ? previous
            : {
                style: undefined,
                side: preferredSide,
                mobile: true,
              }
        ))

        return
      }

      const anchorRect =
        anchorElement
          .getBoundingClientRect()

      const measuredWidth =
        floatingRef.current
          ?.offsetWidth ||
        width

      const measuredHeight =
        floatingRef.current
          ?.offsetHeight ||
        estimatedHeight

      let left = viewportGap
      let top = viewportGap
      let resolvedSide =
        preferredSide

      if (mode === 'above') {
        const preferredTop =
          anchorRect.top -
          measuredHeight -
          gap

        const fallbackTop =
          anchorRect.bottom +
          gap

        top =
          preferredTop >=
          viewportGap
            ? preferredTop
            : fallbackTop

        left = clamp(
          anchorRect.left,
          viewportGap,
          Math.max(
            viewportGap,
            viewportWidth -
              measuredWidth -
              viewportGap,
          ),
        )

        resolvedSide =
          preferredTop >=
          viewportGap
            ? 'above'
            : 'below'
      } else {
        const availableRight =
          viewportWidth -
          anchorRect.right

        const availableLeft =
          anchorRect.left

        if (
          resolvedSide ===
            'right' &&
          availableRight <
            measuredWidth +
              gap &&
          availableLeft >
            availableRight
        ) {
          resolvedSide =
            'left'
        }

        if (
          resolvedSide ===
            'left' &&
          availableLeft <
            measuredWidth +
              gap &&
          availableRight >
            availableLeft
        ) {
          resolvedSide =
            'right'
        }

        left =
          resolvedSide ===
          'right'
            ? anchorRect.right +
              gap
            : anchorRect.left -
              measuredWidth -
              gap

        const anchorCenterY =
          anchorRect.top +
          anchorRect.height /
            2

        top =
          anchorCenterY -
          measuredHeight /
            2

        left = clamp(
          left,
          viewportGap,
          Math.max(
            viewportGap,
            viewportWidth -
              measuredWidth -
              viewportGap,
          ),
        )

        top = clamp(
          top,
          viewportGap,
          Math.max(
            viewportGap,
            viewportHeight -
              measuredHeight -
              viewportGap,
          ),
        )
      }

      const leftValue = `${left}px`
      const topValue = `${top}px`

      setState((previous) => (
        !previous.mobile &&
        previous.side === resolvedSide &&
        previous.style?.left === leftValue &&
        previous.style?.top === topValue
          ? previous
          : {
              style: {
                left: leftValue,
                top: topValue,
              },
              side: resolvedSide,
              mobile: false,
            }
      ))
    }, [
      open,
      anchorElement,
      floatingRef,
      mode,
      preferredSide,
      width,
      estimatedHeight,
      gap,
      viewportGap,
      mobileBreakpoint,
    ])

  const scheduleUpdate =
    useCallback(() => {
      if (scheduledFrameRef.current !== null) return

      scheduledFrameRef.current =
        requestAnimationFrame(() => {
          scheduledFrameRef.current = null
          updatePosition()
        })
    }, [updatePosition])

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }

    scheduleUpdate()

    const settleTimer =
      window.setTimeout(
        scheduleUpdate,
        460,
      )

    window.addEventListener(
      'resize',
      scheduleUpdate,
    )

    window.addEventListener(
      'scroll',
      scheduleUpdate,
      true,
    )

    let resizeObserver = null

    if (
      typeof ResizeObserver !==
        'undefined' &&
      anchorElement
    ) {
      resizeObserver =
        new ResizeObserver(
          scheduleUpdate,
        )

      resizeObserver.observe(
        anchorElement,
      )

      if (
        floatingRef.current
      ) {
        resizeObserver.observe(
          floatingRef.current,
        )
      }
    }

    return () => {
      window.clearTimeout(
        settleTimer,
      )

      if (scheduledFrameRef.current !== null) {
        cancelAnimationFrame(scheduledFrameRef.current)
        scheduledFrameRef.current = null
      }

      window.removeEventListener(
        'resize',
        scheduleUpdate,
      )

      window.removeEventListener(
        'scroll',
        scheduleUpdate,
        true,
      )

      resizeObserver?.disconnect()
    }
  }, [
    open,
    anchorElement,
    floatingRef,
    scheduleUpdate,
    refreshKey,
  ])

  return {
    ...state,
    updatePosition,
  }
}

export default useAnchoredPopover
