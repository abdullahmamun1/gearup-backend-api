import { createRemoteJWKSet, jwtVerify } from "jose";
import config from "../config";
import { createError } from "./createError";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

export interface IGoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

interface ITokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

const exchangeCode = async (
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<string> => {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: config.google_client_id,
        client_secret: config.google_client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
  } catch {
    throw createError(502, "Could not reach Google. Please try again.");
  }

  const payload = (await response.json().catch(() => ({}))) as ITokenResponse;

  if (!response.ok || !payload.id_token) {
    throw createError(401, "Google sign-in could not be completed.");
  }

  return payload.id_token;
};

const verifyIdToken = async (idToken: string): Promise<IGoogleProfile> => {
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(idToken, jwks, {
      issuer: ISSUERS,
      audience: config.google_client_id,
    }));
  } catch {
    throw createError(401, "Google sign-in could not be completed.");
  }

  const { sub, email, email_verified, name } = claims as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!sub || !email) {
    throw createError(401, "Google did not return an email address.");
  }

  if (!email_verified) {
    throw createError(
      403,
      "Your Google email address is not verified. Verify it with Google and try again.",
    );
  }

  const fallbackName = email.split("@")[0] ?? email;

  return { googleId: sub, email, name: name?.trim() || fallbackName };
};

export const googleOAuth = {
  async getProfile(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<IGoogleProfile> {
    const idToken = await exchangeCode(code, codeVerifier, redirectUri);
    return verifyIdToken(idToken);
  },
};
