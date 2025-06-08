import Link from 'next/link';

export default function About() {
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
            <Link href="/about" className="text-primary font-medium">
              About
            </Link>
            <Link href="/how-it-works" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">
              How it Works
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="glass-card p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            About Your App
          </h1>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Welcome to the about page of your application. This is where you can tell your users 
              about your mission, vision, and what makes your application special.
            </p>

            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Describe your mission here. What problem are you solving? What value do you bring to your users?
              This template provides a solid foundation for building modern web applications with all the 
              essential components included.
            </p>

            <h2 className="text-2xl font-bold mb-4">Features Included</h2>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 mb-6 space-y-2">
              <li>Next.js 15 with App Router for optimal performance</li>
              <li>TypeScript for type safety and better development experience</li>
              <li>Tailwind CSS for rapid UI development</li>
              <li>Google Analytics integration for user insights</li>
              <li>Google AdSense setup for monetization</li>
              <li>Complete AWS CDK infrastructure for production deployment</li>
              <li>Dark/light theme toggle</li>
              <li>Responsive design that works on all devices</li>
              <li>SEO optimization and accessibility features</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4">Technology Stack</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              This application is built with modern web technologies and follows best practices 
              for performance, security, and maintainability. The AWS CDK infrastructure ensures 
              scalable and reliable deployment with features like CDN, monitoring, and security.
            </p>

            <h2 className="text-2xl font-bold mb-4">Get Started</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Ready to customize this template for your own project? Check out the documentation 
              to learn how to configure everything for your specific needs.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/how-it-works" className="btn-primary text-center">
                View Documentation
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