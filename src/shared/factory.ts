import { Container } from "@khapu2906/treasure-chest";
import { Module } from "./base/modules";


export class AppFactory {
	static rootContainer = new Container();
	static importModuleInstances = new Map<string, Module>();

	static getModule(key: string) {
		return AppFactory.importModuleInstances.get(key);
	}

	static setModule(key: string, module: Module) {
		AppFactory.importModuleInstances.set(key, module)
	}

	static getContainer(key: string): Container {
		const module = AppFactory.importModuleInstances.get(key);
		if (!module) {
			throw new Error(`No module found for key: ${String(key)}`);
		}
		if (!module.container) {
			throw new Error(`Module ${String(key)} container is not initialized`);
		}
		return module.container;
	}
}