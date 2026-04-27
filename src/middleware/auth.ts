import admin from 'firebase-admin';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load config using readFileSync to bypass ESM import issues with json
const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

// Initialize Firebase Admin with explicit project ID
const projectId = firebaseConfig.projectId;

try {
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase Admin with Project ID:', projectId);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId,
    });
    console.log('Firebase Admin initialized successfully.');
  } else {
    // Check if default app has the right project ID, if not, try to initialize a named one or just log
    const defaultApp = admin.app();
    if (defaultApp.options.projectId !== projectId) {
      console.warn(`Default Firebase App project ID (${defaultApp.options.projectId}) does not match config (${projectId})`);
      if (!admin.apps.find(a => a.name === 'AppletApp')) {
        admin.initializeApp({ projectId }, 'AppletApp');
        console.log('Secondary Firebase Admin "AppletApp" initialized.');
      }
    }
  }
} catch (e: any) {
  console.error('CRITICAL ERROR: Failed to initialize Firebase Admin:', e.message);
  console.warn('Authentication middleware may fail on any token verification.');
}

export const getAuth = () => {
  try {
    const app = admin.apps.find(a => a.options.projectId === projectId) || admin.app();
    return admin.auth(app);
  } catch (e: any) {
    console.error('Failed to get Firebase Auth instance:', e.message);
    throw e;
  }
};

export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    console.warn('Unauthorized access attempt: No token');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase token:', error.message);
    // If there's an audience mismatch, we want to know
    if (error.code === 'auth/argument-error' || error.message.includes('aud')) {
      console.error('AUDIENCE MISMATCH DETECTED. Expected Project ID:', projectId);
    }
    return res.status(403).json({ 
      error: 'Unauthorized: Invalid token', 
      details: error.message,
      code: error.code 
    });
  }
};
