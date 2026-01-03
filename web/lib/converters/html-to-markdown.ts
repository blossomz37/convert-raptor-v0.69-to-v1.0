/**
 * HTML to Markdown Converter
 * Converts HTML content to clean Markdown format
 */

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let result = html;

  // Handle paragraph tags
  result = result.replace(/<\/p>/gi, '\n\n');
  result = result.replace(/<p[^>]*>/gi, '');

  // Handle line breaks - double newline for proper paragraph separation
  result = result.replace(/<br\s*\/?>/gi, '\n\n');

  // Handle bold
  result = result.replace(/<(strong|b)>/gi, '**');
  result = result.replace(/<\/(strong|b)>/gi, '**');

  // Handle italic
  result = result.replace(/<(em|i)>/gi, '*');
  result = result.replace(/<\/(em|i)>/gi, '*');

  // Handle headings
  result = result.replace(/<h1[^>]*>/gi, '# ');
  result = result.replace(/<\/h1>/gi, '\n\n');
  result = result.replace(/<h2[^>]*>/gi, '## ');
  result = result.replace(/<\/h2>/gi, '\n\n');
  result = result.replace(/<h3[^>]*>/gi, '### ');
  result = result.replace(/<\/h3>/gi, '\n\n');
  result = result.replace(/<h4[^>]*>/gi, '#### ');
  result = result.replace(/<\/h4>/gi, '\n\n');

  // Handle links
  result = result.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

  // Handle lists
  result = result.replace(/<ul[^>]*>/gi, '\n');
  result = result.replace(/<\/ul>/gi, '\n');
  result = result.replace(/<ol[^>]*>/gi, '\n');
  result = result.replace(/<\/ol>/gi, '\n');
  result = result.replace(/<li[^>]*>/gi, '- ');
  result = result.replace(/<\/li>/gi, '\n');

  // Handle code
  result = result.replace(/<code>/gi, '`');
  result = result.replace(/<\/code>/gi, '`');
  result = result.replace(/<pre>/gi, '```\n');
  result = result.replace(/<\/pre>/gi, '\n```\n');

  // Handle blockquotes
  result = result.replace(/<blockquote[^>]*>/gi, '> ');
  result = result.replace(/<\/blockquote>/gi, '\n');

  // Remove any remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&nbsp;/g, ' ');

  // Normalize consecutive newlines - max 2 (one blank line between paragraphs)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
