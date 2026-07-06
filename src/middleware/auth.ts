import { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/enums";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";
import config from "../config";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { createError } from "../utils/createError";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: Role;
      };
    }
  }
}

export const auth = (...requiredRoles: Role[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization?.split(" ")[1]
        : req.headers.authorization;
    if (!token) {
      throw createError(401, "No token provided");
    }
    const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

    if (!verifiedToken.success) {
      throw createError(401, verifiedToken.error);
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
      throw createError(403, "Your account is suspended");
    }
    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw createError(
        403,
        "You do not have permission to access this resource",
      );
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  });
};
