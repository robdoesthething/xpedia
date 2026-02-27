import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google';
import ThemeProvider from '@/components/ThemeProvider';
import './globals.css';

const bricolageGrotesque = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Xpedia — Knowledge from Bookmarks',
  description: 'Turn your X bookmarks into a structured knowledge corpus',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolageGrotesque.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
