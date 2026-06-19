"use client";

/**
 * `<GpxDropzone>` — drag-and-drop / click-to-pick GPX uploader for the
 * admin route metadata form.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/specs/admin-routes/spec.md:171
 *       openspec/changes/feat-admin-gpx-upload/tasks.md §3.2
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 06
 *        (`screenshots/06-dropzone-states.png`) — three side-by-side states:
 *        empty (dashed border), loaded (green border + chip), error
 *        (danger border + ⚠ icon + message).
 *
 * Behaviour:
 * - Empty: dashed Trail Vintage border, upload icon, 「拖放 GPX 或點擊選擇」
 *   + 「.gpx · 上限 10 MB」 hint. Click anywhere on the area opens the
 *   native file picker.
 * - On drop / pick the file is run through `deriveStateFromFile`
 *   (extension + size guard from `lib/admin-routes/gpxFile`). On error
 *   the component switches to the error state with the exact spec
 *   string ("請選 .gpx 檔" or "檔案超過 10 MB") and does NOT call
 *   `onFile`.
 * - On a valid file the buffer is passed to `parseGpx` from `lib/gpx`.
 *   When parsing throws the component shows "無法解析此 GPX" and does
 *   NOT call `onFile`. When parsing succeeds the component switches to
 *   the loaded state (chip with filename + size + reset button) AND
 *   calls `onFile(file, metadata)` exactly once.
 * - Map preview + metadata card rendering are the PARENT's responsibility
 *   (`UploadPageClient` in task 4.x) — this component only owns the
 *   drop area itself.
 *
 * Testability note: the React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./dropzoneState.ts` and are
 * covered by `__tests__/dropzoneState.test.ts`; the full user-visible
 * behaviour is exercised by the admin upload Playwright spec (task 5.1).
 *
 * Styling uses Trail Vintage tokens via Tailwind's shadcn-aligned aliases
 * (`border-border`, `border-ring` for the loaded brand state,
 * `border-destructive` for the error state, `bg-muted/50` for the
 * subtle drag-hover wash).
 */

import type { ChangeEvent, DragEvent } from "react";
import { useRef, useState } from "react";
import { TriangleAlert, Upload, X } from "lucide-react";

import { parseGpx } from "@/lib/gpx";
import type { GpxMetadata } from "@/lib/gpx";

import { deriveStateFromFile, formatFileSize } from "./dropzoneState";

type DropzoneState =
  | { kind: "empty" }
  | { kind: "loaded"; file: File }
  | { kind: "error"; message: string };

type Props = {
  onFile: (file: File, metadata: GpxMetadata) => void;
};

export function GpxDropzone({ onFile }: Props) {
  const [state, setState] = useState<DropzoneState>({ kind: "empty" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File): Promise<void> {
    const validation = deriveStateFromFile(file);
    if (validation.kind === "error") {
      setState({ kind: "error", message: validation.message });
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      // `parseGpx` accepts `Uint8Array | string` so it works in both the
      // Node runtime (where `Buffer` is a `Uint8Array` subclass) and the
      // browser bundle. We deliberately avoid Node's `Buffer` here because
      // Next.js 15 + Turbopack does NOT polyfill Node globals in the client
      // bundle — referencing `Buffer` would throw `ReferenceError` at runtime.
      const metadata = parseGpx(new Uint8Array(arrayBuffer));
      setState({ kind: "loaded", file });
      onFile(file, metadata);
    } catch {
      setState({ kind: "error", message: "無法解析此 GPX" });
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleClick(): void {
    inputRef.current?.click();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    // Clear the input so picking the same file twice still re-triggers
    // a change event — otherwise the second pick is silently dropped.
    event.target.value = "";
  }

  function handleReset(event: React.MouseEvent<HTMLButtonElement>): void {
    // Stop the click from bubbling to the dropzone container, which would
    // otherwise immediately re-open the file picker.
    event.stopPropagation();
    setState({ kind: "empty" });
  }

  const baseClasses =
    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const stateClasses =
    state.kind === "loaded"
      ? "border-solid border-ring bg-muted/30"
      : state.kind === "error"
        ? "border-solid border-destructive bg-destructive/5"
        : isDragging
          ? "border-dashed border-ring bg-muted/50"
          : "border-dashed border-border bg-muted/20 hover:bg-muted/40";

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="GPX 上傳區"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`${baseClasses} ${stateClasses}`}
      >
        {state.kind === "empty" && (
          <>
            <Upload
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="text-sm font-medium text-foreground">
              拖放 GPX 或點擊選擇
            </p>
            <p className="text-xs text-muted-foreground">.gpx · 上限 10 MB</p>
          </>
        )}

        {state.kind === "loaded" && (
          <div className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm text-foreground shadow-sm">
            <Upload aria-hidden="true" className="size-4 text-ring" />
            <span className="font-medium">{state.file.name}</span>
            <span className="text-muted-foreground">
              {formatFileSize(state.file.size)}
            </span>
            <button
              type="button"
              onClick={handleReset}
              aria-label="移除已選 GPX"
              className="inline-flex size-5 items-center justify-center rounded-sm text-foreground/70 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <>
            <TriangleAlert
              aria-hidden="true"
              className="size-8 text-destructive"
            />
            <p
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {state.message}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-muted-foreground underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              重新選擇
            </button>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
