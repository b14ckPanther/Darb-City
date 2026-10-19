import { quickApi } from "@/admin/quick-proxy";

type Context = { params: Promise<{ action: string }> };

/** The quick editor on the public card: /admin/quick-api/{business,save,status,locate}. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  return quickApi((await params).action, request);
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  return quickApi((await params).action, request);
}
