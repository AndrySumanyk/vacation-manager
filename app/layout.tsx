import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata = {
  title: "Vacation Manager",
  description: "Система планування відпусток",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}