import Link from 'next/link';

export default function HowItWorks() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              Gravy Prompts
            </h1>
          </Link>
          
          <div className="hidden md:flex space-x-6">
            <Link href="/about" className="text-gray-600 hover:text-primary transition-colors">
              About
            </Link>
            <Link href="/how-it-works" className="text-primary font-medium">
              How it Works
            </Link>
            <Link href="/editor" className="text-gray-600 hover:text-primary transition-colors">
              Editor Demo
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="glass-card p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            How Gravy Prompts Works
          </h1>

          <div className="prose prose-lg max-w-none">
            <p className="text-xl text-gray-600 mb-8">
              Gravy Prompts makes it easy to create, manage, and share AI prompt templates. 
              Here&apos;s how to get the most out of our platform.
            </p>

            <h2 className="text-2xl font-bold mb-4">Step 1: Create Your Template</h2>
            <div className="glass-card p-6 mb-6">
              <p className="text-gray-600 mb-4">
                Start by creating a prompt template with dynamic variables. Use our [[variable]] syntax 
                to mark placeholders that can be filled in later.
              </p>
              <div className="bg-gray-100 rounded-lg p-4">
                <code className="text-sm">
                  Write a [[tone]] email to [[recipient]] about [[topic]]. 
                  Include [[details]] and end with [[call_to_action]].
                </code>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Step 2: Populate Variables</h2>
            <div className="glass-card p-6 mb-6">
              <p className="text-gray-600 mb-4">
                Click &quot;Populate Variables&quot; and fill in the values for each placeholder. The system will 
                prompt you for each variable one by one.
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li><strong>[[tone]]</strong> → professional</li>
                <li><strong>[[recipient]]</strong> → my team</li>
                <li><strong>[[topic]]</strong> → project deadline</li>
                <li><strong>[[details]]</strong> → the deadline has been moved to Friday</li>
                <li><strong>[[call_to_action]]</strong> → please confirm receipt</li>
              </ul>
            </div>

            <h2 className="text-2xl font-bold mb-4">Step 3: Copy and Use</h2>
            <div className="glass-card p-6 mb-6">
              <p className="text-gray-600 mb-4">
                Once populated, copy your completed prompt with formatting preserved. You can paste it 
                directly into ChatGPT, Claude, or any AI tool.
              </p>
              <div className="bg-gray-100 rounded-lg p-4">
                <code className="text-sm">
                  Write a professional email to my team about project deadline. 
                  Include the deadline has been moved to Friday and end with please confirm receipt.
                </code>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Advanced Features</h2>
            
            <h3 className="text-xl font-semibold mb-3">📚 Snippet Library</h3>
            <p className="text-gray-600 mb-4">
              Access pre-made templates for common use cases like emails, reports, social media posts, 
              and more. Just select a snippet and customize it for your needs.
            </p>

            <h3 className="text-xl font-semibold mb-3">🏷️ Custom Variable Delimiters</h3>
            <p className="text-gray-600 mb-4">
              Don&apos;t like [[brackets]]? Change them! Use %%percent%%, @@at@@, or any delimiter that 
              works for your workflow.
            </p>

            <h3 className="text-xl font-semibold mb-3">🎨 Rich Text Formatting</h3>
            <p className="text-gray-600 mb-4">
              Format your prompts with bold, italic, lists, and links. All formatting is preserved when 
              you copy and paste.
            </p>

            <h3 className="text-xl font-semibold mb-3">☁️ Cloud Storage</h3>
            <p className="text-gray-600 mb-4">
              Save your templates to the cloud and access them from any device. Organize with categories 
              and tags for easy retrieval.
            </p>

            <h2 className="text-2xl font-bold mb-4">Pro Tips</h2>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
              <li>Use descriptive variable names like [[customer_name]] instead of just [[name]]</li>
              <li>Create templates for your most common tasks to save time</li>
              <li>Share your best templates with the community to help others</li>
              <li>Rate and review templates to help the best ones rise to the top</li>
              <li>Export templates in different formats for various AI tools</li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/editor" className="btn-primary text-center">
                Try the Editor Now
              </Link>
              <Link 
                href="/about" 
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                Learn More About Us
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}