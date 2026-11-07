import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Repère · Suivi en mathématiques",
  description: "Séances, compétences et bilans de mathématiques.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
