/**
 * Schema 1 to Schema 2 Converter
 * Converts Schema 1 JSON (HTML content) to Schema 2 JSON (BlockNote format)
 */

import { htmlToBlockNote, countWords } from './html-to-blocknote';

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

interface Schema2Document {
  type: string;
  title: string;
  label_color: null;
  card_color: null;
  icon: null;
  content: string;
  synopsis: string | null;
  notes: null;
  label: null;
  status: string;
  order: number;
  word_count: number;
  target_word_count: null;
  keywords: null;
}

interface Schema2Folder {
  name: string;
  type: string;
  description: null;
  parent_id: null;
  label_color: null;
  icon: null;
  order: number;
  is_default: boolean;
  documents: Schema2Document[];
}

interface Schema2Data {
  title: string;
  author: null;
  author_pen_name: null;
  description: null;
  genre: null;
  number_of_chapters: number | null;
  story_hook: null;
  story_pitch: null;
  status: string;
  folders: Schema2Folder[];
}

function slugifyFolderName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function naturalSortKey(text: string): (string | number)[] {
  const parts = text.split(/(\d+)/);
  return parts.filter(p => p).map(p => {
    if (/^\d+$/.test(p)) {
      return parseInt(p, 10);
    }
    return p.toLowerCase();
  });
}

function compareNatural(a: string, b: string): number {
  const aKey = naturalSortKey(a);
  const bKey = naturalSortKey(b);

  for (let i = 0; i < Math.max(aKey.length, bKey.length); i++) {
    const aPart = aKey[i];
    const bPart = bKey[i];

    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;

    if (typeof aPart === 'number' && typeof bPart === 'number') {
      if (aPart !== bPart) return aPart - bPart;
    } else if (typeof aPart === 'string' && typeof bPart === 'string') {
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) return cmp;
    } else {
      // String vs number - strings come first
      return typeof aPart === 'string' ? -1 : 1;
    }
  }
  return 0;
}

function convertDocument(doc: Schema1Document, order: number): Schema2Document {
  const blocknoteContent = htmlToBlockNote(doc.content || '');
  const wordCount = countWords(blocknoteContent);

  // Clean up title - remove .md extension
  let title = doc.title || 'Untitled';
  if (title.toLowerCase().endsWith('.md')) {
    title = title.slice(0, -3);
  }

  // Map status
  let status = doc.status || 'active';
  if (status === 'active') {
    status = 'draft';
  }

  return {
    type: 'manuscript',
    title,
    label_color: null,
    card_color: null,
    icon: null,
    content: JSON.stringify(blocknoteContent),
    synopsis: doc.summary || null,
    notes: null,
    label: null,
    status,
    order,
    word_count: wordCount,
    target_word_count: null,
    keywords: null,
  };
}

export interface ConversionStats {
  foldersProcessed: number;
  documentsProcessed: number;
}

export function convertToSchema2(data: Schema1Data): { result: Schema2Data; stats: ConversionStats } {
  const stats: ConversionStats = {
    foldersProcessed: 0,
    documentsProcessed: 0,
  };

  const trashDocIds = new Set(data.trash?.documentIds || []);
  const trashFolderIds = new Set(data.trash?.folderIds || []);

  // Sort folders by sort order
  const sortedFolders = [...data.folders].sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const convertedFolders: Schema2Folder[] = [];
  let folderOrder = 0;

  for (const folder of sortedFolders) {
    // Skip trashed folders
    if (trashFolderIds.has(folder.id)) continue;

    // Skip inactive folders
    if (folder.status && folder.status !== 'active') continue;

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

    // Sort documents naturally by title
    folderDocs.sort((a, b) => compareNatural(a.title || '', b.title || ''));

    // Convert documents
    const documents = folderDocs.map((doc, idx) => {
      stats.documentsProcessed++;
      return convertDocument(doc, idx);
    });

    convertedFolders.push({
      name: slugifyFolderName(folder.title || 'untitled'),
      type: 'manuscript',
      description: null,
      parent_id: null,
      label_color: null,
      icon: null,
      order: folderOrder++,
      is_default: false,
      documents,
    });

    stats.foldersProcessed++;
  }

  // Calculate total documents
  const totalDocs = convertedFolders.reduce((sum, f) => sum + f.documents.length, 0);

  const result: Schema2Data = {
    title: (data.title || 'Untitled').replace(/ /g, '_'),
    author: null,
    author_pen_name: null,
    description: null,
    genre: null,
    number_of_chapters: totalDocs > 0 ? totalDocs : null,
    story_hook: null,
    story_pitch: null,
    status: 'draft',
    folders: convertedFolders,
  };

  return { result, stats };
}
