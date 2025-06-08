import Link from 'next/link';

export default function HowItWorks() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              Your App
            </h1>
          </Link>
          
          <div className="hidden md:flex space-x-6">
            <Link href="/about" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
              About
            </Link>
            <Link href="/how-it-works" className="text-primary font-medium">
              How it Works
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="glass-card p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            How It Works
          </h1>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              This template provides a complete foundation for building modern web applications. 
              Here&apos;s everything you need to know to get started.
            </p>

            <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
              <pre className="text-sm overflow-x-auto">
                <code>{`# Clone this template
git clone <your-template-repo>
cd your-project

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev

# Install CDK dependencies
npm run cdk:install`}</code>
              </pre>
            </div>

            <h2 className="text-2xl font-bold mb-4">Configuration Steps</h2>
            
            <h3 className="text-xl font-semibold mb-3">1. Environment Variables</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Update the <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">.env</code> file with your specific values:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mb-6 space-y-2">
              <li><strong>NEXT_PUBLIC_GA_MEASUREMENT_ID:</strong> Your Google Analytics measurement ID</li>
              <li><strong>NEXT_PUBLIC_ADSENSE_CLIENT_ID:</strong> Your Google AdSense client ID</li>
              <li><strong>AWS credentials:</strong> For CDK deployment</li>
              <li><strong>DOMAIN_NAME:</strong> Your production domain</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2. Customize Branding</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Update these files with your brand information:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mb-6 space-y-2">
              <li><strong>app/layout.tsx:</strong> Update metadata, title, and descriptions</li>
              <li><strong>app/globals.css:</strong> Customize brand colors in the CSS variables</li>
              <li><strong>tailwind.config.ts:</strong> Add your brand colors to the theme</li>
              <li><strong>package.json:</strong> Update name and description</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3. AWS Infrastructure Setup</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Deploy your infrastructure with the included CDK stacks:
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
              <pre className="text-sm overflow-x-auto">
                <code>{`# Deploy all infrastructure (recommended)
npm run deploy:all

# Or deploy individual stacks
npm run deploy:foundation
npm run deploy:cert
npm run deploy:edge
npm run deploy:waf
npm run deploy:cdn
npm run deploy:app
npm run deploy:monitoring`}</code>
              </pre>
            </div>

            <h2 className="text-2xl font-bold mb-4">Architecture Overview</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The template includes a complete AWS infrastructure setup:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mb-6 space-y-2">
              <li><strong>Foundation Stack:</strong> Core infrastructure and S3 buckets</li>
              <li><strong>Certificate Stack:</strong> SSL certificates for your domain</li>
              <li><strong>Edge Functions Stack:</strong> Lambda@Edge for advanced functionality</li>
              <li><strong>WAF Stack:</strong> Web Application Firewall for security</li>
              <li><strong>CDN Stack:</strong> CloudFront distribution for global content delivery</li>
              <li><strong>App Stack:</strong> Application deployment and hosting</li>
              <li><strong>Monitoring Stack:</strong> CloudWatch dashboards and alerts</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4">Development Scripts</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              The template includes helpful npm scripts for development and deployment:
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mb-6 space-y-2">
              <li><strong>npm run dev:</strong> Start development server with Turbopack</li>
              <li><strong>npm run build:</strong> Build the application for production</li>
              <li><strong>npm run lint:</strong> Run ESLint to check code quality</li>
              <li><strong>npm run status:</strong> Check the status of all deployed stacks</li>
              <li><strong>npm run maintenance:on/off:</strong> Toggle maintenance mode</li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/about" className="btn-primary text-center">
                Learn More
              </Link>
              <Link 
                href="/" 
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}