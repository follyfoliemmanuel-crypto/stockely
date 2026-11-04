import {
  assertSameOrigin,
  getRequestIpHash,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { verifyEmail } from "@/server/services/email-verification";
import { verifyEmailSchema } from "@/server/validation/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);

  const input = await readJson(request, verifyEmailSchema);
  await verifyEmail(input.token, getRequestIpHash(request));

  return jsonOk({ verified: true });
});
