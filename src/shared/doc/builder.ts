import { describeRoute as describeRouteBase } from "hono-openapi";
import type { OpenAPIV3_1 } from "openapi-types";
import type { BaseSchema } from "valibot";
import { jsonContent } from "./content";
import { ErrorResponses } from "./responses";

type RouteOptions<
	TReq extends BaseSchema<any, any, any> | undefined = undefined,
	TRes extends BaseSchema<any, any, any> | undefined = undefined,
> = {
	tag: string;
	description?: string;

	request?: TReq;
	response?: TRes;

	status?: number;

	responses?: Record<number, OpenAPIV3_1.ResponseObject>;
	params?: OpenAPIV3_1.ParameterObject[];

	security?: OpenAPIV3_1.SecurityRequirementObject[];
};

/**
 * Clean wrapper for describeRoute
 */
export function describeRoute<
	TReq extends BaseSchema<any, any, any> | undefined,
	TRes extends BaseSchema<any, any, any> | undefined,
>({
	tag,
	description,
	request,
	response,
	status = 200,
	responses,
	params,
	security = [{ BearerAuth: [] }],
}: RouteOptions<TReq, TRes>) {
	return describeRouteBase({
		tags: [tag],
		description,
		security,

		...(params && { parameters: params }),

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
