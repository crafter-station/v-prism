export type Failure =
  | { readonly reason: "insecure" }
  | { readonly reason: "missing" }
  | { readonly reason: "blocked" }
  | { readonly reason: "crashed"; readonly detail: string };

interface Traced {
  readonly message?: unknown;
  readonly where?: unknown;
  readonly cause?: Traced;
}

export async function diagnose(error: unknown): Promise<Failure> {
  if (!window.isSecureContext) return { reason: "insecure" };
  if (!navigator.gpu) return { reason: "missing" };
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) return { reason: "blocked" };
  return { reason: "crashed", detail: describe(error) };
}

export function describe(error: unknown): string {
  if (typeof error !== "object" || error === null) return String(error);
  const { message, where, cause } = error as Traced;
  const place = typeof where === "string" ? `${where}: ` : "";
  const reason = cause?.message ?? message;
  return `${place}${typeof reason === "string" && reason ? reason : String(error)}`;
}
