import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import AdSenseScript from "@/components/AdSense/AdSenseScript";
import GoogleCMP from "@/components/GoogleCMP";
import GoogleConsentInit from "@/components/GoogleConsentInit";
import { AuthProvider } from "@/lib/auth-context";
import { SearchProvider } from "@/lib/search-context";
import Navigation from "@/components/Navigation";

// Configure Inter for the entire site
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
  description:
    "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
  keywords:
    "AI prompts, prompt templates, prompt management, AI tools, ChatGPT prompts, Claude prompts, prompt engineering, template variables, prompt sharing",
  metadataBase: new URL("https://www.gravyprompts.com"),
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "Gravy Prompts Team" }],
  category: "technology",
  generator: "Next.js",
  applicationName: "Gravy Prompts",
  referrer: "origin-when-cross-origin",
  creator: "Gravy Prompts",
  publisher: "Gravy Prompts",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
    description:
      "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
    type: "website",
    locale: "en_US",
    url: "https://gravyprompts.com",
    siteName: "Gravy Prompts",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gravy Prompts - Find the perfect AI prompt for every use case",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravy Prompts | Store, Share & Populate AI Prompt Templates",
    description:
      "The ultimate platform for managing AI prompt templates. Store, share, populate variables, and rate prompts to supercharge your AI workflow.",
    site: "@gravyprompts",
    creator: "@gravyprompts",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes here when ready
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // yahoo: 'your-yahoo-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="theme-color" content="#FF385C" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
        <GoogleConsentInit />
        <GoogleAnalytics />
        <AdSenseScript />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Comprehensive Schema Markup for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "Gravy Prompts",
                description:
                  "Store, share, populate, and rate your AI prompt templates. The ultimate prompt management platform for AI enthusiasts and professionals.",
                url: "https://gravyprompts.com",
                applicationCategory: "ProductivityApplication",
                operatingSystem: "Web Browser",
                image: "https://gravyprompts.com/images/og-image.png",
                screenshot: "https://gravyprompts.com/images/og-image.png",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "USD",
                },
                creator: {
                  "@type": "Organization",
                  name: "Gravy Prompts",
                  url: "https://gravyprompts.com",
                },
                featureList: [
                  "Store and organize prompt templates",
                  "Share prompts with the community",
                  "Populate variables in templates",
                  "Rate and discover top prompts",
                  "Export prompts in multiple formats",
                  "Search thousands of AI prompts",
                  "Filter by categories and tags",
                ],
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: "4.8",
                  reviewCount: "1250",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Gravy Prompts",
                url: "https://gravyprompts.com",
                logo: "https://gravyprompts.com/images/logo.png",
                sameAs: [
                  "https://twitter.com/gravyprompts",
                  "https://github.com/gravyprompts",
                ],
                contactPoint: {
                  "@type": "ContactPoint",
                  contactType: "customer support",
                  availableLanguage: "English",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Gravy Prompts",
                url: "https://gravyprompts.com",
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate:
                      "https://gravyprompts.com/?search={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: "https://gravyprompts.com",
                  },
                ],
              },
            ]),
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Gradient orbs container to prevent overflow */}
        <div
          className="fixed inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="gradient-orb orb1" />
          <div className="gradient-orb orb2" />
          <div className="gradient-orb orb3" />
          <div className="gradient-orb orb4" />
        </div>

        <AuthProvider>
          <SearchProvider>
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <main className="flex-1 flex flex-col pt-16">{children}</main>
            </div>
          </SearchProvider>
        </AuthProvider>
        <GoogleCMP />
      </body>
    </html>
  );
}
