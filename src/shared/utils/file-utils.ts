/**
 * File Type Utilities
 * Centralized helpers for detecting file types from URLs or file keys
 */

/**
 * Image file extensions supported for image processing (e.g., TinEye)
 */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'] as const;

/**
 * PDF file extension
 */
export const PDF_EXTENSION = '.pdf';

/**
 * Video file extensions
 */
export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'] as const;

/**
 * Check if a file key/path points to an image file
 * @param fileKeyOrPath - File key or path to check
 * @returns true if file is an image
 */
export function isImageFile(fileKeyOrPath: string): boolean {
	const lowerPath = fileKeyOrPath.toLowerCase().split('?')[0]; // Remove query params
	return IMAGE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Check if a file key/path points to a PDF file
 * @param fileKeyOrPath - File key or path to check
 * @returns true if file is a PDF
 */
export function isPdfFile(fileKeyOrPath: string): boolean {
	const lowerPath = fileKeyOrPath.toLowerCase().split('?')[0]; // Remove query params
	return lowerPath.endsWith(PDF_EXTENSION);
}

/**
 * Check if a URL points to a PDF file (includes S3 signed URL detection)
 * @param url - URL to check
 * @returns true if URL points to a PDF
 */
export function isPdfUrl(url: string): boolean {
	// Check URL path extension
	const urlPath = url.split('?')[0].toLowerCase();
	if (urlPath.endsWith(PDF_EXTENSION)) {
		return true;
	}
	// Check for common S3 signed URL patterns with content-type
	const lowerUrl = url.toLowerCase();
	if (lowerUrl.includes('content-type=application%2fpdf') ||
		lowerUrl.includes('content-type=application/pdf')) {
		return true;
	}
	return false;
}

/**
 * Check if a file key/path points to a video file
 * @param fileKeyOrPath - File key or path to check
 * @returns true if file is a video
 */
export function isVideoFile(fileKeyOrPath: string): boolean {
	const lowerPath = fileKeyOrPath.toLowerCase().split('?')[0]; // Remove query params
	return VIDEO_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Get the file type category from a file key/path
 * @param fileKeyOrPath - File key or path to check
 * @returns 'image' | 'pdf' | 'video' | 'unknown'
 */
export function getFileType(fileKeyOrPath: string): 'image' | 'pdf' | 'video' | 'unknown' {
	if (isImageFile(fileKeyOrPath)) return 'image';
	if (isPdfFile(fileKeyOrPath)) return 'pdf';
	if (isVideoFile(fileKeyOrPath)) return 'video';
	return 'unknown';
}

/**
 * Check if file type supports TinEye reverse image search
 * TinEye only supports image files
 * @param fileKeyOrPath - File key or path to check
 * @returns true if TinEye can process this file
 */
export function supportsTinEye(fileKeyOrPath: string): boolean {
	return isImageFile(fileKeyOrPath);
}

/**
 * Check if file type supports OpenAI Vision analysis
 * OpenAI Vision supports images and PDFs
 * @param fileKeyOrPath - File key or path to check
 * @returns true if OpenAI Vision can process this file
 */
export function supportsVisionAnalysis(fileKeyOrPath: string): boolean {
	return isImageFile(fileKeyOrPath) || isPdfFile(fileKeyOrPath);
}
