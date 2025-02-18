import { parse } from 'csv-parse/sync';
import { readFileSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { dump } from 'js-yaml';
import { promise as glob } from 'glob-promise';
import sharp from 'sharp';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import {
    normaliseFilePath,
    warn
} from './Utils';

interface CSVRow {
    hierarchy: string;
    label: string;
    description?: string;
    attribution?: string;
    behavior?: string;
    width?: number;
    height?: number;
    duration?: number;
    viewingHint?: string;
    viewingDirection?: string;
    navDate?: string;
    [key: string]: any; // For dynamic metadata fields
}

/**
 * Converts a CSV file to a biiif directory structure
 * @param csvPath Path to the CSV file
 * @param outputDir Path to the output directory
 */
export async function csvToHierarchy(csvPath: string, outputDir: string, inputDir?: string): Promise<void> {
    // Read and parse the CSV file
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    }) as CSVRow[];

    // If input directory is provided, scan it for files
    const fileMap = new Map<string, string[]>();
    if (inputDir) {
        await scanInputDirectory(inputDir, fileMap);
    }

    // Create the directory structure and populate info.yml files
    for (const record of records) {
        await processRecord(record, outputDir, inputDir, fileMap);
    }
}

/**
 * Scans the input directory recursively and maps files to their parent directories
 * @param inputDir The input directory to scan
 * @param fileMap Map to store directory -> files mapping
 */
async function scanInputDirectory(inputDir: string, fileMap: Map<string, string[]>): Promise<void> {
    const entries = await glob(inputDir + '/**/*', {
        ignore: ['**/*.yml', '**/thumb.*'],
        nodir: true
    });

    for (const entry of entries) {
        const normalizedPath = normaliseFilePath(entry);
        const dirName = dirname(normalizedPath);
        if (!fileMap.has(dirName)) {
            fileMap.set(dirName, []);
        }
        fileMap.get(dirName)!.push(normalizedPath);
    }
}

/**
 * Processes a single record from the CSV and creates the corresponding directory and info.yml
 * @param record The CSV record to process
 * @param outputDir The base output directory
 */
async function processRecord(
    record: CSVRow,
    outputDir: string,
    inputDir?: string,
    fileMap?: Map<string, string[]>
): Promise<void> {
    // Get the full path for this record
    const parts = record.hierarchy.split('/');
    
    // Determine the type of resource
    const lastPart = parts[parts.length - 1];
    const isCanvas = lastPart.startsWith('canvas');
    const isManifest = lastPart.includes('manifest');
    
    // If it's a canvas, prefix with underscore
    if (isCanvas) {
        parts[parts.length - 1] = '_' + lastPart;
    }
    
    // Validate nesting rules
    const parentPart = parts.length > 1 ? parts[parts.length - 2] : null;
    if (isCanvas && parentPart && !parentPart.includes('manifest')) {
        warn(`Warning: Canvas ${lastPart} must be inside a manifest. Current parent: ${parentPart}`);
    }
    if (isManifest && parentPart && parentPart.includes('manifest')) {
        warn(`Warning: Manifest ${lastPart} cannot be inside another manifest. Current parent: ${parentPart}`);
    }
    
    const fullPath = join(outputDir, ...parts);

    // Create the directory
    mkdirSync(fullPath, { recursive: true });

    // If we have an input directory and this is a canvas
    if (inputDir && fileMap && isCanvas) {
    // Get the canvas number from the hierarchy
    const canvasNum = parts[parts.length - 1].replace(/[_canvas]+/, '');
    const canvasIndex = parseInt(canvasNum);
    
    // Determine if this is an image or audio canvas based on the parent directory
    const isAudio = parts[parts.length - 2] === 'audio';
    
    // Find matching files in the input directory
    const files = Array.from(fileMap.values()).flat();
    console.log('\nLooking for files for:', parts[parts.length - 1]);
    console.log('Canvas index:', canvasIndex);
    console.log('Is audio:', isAudio);
    console.log('Available files:', files.map(f => basename(f)));
    
    const matchingFiles = files.filter(file => {
        const ext = extname(file).toLowerCase();
        const fileName = basename(file);
        
        if (isAudio) {
            // Match audio files (Part01.mp3, part02.mp3, Part09-1.mp3, etc.)
            if (ext === '.mp3') {
                const fileNameLower = fileName.toLowerCase();
                console.log('Checking audio file:', fileName, 'for canvas', canvasIndex);
                
                // Convert the file number to a number for comparison
                const match = fileNameLower.match(/part(\d+)(?:-\d+)?\.mp3$/);
                if (match) {
                    const fileNum = parseInt(match[1]);
                    return fileNum === canvasIndex;
                }
            }
            return false;
        } else {
            // Match image files (BHC001_BW_NAGESH_AF_01.JPG, BHC001_BW_NAGESH_AF_010.JPG, etc.)
            if (['.jpg', '.jpeg'].includes(ext)) {
                const fileNameLower = fileName.toLowerCase();
                console.log('Checking image file:', fileName, 'for canvas', canvasIndex);
                
                // Extract the number from the filename
                const match = fileNameLower.match(/_(\d+)\.[^.]+$/);
                if (match) {
                    const fileNum = parseInt(match[1]);
                    return fileNum === canvasIndex;
                }
            }
            return false;
        }
    });

    // Copy matching files to canvas directory
    for (const file of matchingFiles) {
        const fileName = basename(file);
        const destPath = join(fullPath, fileName);
        copyFileSync(file, destPath);

        // Extract and add file metadata to record
        await addFileMetadata(file, record);
        console.log(`Copied ${fileName} to ${destPath}`);
    }

    if (matchingFiles.length === 0) {
        console.warn(`No matching files found for canvas ${parts[parts.length - 1]}`);
    } else {
        console.log('Found matching files:', matchingFiles.map(f => basename(f)));
    }
    }

    // Create the info.yml content with potentially updated metadata
    const infoContent = createInfoYml(record);

    // Write the info.yml file
    const infoPath = join(fullPath, 'info.yml');
    writeFileSync(infoPath, infoContent);
}

/**
 * Creates the content for an info.yml file from a CSV record
 * @param record The CSV record to convert to YAML
 * @returns The YAML content as a string
 */
async function addFileMetadata(filePath: string, record: CSVRow): Promise<void> {
    const ext = extname(filePath).toLowerCase();
    
    // Handle images
    if (['.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)) {
        try {
            const metadata = await sharp(filePath).metadata();
            if (!record.width) record.width = metadata.width;
            if (!record.height) record.height = metadata.height;
        } catch (error) {
            warn(`Could not extract dimensions from image: ${filePath}`);
        }
    }
    
    // Handle audio/video
    else if (['.mp3', '.mp4', '.wav', '.m4a'].includes(ext)) {
        try {
            const info = await ffprobe(filePath, { path: ffprobeStatic.path });
            if (info && info.streams && info.streams.length) {
                const duration = Number(info.streams[0].duration);
                if (!record.duration) record.duration = duration;
            }
        } catch (error) {
            warn(`Could not extract duration from media file: ${filePath}`);
        }
    }
}

function createInfoYml(record: CSVRow): string {
    const info: any = {};

    // Add basic fields
    if (record.label) info.label = record.label;
    if (record.description) info.description = record.description;
    if (record.attribution) info.attribution = record.attribution;
    if (record.behavior) {
        info.behavior = record.behavior.includes(',') 
            ? record.behavior.split(',').map(b => b.trim())
            : record.behavior;
    }

    // Add technical fields
    if (record.width) info.width = parseInt(record.width.toString());
    if (record.height) info.height = parseInt(record.height.toString());
    if (record.duration) info.duration = parseFloat(record.duration.toString());
    if (record.viewingHint) info.viewingHint = record.viewingHint;
    if (record.viewingDirection) info.viewingDirection = record.viewingDirection;
    if (record.navDate) info.navDate = record.navDate;

    // Add metadata fields
    const metadata: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(record)) {
        if (key.startsWith('metadata.') && value) {
            const metadataKey = key.replace('metadata.', '');
            metadata[metadataKey] = value;
        }
    }
    if (Object.keys(metadata).length > 0) {
        info.metadata = metadata;
    }

    // Add required statement
    if (record['requiredStatement.label'] && record['requiredStatement.value']) {
        info.requiredStatement = {
            label: record['requiredStatement.label'],
            value: record['requiredStatement.value']
        };
    }

    // Add summary
    if (record.summary) {
        info.summary = record.summary;
    }

    // Add provider
    if (record['provider.id'] && record['provider.type'] && record['provider.label']) {
        info.provider = {
            id: record['provider.id'],
            type: record['provider.type'],
            label: record['provider.label']
        };
    }

    // Add homepage
    if (record['homepage.id'] && record['homepage.type'] && record['homepage.label']) {
        info.homepage = {
            id: record['homepage.id'],
            type: record['homepage.type'],
            label: record['homepage.label']
        };
    }

    // Add seeAlso
    if (record['seeAlso.id'] && record['seeAlso.type'] && record['seeAlso.label']) {
        info.seeAlso = {
            id: record['seeAlso.id'],
            type: record['seeAlso.type'],
            label: record['seeAlso.label']
        };
    }

    // Add rendering
    if (record['rendering.id'] && record['rendering.type'] && record['rendering.label']) {
        info.rendering = {
            id: record['rendering.id'],
            type: record['rendering.type'],
            label: record['rendering.label']
        };
    }

    // Add start
    if (record['start.id'] && record['start.type'] && record['start.label']) {
        info.start = {
            id: record['start.id'],
            type: record['start.type'],
            label: record['start.label']
        };
    }

    // Add supplementary
    if (record['supplementary.id'] && record['supplementary.type'] && record['supplementary.label']) {
        info.supplementary = {
            id: record['supplementary.id'],
            type: record['supplementary.type'],
            label: record['supplementary.label']
        };
    }

    // Add services
    if (record['services.id'] && record['services.type'] && record['services.profile']) {
        info.services = {
            id: record['services.id'],
            type: record['services.type'],
            profile: record['services.profile']
        };
    }

    return dump(info);
}

// Main function to handle command line arguments
async function main() {
    const [,, csvPath, outputDir, inputDir] = process.argv;
    
    if (!csvPath || !outputDir) {
        console.error('Usage: ts-node csv-to-biiif.ts <csv-file> <output-directory> [input-directory]');
        console.error('');
        console.error('Arguments:');
        console.error('  csv-file         Path to the CSV file containing collection metadata');
        console.error('  output-directory Where to create the BIIIF directory structure');
        console.error('  input-directory  Optional. Directory containing the files to include');
        console.error('');
        console.error('Example:');
        console.error('  ts-node csv-to-biiif.ts metadata.csv output-dir input-files');
        process.exit(1);
    }

    try {
        console.log('Starting conversion...');
        console.log('CSV Path:', csvPath);
        console.log('Output Directory:', outputDir);
        console.log('Input Directory:', inputDir || 'Not provided');
        
        if (inputDir) {
            console.log('Checking input directory exists...');
            if (!existsSync(inputDir)) {
                throw new Error(`Input directory does not exist: ${inputDir}`);
            }
        }
        
        console.log('Checking CSV file exists...');
        if (!existsSync(csvPath)) {
            throw new Error(`CSV file does not exist: ${csvPath}`);
        }

        await csvToHierarchy(csvPath, outputDir, inputDir);
        console.log(`Successfully created BIIIF directory structure in ${outputDir}`);
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the main function
main();
