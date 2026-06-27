import { describeRoute as describeRouteBase } from "hono-openapi";
import type { OpenAPIV3_1 } from "openapi-types";
import type { GenericSchema } from "valibot";
import { jsonContent } from "./content";
import { ErrorResponses } from "./responses";
import { schemaToParameters } from "./params";

type RouteOptions<
	TReq extends GenericSchema | undefined = undefined,
	TRes extends GenericSchema | undefined = undefined,
	TQuery extends GenericSchema | undefined = undefined,
	TPath extends GenericSchema | undefined = undefined,
> = {
	tag: string;
	description?: string;

	request?: TReq;
	response?: TRes;
	query?: TQuery;
	path?: TPath;
	status?: number;

	responses?: Record<number, OpenAPIV3_1.ResponseObject>;
	params?: OpenAPIV3_1.ParameterObject[];

	security?: OpenAPIV3_1.SecurityRequirementObject[];
};

/**
 * Clean wrapper for describeRoute
 */
export function describeRoute<
	TReq extends GenericSchema | undefined,
	TRes extends GenericSchema | undefined,
	TQuery extends GenericSchema | undefined = undefined,
	TPath extends GenericSchema | undefined = undefined,
>({
	tag,
	description,
	request,
	response,
	query,
	path,
	status = 200,
	responses,
	security = [{ bearerAuth: [] }],
}: RouteOptions<TReq, TRes, TQuery, TPath>) {
	const parameters: OpenAPIV3_1.ParameterObject[] = [
		...(path ? schemaToParameters(path, "path") : []),
		...(query ? schemaToParameters(query, "query") : []),
	];

	return describeRouteBase({
		tags: [tag],
		description,
		security,

		...(parameters.length > 0 ? { parameters } : {}),

		...(request && {
			requestBody: {
				required: true,
				content: jsonContent(request),
			},
		}),

		responses: {
			...(response && {
				[status]: {
					description: "Success",
					content: jsonContent(response),
				},
			}),

			...ErrorResponses,
			...responses,
		},
	});
}
