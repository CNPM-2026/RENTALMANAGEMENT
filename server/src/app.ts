import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/error.middleware';
import authRoute from './routes/auth.route';
import propertyRoute from './routes/property.route';
import roomRoute from './routes/room.route';
const app: Application = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Server is running 🚀' });
});

// --- Gắn các Routes sau này vào đây ---
// app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/properties', propertyRoute);
app.use('/api/v1/rooms', roomRoute);
// Bắt lỗi 404 (Route không tồn tại)
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'API Route Not Found' });
});

// Middleware xử lý lỗi (Phải đặt cuối cùng)
app.use(errorHandler);

export default app;