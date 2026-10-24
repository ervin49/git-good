import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helpy — Memoria operațională",
  description: "Transformă experiența echipei în cunoștințe reutilizabile.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}