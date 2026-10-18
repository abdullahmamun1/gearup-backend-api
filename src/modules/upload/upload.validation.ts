import { z } from "zod";

const signature = z.object({
  purpose: z.enum(["gear", "avatar"], { error: "Unknown upload type" }),
});

export const uploadValidation = { signature };
