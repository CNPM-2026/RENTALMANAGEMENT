import express, { Application, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/error.middleware';
import authRoute from './routes/auth.route';
import propertyRoute from './routes/property.route';
import roomRoute from './routes/room.route';
import postRoute from './routes/post.route';
import adminRoute from './routes/admin.route'
import appointmentRoute from './routes/appointment.route'
import contractRoute from './routes/contract.route'
import meterReadingRoute from './routes/meterReading.route';
import invoiceRoute from './routes/invoice.route';
const app: Application = express();
// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public'))); // Nếu có
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Thêm dòng này để public ảnh
// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Server is running 🚀' });
});

// --- Gắn các Routes sau này vào đây ---
// app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/properties', propertyRoute);
app.use('/api/v1/rooms', roomRoute);
app.use('/api/v1/posts', postRoute);
app.use('/api/v1/admin', adminRoute);
app.use('/api/v1/appointments', appointmentRoute);
app.use('/api/v1/contracts', contractRoute);
//app.use('/api/v1/meter-readings', meterReadingRoute);
//app.use('/api/v1/invoices', invoiceRoute);
// Bắt lỗi 404 (Route không tồn tại)
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'API Route Not Found' });
});

// Middleware xử lý lỗi (Phải đặt cuối cùng)
app.use(errorHandler);

export default app;
