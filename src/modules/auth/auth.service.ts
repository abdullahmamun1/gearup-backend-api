import bcrypt from "bcryptjs";
import { ICreateUserPayload, ILoginPayload } from "./auth.interface";
import config from "../../config";
import { prisma } from "../../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";
import { jwtUtils } from "../../utils/jwt";
import { SignOptions } from "jsonwebtoken";
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
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      email,
    },
  });
  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordMatched) {
    throw createError(400, "Password is incorrect!");
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
  getLoggedInUser,
};
