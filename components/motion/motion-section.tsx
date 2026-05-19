"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function MotionSection({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("space-y-4", className)}
    >
      {children}
    </motion.section>
  );
}
