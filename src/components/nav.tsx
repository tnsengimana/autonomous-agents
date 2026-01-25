"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-secondary"
              )}
            >
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto p-2">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={cn(isActive && "bg-secondary")}
            >
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
