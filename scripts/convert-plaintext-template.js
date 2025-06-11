#!/usr/bin/env node

/**
 * Convert plain text to HTML-formatted template content
 * Preserves line breaks and basic formatting
 */

function convertPlainTextToHTML(plainText) {
  // Escape HTML special characters
  let html = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Split into paragraphs (double newline)
  const paragraphs = html.split(/\n\n+/);
  
  // Process each paragraph
  const processedParagraphs = paragraphs.map(paragraph => {
    // Check if it's a numbered or bulleted list
    const lines = paragraph.split('\n');
    
    // Check if all lines start with numbers followed by period
    const isNumberedList = lines.every(line => 
      line.trim() === '' || /^\d+\.\s/.test(line.trim())
    );
    
    // Check if all lines start with bullet points
    const isBulletList = lines.every(line => 
      line.trim() === '' || /^[-*•]\s/.test(line.trim())
    );
    
    if (isNumberedList) {
      const items = lines
        .filter(line => line.trim() !== '')
        .map(line => `<li>${line.replace(/^\d+\.\s/, '')}</li>`)
        .join('\n');
      return `<ol>\n${items}\n</ol>`;
    } else if (isBulletList) {
      const items = lines
        .filter(line => line.trim() !== '')
        .map(line => `<li>${line.replace(/^[-*•]\s/, '')}</li>`)
        .join('\n');
      return `<ul>\n${items}\n</ul>`;
    } else {
      // Regular paragraph - preserve single line breaks with <br>
      const processedLines = lines.map((line, index) => {
        if (index === lines.length - 1) return line;
        return line + '<br>';
      }).join('\n');
      return `<p>${processedLines}</p>`;
    }
  });
  
  return processedParagraphs.join('\n\n');
}

// Example usage
if (require.main === module) {
  const plainText = `You are a game development consultant tasked with providing advice on creating a Minesweeper-like game without infringing on copyrights or trademarks. Your goal is to research Minesweeper, analyze legal considerations, and suggest ways to differentiate a new game from the original, that would also recapture the hearts and minds of game lovers.

First, review the following links related to Minesweeper:

[[LINKS]]

Now, carefully read through these links and any other reputable sources you can find to gather information about Minesweeper. Pay special attention to:

1. The game's history and original creators
2. Gameplay mechanics and rules
3. Visual design elements
4. Any known copyrights, trademarks, or patents associated with the game

Next, analyze the legal considerations for creating a Minesweeper-like game. Consider:

1. What elements of Minesweeper are likely protected by copyright or trademark?
2. What aspects of the game are considered public domain or common game mechanics?
3. Are there any known legal precedents related to Minesweeper clones or similar games?
4. This is a mobile game, so how does that help with what we're doing

Then, brainstorm ideas to differentiate the new game from Minesweeper. Consider:

1. Unique gameplay mechanics that could be added or modified
2. Visual design changes that would set the game apart
3. Thematic alterations that could give the game a distinct identity
4. Customization options or features that could enhance the player experience`;

  console.log('Original:');
  console.log(plainText);
  console.log('\n\nConverted to HTML:');
  console.log(convertPlainTextToHTML(plainText));
}

module.exports = { convertPlainTextToHTML };