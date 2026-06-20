import { listExistingTags } from "@/lib/admin-routes/listExistingTags";
import { getDb } from "@/lib/db/client";

import { UploadPageClient } from "@/features/admin-routes/UploadPageClient";

export default async function AdminUploadPage() {
  const existingTags = await listExistingTags(getDb());

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-12">
      <UploadPageClient existingTags={existingTags} />
    </section>
  );
}
