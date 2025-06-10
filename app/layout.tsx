import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import AdSenseScript from "@/components/AdSense/AdSenseScript";
import GoogleCMP from "@/components/GoogleCMP";
import GoogleConsentInit from "@/components/GoogleConsentInit";
import ThemeToggle from "@/components/ThemeToggle";
import { AuthProvider } from "@/lib/auth-context";
import Navigation from "@/components/Navigation";

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
  title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
  description: "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
  keywords: "AI prompts, prompt templates, prompt management, AI tools, ChatGPT prompts, Claude prompts, prompt engineering, template variables, prompt sharing",
  metadataBase: new URL('https://www.gravyprompts.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
    description: "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
    type: "website",
    locale: "en_US",
    url: "https://gravyprompts.com",
    siteName: "Gravy Prompts",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
    description: "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
    site: "@gravyprompts",
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
              "name": "Gravy Prompts",
              "description": "Store, share, populate, and rate your AI prompt templates. The ultimate prompt management platform for AI enthusiasts and professionals.",
              "url": "https://gravyprompts.com",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Gravy Prompts"
              },
              "featureList": [
                "Store and organize prompt templates",
                "Share prompts with the community",
                "Populate variables in templates",
                "Rate and discover top prompts",
                "Export prompts in multiple formats"
              ]
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
        <AuthProvider>
          <Navigation />
          <main className="pt-16">
            {children}
          </main>
        </AuthProvider>
        <GoogleCMP />
      </body>
    </html>
  );
}