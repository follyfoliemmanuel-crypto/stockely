import { cookies } from "next/headers";

import { getAuthContext, assertCsrf } from "@/server/auth/context";
import {
  clearAuthCookies,
  revokeSessionByToken,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { assertSameOrigin, jsonOk, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  assertSameOrigin(request);

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  const context = await getAuthContext();
  if (context) {
    assertCsrf(request, context);
    if (token) await revokeSessionByToken(token);
  }

  await clearAuthCookies();
  return jsonOk({ loggedOut: true });
});
