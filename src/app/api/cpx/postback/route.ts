import { handleCpxPostback } from "@/lib/survey-providers/providers/cpx/postback-route";

export function GET(request: Request): Promise<Response> {
  return handleCpxPostback(request);
}
