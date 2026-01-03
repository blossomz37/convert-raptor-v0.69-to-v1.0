#!/usr/bin/env python3
"""
Schema 1 JSON to ZIP Converter

Converts a Schema 1 JSON file into a ZIP archive containing:
- Folders (slugified from folder titles)
- Markdown files (content converted from HTML)

Usage:
    python schema1_to_zip.py input.json output.zip
    python schema1_to_zip.py input.json  # outputs to input.zip
"""

import argparse
import json
import re
import zipfile
from html.parser import HTMLParser
from pathlib import Path


class HTMLToMarkdownConverter(HTMLParser):
    """Convert HTML content to Markdown."""
    
    def __init__(self):
        super().__init__()
        self.result = []
        self.current_text = []
        self.in_list = False
        self.list_type = None
        self.list_item_count = 0
        
    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)
        
        if tag == 'p':
            pass  # Will add newlines on end tag
        elif tag == 'br':
            # Double newline for paragraph break (single \n is a soft break in Markdown)
            self.result.append('\n\n')
        elif tag in ('strong', 'b'):
            self.result.append('**')
        elif tag in ('em', 'i'):
            self.result.append('*')
        elif tag == 'u':
            pass  # Markdown doesn't have underline, keep text as-is
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            level = int(tag[1])
            self.result.append('#' * level + ' ')
        elif tag == 'a':
            href = attrs_dict.get('href', '')
            self.result.append('[')
            self.current_text.append(('link', href))
        elif tag == 'ul':
            self.in_list = True
            self.list_type = 'ul'
        elif tag == 'ol':
            self.in_list = True
            self.list_type = 'ol'
            self.list_item_count = 0
        elif tag == 'li':
            if self.list_type == 'ul':
                self.result.append('- ')
            else:
                self.list_item_count += 1
                self.result.append(f'{self.list_item_count}. ')
        elif tag == 'blockquote':
            self.result.append('> ')
        elif tag == 'code':
            self.result.append('`')
        elif tag == 'pre':
            self.result.append('```\n')
    
    def handle_endtag(self, tag):
        tag = tag.lower()
        
        if tag == 'p':
            self.result.append('\n\n')
        elif tag in ('strong', 'b'):
            self.result.append('**')
        elif tag in ('em', 'i'):
            self.result.append('*')
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.result.append('\n\n')
        elif tag == 'a':
            if self.current_text and self.current_text[-1][0] == 'link':
                _, href = self.current_text.pop()
                self.result.append(f']({href})')
        elif tag in ('ul', 'ol'):
            self.in_list = False
            self.list_type = None
            self.result.append('\n')
        elif tag == 'li':
            self.result.append('\n')
        elif tag == 'blockquote':
            self.result.append('\n')
        elif tag == 'code':
            self.result.append('`')
        elif tag == 'pre':
            self.result.append('\n```\n')
    
    def handle_data(self, data):
        self.result.append(data)
    
    def get_markdown(self) -> str:
        return ''.join(self.result).strip()


def html_to_markdown(html: str) -> str:
    """Convert HTML content to Markdown."""
    if not html:
        return ''
    
    converter = HTMLToMarkdownConverter()
    try:
        converter.feed(html)
        result = converter.get_markdown()
        # Normalize consecutive newlines - max 2 (one blank line between paragraphs)
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result
    except Exception:
        # If parsing fails, return cleaned text
        return re.sub(r'<[^>]+>', '', html)


def slugify_folder(title: str) -> str:
    """
    Convert folder title to slug for directory name.
    'Schema 1 Subfolder 1' → 'schema-1-subfolder-1'
    """
    slug = title.strip().lower()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special chars except spaces and hyphens
    slug = re.sub(r'\s+', '-', slug)      # Spaces to hyphens
    slug = re.sub(r'-+', '-', slug)       # Collapse multiple hyphens
    return slug.strip('-')


def slugify_filename(title: str) -> str:
    """
    Convert document title to filename.
    'Document For Subfolder 1' → 'Document_For_Subfolder_1.md'
    'Chapter 8 Lucas.md' → 'Chapter_8_Lucas.md' (not double extension)
    """
    filename = title.strip()
    # Remove existing .md extension if present
    if filename.lower().endswith('.md'):
        filename = filename[:-3]
    filename = re.sub(r'[^\w\s-]', '', filename)  # Remove special chars
    filename = re.sub(r'\s+', '_', filename)      # Spaces to underscores
    return filename + '.md'


def convert_schema1_to_zip(json_path: str, output_zip: str) -> dict:
    """
    Convert a Schema 1 JSON file to a ZIP archive.
    
    Returns a summary dict with conversion stats.
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    docs_by_id = data.get('documentsById', {})
    folders = data.get('folders', [])
    trash = data.get('trash', {})
    trash_doc_ids = set(trash.get('documentIds', []))
    trash_folder_ids = set(trash.get('folderIds', []))
    
    stats = {
        'folders_processed': 0,
        'documents_processed': 0,
        'documents_skipped_trash': 0,
        'documents_skipped_missing': 0,
    }
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Sort folders by their sort order
        sorted_folders = sorted(folders, key=lambda f: f.get('sort', 0))
        
        for folder in sorted_folders:
            folder_id = folder.get('id', '')
            
            # Skip trashed folders
            if folder_id in trash_folder_ids:
                continue
            
            # Skip folders with no status or inactive status
            if folder.get('status') not in (None, 'active'):
                continue
            
            folder_title = folder.get('title', 'untitled')
            folder_slug = slugify_folder(folder_title)
            
            # Collect valid documents first
            folder_docs = []
            for doc_id in folder.get('documentIds', []):
                # Skip trashed documents
                if doc_id in trash_doc_ids:
                    stats['documents_skipped_trash'] += 1
                    continue
                
                doc = docs_by_id.get(doc_id)
                if not doc:
                    stats['documents_skipped_missing'] += 1
                    continue
                
                # Skip inactive documents
                if doc.get('status') not in (None, 'active'):
                    continue
                
                folder_docs.append(doc)
            
            # Skip empty folders
            if not folder_docs:
                continue
            
            # Create folder entry
            zf.writestr(f"{folder_slug}/", '')
            stats['folders_processed'] += 1
            
            # Process documents in this folder
            for doc in folder_docs:
                doc_title = doc.get('title', 'untitled')
                filename = slugify_filename(doc_title)
                
                # Convert HTML content to Markdown
                html_content = doc.get('content', '')
                markdown_content = html_to_markdown(html_content)
                
                # Write to ZIP
                file_path = f"{folder_slug}/{filename}"
                zf.writestr(file_path, markdown_content.encode('utf-8'))
                stats['documents_processed'] += 1
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Convert Schema 1 JSON to ZIP with Markdown files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python schema1_to_zip.py project.json project.zip
    python schema1_to_zip.py project.json  # outputs to project.zip
        """
    )
    parser.add_argument('input', help='Input Schema 1 JSON file')
    parser.add_argument('output', nargs='?', help='Output ZIP file (default: input.zip)')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file '{args.input}' not found")
        return 1
    
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_suffix('.zip')
    
    print(f"Converting: {input_path} → {output_path}")
    
    stats = convert_schema1_to_zip(str(input_path), str(output_path))
    
    print(f"✓ Created {output_path}")
    print(f"  Folders: {stats['folders_processed']}")
    print(f"  Documents: {stats['documents_processed']}")
    if stats['documents_skipped_trash']:
        print(f"  Skipped (trashed): {stats['documents_skipped_trash']}")
    if stats['documents_skipped_missing']:
        print(f"  Skipped (missing): {stats['documents_skipped_missing']}")
    
    return 0


if __name__ == '__main__':
    exit(main())
