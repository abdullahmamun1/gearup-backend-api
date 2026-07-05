import bcrypt from "bcryptjs";
import { ICreateUserPayload } from "./auth.interface";
import config from "../../config";
import { prisma } from "../../../lib/prisma";
import { safeUserSelect } from "../../utils/userSelect";

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

export const authService = {
  registerUser,
};
