import bcrypt from "bcryptjs";
import {
  ICreateUserPayload,
  IGoogleLoginPayload,
  ILoginPayload,
  IUpdateProfilePayload,
} from "./auth.interface";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { createError } from "../../utils/createError";
import { googleOAuth } from "../../utils/googleOAuth";
import { UserModel } from "../../../generated/prisma/models";

const issueTokens = (
  user: Pick<UserModel, "id" | "name" | "email" | "role">,
) => {
  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: jwtUtils.createToken(
      jwtPayload,
      config.jwt_access_secret,
      config.jwt_access_expires_in as SignOptions["expiresIn"],
    ),
    refreshToken: jwtUtils.createToken(
      jwtPayload,
      config.jwt_refresh_secret,
      config.jwt_refresh_expires_in as SignOptions["expiresIn"],
    ),
  };
};

const assertNotSuspended = (user: Pick<UserModel, "status">) => {
  if (user.status === "SUSPENDED") {
    throw createError(
      403,
      "User account is suspended. Please contact support.",
    );
  }
};

const registerUser = async (payload: ICreateUserPayload) => {
  const { name, email, password, phone, role } = payload;
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashedPassword,
      phone,
      role,
    },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: createdUser.id,
    },
    select: safeUserSelect,
  });
  return user;
};

const loginUser = async (payload: ILoginPayload) => {
  const { email, password } = payload;
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (user && !user.passwordHash) {
    throw createError(
      400,
      "This account uses Google sign-in. Continue with Google instead.",
    );
  }

  const isPasswordMatched =
    user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !isPasswordMatched) {
    throw createError(400, "Email or password is incorrect!");
  }
  assertNotSuspended(user);

  return issueTokens(user);
};

const loginWithGoogle = async (payload: IGoogleLoginPayload) => {
  const { code, codeVerifier, redirectUri, role } = payload;

  const profile = await googleOAuth.getProfile(code, codeVerifier, redirectUri);

  let user =
    (await prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
    (await prisma.user.findUnique({ where: { email: profile.email } }));

  if (user) {
    assertNotSuspended(user);

    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        passwordHash: null,
        role: role ?? "CUSTOMER",
      },
    });
  }

  return issueTokens(user);
};

const refreshToken = async (token: string) => {
  const verifiedToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
  if (!verifiedToken.success) {
    throw createError(401, "Refresh token is invalid or expired");
  }

  const { id } = verifiedToken.data as JwtPayload;
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });
  if (!user) {
    throw createError(404, "User not found");
  }
  assertNotSuspended(user);

  const { accessToken } = issueTokens(user);

  return {
    accessToken,
  };
};

const getLoggedInUser = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
    },
    select: safeUserSelect,
  });
  return user;
};

const updateProfile = async (
  userId: string,
  payload: IUpdateProfilePayload,
) => {
  const { name, phone } = payload;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone: phone === "" ? null : phone }),
    },
    select: safeUserSelect,
  });

  return user;
};

export const authService = {
  registerUser,
  loginUser,
  loginWithGoogle,
  refreshToken,
  getLoggedInUser,
  updateProfile,
};
