export type Failure =
  | { readonly reason: "insecure" }
  | { readonly reason: "missing" }
  | { readonly reason: "blocked" }
  | { readonly reason: "crashed"; readonly detail: string };

export async function diagnose(error: unknown): Promise<Failure> {
  if (!window.isSecureContext) return { reason: "insecure" };
  if (!navigator.gpu) return { reason: "missing" };
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) return { reason: "blocked" };
  return { reason: "crashed", detail: error instanceof Error ? error.message : String(error) };
}
