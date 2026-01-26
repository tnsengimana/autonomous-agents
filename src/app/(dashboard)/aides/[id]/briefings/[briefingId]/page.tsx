import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getAideById } from "@/lib/db/queries/aides";
import { getBriefingById } from "@/lib/db/queries/briefings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function AideBriefingPage({
  params,
}: {
  params: Promise<{ id: string; briefingId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { id, briefingId } = await params;

  const aide = await getAideById(id);
  if (!aide || aide.userId !== session.user.id) notFound();

  const briefing = await getBriefingById(briefingId);
  if (!briefing || briefing.userId !== session.user.id || briefing.aideId !== id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge>Briefing</Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(briefing.createdAt).toLocaleString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold mt-2">{briefing.title}</h1>
          <p className="text-muted-foreground">From {aide.name}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/inbox">Back to Inbox</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>{briefing.summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-6" />
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {briefing.content.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
