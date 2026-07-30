import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { catchAsync } from "../utils/catchAsync";

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}

export const validateRequest = (schema: ZodType) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    req.body = await schema.parseAsync(req.body ?? {});
    next();
  });

/**
 * Params are always strings and never coerced, so this only rejects — it
 * doesn't write back. Keeps a malformed id a 400 instead of letting it fall
 * through to the database and come back as a 404.
 */
export const validateParams = (schema: ZodType) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    await schema.parseAsync(req.params ?? {});
    next();
  });

export const validateQuery = (schema: ZodType) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    req.validatedQuery = await schema.parseAsync(req.query ?? {});
    next();
  });
