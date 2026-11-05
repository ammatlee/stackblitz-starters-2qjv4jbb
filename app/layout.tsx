import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../components/AuthProvider';
import SiteHeader from '../components/SiteHeader';
import OfflineBanner from '../components/OfflineBanner';
import { DialogProvider } from '../components/DialogProvider';

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
      <body className="bg-slate-100 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] text-slate-800 antialiased md:pb-0">
        <AuthProvider>
          <DialogProvider>
            <SiteHeader />
            {children}
            <OfflineBanner />
          </DialogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}