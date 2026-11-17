"use client";

import React from "react";

export function MetadataTab({ metadata }) {
  return (
    <div className="rounded-xl bg-theme-panel p-5 font-mono text-xs text-theme-text overflow-x-auto border border-theme-divider shadow-inner">
      <pre>{JSON.stringify(metadata || {}, null, 2)}</pre>
    </div>
  );
}
