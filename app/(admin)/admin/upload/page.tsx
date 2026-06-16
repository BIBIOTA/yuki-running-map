import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminUploadPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">
            Coming soon · GPX 上傳開發中
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          上傳介面尚未開放。後續 change 將提供 GPX 解析、編輯路線
          metadata、發佈狀態切換等功能。
        </CardContent>
      </Card>
    </section>
  );
}
