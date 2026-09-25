"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive Pure SVG Area Chart
 * Renders time-series data with smooth lines, gradients, and hover tooltips.
 */
export function AdminAreaChart({
  data = [],
  height = 200,
  color = "indigo",
  label = "Items",
  className,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl"
      >
        No activity recorded in this period
      </div>
    );
  }

  // Dimensions
  const paddingX = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const width = 600; // SVG viewBox coordinate width

  const values = data.map((d) => d.count ?? d.value ?? 0);
  const maxValue = Math.max(...values, 5); // minimum ceiling

  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  // Calculate points
  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const val = d.count ?? d.value ?? 0;
    const y = paddingTop + chartHeight - (val / maxValue) * chartHeight;
    return { x, y, val, date: d.date || d.day || `Day ${i + 1}` };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${
    paddingTop + chartHeight
  } L ${points[0].x} ${paddingTop + chartHeight} Z`;

  const strokeColor =
    color === "indigo"
      ? "#6366f1"
      : color === "emerald"
      ? "#10b981"
      : color === "purple"
      ? "#a855f7"
      : "#3b82f6";

  const gradientId = `area-gradient-${color}`;

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((pct) => {
          const y = paddingTop + chartHeight * (1 - pct);
          const gridVal = Math.round(maxValue * pct);
          return (
            <g key={pct}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800/80"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX}
                y={y - 4}
                className="text-[9px] fill-slate-400 font-mono"
              >
                {gridVal}
              </text>
            </g>
          );
        })}

        {/* Fill Area */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Stroke Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive points */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
            className="cursor-pointer"
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : 3}
              fill="#fff"
              stroke={strokeColor}
              strokeWidth={hoverIndex === i ? "2.5" : "1.5"}
              className="transition-all"
            />
          </g>
        ))}

        {/* X Axis labels (First, Middle, Last) */}
        {points.length > 0 && (
          <>
            <text
              x={points[0].x}
              y={height - 8}
              className="text-[10px] fill-slate-400 font-mono"
            >
              {points[0].date}
            </text>
            {points.length > 2 && (
              <text
                x={points[Math.floor(points.length / 2)].x}
                y={height - 8}
                textAnchor="middle"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {points[Math.floor(points.length / 2)].date}
              </text>
            )}
            <text
              x={points[points.length - 1].x}
              y={height - 8}
              textAnchor="end"
              className="text-[10px] fill-slate-400 font-mono"
            >
              {points[points.length - 1].date}
            </text>
          </>
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="absolute z-10 -translate-x-1/2 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-medium shadow-xl pointer-events-none whitespace-nowrap dark:bg-slate-800 border border-slate-700"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `10%`,
          }}
        >
          <p className="font-semibold text-xs">{points[hoverIndex].val} {label}</p>
          <p className="text-[10px] text-slate-400">{points[hoverIndex].date}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Pure SVG Donut Chart
 * Visualizes category distributions (e.g. file types).
 */
export function AdminDonutChart({
  data = [],
  size = 160,
  strokeWidth = 24,
  className,
}) {
  const total = data.reduce((acc, d) => acc + (d.count || 0), 0);

  if (total === 0) {
    return (
      <div
        style={{ height: size }}
        className="flex items-center justify-center text-xs text-slate-400"
      >
        No distribution data
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Colors per file type
  const colorMap = {
    pdf: "#ef4444", // Red
    docx: "#3b82f6", // Blue
    txt: "#10b981", // Emerald
    csv: "#f59e0b", // Amber
    other: "#8b5cf6", // Purple
  };

  let accumulatedPercent = 0;

  const segments = data.map((d) => {
    const count = d.count || 0;
    const percent = count / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    const fileType = (d.fileType || "other").toLowerCase();
    const color = colorMap[fileType] || colorMap.other;

    return {
      ...d,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-6", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {total}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            Files
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 text-xs flex-1 w-full">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300 uppercase">
                {seg.fileType}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono">{seg.count}</span>
              <span className="text-slate-400 text-[11px] w-8 text-right font-mono">
                {seg.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Segmented Progress Bar List
 */
export function AdminBarChart({ items = [], className }) {
  const total = items.reduce((acc, item) => acc + (item.count || 0), 0);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, idx) => {
        const count = item.count || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {item.label}
              </span>
              <div className="flex items-center gap-2 font-mono text-slate-500 text-[11px]">
                <span>{count.toLocaleString()}</span>
                <span className="text-slate-400">({pct}%)</span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", item.colorClass || "bg-indigo-600")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
