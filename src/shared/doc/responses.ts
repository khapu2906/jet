import type { OpenAPIV3_1 } from "openapi-types";
import { jsonContent } from "./content";
import { ErrorResponseDto } from "@/shared/dto";

const errorContent = jsonContent(ErrorResponseDto);

export const ErrorResponses: Record<number, OpenAPIV3_1.ResponseObject> = {
	400: {
		description: "Bad Request",
		content: errorContent,
	},
	401: {
		description: "Unauthorized",
		content: errorContent,
	},
	403: {
		description: "Forbidden",
		content: errorContent,
	},
	404: {
		description: "Not Found",
		content: errorContent,
	},
	422: {
		description: "Validation failed",
		content: errorContent,
	},
	500: {
		description: "Internal server error",
		content: errorContent,
	},
};
