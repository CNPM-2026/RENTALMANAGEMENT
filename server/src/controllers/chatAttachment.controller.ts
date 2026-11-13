import { NextFunction, Request, Response } from 'express';
import { loadChatAttachment } from '../services/chatAttachment.service';

export const chatAttachmentController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buffer, contentType } = await loadChatAttachment(
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
