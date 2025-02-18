# Manual IIIF Structure Guide

This guide explains how to create IIIF collections by manually organizing directories, as an alternative to using the CSV method.

## Directory Structure Rules

### Basic Rules
- A collection is a folder with sub-folders that don't start with underscore
- A manifest is a folder with sub-folders that do start with underscore
- Canvas folders must start with underscore (e.g., `_canvas1`)

### Example Structure
```
my-collection/                     // collection
├── info.yml                      // collection metadata
├── thumb.jpg                     // collection thumbnail
├── photographs/                  // manifest
|   ├── _photo1                   // canvas
|   |   ├── image.jpg            // content
|   |   └── info.yml             // metadata
|   ├── _photo2                   // canvas
|   |   ├── image.jpg            // content
|   |   └── info.yml             // metadata
|   ├── info.yml                 // manifest metadata
|   └── thumb.jpg                // manifest thumbnail
└── documents/                    // manifest
    ├── _page1                    // canvas
    ├── _page2                    // canvas
    ├── info.yml                 // manifest metadata
    └── thumb.jpg                // manifest thumbnail
```

## Metadata Files (info.yml)

You can add metadata at any level using `info.yml` files:

```yml
label: My Collection
description: A wonderful collection
attribution: My Institution
metadata:
  Author: John Smith
  Date: 2024-02-17
  Rights: CC-BY
```

### Available Fields
- **label**: Title or name (required)
- **description**: Detailed description
- **attribution**: Credit line
- **metadata**: Custom key-value pairs
- **behavior**: Viewing hints (e.g., "paged", "continuous")

## Files and Annotations

### Supported File Types
- Images: jpg, jpeg, png, tiff
- Audio: mp3, wav
- Video: mp4
- 3D: obj, gltf
- Documents: pdf

### Automatic Annotations
- Files in canvas folders are automatically annotated with "painting" motivation
- Images get IIIF image service annotations for deep zoom
- Technical metadata (dimensions, duration) is extracted automatically

### Custom Annotations
Create a YAML file (e.g., `my-annotation.yml`) in the canvas directory:

```yml
motivation: commenting
value: This is my comment on the image
```

## Thumbnails

- Add `thumb.jpg` to any folder for a custom thumbnail
- For canvases without thumbnails, one is generated from the first image
- Any image format works (jpg, png, etc.)

## Linked Manifests

Include external manifests using `manifests.yml` in a collection folder:

```yml
manifests:
  - id: http://example.com/collection/manifest1/index.json
    label: External Manifest 1
    thumbnail: http://example.com/collection/manifest1/thumb.jpg
  - id: http://example.com/collection/manifest2/index.json
    label: External Manifest 2
```

## Building the Collection

Once your directories are organized:

```bash
npx biiif my-collection https://your-website.com/iiif
```

This generates:
- IIIF collection/manifest files
- Image tiles for deep zoom
- Thumbnails
- All required JSON files

## Tips

- Use `!` prefix to exclude folders (e.g., `!temp`)
- Avoid ":" in metadata values (breaks YAML)
- Test with small collections first
- Check generated files in a IIIF viewer

## Examples

- [Example Collections](https://github.com/edsilv/biiif-test-manifests)
- [3D Objects](https://github.com/edsilv/iiif-3d-manifests)
