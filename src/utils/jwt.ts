import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const createToken = (
  payload: JwtPayload,
  secret: string,
  expiresIn: SignOptions["expiresIn"],
) => {
  const token = jwt.sign(payload, secret, { expiresIn } as SignOptions);
  return token;
};

const verifyToken = (token: string, secret: string) => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true,
      data: verifiedToken,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * True when the token predates a password change. `iat` is in whole seconds,
 * so a token issued in the same second as the change still counts as newer.
 */
const issuedBefore = (payload: JwtPayload, changedAt: Date | null) =>
  !!changedAt &&
  typeof payload.iat === "number" &&
  payload.iat < Math.floor(changedAt.getTime() / 1000);

export const jwtUtils = {
  createToken,
  verifyToken,
  issuedBefore,
};
