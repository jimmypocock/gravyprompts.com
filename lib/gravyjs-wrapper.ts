// Wrapper to handle gravyjs import issues with Next.js
import type { ComponentType, ForwardedRef } from 'react';
import type { GravyJSRef } from 'gravyjs';

let GravyJS: ComponentType<any> | null = null;

export async function getGravyJS() {
  if (!GravyJS) {
    const module = await import('gravyjs');
    // Handle both default and named exports
    GravyJS = module.default || module.GravyJS || module;
  }
  return GravyJS;
}

// For synchronous usage, we'll need to lazy load
export function LazyGravyJS(props: any) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  
  useEffect(() => {
    getGravyJS().then(setComponent);
  }, []);
  
  if (!Component) {
    return <div>Loading editor...</div>;
  }
  
  return <Component {...props} />;
}

import { useState, useEffect } from 'react';

// Export type for convenience
export type { GravyJSRef };