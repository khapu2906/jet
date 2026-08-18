import { createSuccessResponseDto } from "@shared/dto";
import {
	PaginationParams,
	buildPaginationMeta,
	createPaginatedResponseDto,
} from "./pagination";
import * as v from "valibot";

export function paginated<T extends v.GenericSchema>(
	schema: T,
	items: v.InferOutput<T>[],
	params: Pick<PaginationParams, "page" | "pageSize">,
	totalCount: number,
	message?: string,
) {
	const response = {
		data: items,
		pagination: buildPaginationMeta(params, totalCount),
		message,
		timestamp: new Date().toISOString(),
	};

	return v.parse(createPaginatedResponseDto(schema), response);
}

export function success<T extends v.GenericSchema>(
	schema: T,
	data: v.InferOutput<T>,
	message: string = "successful",
) {
	return v.parse(createSuccessResponseDto(schema), {
		data,
		message,
		timestamp: new Date().toISOString(),
	});
}
