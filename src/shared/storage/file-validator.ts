/**
 * File Validation Utilities with Magic Bytes Detection
 * SECURITY: Prevents file upload attacks by validating actual file content,
 * not just MIME type which can be spoofed.
 */

/**
 * Magic bytes (file signatures) for common file types
 * First few bytes that uniquely identify file formats
 */
const FILE_SIGNATURES: Record<
	string,
	{ signature: number[][]; mimeTypes: string[] }
> = {
	// Images
	jpeg: {
		signature: [
			[0xff, 0xd8, 0xff, 0xe0], // JPEG JFIF
			[0xff, 0xd8, 0xff, 0xe1], // JPEG Exif
			[0xff, 0xd8, 0xff, 0xe2], // JPEG EXIF
			[0xff, 0xd8, 0xff, 0xe3], // JPEG
			[0xff, 0xd8, 0xff, 0xe8], // JPEG
		],
		mimeTypes: ["image/jpeg", "image/jpg"],
	},
	png: {
		signature: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
		mimeTypes: ["image/png"],
	},
	gif: {
		signature: [
			[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
			[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
		],
		mimeTypes: ["image/gif"],
	},
	webp: {
		signature: [
			[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], // RIFF....WEBP (null = any byte)
		],
		mimeTypes: ["image/webp"],
	},
	bmp: {
		signature: [[0x42, 0x4d]], // BM
		mimeTypes: ["image/bmp", "image/x-ms-bmp"],
	},

	// Videos
	mp4: {
		signature: [
			[null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], // ....ftypisom
			[null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32], // ....ftypmp42
			[null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x53, 0x4e, 0x56], // ....ftypMSNV
		],
		mimeTypes: ["video/mp4"],
	},
	mov: {
		signature: [
			[null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], // ....ftypqt
		],
		mimeTypes: ["video/quicktime"],
	},
	avi: {
		signature: [
			[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x56, 0x49, 0x20],
		], // RIFF....AVI
		mimeTypes: ["video/x-msvideo", "video/avi"],
	},

	// Documents
	pdf: {
		signature: [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
		mimeTypes: ["application/pdf"],
	},
	doc: {
		signature: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // MS Office old format
		mimeTypes: ["application/msword"],
	},
	docx: {
		signature: [[0x50, 0x4b, 0x03, 0x04]], // ZIP-based (DOCX, XLSX, PPTX)
		mimeTypes: [
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		],
	},

	// Archives
	zip: {
		signature: [
			[0x50, 0x4b, 0x03, 0x04], // Standard ZIP
			[0x50, 0x4b, 0x05, 0x06], // Empty ZIP
			[0x50, 0x4b, 0x07, 0x08], // Spanned ZIP
		],
		mimeTypes: ["application/zip"],
	},
};

/**
 * Read first N bytes from a File object
 */
async function readFileHeader(
	file: File,
	bytesToRead: number = 16,
): Promise<Uint8Array> {
	const slice = file.slice(0, bytesToRead);
	const arrayBuffer = await slice.arrayBuffer();
	return new Uint8Array(arrayBuffer);
}

/**
 * Check if file header matches a signature
 * @param header - File header bytes
 * @param signature - Expected signature (null = wildcard byte)
 */
function matchesSignature(
	header: Uint8Array,
	signature: (number | null)[],
): boolean {
	if (header.length < signature.length) {
		return false;
	}

	for (let i = 0; i < signature.length; i++) {
		// null in signature means "any byte" (wildcard)
		if (signature[i] !== null && header[i] !== signature[i]) {
			return false;
		}
	}

	return true;
}

/**
 * Detect file type from magic bytes
 * @returns Detected MIME type or null if unknown
 */
export async function detectFileType(file: File): Promise<string | null> {
	const header = await readFileHeader(file, 16);

	// Check each known file type
	for (const [, { signature: signatures, mimeTypes }] of Object.entries(
		FILE_SIGNATURES,
	)) {
		for (const sig of signatures) {
			if (matchesSignature(header, sig)) {
				return mimeTypes[0]; // Return primary MIME type
			}
		}
	}

	return null; // Unknown file type
}

/**
 * Validate file type matches declared MIME type
 * SECURITY: Prevents MIME type spoofing attacks
 */
export async function validateFileMimeType(file: File): Promise<{
	valid: boolean;
	detectedType: string | null;
	declaredType: string;
	message?: string;
}> {
	const declaredType = file.type;
	const detectedType = await detectFileType(file);

	// If we can't detect the type, we can't validate
	if (!detectedType) {
		return {
			valid: false,
			detectedType: null,
			declaredType,
			message: `Unable to validate file type. File signature not recognized.`,
		};
	}

	// Check if detected type matches any allowed MIME type for this signature
	const fileTypeEntry = Object.entries(FILE_SIGNATURES).find(
		([_, { mimeTypes }]) => mimeTypes.includes(detectedType),
	);

	if (!fileTypeEntry) {
		return {
			valid: false,
			detectedType,
			declaredType,
			message: `File validation error: internal configuration issue`,
		};
	}

	const [, { mimeTypes: allowedMimeTypes }] = fileTypeEntry;

	// Check if declared type is in the allowed list for this file type
	const valid = allowedMimeTypes.includes(declaredType);

	if (!valid) {
		return {
			valid: false,
			detectedType,
			declaredType,
			message: `File type mismatch: file appears to be ${detectedType} but declared as ${declaredType}. This may indicate a malicious file.`,
		};
	}

	return {
		valid: true,
		detectedType,
		declaredType,
	};
}

/**
 * Validate file against configuration with magic bytes check
 * SECURITY: Enhanced validation with content inspection
 */
export async function validateFileWithMagicBytes(
	file: File,
	config: {
		maxFileSize: number;
		allowedFileTypes: string[];
	},
): Promise<{ valid: boolean; error?: string }> {
	// 1. Check file size
	if (file.size > config.maxFileSize) {
		return {
			valid: false,
			error: `File size ${file.size} bytes exceeds maximum limit of ${config.maxFileSize} bytes`,
		};
	}

	// 2. Check empty file
	if (file.size === 0) {
		return {
			valid: false,
			error: "File is empty",
		};
	}

	// 3. Check declared MIME type is in allowed list
	if (!config.allowedFileTypes.includes(file.type)) {
		return {
			valid: false,
			error: `File type ${file.type} is not allowed. Allowed types: ${config.allowedFileTypes.join(", ")}`,
		};
	}

	// 4. SECURITY: Validate actual file content matches declared MIME type
	const validation = await validateFileMimeType(file);

	if (!validation.valid) {
		return {
			valid: false,
			error: validation.message || "File validation failed",
		};
	}

	// 5. Additional check: ensure detected type is also in allowed list
	if (
		validation.detectedType &&
		!config.allowedFileTypes.includes(validation.detectedType)
	) {
		return {
			valid: false,
			error: `Detected file type ${validation.detectedType} is not in allowed types`,
		};
	}

	return { valid: true };
}

/**
 * Check if file is potentially dangerous
 * @returns true if file is suspicious
 */
export async function isSuspiciousFile(file: File): Promise<boolean> {
	// Check for dangerous extensions in filename
	const dangerousExtensions = [
		".exe",
		".bat",
		".cmd",
		".com",
		".pif",
		".scr",
		".vbs",
		".js",
		".jar",
		".msi",
		".app",
		".deb",
		".rpm",
		".sh",
		".ps1",
	];

	const filename = file.name.toLowerCase();
	const hasDangerousExtension = dangerousExtensions.some((ext) =>
		filename.endsWith(ext),
	);

	if (hasDangerousExtension) {
		return true;
	}

	// Check for executable magic bytes
	const header = await readFileHeader(file, 8);

	// Windows executables
	if (header[0] === 0x4d && header[1] === 0x5a) {
		// MZ (DOS/Windows executable)
		return true;
	}

	// ELF executable (Linux)
	if (
		header[0] === 0x7f &&
		header[1] === 0x45 &&
		header[2] === 0x4c &&
		header[3] === 0x46
	) {
		return true;
	}

	// Mach-O executable (macOS)
	if (
		(header[0] === 0xfe &&
			header[1] === 0xed &&
			header[2] === 0xfa &&
			header[3] === 0xce) ||
		(header[0] === 0xce &&
			header[1] === 0xfa &&
			header[2] === 0xed &&
			header[3] === 0xfe)
	) {
		return true;
	}

	return false;
}
