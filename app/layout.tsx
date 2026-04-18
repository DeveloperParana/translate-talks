import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Translate Talks — DevParaná',
  description: 'Transcrição em tempo real de palestras — DevParaná',
  icons: { icon: '/devparana.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1a1a2e" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('tt-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
