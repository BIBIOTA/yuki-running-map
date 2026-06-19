"use client";

/**
 * `<TagsInput>` — chip-style tag editor for the admin route metadata form.
 *
 * Behaviour (spec: openspec/changes/feat-admin-gpx-upload/tasks.md §3.1):
 * - Renders an input plus a row of removable chips (one per `value` item).
 * - Pressing Enter or `,` commits the trimmed draft as a new chip via
 *   `onChange`. Whitespace-only and duplicate inputs are silently ignored
 *   (see `addTag` in `./tags.ts`).
 * - Pressing Backspace on an empty input pops the trailing chip — matches
 *   the common chip-input UX.
 * - While typing, up to 5 case-insensitive substring matches from
 *   `existingTags` (minus what's already selected) render as a small
 *   suggestion panel; clicking one commits it.
 *
 * Testability note: the React DOM behaviour is NOT unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./tags.ts` and are covered by
 * `__tests__/tags.test.ts`; the full user-visible behaviour is exercised
 * by the admin upload Playwright spec (task 5.1).
 *
 * Styling uses Trail Vintage tokens via Tailwind's shadcn-aligned aliases
 * (`bg-muted`, `text-foreground`, `ring-ring`).
 */

import type { KeyboardEvent } from "react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

import { addTag, filterSuggestions, removeTagAt } from "./tags";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  existingTags?: string[];
  placeholder?: string;
  ariaLabel?: string;
};

export function TagsInput({
  value,
  onChange,
  existingTags = [],
  placeholder = "輸入後按 Enter 或逗號新增",
  ariaLabel = "標籤",
}: Props) {
  const [draft, setDraft] = useState("");
  const suggestions = filterSuggestions(existingTags, value, draft);

  function commit(raw: string) {
    const next = addTag(value, raw);
    // addTag returns the same reference on no-op (dedup / empty); avoid
    // calling onChange in that case so React skips an unnecessary render.
    if (next !== value) onChange(next);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (draft.trim().length > 0) commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
      event.preventDefault();
      const next = removeTagAt(value, value.length - 1);
      if (next !== value) onChange(next);
    }
  }

  function handleRemove(index: number) {
    const next = removeTagAt(value, index);
    if (next !== value) onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" aria-live="polite">
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-foreground"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={`移除 ${tag}`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-foreground/70 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
        />

        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="標籤建議"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm text-popover-foreground shadow-md"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => commit(suggestion)}
                  className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
