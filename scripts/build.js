const { build } = require("esbuild");
const { readdirSync, statSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

/** @typedef {{ minify: boolean, obfuscate: boolean, obfuscateLevel: number }} BuildConfig */

/** @returns {BuildConfig} */
function loadConfig() {
	try {
		return require("../build.config.js");
	} catch {
		return { minify: false, obfuscate: false, obfuscateLevel: 30 };
	}
}

function collectJs(dir, files = []) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			collectJs(full, files);
		} else if (name.endsWith(".js")) {
			files.push(full);
		}
	}
	return files;
}

/** @param {number} level 0-100 */
function obfuscatorOptions(level) {
	const low = level <= 30;
	const medium = level > 30 && level <= 60;

	return {
		// always on
		renameGlobals: false,
		identifierNamesGenerator: "hexadecimal",

		// medium+
		stringArray: !low,
		stringArrayThreshold: medium ? 0.5 : 0.8,
		stringArrayEncoding: low ? [] : medium ? ["base64"] : ["rc4"],

		// heavy only
		controlFlowFlattening: !low && !medium,
		controlFlowFlatteningThreshold: 0.7,
		deadCodeInjection: !low && !medium,
		deadCodeInjectionThreshold: 0.2,

		sourceMap: false,
		selfDefending: false,
	};
}

async function main() {
	const config = loadConfig();

	console.log("Build config:", config);

	const files = collectJs("dist");

	if (config.minify) {
		console.log(`Minifying ${files.length} files...`);
		await build({
			entryPoints: files,
			bundle: false,
			minify: true,
			platform: "node",
			target: "node20",
			outdir: "dist",
			allowOverwrite: true,
		});
	}

	if (config.obfuscate) {
		const level = Math.min(100, Math.max(1, config.obfuscateLevel));
		console.log(`Obfuscating ${files.length} files at level ${level}%...`);
		const options = obfuscatorOptions(level);

		// suppress promotional spam from javascript-obfuscator
		const _log = console.log;
		console.log = () => {};

		for (const file of files) {
			const code = readFileSync(file, "utf8");
			const result = JavaScriptObfuscator.obfuscate(code, options);
			writeFileSync(file, result.getObfuscatedCode(), "utf8");
		}

		console.log = _log;
	}

	console.log("Build complete.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
