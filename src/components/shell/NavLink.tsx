"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function NavLink({ href, className, testId, children }: { href: string; className?: string; testId?: string; children: React.ReactNode }) {
  const p = usePathname() ?? ""; const on = p === href || (href !== "/agencia" && href.length > 1 && p.startsWith(href + "/"));
  return <Link href={href} className={className} data-testid={testId} aria-current={on ? "page" : undefined}>{children}</Link>;
}
