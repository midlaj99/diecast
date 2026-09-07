import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "../components/Header";
import AnnouncementBar from "../components/AnnouncementBar";
import Footer from "../components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Diecast Hub | Premium Diecast Model Cars & Collectibles",
  description: "Shop premium diecast model cars from leading brands and discover your next collectible at Diecast Hub.",
  openGraph: {
    title: "Diecast Hub | Premium Diecast Model insertions",
    description: "Shop premium diecast model cars from leading brands and discover your next collectible at Diecast Hub.",
    type: "website",
    locale: "en_IN",
  },
  robots: {
    index: true,
    follow: true,
  },
};

import { Toaster } from 'react-hot-toast';
import { CartProvider } from '../context/CartContext';

import ScrollToTop from '../components/ScrollToTop';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body>
        <CartProvider>
          <ScrollToTop />
          <Suspense fallback={<div style={{ height: '72px' }} />}>
            <Header />
          </Suspense>
          <AnnouncementBar />
          <main>{children}</main>
          <Footer />
          <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '8px',
            },
          }}
          containerStyle={{
            zIndex: 99999,
          }}
        />
        </CartProvider>
      </body>
    </html>
  );
}
