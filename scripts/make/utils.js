export function toWords(input) {
	return input
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());
}

export function toPascalCase(input) {
	return toWords(input)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join("");
}

export function toCamelCase(input) {
	const pascal = toPascalCase(input);
	return pascal[0].toLowerCase() + pascal.slice(1);
}

export function toKebabCase(input) {
	return toWords(input).join("-");
}
