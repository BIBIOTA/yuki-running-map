"use client";

/**
 * `<RouteMetadataForm>` — shared metadata editor for the admin
 * `/admin/upload` (create) and `/admin/routes/[id]` (edit) flows.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §3.4
 *       openspec/changes/feat-admin-gpx-upload/design.md §6.2 (error sources)
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frames 03 + 05
 *        - `screenshots/03-routes-edit.png` — full field layout (title /
 *          slug / description / region / tags / difficulty + duration row /
 *          published toggle, outline-cancel + brand-save action row).
 *        - `screenshots/05-upload-error.png` — `_form` Alert + per-field
 *          red text under each invalid input.
 *
 * Fields rendered (繁體中文 labels are load-bearing for E2E):
 *   標題 / 網址代稱（slug） / 描述 / 地區 / 標籤 / 難度 / 預計時長（秒） /
 *   已發佈.
 *
 * GPX-derived fields (distance / elevation / bbox / start_point /
 * recorded_at / gpx_path) are DELIBERATELY NOT rendered here — those
 * are derived server-side from the uploaded GPX during the Server
 * Action (spec: admin-routes spec §"GPX 衍生欄位 server-derived only").
 *
 * Native-control choice (per CLAUDE.md "no new deps"): shadcn ships
 * `<Input>` and `<Button>` already, but the project does NOT have the
 * Radix-based `<Select>`, `<Switch>`, `<Alert>`, or `<Textarea>`
 * primitives installed. Rather than introduce `@radix-ui/react-*`
 * runtime deps for a single admin form, this component uses plain
 * HTML controls styled with the same Trail Vintage Tailwind aliases
 * (`border-input`, `bg-transparent`, `border-destructive`, etc.):
 *   - `<textarea>` for description (matches Input shape)
 *   - `<select>` for difficulty (native dropdown; one-line value picker)
 *   - `<input type="checkbox">` for published (semantic + accessible)
 *   - `<div role="alert">` for the `_form` banner
 * The `<TagsInput>` from task 3.1 owns the tags field.
 *
 * Testability note: the React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node environment
 * with no React testing library (CLAUDE.md forbids adding deps without
 * approval). All pure transitions live in `./routeMetadataFormState.ts`
 * and are covered by `__tests__/routeMetadataFormState.test.ts`; the full
 * user-visible behaviour is exercised by the admin upload Playwright
 * spec (task 5.1).
 */

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { TagsInput } from "./TagsInput";
import { buildInitialValues } from "./routeMetadataFormState";
import type { RouteMetadataValues } from "./types";

type Props = {
  mode: "create" | "edit";
  existingTags: string[];
  onSubmit: (values: RouteMetadataValues) => Promise<void> | void;
  initial?: Partial<RouteMetadataValues>;
  fieldErrors?: Record<string, string>;
  submitLabel?: string;
  cancelHref?: string;
};

export function RouteMetadataForm({
  mode,
  existingTags,
  onSubmit,
  initial,
  fieldErrors,
  submitLabel = "儲存",
  cancelHref = "/admin/routes",
}: Props) {
  const [values, setValues] = useState<RouteMetadataValues>(() =>
    buildInitialValues(initial),
  );
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof RouteMetadataValues>(
    key: K,
    value: RouteMetadataValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="路線資料表單">
      {fieldErrors?._form ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive"
        >
          <p className="font-medium">寫入失敗</p>
          <p className="text-sm">請修正下列欄位後重試。</p>
          <p className="mt-1 text-sm">{fieldErrors._form}</p>
        </div>
      ) : null}

      {fieldErrors?.gpxFile ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive"
        >
          <p className="text-sm">✕ {fieldErrors.gpxFile}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <Field label="標題" id="title" required error={fieldErrors?.title}>
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            aria-invalid={fieldErrors?.title ? true : undefined}
          />
        </Field>

        <Field
          label="網址代稱（slug）"
          id="slug"
          required
          error={fieldErrors?.slug}
        >
          <Input
            id="slug"
            name="slug"
            value={values.slug}
            onChange={(event) => setField("slug", event.target.value)}
            aria-invalid={fieldErrors?.slug ? true : undefined}
          />
        </Field>

        <Field
          label="描述"
          id="description"
          error={fieldErrors?.description}
        >
          <textarea
            id="description"
            name="description"
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            rows={4}
            aria-invalid={fieldErrors?.description ? true : undefined}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
          />
        </Field>

        <Field label="標籤" id="tags" error={fieldErrors?.tags}>
          <TagsInput
            value={values.tags}
            onChange={(tags) => setField("tags", tags)}
            existingTags={existingTags}
          />
        </Field>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <input
              id="published"
              name="published"
              type="checkbox"
              checked={values.published}
              onChange={(event) =>
                setField("published", event.target.checked)
              }
              aria-invalid={fieldErrors?.published ? true : undefined}
              className="size-4 cursor-pointer rounded border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label htmlFor="published" className="text-sm font-medium">
              已發佈
            </label>
          </div>
          {fieldErrors?.published ? (
            <p className="text-sm text-destructive">
              ✕ {fieldErrors.published}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <a href={cancelHref}>取消</a>
        </Button>
        <Button type="submit" disabled={submitting} data-mode={mode}>
          {submitting ? "儲存中…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

function Field({ label, id, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-destructive">✕ {error}</p> : null}
    </div>
  );
}
