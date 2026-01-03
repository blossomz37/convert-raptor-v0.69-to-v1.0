/**
 * HTML to BlockNote JSON Converter
 * Converts HTML content to BlockNote editor format
 */

interface TextNode {
  type: 'text';
  text: string;
  styles: Record<string, boolean>;
}

interface BlockNoteBlock {
  id: string;
  type: 'paragraph' | 'heading';
  props: {
    textColor: string;
    backgroundColor: string;
    textAlignment: string;
    level?: number;
  };
  content: TextNode[];
  children: never[];
}

function generateId(): string {
  return crypto.randomUUID();
}

function createBlock(type: 'paragraph' | 'heading' = 'paragraph'): BlockNoteBlock {
  return {
    id: generateId(),
    type,
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left',
    },
    content: [],
    children: [],
  };
}

export function htmlToBlockNote(html: string): BlockNoteBlock[] {
  if (!html) return [];

  const blocks: BlockNoteBlock[] = [];
  let currentBlock = createBlock();
  let currentStyles: Record<string, boolean> = {};

  // Parse HTML using regex (simplified approach for browser)
  // Split by tags while preserving them
  const parts = html.split(/(<[^>]+>)/);

  for (const part of parts) {
    if (!part) continue;

    // Check if it's a tag
    if (part.startsWith('<')) {
      const tagMatch = part.match(/^<\/?(\w+)/);
      if (!tagMatch) continue;

      const tagName = tagMatch[1].toLowerCase();
      const isClosing = part.startsWith('</');

      if (tagName === 'p') {
        if (isClosing) {
          // Flush current block
          if (currentBlock.content.length > 0) {
            blocks.push(currentBlock);
            currentBlock = createBlock();
          }
        }
      } else if (tagName === 'br') {
        // Flush current block for line break
        if (currentBlock.content.length > 0) {
          blocks.push(currentBlock);
          currentBlock = createBlock();
        }
      } else if (tagName === 'strong' || tagName === 'b') {
        if (isClosing) {
          delete currentStyles.bold;
        } else {
          currentStyles.bold = true;
        }
      } else if (tagName === 'em' || tagName === 'i') {
        if (isClosing) {
          delete currentStyles.italic;
        } else {
          currentStyles.italic = true;
        }
      } else if (tagName === 'u') {
        if (isClosing) {
          delete currentStyles.underline;
        } else {
          currentStyles.underline = true;
        }
      }
    } else {
      // It's text content
      const text = part
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

      if (text.trim() || text === ' ') {
        currentBlock.content.push({
          type: 'text',
          text,
          styles: { ...currentStyles },
        });
      }
    }
  }

  // Flush any remaining content
  if (currentBlock.content.length > 0) {
    blocks.push(currentBlock);
  }

  // Filter out completely empty blocks
  return blocks.filter(b => b.content.length > 0);
}

export function countWords(blocks: BlockNoteBlock[]): number {
  let text = '';
  for (const block of blocks) {
    for (const content of block.content) {
      if (content.type === 'text') {
        text += content.text + ' ';
      }
    }
  }
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
