# Guide to Building a IIIF Manifest Generator

## Introduction

This guide will help you build a feature-complete IIIF manifest generator for images and audio content. A IIIF manifest is a JSON-LD document that describes the structure and properties of a digital object, enabling interoperable presentation across different IIIF-compatible viewers.

## Required Information

To generate a valid IIIF manifest, you'll need the following information:

### For All Manifests

- Unique identifier (URI) for the manifest
- Label/title for the object
- Rights/attribution information
- Provider information
- Language information for text fields
- Dimensions (width/height) for images, duration for audio
- Server capabilities (supported image operations, formats, etc.)

### For Images

- Source image file locations
- Image dimensions
- Image service information (if using IIIF Image API)
- Thumbnail information
- Viewing hints/behaviors (paged, continuous, etc.)

### For Audio

- Source audio file locations
- Duration information
- Supported formats
- Playback behaviors
- Accompanying visuals (if any)

## Key Components of a Manifest

### 1. Basic Structure

Every manifest must include:

```json
{
  "@context": "http://iiif.io/api/presentation/3/context.json",
  "id": "[Manifest URI]",
  "type": "Manifest",
  "label": {
    "[language-code]": ["Title"]
  }
}
```

### 2. Descriptive Metadata

```json
{
  "metadata": [
    {
      "label": { "en": ["Creator"] },
      "value": { "en": ["Artist Name"] }
    }
  ],
  "summary": { "en": ["Brief description"] },
  "requiredStatement": {
    "label": { "en": ["Attribution"] },
    "value": { "en": ["Provided by [Institution]"] }
  },
  "rights": "http://rightsstatements.org/vocab/InC/1.0/"
}
```

### 3. Items (Canvases)

```json
{
  "items": [
    {
      "id": "[Canvas URI]",
      "type": "Canvas",
      "height": 1000,
      "width": 1000,
      "items": [
        {
          "id": "[Annotation Page URI]",
          "type": "AnnotationPage",
          "items": [
            {
              "id": "[Annotation URI]",
              "type": "Annotation",
              "motivation": "painting",
              "body": {
                // Image or Audio resource here
              },
              "target": "[Canvas URI]"
            }
          ]
        }
      ]
    }
  ]
}
```

## Implementation Steps

1. **Create Base Structure**

   - Set up the basic manifest skeleton with required fields
   - Implement proper URI generation for all resources
   - Handle language map creation for text fields

2. **Handle Image Resources**

   ```python
   def create_image_resource(image_info):
       return {
           "id": image_info['url'],
           "type": "Image",
           "format": "image/jpeg",
           "width": image_info['width'],
           "height": image_info['height'],
           "service": [{
               "id": image_info['service_url'],
               "type": "ImageService3",
               "profile": "level1"
           }]
       }
   ```

3. **Handle Audio Resources**

   ```python
   def create_audio_resource(audio_info):
       return {
           "id": audio_info['url'],
           "type": "Sound",
           "format": "audio/mp4",
           "duration": audio_info['duration']
       }
   ```

4. **Create Canvases**

   ```python
   def create_canvas(resource_info, canvas_id):
       canvas = {
           "id": canvas_id,
           "type": "Canvas",
           "height": resource_info.get('height', 1),
           "width": resource_info.get('width', 1)
       }

       if 'duration' in resource_info:
           canvas['duration'] = resource_info['duration']

       return canvas
   ```

5. **Generate Annotations**
   ```python
   def create_painting_annotation(resource, target_canvas_id):
       return {
           "id": f"{target_canvas_id}/annotation/1",
           "type": "Annotation",
           "motivation": "painting",
           "body": resource,
           "target": target_canvas_id
       }
   ```

## Special Considerations

### For Images

1. **Image Service Support**

   - Implement IIIF Image API service references
   - Include thumbnail generations
   - Handle different quality levels and formats

2. **Viewing Hints**
   - Support paged viewing for books
   - Support continuous viewing for scrolls
   - Handle right-to-left and other reading directions

### For Audio

1. **Time-based Media**

   - Properly set canvas duration
   - Handle accompanying images if present
   - Support time-based navigation

2. **Playback Behaviors**
   - Implement auto-advance features
   - Handle repeat behaviors
   - Support playlists via ranges

## Example Full Implementation

```python
class IIIFManifestGenerator:
    def __init__(self, base_url):
        self.base_url = base_url

    def create_manifest(self, resource_info):
        manifest = {
            "@context": "http://iiif.io/api/presentation/3/context.json",
            "id": f"{self.base_url}/manifest/{resource_info['id']}",
            "type": "Manifest",
            "label": self.create_language_map(resource_info['label']),
            "items": []
        }

        # Add metadata
        manifest.update(self.create_descriptive_metadata(resource_info))

        # Create canvases
        for idx, resource in enumerate(resource_info['resources']):
            canvas = self.create_canvas(resource, idx)
            manifest['items'].append(canvas)

        return manifest

    def create_language_map(self, text, lang="en"):
        return {lang: [text]}

    def create_descriptive_metadata(self, info):
        return {
            "metadata": [
                {
                    "label": self.create_language_map("Creator"),
                    "value": self.create_language_map(info.get('creator', 'Unknown'))
                }
            ],
            "requiredStatement": {
                "label": self.create_language_map("Attribution"),
                "value": self.create_language_map(info['attribution'])
            },
            "rights": info.get('rights', "http://rightsstatements.org/vocab/InC/1.0/")
        }

    def create_canvas(self, resource, index):
        canvas_id = f"{self.base_url}/canvas/{index}"
        canvas = {
            "id": canvas_id,
            "type": "Canvas",
            "height": resource.get('height', 1),
            "width": resource.get('width', 1),
            "items": [
                {
                    "id": f"{canvas_id}/page",
                    "type": "AnnotationPage",
                    "items": [
                        self.create_painting_annotation(
                            self.create_resource(resource),
                            canvas_id
                        )
                    ]
                }
            ]
        }

        if 'duration' in resource:
            canvas['duration'] = resource['duration']

        return canvas

    def create_resource(self, resource_info):
        if resource_info['type'] == 'image':
            return self.create_image_resource(resource_info)
        elif resource_info['type'] == 'audio':
            return self.create_audio_resource(resource_info)
        else:
            raise ValueError(f"Unsupported resource type: {resource_info['type']}")
```

## Usage Example

```python
generator = IIIFManifestGenerator("https://example.org/iiif")

manifest_info = {
    "id": "book1",
    "label": "Example Book",
    "attribution": "Provided by Example Organization",
    "creator": "John Smith",
    "resources": [
        {
            "type": "image",
            "url": "https://example.org/image1.jpg",
            "height": 2000,
            "width": 1500,
            "service_url": "https://example.org/iiif/image1"
        },
        {
            "type": "audio",
            "url": "https://example.org/audio1.mp4",
            "duration": 180.5
        }
    ]
}

manifest = generator.create_manifest(manifest_info)
```

## Testing and Validation

1. Use the IIIF Presentation Validator
2. Test with multiple IIIF viewers (Mirador, Universal Viewer)
3. Validate JSON-LD structure
4. Check language map implementations
5. Verify URI patterns are consistent
6. Test with different resource types
7. Validate service references

## Common Pitfalls

1. Forgetting required fields
2. Incorrect language map implementation
3. Invalid URI patterns
4. Missing context information
5. Incorrect service references
6. Improper canvas sizing
7. Missing thumbnail information

Remember that IIIF manifests are designed to be interoperable, so following the specification precisely is important for compatibility with different viewers and tools.
