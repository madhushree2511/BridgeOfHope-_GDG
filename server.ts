import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import userRoutes from './src/routes/userRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Database Connection
  const MONGODB_URI = process.env.MONGODB_URI;
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  } else {
    console.warn('MONGODB_URI not found in environment variables. Database features will be disabled.');
  }

  // API Routes
  app.use('/api/users', userRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
