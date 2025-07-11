import type { Metadata } from "next";
import "./globals.css";
import { Inter } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ChopsticksStatus } from '@/components/ui/ChopsticksStatus'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Swush",
  description: "DEX Aggregator on Polkadot Asset Hub"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
        <ChopsticksStatus />
        <Toaster 
          position="top-right"
          toastOptions={{
            // Let individual toasts control their own duration
            // This prevents conflicts with loading toasts that have custom durations
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              maxWidth: '400px',
              minWidth: '300px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            },
          }}
        />
      </body>
    </html>
  );
}
