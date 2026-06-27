import {
	mkdirSync,
	existsSync,
	writeFileSync,
	readFileSync,
	rmSync,
	lstatSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { Logger } from "@shared/logger";
import type { IStorage, UploadOptions } from "../base";
import { storageConfig } from "@/shared/config/storage";

export class LocalStorage implements IStorage {
	private readonly _dir: string;
	private readonly _baseUrl: string;
	private readonly _secret: string;

	constructor(dir: string, baseUrl: string, secret: string) {
		this._dir = dir;
		this._baseUrl = baseUrl;
		this._secret = secret;
		mkdirSync(dir, { recursive: true });
	}

	async getSignedUrl(key: string, expiresIn?: number): Promise<string> {
		const ttl = expiresIn ?? storageConfig.local.defaultStorageExpries;

		const expires = Math.floor(Date.now() / 1000) + ttl;
		const signature = this._sign(key, expires);

		const url = new URL(this.getUrl(key));
		url.searchParams.set("expires", String(expires));
		url.searchParams.set("signature", signature);

		return url.toString();
	}

	async upload(
		key: string,
		data: Buffer,
		_options?: UploadOptions,
	): Promise<string> {
		const filePath = this._filePath(key);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, data);
		return key;
	}

	async get(key: string): Promise<Buffer | null> {
		const filePath = this._filePath(key);
		if (!existsSync(filePath) || !lstatSync(filePath).isFile()) return null;
		return readFileSync(filePath);
	}

	async delete(key: string): Promise<void> {
		const filePath = this._filePath(key);
		if (existsSync(filePath)) rmSync(filePath);
	}

	async exists(key: string): Promise<boolean> {
		const filePath = this._filePath(key);
		return existsSync(filePath) && lstatSync(filePath).isFile();
	}

	getUrl(key: string): string {
		return `${this._baseUrl}/${key}`;
	}

	createRouter(mountPath = "/storage"): Hono {
		const app = new Hono();

		const MIME: Record<string, string> = {
			mp3: "audio/mpeg",
			wav: "audio/wav",
			ogg: "audio/ogg",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			png: "image/png",
			webp: "image/webp",
			gif: "image/gif",
			pdf: "application/pdf",
			txt: "text/plain",
		};

		app.get("/*", async (c) => {
			const key = c.req.path.replace(new RegExp(`^${mountPath}\\/?`), "");

			// ===== Verify signed URL =====
			const expires = Number(c.req.query("expires"));
			const signature = c.req.query("signature") ?? "";

			if (!expires || expires < Math.floor(Date.now() / 1000)) {
				return c.text("Expired", 403);
			}

			const expected = this._sign(key, expires);

			if (
				signature.length !== expected.length ||
				!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
			) {
				return c.text("Forbidden", 403);
			}

			// ==============================

			const data = await this.get(key);

			if (!data) {
				Logger.debug(`[LocalStorage] 404 key=${key}`);
				return c.notFound();
			}

			const ext = key.split(".").pop() ?? "";
			const body = new Uint8Array(data);

			return new Response(body, {
				headers: {
					"Content-Type": MIME[ext] ?? "application/octet-stream",
					"Content-Length": String(body.byteLength),
					"Cache-Control": "public, max-age=31536000, immutable",
					"Cross-Origin-Resource-Policy": "cross-origin",
				},
			});
		});

		return app;
	}

	private _filePath(key: string): string {
		return join(this._dir, key);
	}

	private _sign(key: string, expires: number): string {
		return createHmac("sha256", this._secret)
			.update(`${key}:${expires}`)
			.digest("hex");
	}
}
