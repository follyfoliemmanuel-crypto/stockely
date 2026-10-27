import {
  assertSameOrigin,
  getRequestIpHash,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { resetPassword } from "@/server/services/password-reset";
import { resetPasswordSchema } from "@/server/validation/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const input = await readJson(request, resetPasswordSchema);

  await resetPassword(input.token, input.password, getRequestIpHash(request));

  return jsonOk({ reset: true });
});
