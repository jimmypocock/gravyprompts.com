/**
 * Convert plain text template to HTML format
 * Handles variable placeholders and basic formatting
 */

function convertPlainTextToHTML(plainText) {
  if (!plainText) return "";
  
  // If it's already HTML (starts with < tag), return as is
  if (plainText.trim().startsWith("<")) {
    return plainText;
  }
  
  // Escape HTML special characters first
  let html = plainText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  
  // Convert line breaks to paragraphs
  const lines = html.split(/\n\n+/);
  html = lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  
  // Ensure [[variables]] are preserved and properly displayed
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="template-variable">[[<span class="variable-name">$1</span>]]</span>');
  
  return html;
}

module.exports = {
  convertPlainTextToHTML
};