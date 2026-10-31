/** Next's global headers must retain this policy at the public document boundary. */
export const publicDocumentContentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-popups";
