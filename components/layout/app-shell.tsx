"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";
import { Gem, Settings, Sparkles, Tags, Vault } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Dashboard", icon: Gem },
  { href: "/capture", label: "Capture", icon: Sparkles },
  { href: "/inventory", label: "Inventory", icon: Vault },
  { href: "/app/labels", label: "Labels", icon: Tags },
  { href: "/review", label: "Review", icon: Gem },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/8 px-6 py-8 lg:block">
        <div className="glass-panel surface-outline flex h-full flex-col rounded-[2rem] border p-6">
          <Link href="/" className="space-y-2">
            <p className="text-xs uppercase tracking-[0.34em] text-primary">
              JWLD Studio
            </p>
            <h1 className="font-[var(--font-display)] text-4xl">
              Boutique inventory OS
            </h1>
          </Link>
          <nav className="mt-10 space-y-2">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition hover:bg-white/6 hover:text-foreground",
                    active
                      ? "bg-white/8 text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-[1.75rem] border bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-primary">
              Purpose built
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Designed for handheld product intake, AI-assisted metadata, and
              fast review loops.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/8 bg-black/20 px-4 py-4 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-primary">
                JWLD.store
              </p>
              <h2 className="font-[var(--font-display)] text-2xl">
                Studio workflow
              </h2>
            </div>
            <MobileNav items={navigation} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
