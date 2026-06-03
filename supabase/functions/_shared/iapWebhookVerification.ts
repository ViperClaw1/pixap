// @ts-ignore Deno Edge Functions resolve remote URL imports at runtime.
import { importX509, jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@5.9.6";
// @ts-ignore Deno Edge Functions resolve remote URL imports at runtime.
import { X509Certificate } from "https://esm.sh/@peculiar/x509@1.12.4";

function normalizeBase64Url(input: string): string {
  return input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
}

function decodeJwtPart<T>(jwt: string, partIndex: 0 | 1): T {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWS");
  return JSON.parse(atob(normalizeBase64Url(parts[partIndex]))) as T;
}

function certDerToPem(base64Der: string): string {
  const chunks = base64Der.match(/.{1,64}/g)?.join("\n") ?? base64Der;
  return `-----BEGIN CERTIFICATE-----\n${chunks}\n-----END CERTIFICATE-----`;
}

async function sha256HexBase64Der(base64Der: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64Der), (char) => char.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyAppleCertificateChain(x5c: string[]): Promise<void> {
  if (x5c.length < 2) throw new Error("Apple signedPayload is missing certificate chain");

  const expectedRootSha256 = Deno.env.get("APPLE_ROOT_CERT_SHA256")?.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (!expectedRootSha256) {
    throw new Error("Missing APPLE_ROOT_CERT_SHA256 for Apple notification verification");
  }

  const rootFingerprint = await sha256HexBase64Der(x5c[x5c.length - 1]);
  if (rootFingerprint !== expectedRootSha256) {
    throw new Error("Apple signedPayload root certificate does not match configured trust anchor");
  }

  const certs = x5c.map((cert) => new X509Certificate(Uint8Array.from(atob(cert), (char) => char.charCodeAt(0))));
  const now = new Date();
  for (const cert of certs) {
    if (cert.notBefore > now || cert.notAfter < now) {
      throw new Error("Apple signedPayload certificate is outside its validity window");
    }
  }

  for (let index = 0; index < certs.length - 1; index += 1) {
    const valid = await certs[index].verify({ publicKey: certs[index + 1].publicKey });
    if (!valid) throw new Error("Apple signedPayload certificate chain is invalid");
  }

  const rootValid = await certs[certs.length - 1].verify({ publicKey: certs[certs.length - 1].publicKey });
  if (!rootValid) throw new Error("Apple signedPayload root certificate is invalid");
}

export async function verifyAppleSignedPayload<T>(signedPayload: string): Promise<T> {
  const header = decodeJwtPart<{ x5c?: string[]; alg?: string }>(signedPayload, 0);
  if (header.alg !== "ES256") throw new Error("Apple signedPayload must use ES256");
  if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
    throw new Error("Apple signedPayload is missing x5c certificates");
  }

  await verifyAppleCertificateChain(header.x5c);

  const key = await importX509(certDerToPem(header.x5c[0]), "ES256");
  const { payload } = await jwtVerify(signedPayload, key, {
    algorithms: ["ES256"],
  });
  return payload as T;
}

export async function verifyGooglePubSubRequest(req: Request): Promise<void> {
  const expectedAudience = Deno.env.get("GOOGLE_RTDN_AUDIENCE");
  const expectedEmail = Deno.env.get("GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL");
  if (!expectedAudience || !expectedEmail) {
    throw new Error("Missing GOOGLE_RTDN_AUDIENCE or GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL");
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Missing Google Pub/Sub bearer token");

  const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  const { payload } = await jwtVerify(token, jwks, {
    audience: expectedAudience,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
  });

  const email = typeof payload.email === "string" ? payload.email : null;
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (email !== expectedEmail || !emailVerified) {
    throw new Error("Google Pub/Sub bearer token was not issued for the expected service account");
  }
}
