"use client";

import React from "react";
import {
  isMarkdownTable,
  parseTableCells,
  parseInlineTokens,
  splitMarkdownBlocks,
} from "@/lib/markdown";

/**
 * Clickable Source Pill badge for grounded citations ([SOURCE 1]).
 * Anchors or triggers source highlight when clicked.
 */
export function SourcePill({ number, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded font-mono text-[10px] font-semibold bg-blue-100/80 hover:bg-blue-200/90 dark:bg-blue-950/80 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800 transition-colors cursor-pointer align-baseline select-none shadow-2xs"
      title={`Jump to Source ${number}`}
    >
      <span className="opacity-60 text-[9px]">#</span>
      <span>SOURCE {number}</span>
    </button>
  );
}

/**
 * Formats inline text with bold, italic, code, and source pills.
 */
export function InlineFormattedText({ text, isUser = false, onSourceClick }) {
  if (typeof text !== "string") return null;

  const tokens = parseInlineTokens(text);
  if (tokens.length === 0) return text;

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.type === "bold") {
          return (
            <strong
              key={idx}
              className={
                isUser
                  ? "font-semibold text-white"
                  : "font-semibold text-slate-900 dark:text-slate-100"
              }
            >
              {token.text}
            </strong>
          );
        }
        if (token.type === "italic") {
          return (
            <em key={idx} className="italic opacity-90">
              {token.text}
            </em>
          );
        }
        if (token.type === "code") {
          return (
            <code
              key={idx}
              className={`px-1 py-0.5 rounded font-mono text-[11px] ${
                isUser
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              }`}
            >
              {token.text}
            </code>
          );
        }
        if (token.type === "source") {
          const numbers = (token.value || "")
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean);
          return (
            <span key={idx} className="inline-flex items-center gap-0.5">
              {numbers.map((num, sIdx) => (
                <SourcePill
                  key={sIdx}
                  number={num}
                  onClick={onSourceClick ? () => onSourceClick(num) : undefined}
                />
              ))}
            </span>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </>
  );
}

/**
 * Complete Markdown formatter for chat messages.
 * Formats headings, bullet lists, numbered lists, markdown tables,
 * code blocks, bold text, and source citations into clean React elements.
 *
 * @param {Object} props
 * @param {string} props.content - Raw message content
 * @param {boolean} [props.isUser=false] - Whether message is from the user
 * @param {Function} [props.onSourceClick] - Handler when a [SOURCE X] pill is clicked
 */
export function ChatMessageContent({ content, isUser = false, onSourceClick }) {
  if (!content) return null;

  // For user messages, simple clean display with whitespace-pre-wrap
  if (isUser) {
    return <div className="whitespace-pre-wrap font-sans">{content}</div>;
  }

  const blocks = splitMarkdownBlocks(content);

  return (
    <div className="space-y-2 text-xs md:text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Fenced Code Block
        if (trimmed.startsWith("```")) {
          const lines = trimmed.split("\n");
          const firstLine = lines[0].trim();
          const lang = firstLine.replace(/^```/, "").trim();
          const codeContent = lines
            .slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined)
            .join("\n");
          return (
            <div
              key={bIdx}
              className="my-2.5 rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-xs overflow-x-auto border border-slate-800 shadow-sm"
            >
              {lang && (
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 pb-1 border-b border-slate-800">
                  {lang}
                </div>
              )}
              <pre className="whitespace-pre overflow-x-auto">{codeContent}</pre>
            </div>
          );
        }

        // 2. Markdown Table
        if (isMarkdownTable(trimmed)) {
          const lines = trimmed
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          const sepIdx = lines.findIndex(
            (line, i) =>
              i > 0 &&
              (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line) ||
                (/^[\s|:-]+$/.test(line) && line.includes("-") && line.includes("|")))
          );

          const headerLines = sepIdx !== -1 ? lines.slice(0, sepIdx) : [lines[0]];
          const bodyLines = sepIdx !== -1 ? lines.slice(sepIdx + 1) : lines.slice(1);

          return (
            <div
              key={bIdx}
              className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-800">
                  {headerLines.map((hLine, hIdx) => (
                    <tr key={`th-${hIdx}`}>
                      {parseTableCells(hLine).map((cell, cIdx) => (
                        <th
                          key={`th-c-${cIdx}`}
                          className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100"
                        >
                          <InlineFormattedText
                            text={cell}
                            onSourceClick={onSourceClick}
                          />
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {bodyLines.map((bLine, rIdx) => (
                    <tr
                      key={`tb-${rIdx}`}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {parseTableCells(bLine).map((cell, cIdx) => (
                        <td key={`td-c-${cIdx}`} className="px-3 py-1.5">
                          <InlineFormattedText
                            text={cell}
                            onSourceClick={onSourceClick}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // 3. Headings
        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={bIdx}
              className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1"
            >
              <InlineFormattedText
                text={trimmed.replace(/^###\s+/, "")}
                onSourceClick={onSourceClick}
              />
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={bIdx}
              className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 mt-3.5 mb-1.5 pb-0.5 border-b border-slate-100 dark:border-slate-800"
            >
              <InlineFormattedText
                text={trimmed.replace(/^##\s+/, "")}
                onSourceClick={onSourceClick}
              />
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1
              key={bIdx}
              className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2"
            >
              <InlineFormattedText
                text={trimmed.replace(/^#\s+/, "")}
                onSourceClick={onSourceClick}
              />
            </h1>
          );
        }

        // 4. Blockquote
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={bIdx}
              className="border-l-4 border-blue-400 dark:border-blue-600 pl-3 my-2 italic text-slate-600 dark:text-slate-400"
            >
              <InlineFormattedText
                text={trimmed.replace(/^>\s+/, "")}
                onSourceClick={onSourceClick}
              />
            </blockquote>
          );
        }

        // 5. Line Groups (Handling mixed paragraphs and lists within blocks)
        const lines = block.split("\n");
        const groups = [];
        let currentGroup = null;

        for (const line of lines) {
          const lTrimmed = line.trim();
          if (!lTrimmed) continue;

          const isBullet = /^[-*]\s+/.test(lTrimmed);
          const isOrdered = /^\d+\.\s+/.test(lTrimmed);
          const type = isBullet ? "bullet" : isOrdered ? "ordered" : "text";

          if (!currentGroup || currentGroup.type !== type || type === "text") {
            currentGroup = { type, items: [line] };
            groups.push(currentGroup);
          } else {
            currentGroup.items.push(line);
          }
        }

        return (
          <div key={bIdx} className="space-y-1.5">
            {groups.map((group, gIdx) => {
              if (group.type === "bullet") {
                return (
                  <ul
                    key={gIdx}
                    className="space-y-1 my-1.5 list-disc pl-5 text-slate-700 dark:text-slate-300"
                  >
                    {group.items.map((it, itIdx) => (
                      <li key={itIdx}>
                        <InlineFormattedText
                          text={it.trim().replace(/^[-*]\s+/, "")}
                          onSourceClick={onSourceClick}
                        />
                      </li>
                    ))}
                  </ul>
                );
              }

              if (group.type === "ordered") {
                return (
                  <ol
                    key={gIdx}
                    className="space-y-1 my-1.5 list-decimal pl-5 text-slate-700 dark:text-slate-300"
                  >
                    {group.items.map((it, itIdx) => (
                      <li key={itIdx}>
                        <InlineFormattedText
                          text={it.trim().replace(/^\d+\.\s+/, "")}
                          onSourceClick={onSourceClick}
                        />
                      </li>
                    ))}
                  </ol>
                );
              }

              return (
                <p key={gIdx} className="leading-relaxed">
                  {group.items.map((item, iIdx) => (
                    <React.Fragment key={iIdx}>
                      {iIdx > 0 && <br />}
                      <InlineFormattedText
                        text={item}
                        onSourceClick={onSourceClick}
                      />
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
