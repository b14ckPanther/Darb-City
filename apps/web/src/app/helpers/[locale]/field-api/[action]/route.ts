import { adminToken } from "@/admin/auth";
import { forwardField } from "@/admin/field-proxy";

type Context = { params: Promise<{ action: string }> };

/**
 * The helper's capture: /helpers/field-api/{photo,read,duplicates,captures}, forwarded to the
 * API's /helpers/field routes with the helper's own token (HelperGuard decides there).
 */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  return forwardField((await params).action, request, fetch, adminToken, "/helpers/field");
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  return forwardField((await params).action, request, fetch, adminToken, "/helpers/field");
}
