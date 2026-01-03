/**
 * Schema 1 to ZIP Converter
 * Converts Schema 1 JSON to ZIP archive with Markdown files
 */

import JSZip from 'jszip';
import { htmlToMarkdown } from './html-to-markdown';

interface Schema1Document {
  id: string;
  title: string;
  content: string;
  status?: string;
  summary?: string;
}

interface Schema1Folder {
  id: string;
  title: string;
  documentIds: string[];
  sort?: number;
  status?: string;
}

interface Schema1Data {
  title: string;
  folders: Schema1Folder[];
  documentsById: Record<string, Schema1Document>;
  trash?: {
    documentIds?: string[];
    folderIds?: string[];
  };
}

function slugifyFolder(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugifyFilename(title: string): string {
  let filename = title.trim();
  // Remove .md extension if present
  if (filename.toLowerCase().endsWith('.md')) {
    filename = filename.slice(0, -3);
  }
  filename = filename.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  return filename + '.md';
}

export interface ConversionStats {
  foldersProcessed: number;
  documentsProcessed: number;
}

export async function convertToZip(data: Schema1Data): Promise<{ blob: Blob; stats: ConversionStats }> {
  const zip = new JSZip();
  const stats: ConversionStats = {
    foldersProcessed: 0,
    documentsProcessed: 0,
  };

  const trashDocIds = new Set(data.trash?.documentIds || []);
  const trashFolderIds = new Set(data.trash?.folderIds || []);

  // Sort folders by sort order
  const sortedFolders = [...data.folders].sort((a, b) => (a.sort || 0) - (b.sort || 0));

  for (const folder of sortedFolders) {
    // Skip trashed folders
    if (trashFolderIds.has(folder.id)) continue;

    // Skip inactive folders
    if (folder.status && folder.status !== 'active') continue;

    const folderSlug = slugifyFolder(folder.title || 'untitled');

    // Collect valid documents
    const folderDocs: Schema1Document[] = [];
    for (const docId of folder.documentIds || []) {
      if (trashDocIds.has(docId)) continue;

      const doc = data.documentsById[docId];
      if (!doc) continue;
      if (doc.status && doc.status !== 'active') continue;

      folderDocs.push(doc);
    }

    // Skip empty folders
    if (folderDocs.length === 0) continue;

    stats.foldersProcessed++;

    // Add documents to folder
    for (const doc of folderDocs) {
      const filename = slugifyFilename(doc.title || 'untitled');
      const markdown = htmlToMarkdown(doc.content || '');

      zip.file(`${folderSlug}/${filename}`, markdown);
      stats.documentsProcessed++;
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, stats };
}
