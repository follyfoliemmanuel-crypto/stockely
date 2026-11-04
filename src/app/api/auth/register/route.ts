import { setAuthCookies } from "@/server/auth/session";
import {
  assertSameOrigin,
  getRequestIpHash,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { registerUser } from "@/server/services/auth";
import { sendVerificationEmail } from "@/server/services/email-verification";
import { registerSchema } from "@/server/validation/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);

  const input = await readJson(request, registerSchema);
  const result = await registerUser(input, {
    ipHash: getRequestIpHash(request),
    userAgent: request.headers.get("user-agent"),
  });

  await setAuthCookies(result.session);

  // L'inscription reste valide même si le fournisseur d'e-mail est indisponible.
  try {
    await sendVerificationEmail(result.user);
  } catch {
    console.error("[stockely] échec d'envoi de l'e-mail de vérification");
  }

  return jsonOk(
    {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      shop: {
        id: result.shop.id,
        name: result.shop.name,
        slug: result.shop.slug,
        currency: result.shop.currency,
        timezone: result.shop.timezone,
      },
      role: result.role,
    },
    201,
  );
});
