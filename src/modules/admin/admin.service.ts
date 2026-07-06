import { prisma } from "../../../lib/prisma";
import { ICreateCategoryPayload } from "./admin.interface";

const createCategory = async (payload: ICreateCategoryPayload) => {
  const { name, description } = payload;
  const category = await prisma.category.create({
    data: {
      name,
      description,
    },
  });
  return category;
};

export const adminService = {
  createCategory,
};
