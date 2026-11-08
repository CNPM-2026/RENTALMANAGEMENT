import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/AppError';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Chỉ cho phép upload ảnh
  if (new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Chỉ cho phép upload file hình ảnh!', 400), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { files: 10, fileSize: 5 * 1024 * 1024 }, // Tối đa 10 file, mỗi file 5MB
});

const imageSignatures: Record<string, (bytes: Buffer) => boolean> = {
  jpeg: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (bytes) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
};

const extensionToSignature: Record<string, keyof typeof imageSignatures> = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
};

export const validateUploadedImages = async (req: any, res: any, next: any) => {
  const uploaded = req.files ?? [];
  const files = (Array.isArray(uploaded) ? uploaded : Object.values(uploaded).flat()) as Express.Multer.File[];
  try {
    for (const file of files) {
      const signature = extensionToSignature[path.extname(file.originalname).toLowerCase()];
      const bytes = file.buffer;
      if (!signature || !imageSignatures[signature](bytes)) {
        throw new AppError('Tệp tải lên không phải hình ảnh hợp lệ', 400);
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};