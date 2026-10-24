"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notification-bell";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  GraduationCap,
  Video,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Prezentare generală", icon: LayoutDashboard },
  { href: "/review", label: "De revizuit", icon: FileCheck2, badge: "4" },
  { href: "/procedures", label: "Proceduri", icon: BookOpenText },
  { href: "/search", label: "Căutare", icon: Search },
  { href: "/meetings", label: "Ședințe", icon: Video },
  { href: "/roadmap", label: "Dezvoltare angajați", icon: GraduationCap },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#D9C2AA] text-[#25160e]">
      {mobileOpen && <button aria-label="Închide meniul" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#1a0d08]/45 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col bg-[#21130d] px-4 pb-4 pt-5 text-white transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <div className="relative grid h-9 w-9 grid-cols-2 gap-[3px] rounded-xl bg-[#ff5a00] p-[7px]">
              <span className="rounded-[3px] bg-[#401909]" /><span className="rounded-[3px] bg-[#ff9a63]" />
              <span className="rounded-[3px] bg-[#ff9a63]" /><span className="rounded-[3px] bg-[#401909]" />
            </div>
            <div>
              <div className="text-[19px] font-semibold tracking-[0.18em]">Helpy</div>
              <div className="-mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[#9bb9ad]">memoria echipei</div>
            </div>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden" aria-label="Închide meniul"><X size={18} /></button>
        </div>

        <button className="mt-8 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-left hover:bg-white/10">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#ffdac5] text-[12px] font-bold text-[#8a330a]">AN</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">Atelier Nord</div>
          </div>
          <ChevronDown size={15} className="text-white/50" />
        </button>

        <div className="mt-8 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#809c90]">Spațiu de lucru</div>
        <nav className="mt-2 space-y-1">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-medium transition ${active ? "bg-[#ff5a00]/15 text-white shadow-sm" : "text-[#b4c5bd] hover:bg-white/[0.07] hover:text-white"}`}>
                <Icon size={17} strokeWidth={1.8} className={active ? "text-[#ffd0b5]" : "text-[#91a99e] group-hover:text-[#f3cbb8]"} />
                <span className="flex-1">{item.label}</span>
                {item.badge && <span className="rounded-md bg-[#dfb96d]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#f0d79f]">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#809c90]">Administrare</div>
        <nav className="mt-2 space-y-1">
          <Link href="/settings/privacy" onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-medium transition ${pathname.startsWith("/settings") ? "bg-[#ff5a00]/15 text-white" : "text-[#b4c5bd] hover:bg-white/[0.07] hover:text-white"}`}>
            <Settings2 size={17} strokeWidth={1.8} className="text-[#91a99e] group-hover:text-[#f3cbb8]" />
            <span className="flex-1">Surse și confidențialitate</span>
          </Link>
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-[#ffc19d]/15 bg-[#3a1b0d] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#ffe0ce]"><ShieldCheck size={15} className="text-[#ffbd99]" /> Date sub control</div>
            <p className="mb-3 mt-2 text-[10px] leading-[1.55] text-[#d9b3a0]">Captura este oprită. Doar sursele aprobate pot fi procesate.</p>
            <Link href="/settings/privacy" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#ffd0b5] hover:text-white">Configurează sursele <ChevronRight size={13} /></Link>
          </div>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] text-[#9bb2a7] hover:bg-white/[0.07] hover:text-white"><CircleHelp size={15} /> Ajutor și feedback</button>
          <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#d7c6a2] text-[10px] font-bold text-[#443b2f]">AM</div>
            <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">Alex Marin</div><div className="text-[9px] text-[#8fa79a]">Administrator</div></div>
            <LockKeyhole size={14} className="text-[#849b90]" />
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#E8D9CA] bg-[#E8D9CA] px-5 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Deschide meniul" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#60736b] hover:bg-[#E4D3C4] lg:hidden"><Menu size={19} /></button>
            <div className="hidden items-center gap-2 text-[11px] text-[#8a9993] sm:flex"><span>Atelier Nord</span><ChevronRight size={13} /><span className="font-medium text-[#4e625a]">Helpy</span></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/search" className="hidden h-9 items-center gap-2 rounded-xl border border-[#FF5A00] bg-[#FF5A00] px-3 text-[11px] text-[#29170e] shadow-[0_1px_2px_rgba(20,40,30,.03)] transition hover:border-[#bfd9cb] sm:flex"><Search size={14} /><span>Caută cunoștințe</span><span className="ml-4 rounded border border-[#D5C0AC] px-1.5 py-0.5 text-[9px] text-[#9ca9a3]">⌘ K</span></Link>
            <Link href="/search" aria-label="Caută" className="grid h-9 w-9 place-items-center rounded-xl border border-[#FF5A00] bg-[#FF5A00] text-[#29170e] sm:hidden"><Search size={15} /></Link>
            <NotificationBell />
            <div className="ml-1 hidden h-8 w-8 place-items-center rounded-full bg-[#d7c6a2] text-[10px] font-bold text-[#443b2f] sm:grid">AM</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}