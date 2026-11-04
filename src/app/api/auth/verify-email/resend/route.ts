import { assertCsrf, requireAuth } from "@/server/auth/context";
import { getRequestIpHash, jsonOk, route } from "@/server/http";
import { resendVerificationEmail } from "@/server/services/email-verification";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertCsrf(request, context);

  await resendVerificationEmail(context.user, getRequestIpHash(request));

  return jsonOk({ sent: true });
});
