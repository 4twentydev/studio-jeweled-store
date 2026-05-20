"use client";

import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-2 rounded-full border bg-black/30 p-1 lg:flex">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="fixed inset-x-4 bottom-4 z-30 rounded-[1.75rem] border bg-black/70 p-2 shadow-2xl backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 gap-1">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition",
                  active ? "bg-primary/12 text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
