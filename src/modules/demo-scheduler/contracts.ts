export const DemoJobKey = Symbol("DemoJob");

export interface IDemoJob {
	sayHello(): Promise<void>;
}
