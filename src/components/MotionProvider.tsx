import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadFeatures = () => import("./motionFeatures").then((module) => module.default);

/** Подключает Motion лениво: компоненты `m.*` оживают, когда догрузится чанк возможностей. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
