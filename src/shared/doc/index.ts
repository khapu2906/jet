import type { DescribeRouteOptions } from 'hono-openapi';
import type { OpenAPIV3_1 } from 'openapi-types';

export type docType = Record<string, DescribeRouteOptions>;

export const RES_401: OpenAPIV3_1.ResponseObject = {
	description: 'Unauthorized',
	content: {
		'application/json': {
			schema: {
				type: 'object',
				properties: {
					error: { type: 'string' },
				},
			},
		},
	},
};
