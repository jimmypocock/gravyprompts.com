import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import AdSenseScript from "@/components/AdSense/AdSenseScript";
import GoogleCMP from "@/components/GoogleCMP";
import GoogleConsentInit from "@/components/GoogleConsentInit";
import ThemeToggle from "@/components/ThemeToggle";

// Configure Noto Sans for UI text with phonetic support
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
  preload: true,
});

// Configure Noto Serif for optional use in content areas
const notoSerif = Noto_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-noto-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Your App Name | Professional Description",
  description: "Description of your amazing application and what it does for users.",
  keywords: "your, keywords, here, separated, by, commas",
  openGraph: {
    title: "Your App Name | Professional Description",
    description: "Description of your amazing application and what it does for users.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your App Name | Professional Description",
    description: "Description of your amazing application and what it does for users.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoSerif.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <GoogleConsentInit />
        <GoogleAnalytics />
        <AdSenseScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Application Schema Markup - Customize for your app */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Your App Name",
              "description": "Description of your application and its purpose.",
              "url": "https://yourdomain.com",
              "applicationCategory": "WebApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Your Organization Name"
              }
            })
          }}
        />
      </head>
      <body className={notoSans.className}>
        {/* Gradient orbs container to prevent overflow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="gradient-orb orb1" />
          <div className="gradient-orb orb2" />
          <div className="gradient-orb orb3" />
          <div className="gradient-orb orb4" />
        </div>
        
        <ThemeToggle />
        {children}
        <GoogleCMP />
      </body>
    </html>
  );
}