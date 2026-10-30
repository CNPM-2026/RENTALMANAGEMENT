
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

export const validate = (schema: ZodType, source: 'body' | 'query' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(source === 'query' ? req.query : req.body);
      if (source === 'query') {
        Object.assign(req.query, parsed);
      } else {
        req.body = parsed;
      }
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errorMessages,
        });
      }

      next(error);
    }
  };
};
