#!/usr/bin/env python3
"""
Schema 1 to Schema 2 JSON Converter

Converts Schema 1 (HTML-based, normalized documents) to Schema 2 
(BlockNote JSON, embedded documents) for RaptorWrite compatibility.

Usage:
    python schema1_to_schema2.py input.json output.json
    python schema1_to_schema2.py input.json  # outputs to input_schema2.json
"""

import argparse
import json
import re
import uuid
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


class HTMLToBlockNoteConverter(HTMLParser):
    """Convert HTML content to BlockNote JSON format."""
    
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.current_block = None
        self.current_content = []
        self.current_styles = {}
        self.pending_text = []
        
    def _generate_id(self) -> str:
        """Generate a UUID for block IDs."""
        return str(uuid.uuid4())
    
    def _create_block(self, block_type: str = "paragraph") -> dict:
        """Create a new BlockNote block."""
        return {
            "id": self._generate_id(),
            "type": block_type,
            "props": {
                "textColor": "default",
                "backgroundColor": "default",
                "textAlignment": "left"
            },
            "content": [],
            "children": []
        }
    
    def _flush_text(self):
        """Flush pending text to current content."""
        if self.pending_text:
            text = ''.join(self.pending_text)
            if text:
                text_node = {
                    "type": "text",
                    "text": text,
                    "styles": dict(self.current_styles)
                }
                self.current_content.append(text_node)
            self.pending_text = []
    
    def _flush_block(self):
        """Flush current block to blocks list."""
        self._flush_text()
        if self.current_content:
            block = self._create_block()
            block["content"] = self.current_content
            self.blocks.append(block)
            self.current_content = []
    
    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        
        if tag == 'p':
            # Start a new paragraph - flush any existing content
            self._flush_block()
        elif tag == 'br':
            # Create a paragraph break - some documents use <br> instead of <p> tags
            self._flush_block()
        elif tag in ('strong', 'b'):
            self._flush_text()
            self.current_styles['bold'] = True
        elif tag in ('em', 'i'):
            self._flush_text()
            self.current_styles['italic'] = True
        elif tag == 'u':
            self._flush_text()
            self.current_styles['underline'] = True
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self._flush_block()
            # For headings, we'll create a heading block
            level = int(tag[1])
            self.current_block = self._create_block("heading")
            self.current_block["props"]["level"] = level
        elif tag == 'a':
            self._flush_text()
            attrs_dict = dict(attrs)
            href = attrs_dict.get('href', '')
            # Store link info for when we get the text
            self.current_styles['link'] = href
    
    def handle_endtag(self, tag):
        tag = tag.lower()
        
        if tag == 'p':
            self._flush_block()
        elif tag in ('strong', 'b'):
            self._flush_text()
            self.current_styles.pop('bold', None)
        elif tag in ('em', 'i'):
            self._flush_text()
            self.current_styles.pop('italic', None)
        elif tag == 'u':
            self._flush_text()
            self.current_styles.pop('underline', None)
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self._flush_text()
            if self.current_block:
                self.current_block["content"] = self.current_content
                self.blocks.append(self.current_block)
                self.current_block = None
                self.current_content = []
        elif tag == 'a':
            self._flush_text()
            self.current_styles.pop('link', None)
    
    def handle_data(self, data):
        # Collect text data
        self.pending_text.append(data)
    
    def get_blocknote_json(self) -> list:
        """Get the final BlockNote JSON structure."""
        # Flush any remaining content
        self._flush_block()
        return self.blocks


def html_to_blocknote(html: str) -> list:
    """Convert HTML content to BlockNote JSON format."""
    if not html:
        return []
    
    converter = HTMLToBlockNoteConverter()
    try:
        converter.feed(html)
        blocks = converter.get_blocknote_json()
        # Filter out completely empty blocks
        return [b for b in blocks if b.get("content")]
    except Exception as e:
        # If parsing fails, create a single paragraph with cleaned text
        text = re.sub(r'<[^>]+>', '', html)
        if text.strip():
            return [{
                "id": str(uuid.uuid4()),
                "type": "paragraph",
                "props": {
                    "textColor": "default",
                    "backgroundColor": "default",
                    "textAlignment": "left"
                },
                "content": [{"type": "text", "text": text.strip(), "styles": {}}],
                "children": []
            }]
        return []


def count_words(blocknote_content: list) -> int:
    """Count words in BlockNote JSON content."""
    text_parts = []
    for block in blocknote_content:
        for content_item in block.get("content", []):
            if content_item.get("type") == "text":
                text_parts.append(content_item.get("text", ""))
    
    full_text = ' '.join(text_parts)
    words = full_text.split()
    return len(words)


def natural_sort_key(text: str) -> list:
    """
    Generate a sort key for natural sorting.
    Alphabetical first, then numerical (e.g., Chapter 1, Chapter 2, Chapter 10).
    """
    def convert(part):
        # If it's a number, return as int for proper numerical sorting
        if part.isdigit():
            return (1, int(part))  # Numbers come after text
        return (0, part.lower())  # Text comes first, case-insensitive
    
    # Split into text and number parts
    parts = re.split(r'(\d+)', text)
    return [convert(part) for part in parts if part]


def slugify_folder_name(title: str) -> str:
    """Convert folder title to slug for name field."""
    slug = title.strip().lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def convert_document(doc: dict, order: int) -> dict:
    """Convert a Schema 1 document to Schema 2 format."""
    html_content = doc.get('content', '')
    blocknote_content = html_to_blocknote(html_content)
    word_count = count_words(blocknote_content)
    
    # Map status: "active" -> "draft"
    status = doc.get('status', 'active')
    if status == 'active':
        status = 'draft'
    
    # Clean up title - remove .md extension if present
    title = doc.get('title', 'Untitled')
    if title.lower().endswith('.md'):
        title = title[:-3]
    
    return {
        "type": "manuscript",
        "title": title,
        "label_color": None,
        "card_color": None,
        "icon": None,
        "content": json.dumps(blocknote_content),  # Stored as JSON string
        "synopsis": doc.get('summary') if doc.get('summary') else None,
        "notes": None,
        "label": None,
        "status": status,
        "order": order,
        "word_count": word_count,
        "target_word_count": None,
        "keywords": None
    }


def convert_folder(folder: dict, docs_by_id: dict, trash_doc_ids: set, order: int) -> dict:
    """Convert a Schema 1 folder to Schema 2 format.
    
    Returns None if folder has no valid documents.
    """
    documents = []
    
    for doc_id in folder.get('documentIds', []):
        # Skip trashed documents
        if doc_id in trash_doc_ids:
            continue
        
        doc = docs_by_id.get(doc_id)
        if not doc:
            continue
        
        # Skip inactive documents
        if doc.get('status') not in (None, 'active'):
            continue
        
        # Convert document (order will be assigned after sorting)
        converted_doc = convert_document(doc, 0)
        documents.append(converted_doc)
    
    # Return None if no documents (will be filtered out)
    if not documents:
        return None
    
    # Sort documents using natural sort on title
    documents.sort(key=lambda d: natural_sort_key(d.get('title', '')))
    
    # Reassign order after sorting
    for idx, doc in enumerate(documents):
        doc['order'] = idx
    
    return {
        "name": slugify_folder_name(folder.get('title', 'untitled')),
        "type": "manuscript",
        "description": None,
        "parent_id": None,
        "label_color": None,
        "icon": None,
        "order": order,
        "is_default": False,
        "documents": documents
    }


def convert_schema1_to_schema2(schema1_data: dict) -> dict:
    """Convert Schema 1 JSON to Schema 2 JSON format."""
    docs_by_id = schema1_data.get('documentsById', {})
    folders = schema1_data.get('folders', [])
    trash = schema1_data.get('trash', {})
    trash_doc_ids = set(trash.get('documentIds', []))
    trash_folder_ids = set(trash.get('folderIds', []))
    
    # Sort folders by sort order
    sorted_folders = sorted(folders, key=lambda f: f.get('sort', 0))
    
    # Convert folders (filtering out empty ones)
    converted_folders = []
    folder_order = 0
    for folder in sorted_folders:
        folder_id = folder.get('id', '')
        
        # Skip trashed folders
        if folder_id in trash_folder_ids:
            continue
        
        # Skip inactive folders
        if folder.get('status') not in (None, 'active'):
            continue
        
        converted_folder = convert_folder(folder, docs_by_id, trash_doc_ids, folder_order)
        
        # Skip empty folders (convert_folder returns None if no documents)
        if converted_folder is None:
            continue
        
        converted_folders.append(converted_folder)
        folder_order += 1
    
    # Get project title
    title = schema1_data.get('title', 'Untitled')
    title = title.replace(' ', '_')  # Schema 2 uses underscores
    
    # Count total chapters
    total_docs = sum(len(f.get('documents', [])) for f in converted_folders)
    
    return {
        "title": title,
        "author": None,
        "author_pen_name": None,
        "description": None,
        "genre": None,
        "number_of_chapters": total_docs if total_docs > 0 else None,
        "story_hook": None,
        "story_pitch": None,
        "status": "draft",
        "folders": converted_folders
    }


def main():
    parser = argparse.ArgumentParser(
        description='Convert Schema 1 JSON to Schema 2 JSON format',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python schema1_to_schema2.py project.json output.json
    python schema1_to_schema2.py project.json  # outputs to project_schema2.json
        """
    )
    parser.add_argument('input', help='Input Schema 1 JSON file')
    parser.add_argument('output', nargs='?', help='Output Schema 2 JSON file')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file '{args.input}' not found")
        return 1
    
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_stem(input_path.stem + '_schema2')
    
    print(f"Converting: {input_path} → {output_path}")
    
    # Load Schema 1
    with open(input_path, 'r', encoding='utf-8') as f:
        schema1_data = json.load(f)
    
    # Convert to Schema 2
    schema2_data = convert_schema1_to_schema2(schema1_data)
    
    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schema2_data, f, indent=2, ensure_ascii=False)
    
    # Print stats
    folder_count = len(schema2_data.get('folders', []))
    doc_count = sum(len(f.get('documents', [])) for f in schema2_data.get('folders', []))
    
    print(f"✓ Created {output_path}")
    print(f"  Folders: {folder_count}")
    print(f"  Documents: {doc_count}")
    
    return 0


if __name__ == '__main__':
    exit(main())
