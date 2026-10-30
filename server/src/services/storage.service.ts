import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import { env } from '../config/env';

const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export const storageService = {
  uploadImage: async (file: Express.Multer.File, folder: string) => {
    if (!cloudinaryEnabled) return `/uploads/${file.filename}`;
    const result = await cloudinary.uploader.upload(file.path, { folder, resource_type: 'image' });
    await fs.unlink(file.path).catch(() => undefined);
    return result.secure_url;
  },
};
