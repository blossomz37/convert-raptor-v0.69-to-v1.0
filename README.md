# JSON Schema Converter

Convert Raptor v0.69 JSON files to ZIP (Markdown) or Raptor v1.0 JSON format.

## Features

- **Raptor v0.69 → ZIP**: Converts HTML documents to Markdown files in a ZIP archive
- **Raptor v0.69 → Raptor v1.0**: Converts to BlockNote JSON format with word counts
- **Web UI**: Drag-and-drop interface with WCAG AAA accessibility
- **CLI Scripts**: Python scripts for command-line conversion

## Quick Start

### Web Interface

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 and drag your JSON file to convert.

### Command Line

**Convert to ZIP:**
```bash
python scripts/schema1_to_zip.py input.json output.zip
```

**Convert to Schema 2:**
```bash
python scripts/schema1_to_schema2.py input.json output.json
```

## Project Structure

```
├── scripts/
│   ├── schema1_to_zip.py      # CLI: Schema 1 → ZIP
│   └── schema1_to_schema2.py  # CLI: Schema 1 → Schema 2
├── web/                        # Next.js web application
│   ├── app/                    # Page components
│   └── lib/converters/         # TypeScript conversion logic
├── in/                         # Input files (gitignored)
└── out/                        # Output files (gitignored)
```

## Requirements

- **Python scripts**: Python 3.8+
- **Web app**: Node.js 18+

## License

MIT License - see [LICENSE](LICENSE)
