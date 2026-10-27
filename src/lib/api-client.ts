export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Ajoute automatiquement le jeton CSRF pour les mutations. */
  csrf?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, csrf = false, headers, ...rest } = options;
  const method = rest.method ?? (body !== undefined ? "POST" : "GET");

  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");

  if (csrf) {
    const token = readCookie("stockely_csrf");
    if (token) finalHeaders.set("x-csrf-token", token);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(
      0,
      "network_error",
      "Connexion impossible. Vérifiez votre réseau puis réessayez.",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string; details?: unknown } }
    | null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.error?.code ?? "request_failed",
      payload?.error?.message ?? "La requête a échoué. Réessayez.",
      payload?.error?.details,
    );
  }

  return payload?.data as T;
}
