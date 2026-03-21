import type { Context } from "hono";
import { config } from "./rbac";
import { RBAC } from "@fire-shield/core";
import type { AuthorizationResult, RBACUser } from "@fire-shield/core";
import { HonoRBACAdapter } from "@fire-shield/hono";
import { ForbiddenError } from "@shared/errors";

export const rbac = new RBAC({ config });

export const rbacAdapter = new HonoRBACAdapter(rbac, {
	getUser: (c: Context) => c.get("currentUser"),
	onUnauthorized: (result: AuthorizationResult, c: Context) => {
		throw new ForbiddenError("Access Denied", {
			required: result.reason,
			user: (result.user as RBACUser)?.id,
		});
	},
});
