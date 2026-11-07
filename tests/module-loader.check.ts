// Run: npx tsx tests/module-loader.check.ts
import assert from "node:assert/strict";
import { Container } from "@khapu2906/treasure-chest";
import { Module } from "../src/shared/base/modules";
import { ModuleLoader } from "../src/shared/base/module-loader";

const PublicKey = Symbol("Public");
const PrivateKey = Symbol("Private");
const events: string[] = [];

class A extends Module {
	readonly name = "a";
	register() {
		events.push("register:a");
		this.container.singleton(PrivateKey, () => ({ secret: true }));
	}
	share(to: Container) {
		to.singleton(PublicKey, () => this.container.resolve(PrivateKey));
	}
	async onInit() {
		events.push("onInit:a");
	}
	bootstrap() {
		events.push("bootstrap:a");
	}
}

class B extends Module {
	readonly name = "b";
	readonly imports = [A];
	register() {
		events.push("register:b");
	}
}

(async () => {
	// Imports load first; imported module is registered but never activated.
	const loader = new ModuleLoader(new Container());
	const roots = await loader.load([B]);
	assert.deepEqual(events, ["register:a", "register:b"]);
	assert.equal(roots.length, 1);
	assert.equal(roots[0].name, "b");

	// Public key is bound into the importer's container; private key is not.
	const b = roots[0];
	assert.equal(typeof b.getContainer().resolve(PublicKey), "object");
	assert.throws(() => b.getContainer().resolve(PrivateKey));

	// Activated root gets onInit (bootstrap is called by the process, not the loader).
	await loader.load([A]);
	assert.ok(events.includes("onInit:a"));
	assert.ok(!events.includes("bootstrap:a"));

	// Import cycle is reported.
	class X extends Module {
		readonly name = "x";
		readonly imports = [Y];
		register() {}
	}
	class Y extends Module {
		readonly name = "y";
		readonly imports = [X];
		register() {}
	}
	await assert.rejects(new ModuleLoader(new Container()).load([X]), /import cycle/);

	// Real module: importing auth exposes only AuthServiceKey, not the repo.
	const { AuthModule } = await import("../src/modules/auth/module");
	const { AuthServiceKey } = await import(
		"../src/modules/auth/contracts/service"
	);
	const { AuthRepositoryKey } = await import(
		"../src/modules/auth/contracts/repository"
	);

	class Probe extends Module {
		readonly name = "probe";
		readonly imports = [AuthModule];
		register() {}
	}

	const probeRoots = await new ModuleLoader(new Container()).load([Probe]);
	const probe = probeRoots[0];
	assert.equal(probe.getContainer().has(AuthServiceKey), true);
	assert.equal(probe.getContainer().has(AuthRepositoryKey), false);

	// Real chain: user imports auth; user's service reaches auth's PUBLIC
	// service, and a call lands in the DB through auth's repository.
	const { UserModule } = await import("../src/modules/user/module");
	const { UserServiceKey } = await import(
		"../src/modules/user/contracts/service"
	);
	const { UserService } = await import("../src/modules/user/service");
	const { DbKey } = await import("../src/shared/db");

	const dbReached = new Error("db-reached");
	const root = new Container();
	root.singleton(DbKey, () => ({
		query: {
			authCredentials: {
				findFirst: async () => {
					throw dbReached;
				},
			},
		},
	}));

	const userRoots = await new ModuleLoader(root).load([UserModule]);
	const user = userRoots[0].getContainer().resolve(UserServiceKey);
	assert.ok(user instanceof UserService);
	await assert.rejects(
		user.createUser({ email: "a@b.co", password: "password123" }),
		(error) => error === dbReached
	);

	console.log("module-loader: ok");
})();
