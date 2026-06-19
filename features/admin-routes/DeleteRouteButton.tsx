"use client";

/**
 * `<DeleteRouteButton>` — the danger-coloured "刪除" trigger rendered
 * in each row of the admin routes table; opens a confirmation
 * AlertDialog and, on confirmation, invokes the `deleteRoute({ id })`
 * Server Action.
 *
 * Spec:  openspec/changes/feat-admin-gpx-upload/specs/admin-routes-crud/spec.md
 *        §"<DeleteRouteButton>" (lines 214–254)
 * Tasks: openspec/changes/feat-admin-gpx-upload/tasks.md §3.5
 * Figma: openspec/changes/feat-admin-gpx-upload/designs/figma.md frame 07
 *        - `screenshots/07-delete-dialog.png` — 45% black backdrop dim,
 *          centred 480px-wide AlertDialog with the ⚠ icon, title
 *          「確認刪除路線？」, body 「將永久刪除「{title}」，含 GPX 原檔
 *          （{gpx_path}）。」, emphasis 「此操作不可還原。」, and the
 *          「取消」 outline / 「確認刪除」 danger button row.
 *
 * Primitive-choice note (per CLAUDE.md "no new deps"): the spec
 * mentions Radix `AlertDialog` but `@radix-ui/react-alert-dialog` is
 * NOT installed in this repo — `@radix-ui/react-dialog` is, via
 * `components/ui/dialog.tsx`. Rather than introduce a new runtime
 * dependency for a single confirmation flow, this component reuses
 * the existing shadcn `<Dialog>` primitive and re-establishes the
 * AlertDialog semantics by hand:
 *
 *   - `role="alertdialog"` on `<DialogContent>` (overrides the
 *     primitive's default `role="dialog"` so assistive tech treats
 *     the surface as an alert that needs immediate confirmation)
 *   - `<DialogTitle>` is the labelled-by target and `<DialogDescription>`
 *     is the described-by target (Radix wires this automatically from
 *     the primitive's IDs)
 *   - the destructive action lives on a `<Button>` outside any
 *     `<DialogClose>`, so a failed Server Action keeps the dialog
 *     open and surfaces the error in-place
 *   - the cancel action wraps `<DialogClose>` so Escape / outside-click
 *     / explicit-cancel all close via the same DOM path
 *
 * Testability note: React DOM behaviour is not unit-tested here
 * because the project deliberately runs vitest in the node
 * environment with no React testing library (CLAUDE.md forbids
 * adding deps without approval). All pure transitions live in
 * `./deleteButtonState.ts` and are covered by
 * `__tests__/deleteButtonState.test.ts`; the full user-visible
 * behaviour — Dialog opens, success closes + refreshes + toasts,
 * failure keeps Dialog open with error — is exercised by the admin
 * delete Playwright spec (task 5.1).
 */
import { TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteRoute } from "@/features/admin-routes/actions/deleteRoute";

import { buildConfirmBody, buildSuccessToast } from "./deleteButtonState";

type Props = {
  id: string;
  title: string;
  /**
   * The Storage path (`gpx_path`) of the route's GPX file. When
   * provided, the path is surfaced in the body copy so the admin can
   * audit the exact object that will be removed (Figma frame 07).
   * Optional because the bare spec acceptance only requires `id` +
   * `title`; callers that already have the path SHOULD pass it.
   */
  gpxPath?: string;
};

export function DeleteRouteButton({ id, title, gpxPath }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean): void {
    // Don't allow the dialog to close while the Server Action is
    // in-flight — the action result owns the close transition.
    if (pending && !nextOpen) return;
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  async function handleConfirm(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const result = await deleteRoute({ id });
      if (result.ok) {
        setOpen(false);
        toast.success(buildSuccessToast(title));
        router.refresh();
      } else {
        // Per spec: dialog STAYS OPEN and surfaces the error inline.
        setError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          刪除
        </Button>
      </DialogTrigger>
      <DialogContent role="alertdialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-destructive" aria-hidden="true" />
            <DialogTitle>確認刪除路線？</DialogTitle>
          </div>
          <DialogDescription>
            {buildConfirmBody(title, gpxPath)}
            <span className="mt-2 block font-medium text-destructive">此操作不可還原。</span>
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            ✕ {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "刪除中…" : "確認刪除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
