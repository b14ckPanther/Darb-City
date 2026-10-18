import { forwardField } from "@/admin/field-proxy";

type Context = { params: Promise<{ action: string }> };

/** Add from the street: /admin/field-api/{photo,read,duplicates,captures} (admin proxy, Clerk). */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  return forwardField((await params).action, request);
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  return forwardField((await params).action, request);
}
