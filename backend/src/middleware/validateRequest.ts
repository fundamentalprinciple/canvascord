import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export function validateRequest(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      next(result.error);
      return;
    }

    res.locals.validated = result.data;
    next();
  };
}
