# BIIIF CSV Tool: Create IIIF Collections from Spreadsheets 📊

A user-friendly tool for creating [IIIF](https://iiif.io) collections using spreadsheets. Perfect for libraries, archives, and museums wanting to make their digital collections accessible.

## What is IIIF?

The International Image Interoperability Framework (IIIF) is a set of standards that makes it easy to share and display digital images, audio, and video online. This tool helps you create IIIF collections without needing to understand all the technical details.

## Quick Start

**Install the Tools**
   ```bash
   # Install Node.js if you haven't already
   # Download from: https://nodejs.org/

   # Create a project directory
   mkdir my-iiif-project
   cd my-iiif-project

   # Install the tools
   npm install biiif
   npm install typescript ts-node @types/node
   ```

## Creating Your Collection

### 1. Prepare Your Spreadsheet

Create a CSV file (you can use Excel and save as CSV) with these columns:

```csv
hierarchy,label,description,attribution
root,My Collection,A wonderful collection,My Institution
root/photos,Photographs,Collection of photos,My Institution
root/photos/manifest1,First Album,Photo album from 2024,My Institution
root/photos/manifest1/canvas1,First Photo,Beautiful landscape,My Institution
```

#### Important Nesting Rules:
- Collections can contain other collections or manifests
- Manifests can only contain canvases
- Canvases must be inside manifests
- The tool will warn you if you break these rules

Example valid structure:
```
root/ (Collection)
├── photos/ (Collection)
│   └── manifest1/ (Manifest)
│       ├── canvas1
│       └── canvas2
└── audio/ (Collection)
    └── manifest2/ (Manifest)
        └── canvas1
```

### 2. Prepare Your Files

Organize your files (images, audio, etc.) in a directory. The tool will automatically match files to canvases based on numbers in the filenames.

**For Images:**
```
BHC001_01.jpg  -> matches canvas1
photo_02.jpg   -> matches canvas2
```

**For Audio:**
```
part01.mp3     -> matches canvas1
Part02.mp3     -> matches canvas2
```

### 3. Run the Conversion

```bash
ts-node csv-to-biiif.ts metadata.csv output-dir input-files
```

This will:
- Create the IIIF directory structure
- Copy files to the right locations
- Extract metadata (dimensions, duration)
- Create info.yml files
- Validate the nesting structure

### 4. Generate IIIF Collection

```bash
npx biiif output-dir https://your-website.com/iiif
```

This creates the final IIIF collection that you can serve from your website.

## Metadata Options

Your CSV can include these columns:

```csv
hierarchy,label,description,attribution,behavior,metadata.Author,metadata.Date
```

Common fields:
- **hierarchy**: Required. Defines the structure (e.g., "root/photos/manifest1/canvas1")
- **label**: Required. Title or name
- **description**: Optional. Detailed description
- **attribution**: Optional. Credit line
- **behavior**: Optional. Viewing hints (e.g., "paged", "continuous")
- **metadata.*****: Optional. Custom metadata fields (e.g., metadata.Author, metadata.Date)

## Features

### Automatic Metadata Extraction
- Images: Width and height are extracted automatically
- Audio: Duration is extracted automatically
- These values are added to the info.yml files

### File Matching Rules
The tool matches files to canvases using these patterns:
- Images: Looks for numbers at the end of filenames (e.g., "photo_01.jpg")
- Audio: Looks for "part" followed by numbers (e.g., "part01.mp3")

### Validation
The tool validates your structure and warns about:
- Canvases outside of manifests
- Manifests inside other manifests
- Missing required fields

## Alternative: Manual Directory Structure

While the CSV method is recommended, you can also create collections by manually organizing directories. See the [Manual Structure Guide](manual-structure.md) for details.

## Need Help?

- Check our [sample spreadsheet](sample-metadata.csv) for a complete example
- Look at [test-metadata.csv](test-metadata.csv) for a real-world example
- Open an issue on GitHub if you have questions

## License

MIT License - feel free to use this tool for your projects!
