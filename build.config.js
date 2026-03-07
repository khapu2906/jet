/** @type {import('./scripts/build').BuildConfig} */
module.exports = {
	/**
	 * Minify output files (remove whitespace, shorten variable names)
	 */
	minify: true,

	/**
	 * Obfuscate output files
	 */
	obfuscate: true,

	/**
	 * Obfuscation level: 0 - 100
	 *
	 *  0  - 30  : rename variables only (nhẹ, hiệu năng gần như không đổi)
	 * 31  - 60  : + encode strings, light control flow (trung bình, chậm hơn ~5-10%)
	 * 61  - 100 : + dead code injection, heavy control flow (nặng, chậm hơn ~20-30%)
	 */
	obfuscateLevel: 100,
};
