import {
	readdirSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toPascalCase, toCamelCase, toKebabCase } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// Each entry scaffolds one process type's module shape. See stubs/<stub>/
// for the actual template files, and docs/apply/{http,worker,scheduler}.md
// for the pattern each one is generated from.
const TYPES = {
	http: {
		stub: "http-module",
		suffix: "",
		process: "HttpProcess",
		processFile: "src/processes/http.ts",
		className: (pascal) => `${pascal}Module`,
	},
	worker: {
		stub: "worker-module",
		suffix: "-worker",
		process: "WorkerProcess",
		processFile: "src/processes/worker.ts",
		className: (pascal) => `${pascal}WorkerModule`,
	},
	scheduler: {
		stub: "scheduler-module",
		suffix: "-scheduler",
		process: "SchedulerProcess",
		processFile: "src/processes/scheduler.ts",
		className: (pascal) => `${pascal}SchedulerModule`,
	},
};

function applyTokens(text, tokens) {
	return text
		.replaceAll("__Name__", tokens.pascal)
		.replaceAll("__name__", tokens.camel)
		.replaceAll("__kebab__", tokens.kebab);
}

const EVENTS_DIR = "src/shared/event-manager/events";

function addEventForWorker(tokens) {
	const eventFile = `${tokens.kebab}.event.ts`;
	const eventPath = join(ROOT, EVENTS_DIR, eventFile);

	if (existsSync(eventPath)) {
		console.error(`Refusing to overwrite existing file: ${EVENTS_DIR}/${eventFile}`);
		process.exit(1);
	}

	const stubContent = readFileSync(join(ROOT, "stubs/event.ts.stub"), "utf8");
	writeFileSync(eventPath, applyTokens(stubContent, tokens));

	const indexPath = join(ROOT, EVENTS_DIR, "index.ts");
	const exportLine = `export * from "./${tokens.kebab}.event";`;
	const indexContent = readFileSync(indexPath, "utf8");

	if (!indexContent.includes(exportLine)) {
		writeFileSync(indexPath, `${indexContent.trimEnd()}\n${exportLine}\n`);
	}

	return `${EVENTS_DIR}/${eventFile}`;
}

function copyStub(srcDir, destDir, tokens) {
	const created = [];

	for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = join(srcDir, entry.name);
		const destName = applyTokens(entry.name, tokens).replace(/\.stub$/, "");
		const destPath = join(destDir, destName);

		if (entry.isDirectory()) {
			mkdirSync(destPath, { recursive: true });
			created.push(...copyStub(srcPath, destPath, tokens));
			continue;
		}

		const content = applyTokens(readFileSync(srcPath, "utf8"), tokens);
		mkdirSync(dirname(destPath), { recursive: true });
		writeFileSync(destPath, content);
		created.push(destPath);
	}

	return created;
}

function main() {
	const [, , type, rawName] = process.argv;
	const def = TYPES[type];

	if (!def || !rawName) {
		console.error("Usage: node scripts/make/module.js <http|worker|scheduler> <name>");
		console.error("  e.g. node scripts/make/module.js http billing");
		process.exit(1);
	}

	const tokens = {
		pascal: toPascalCase(rawName),
		camel: toCamelCase(rawName),
		kebab: toKebabCase(rawName),
	};

	const moduleDir = `${tokens.kebab}${def.suffix}`;
	const destDir = join(ROOT, "src/modules", moduleDir);

	if (existsSync(destDir)) {
		console.error(`Refusing to overwrite existing directory: src/modules/${moduleDir}`);
		process.exit(1);
	}

	const stubDir = join(ROOT, "stubs", def.stub);
	const created = copyStub(stubDir, destDir, tokens);

	if (type === "worker") {
		created.push(join(ROOT, addEventForWorker(tokens)));
	}

	console.log(`Created ${type} module "${moduleDir}":\n`);
	for (const file of created) {
		console.log(`  ${file.slice(ROOT.length + 1)}`);
	}

	const className = def.className(tokens.pascal);
	console.log(`\nNext step — register it in ${def.processFile}:`);
	console.log(`  import { ${className} } from "@/modules/${moduleDir}/module";`);
	console.log(`  protected _modules: ModuleConstructor[] = [..., ${className}];`);
}

main();
