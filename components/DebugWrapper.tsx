"use client";

import dynamic from "next/dynamic";

const DebugPanel = dynamic(
  () => import("@/components/DebugPanel").then((mod) => mod.DebugPanel),
  { ssr: false }
);

export default function DebugWrapper() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <DebugPanel />;
}