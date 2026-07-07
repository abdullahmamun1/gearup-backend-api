import { prisma } from "../../lib/prisma";
import { ICreateCategoryPayload } from "./category.interface";

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

const getAllCategories = async () => {
  const categories = await prisma.category.findMany();
  return categories;
};

const updateCategory = async (payload: ICreateCategoryPayload, id: string) => {
  await prisma.category.findUniqueOrThrow({
    where: {
      id,
    },
  });
  const { name, description } = payload;
  const result = await prisma.category.update({
    where: {
      id,
    },
    data: {
      name,
      description,
    },
  });
  return result;
};

const deleteCategory = async (id: string) => {
  await prisma.category.findUniqueOrThrow({
    where: {
      id,
    },
  });
  await prisma.category.delete({
    where: {
      id,
    },
  });
};

export const categoryService = {
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
};
