import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth/config";
import { Nav, MobileNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const userInitials = session.user.email
    ? session.user.email.substring(0, 2).toUpperCase()
    : "U";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/inbox" className="text-lg font-semibold">
            Autonomous Teams
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user.image || undefined} />
                <AvatarFallback className="text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground md:inline">
                {session.user.email}
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
        {/* Mobile navigation */}
        <div className="border-t md:hidden">
          <MobileNav />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - hidden on mobile */}
        <aside className="hidden w-64 border-r md:block">
          <Nav />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
