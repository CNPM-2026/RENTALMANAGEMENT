import { NextFunction, Request, Response } from 'express';
import { loadReportAttachment } from '../services/reportAttachment.service';

export const reportAttachmentController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buffer, contentType } = await loadReportAttachment(
        String(req.params.id),
        typeof req.query.token === 'string' ? req.query.token : undefined,
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buffer.byteLength));
      res.setHeader('Cache-Control', 'private, max-age=600, no-transform');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(buffer);
    } catch (error) {
      return next(error);
    }
  },
};
