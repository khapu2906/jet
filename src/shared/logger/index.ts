import { CoreLogger, PrettyLogger } from "meo-meo-logger";
import { loggerConfig } from "@shared/config/logger";

CoreLogger.configure(loggerConfig);

export { CoreLogger as Logger, PrettyLogger as LoggerUI };
