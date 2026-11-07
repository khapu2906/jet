// Run: npx tsx tests/base-process.check.ts
import assert from "node:assert/strict";
import { BaseProcess } from "@shared/base/processes";

// A process that uses no events at all: it must boot and clean up without
// ever creating an EventBus (BaseProcess._enableEventBus() is opt-in).
class BareProcess extends BaseProcess<string> {
	protected _modules = [];

	protected _registerCoreDependencies() {}

	protected async _build(): Promise<string> {
		return "bare";
	}
}

const CoreKey = Symbol("core");

// Binds its own value under the same key: with PROCESS_TYPE=* each process
// must get its own child container, so these cannot clobber each other.
class KeyedProcess extends BareProcess {
	constructor(private readonly _value: number) {
		super();
	}

	protected _registerCoreDependencies() {
		this._container.singleton(CoreKey, () => this._value);
	}

	resolveCore() {
		return this._container.resolve<number>(CoreKey);
	}
}

void (async () => {
	const proc = new BareProcess();

	assert.equal(await proc.bootstrap(), "bare");
	await proc.cleanup();

	const first = new KeyedProcess(1);
	const second = new KeyedProcess(2);
	await first.bootstrap();
	await second.bootstrap();

	assert.equal(first.resolveCore(), 1);
	assert.equal(second.resolveCore(), 2);

	console.log("base-process: ok");
})();
