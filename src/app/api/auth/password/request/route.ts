import {
  assertSameOrigin,
  getRequestIpHash,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { requestPasswordReset } from "@/server/services/password-reset";
import { forgotPasswordSchema } from "@/server/validation/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);
  const input = await readJson(request, forgotPasswordSchema);

  await requestPasswordReset(input.email, getRequestIpHash(request));

  // Réponse identique que le compte existe ou non.
  return jsonOk({ sent: true }, 202);
});
