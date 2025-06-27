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
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
