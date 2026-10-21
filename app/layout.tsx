import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../components/AuthProvider';
import SiteHeader from '../components/SiteHeader';

export const metadata: Metadata = {
  title: 'RDK — Class Validity',
  description: 'Vessel survey status dan class scope management.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0d9488',
  icons: { icon: '/icon-192.png', apple: '/icon-512.png' },
  appleWebApp: { capable: true, title: 'RDK', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-100 text-slate-800 antialiased">
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
