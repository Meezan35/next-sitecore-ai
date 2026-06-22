import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "next-sitecore-ai Demo",
  description: "Demo app for the next-sitecore-ai toolkit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}