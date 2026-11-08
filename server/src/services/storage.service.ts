import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

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

const ensureCloudinaryConfigured = () => {
  if (!cloudinaryEnabled) {
    throw new AppError('Cloudinary phải được cấu hình để upload ảnh.', 503);
  }
};

const upload = (file: Express.Multer.File, options: Record<string, string>) => new Promise<any>((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error || !result) return reject(error ?? new Error('Cloudinary không trả về kết quả upload.'));
    resolve(result);
  });
  stream.end(file.buffer);
});

export const storageService = {
  uploadImage: async (file: Express.Multer.File, folder: string) => {
    ensureCloudinaryConfigured();
    const result = await upload(file, { folder, resource_type: 'image' });
    return result.secure_url as string;
  },
  uploadPrivateImage: async (file: Express.Multer.File, folder: string) => {
    ensureCloudinaryConfigured();
    const result = await upload(file, { folder, resource_type: 'image', type: 'authenticated' });
    return result.public_id as string;
  },
  deleteImage: async (asset: string, type: 'upload' | 'authenticated' = 'upload') => {
    if (!asset || asset.startsWith('/uploads/')) return;
    ensureCloudinaryConfigured();
    const publicId = asset.includes('://') ? asset.split('/upload/')[1]?.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '') : asset;
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type });
  },
  getPrivateImageUrl: (publicId: string) => {
    if (!publicId) throw new AppError('Tài liệu KYC không hợp lệ', 500);
    ensureCloudinaryConfigured();
    return cloudinary.url(publicId, { resource_type: 'image', type: 'authenticated', sign_url: true, secure: true });
  },
};
