"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation({ desktop = false }: { desktop?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav aria-label="Main navigation" className="main-nav">
      {[
        ...(desktop ? [["/desktop", "My spellbook"]] : []),
        ["/dashboard", "Your comments"],
        ["/dashboard/settings", "Your boundaries"],
        ["/setup", "Connection & setup"],
      ].map(([href, label]) => (
        <Link key={href} href={href!} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
      {!desktop && <form action="/api/session" method="post"><input type="hidden" name="action" value="logout" /><button className="btn btn-quiet text-xs" type="submit">Lock spellbook</button></form>}
    </nav>
  );
}
