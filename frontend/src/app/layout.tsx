import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Business Operations Platform",
  description: "Configurable business operations system"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
