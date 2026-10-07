// Magic UI (MIT), official registry source. Checkout adaptations documented in THIRD_PARTY_NOTICES.md.
"use client"

import React, {
  useMemo,
  type ComponentPropsWithoutRef,
} from "react"
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "motion/react"

const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" ")

export function AnimatedListItem({ children, animate }: { children: React.ReactNode; animate: boolean }) {
  const reducedMotion = useReducedMotion()
  const animations: MotionProps = {
    initial: animate && !reducedMotion ? { y: 6, opacity: 0 } : false,
    animate: { y: 0, opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reducedMotion ? 0 : 0.25 },
  }

  return (
    <motion.div {...animations} className="w-full">
      {children}
    </motion.div>
  )
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode
  animate?: boolean
}

export const AnimatedList = React.memo(
  ({ children, className, animate = false, ...props }: AnimatedListProps) => {
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children]
    )

    return (
      <div
        className={cn(`flex flex-col`, className)}
        {...props}
      >
        <AnimatePresence initial={false} mode="sync">
          {childrenArray.map((item) => (
            <AnimatedListItem key={(item as React.ReactElement).key} animate={animate}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    )
  }
)

AnimatedList.displayName = "AnimatedList"
