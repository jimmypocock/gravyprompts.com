import Link from "next/link";

export default function About() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--primary)" }}
            >
              Gravy Prompts
            </h1>
          </Link>

          <div className="hidden md:flex space-x-6">
            <Link href="/about" className="text-primary font-medium">
              About
            </Link>
            <Link
              href="/how-it-works"
              className="text-gray-600 hover:text-primary transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="/editor"
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Editor Demo
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="glass-card p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            About Gravy Prompts
          </h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-xl text-gray-600 mb-8">
              Gravy Prompts is the ultimate platform for managing, sharing, and
              discovering AI prompt templates. We believe that great prompts are
              the key to unlocking the full potential of AI, and we&apos;re here
              to make prompt engineering accessible to everyone.
            </p>

            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-gray-600 mb-6">
              To empower AI users with tools that make prompt creation,
              management, and sharing effortless. We&apos;re building a
              community where the best prompts rise to the top, and everyone can
              benefit from collective wisdom.
            </p>

            <h2 className="text-2xl font-bold mb-4">Key Features</h2>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
              <li>🎯 Smart Template System with dynamic [[variable]] syntax</li>
              <li>📚 Organized Library with categories, tags, and search</li>
              <li>
                🌟 Community Driven platform for sharing and rating prompts
              </li>
              <li>🚀 Export Anywhere with rich formatting preserved</li>
              <li>💾 Cloud Storage to access your prompts from any device</li>
              <li>🔒 Private & Public options for your prompt templates</li>
              <li>📊 Analytics to track your most popular prompts</li>
              <li>🎨 Beautiful Editor with syntax highlighting</li>
              <li>⚡ Lightning Fast with global CDN distribution</li>
            </ul>

            <h2 className="text-2xl font-bold mb-4">Built for the AI Era</h2>
            <p className="text-gray-600 mb-6">
              Gravy Prompts is designed specifically for the age of AI. Whether
              you&apos;re using ChatGPT, Claude, Gemini, or any other AI model,
              our platform helps you create better prompts that deliver
              consistent, high-quality results.
            </p>

            <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
            <p className="text-gray-600 mb-6">
              Whether you&apos;re a prompt engineering expert or just getting
              started with AI, Gravy Prompts has something for you. Join our
              growing community and start creating better AI interactions today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/editor" className="btn-primary text-center">
                Try the Editor
              </Link>
              <Link
                href="/"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
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
