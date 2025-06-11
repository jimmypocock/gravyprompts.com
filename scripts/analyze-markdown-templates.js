#!/usr/bin/env node

/**
 * Analyze markdown templates and generate CSV file with auto-detected tags and categories
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Tag keywords mapping
const TAG_KEYWORDS = {
  // Technical tags
  'ai': ['ai', 'artificial intelligence', 'ml', 'machine learning', 'llm', 'gpt', 'claude'],
  'game-development': ['game', 'gaming', 'gameplay', 'player', 'level', 'score'],
  'mobile': ['mobile', 'ios', 'android', 'app', 'smartphone'],
  'aws': ['aws', 'amazon', 'lambda', 'dynamodb', 'cognito', 's3', 'sagemaker', 'appsync'],
  'api': ['api', 'endpoint', 'rest', 'graphql', 'webhook'],
  'backend': ['backend', 'server', 'database', 'infrastructure'],
  'frontend': ['frontend', 'ui', 'ux', 'interface', 'react', 'flutter'],
  'multiplayer': ['multiplayer', 'online', 'real-time', 'session', 'player vs'],
  
  // Content types
  'consultant': ['consultant', 'consulting', 'advisor', 'expert', 'analysis'],
  'development': ['development', 'developer', 'coding', 'programming', 'implementation'],
  'design': ['design', 'designer', 'asset', 'graphic', 'visual', 'art'],
  'strategy': ['strategy', 'plan', 'planning', 'roadmap', 'timeline'],
  'research': ['research', 'analysis', 'market', 'analyze', 'investigate'],
  'documentation': ['documentation', 'document', 'guide', 'readme', 'tutorial'],
  'monetization': ['monetization', 'revenue', 'payment', 'premium', 'subscription'],
  
  // Specific domains
  'quantum': ['quantum', 'superposition', 'entanglement'],
  'poker': ['poker', 'card', 'hand', 'deck', 'betting'],
  'legal': ['legal', 'copyright', 'trademark', 'license', 'patent'],
  'marketing': ['marketing', 'market', 'audience', 'retention', 'engagement'],
  'technical': ['technical', 'architecture', 'implementation', 'deployment'],
};

// Category detection based on content
const CATEGORY_PATTERNS = {
  'Game Development': /game|gaming|player|mobile game|game design|game mechanics/i,
  'AI Consulting': /ai assistant|expert consultant|analysis|recommendations/i,
  'Technical Architecture': /technical|architecture|aws|backend|infrastructure/i,
  'Design & Assets': /design|asset|graphic|visual|art|creation/i,
  'Strategy & Planning': /strategy|plan|roadmap|timeline|development plan/i,
  'Legal & Compliance': /legal|copyright|trademark|license|compliance/i,
  'Marketing & Monetization': /marketing|monetization|revenue|retention|engagement/i,
  'Documentation': /documentation|guide|tutorial|readme/i,
};

// Extract variables from content
function extractVariables(content) {
  const variablePattern = /\[\[([^\]]+)\]\]/g;
  const variables = [];
  let match;
  
  while ((match = variablePattern.exec(content)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
  
  return variables;
}

// Auto-detect tags based on content
function detectTags(content) {
  const contentLower = content.toLowerCase();
  const detectedTags = new Set();
  
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        detectedTags.add(tag);
        break;
      }
    }
  }
  
  return Array.from(detectedTags).slice(0, 8); // Limit to 8 tags
}

// Auto-detect category based on content
function detectCategory(content, title) {
  const combinedText = `${title} ${content}`.toLowerCase();
  let bestMatch = 'General';
  let highestScore = 0;
  
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    const matches = combinedText.match(pattern);
    if (matches && matches.length > highestScore) {
      highestScore = matches.length;
      bestMatch = category;
    }
  }
  
  return bestMatch;
}

// Generate a better title based on content analysis
function generateTitle(content, fileName) {
  const contentLower = content.toLowerCase();
  
  // Manual title mapping based on file analysis
  const titleMap = {
    '1': 'Mobile Game Ideation Consultant',
    '2': 'Quantum Poker Game Development Plan',
    '3': 'Game Asset Creation Strategy Guide',
    '4': 'Website Review & Competitor Analysis',
    '5': 'Marketing Campaign Research Assistant',
    '6': 'Pixelmator Pro Design Tutorial Creator',
    '7': 'Canva Pro Design Guide Generator',
    '8': 'SEO Blog Article Writer',
    '9': 'eBay Seller Authenticity Checker',
    '10': 'Personalized Side Hustle Advisor'
  };
  
  // Extract file number
  const fileNum = fileName.match(/\d+/)?.[0];
  if (fileNum && titleMap[fileNum]) {
    return titleMap[fileNum];
  }
  
  // Fallback: intelligent title generation based on content
  if (contentLower.includes('mobile game') && contentLower.includes('ideation')) {
    return 'Mobile Game Concept Developer';
  } else if (contentLower.includes('quantum') && contentLower.includes('poker')) {
    return 'Quantum Poker Game Blueprint';
  } else if (contentLower.includes('game asset')) {
    return 'AI Game Asset Creation Guide';
  } else if (contentLower.includes('website') && contentLower.includes('review')) {
    return 'Website Analysis & Research';
  } else if (contentLower.includes('marketing campaign')) {
    return 'Marketing Campaign Strategist';
  } else if (contentLower.includes('pixelmator')) {
    return 'Pixelmator Design Assistant';
  } else if (contentLower.includes('canva')) {
    return 'Canva Design Assistant';
  } else if (contentLower.includes('blog') && contentLower.includes('seo')) {
    return 'SEO Content Writer';
  } else if (contentLower.includes('ebay') && contentLower.includes('seller')) {
    return 'Online Seller Verification';
  } else if (contentLower.includes('side hustle')) {
    return 'Side Hustle Consultant';
  }
  
  // Last resort: use first line but clean it up
  const lines = content.split('\n').filter(line => line.trim());
  const firstLine = lines[0]?.substring(0, 60).replace(/[.:]/g, '').trim();
  return firstLine || 'AI Assistant Template';
}

// Process markdown file
function processMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.md');
  
  const title = generateTitle(content, fileName);
  const variables = extractVariables(content);
  const tags = detectTags(content);
  const category = detectCategory(content, title);
  
  // Determine format - if it has markdown syntax, keep as plain
  const hasMarkdown = content.includes('#') || content.includes('*') || content.includes('`');
  const format = hasMarkdown ? 'plain' : 'plain';
  
  return {
    title,
    content: content.trim(),
    format,
    tags: tags.join(','),
    category,
    authorEmail: 'system@gravyprompts.com',
    visibility: 'public',
    viewCount: Math.floor(Math.random() * 500) + 50,
    useCount: Math.floor(Math.random() * 200) + 10,
    variables: variables.join(','),
    sourceFile: fileName,
  };
}

// Main function
async function main() {
  const templatesDir = path.join(__dirname, '..', 'data', 'starter_templates');
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`Directory not found: ${templatesDir}`);
    process.exit(1);
  }
  
  // Get all markdown files
  const files = fs.readdirSync(templatesDir)
    .filter(file => file.endsWith('.md'))
    .sort((a, b) => {
      // Sort numerically if files are numbered
      const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
      const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
      return aNum - bNum;
    });
  
  console.log(`Found ${files.length} markdown files to process\n`);
  
  const templates = [];
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(templatesDir, file);
    console.log(`Processing ${file}...`);
    
    try {
      const template = processMarkdownFile(filePath);
      templates.push(template);
      
      console.log(`  Title: ${template.title}`);
      console.log(`  Category: ${template.category}`);
      console.log(`  Tags: ${template.tags}`);
      console.log(`  Variables: ${template.variables || 'none'}`);
      console.log('');
    } catch (error) {
      console.error(`  Error processing ${file}: ${error.message}`);
    }
  }
  
  // Generate CSV
  const csvContent = stringify(templates, {
    header: true,
    columns: ['title', 'content', 'format', 'tags', 'category', 'authorEmail', 'visibility', 'viewCount', 'useCount'],
  });
  
  const outputPath = path.join(__dirname, '..', 'data', 'analyzed-templates.csv');
  fs.writeFileSync(outputPath, csvContent);
  
  console.log(`\n✅ Successfully analyzed ${templates.length} templates`);
  console.log(`📄 CSV file saved to: ${outputPath}`);
  console.log('\nTo import these templates, run:');
  console.log('  npm run templates:load -- --file ./data/analyzed-templates.csv');
  
  // Show summary
  console.log('\n📊 Category Summary:');
  const categoryCounts = {};
  templates.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} templates`);
  });
  
  console.log('\n🏷️  Most Common Tags:');
  const tagCounts = {};
  templates.forEach(t => {
    t.tags.split(',').forEach(tag => {
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count} occurrences`);
    });
}

// Run the script
main().catch(console.error);