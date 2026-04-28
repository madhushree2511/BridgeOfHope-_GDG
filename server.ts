import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import userRoutes from './src/routes/userRoutes.ts';
import donationRoutes from './src/routes/donationRoutes.ts';
import ngoRoutes from './src/routes/ngoRoutes.ts';

console.log('Environment variables loaded. MONGODB_URI exists:', !!process.env.MONGODB_URI);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // API Routes
  app.use('/api/users', userRoutes);
  app.use('/api/donations', donationRoutes);
  app.use('/api/ngo', ngoRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      connectionState: mongoose.connection.readyState
    });
  });

  // Database Connection
  const MONGODB_URI = process.env.MONGODB_URI;

  const configureVite = async () => {
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
  };

  await configureVite();

  app.listen(PORT, '0.0.0.0', () => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'ONLINE' : 'OFFLINE';
    console.log(`Server running on http://localhost:${PORT} [Database: ${dbStatus}]`);
  });

  if (MONGODB_URI) {
    console.log('Attempting to connect to MongoDB...');
    try {
      // Allow buffering initially so queries can wait for a quick connection
      mongoose.set('bufferCommands', true);
      
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // Wait 10s for initial selection
        connectTimeoutMS: 10000, // Wait 10s for connection
      });
      app.set('dbStatus', 'ONLINE');
      console.log('Successfully connected to MongoDB');
    } catch (err: any) {
      console.error('CRITICAL: MongoDB connection failed:', err.message);
      app.set('dbStatus', 'OFFLINE');
      // Disable buffering if connection failed so routes fail fast instead of hanging
      mongoose.set('bufferCommands', false);
      console.warn('Database operations will fail immediately (buffering disabled).');
    }
  } else {
    console.warn('MONGODB_URI not found in environment variables. Database features will be disabled.');
    mongoose.set('bufferCommands', false);
  }
}

startServer();
