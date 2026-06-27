export const StorageKey = Symbol("Storage");

export interface UploadOptions {
	contentType?: string;
}

export interface IStorage {
	/** Upload file — trả về storage key (không phải URL) */
	upload(key: string, data: Buffer, options?: UploadOptions): Promise<string>;

	/** Đọc file theo key — trả null nếu không tồn tại */
	get(key: string): Promise<Buffer | null>;

	/** Xoá file theo key */
	delete(key: string): Promise<void>;

	/** Kiểm tra file tồn tại */
	exists(key: string): Promise<boolean>;

	/** Tính URL công khai từ key */
	getUrl(key: string): string;

	getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
