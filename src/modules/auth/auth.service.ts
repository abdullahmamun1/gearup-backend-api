import bcrypt from "bcryptjs";
import { ICreateUserPayload, ILoginPayload } from "./auth.interface";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { createError } from "../../utils/createError";

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
  const isPasswordMatched =
    user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !isPasswordMatched) {
    throw createError(400, "Email or password is incorrect!");
  }
  if (user.status === "SUSPENDED") {
    throw createError(
      403,
      "User account is suspended. Please contact support.",
    );
  }
  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions["expiresIn"],
  );
  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions["expiresIn"],
  );

  return {
    accessToken,
    refreshToken,
  };
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
  if (user.status === "SUSPENDED") {
    throw createError(
      403,
      "User account is suspended. Please contact support.",
    );
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions["expiresIn"],
  );

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

export const authService = {
  registerUser,
  loginUser,
  refreshToken,
  getLoggedInUser,
};
