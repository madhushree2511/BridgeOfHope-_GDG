import express from 'express';
import multer from 'multer';
import { User } from '../models/User.ts';
import { verifyToken, AuthRequest, getAuth } from '../middleware/auth.ts';
import mongoose from 'mongoose';
import { ADMIN_WHITELIST } from '../constants.ts';

const router = express.Router();

// Database connection check middleware
const dbCheck = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('Database unreachable at route:', req.originalUrl);
    return res.status(503).json({ 
      error: 'Database connection offline', 
      details: 'The server is unable to connect to MongoDB. Please check your Atlas configuration or MONGODB_URI.' 
    });
  }
  next();
};

router.use(dbCheck);

// Multer Setup - Using disk storage for viewable files
import fs from 'fs';
import path from 'path';
const LICENSE_DIR = 'uploads/licenses';
const PRODUCT_DIR = 'uploads/products';

[LICENSE_DIR, PRODUCT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = file.fieldname === 'license' ? LICENSE_DIR : PRODUCT_DIR;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// POST /api/users/register
router.post('/register', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { role, displayName } = req.body;
    const { uid, email } = req.user!;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Check if user already exists
    let user = await User.findOne({ firebaseUid: uid });

    if (user) {
      // Update displayName if provided and not set
      if (displayName && !user.displayName) {
        user.displayName = displayName;
        await user.save();
      }
      return res.status(200).json({ message: 'User already exists', user });
    }

    // Create new user
    const isWhitelisted = email && ADMIN_WHITELIST.includes(email);
    
    if (role === 'Admin' && !isWhitelisted) {
      return res.status(403).json({ error: 'Unauthorized Admin Email. Access Denied.' });
    }

    user = new User({
      firebaseUid: uid,
      email,
      displayName: displayName || (email ? email.split('@')[0] : 'User'),
      role: isWhitelisted ? 'Admin' : role,
      isVerified: isWhitelisted,
      verificationStatus: isWhitelisted ? 'Approved' : undefined
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error: any) {
    console.error('Registration error details:', error);
    res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
});

// POST /api/users/submit-verification - Real file selection + Profile details
router.post('/submit-verification', verifyToken, upload.fields([
  { name: 'license', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req: AuthRequest, res: any) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const licenseFile = files?.['license']?.[0];
    const profileImageFile = files?.['profileImage']?.[0];

    if (!licenseFile) {
      return res.status(400).json({ error: 'NGO License is required' });
    }

    const { officialName, location, city, pincode, contactNumber, shopName } = req.body;
    
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Role-specific validation
    if (user.role === 'Donor') {
      if (!shopName || !location || !pincode || !contactNumber) {
        return res.status(400).json({ error: 'All shop details (Name, Location, PIN, Contact) are required' });
      }
    } else {
      if (!officialName || !location || !city || !pincode || !contactNumber) {
        return res.status(400).json({ error: 'All organization details are required' });
      }
    }

    const licenseUrl = `/api/users/documents/licenses/${licenseFile.filename}`;
    
    user.verificationStatus = 'Pending';
    user.isVerified = false;

    if (user.role === 'Donor') {
      user.donorDetails = {
        shopName,
        location,
        pincode,
        contactNumber,
        shopImageUrl: profileImageFile ? `/api/users/documents/products/${profileImageFile.filename}` : user.donorDetails?.shopImageUrl
      };
    } else {
      user.ngoDetails = {
        officialName,
        location,
        city,
        pincode,
        contactNumber,
        profileImageUrl: profileImageFile ? `/api/users/documents/products/${profileImageFile.filename}` : user.ngoDetails?.profileImageUrl
      };
    }

    user.uploadedDocuments.push({
      name: licenseFile.originalname,
      url: licenseUrl,
      docType: user.role === 'Donor' ? 'Business License' : 'NGO License',
      uploadedAt: new Date()
    });

    await user.save();

    res.json({ 
      message: 'Verification request submitted successfully! Waiting for Admin Approval', 
      user 
    });
  } catch (error: any) {
    console.error('[VerificationSubmit] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit verification' });
  }
});

// POST /api/users/upload-product-image
router.post('/upload-product-image', verifyToken, (req, res, next) => {
  console.log('[ProductImageUpload] Initializing multer for field "image"');
  next();
}, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      console.warn('[ProductImageUpload] No file received');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[ProductImageUpload] Received file: ${file.filename} (${file.size} bytes)`);
    const fileUrl = `/api/users/documents/products/${file.filename}`;
    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error('[ProductImageUpload] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// Public route for product images (to support <img> tags which don't send auth headers)
router.get('/documents/products/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const rootDir = process.cwd();
    const filePath = path.resolve(rootDir, 'uploads/products', filename);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[FileAccess] Product image not found: ${filePath}`);
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send('Error retrieving file');
  }
});

// Route to serve protected license documents
router.get('/documents/licenses/:filename', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { filename } = req.params;
    console.log(`[FileAccess] Request for license: ${filename} from UID: ${req.user?.uid}`);

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      console.warn(`[FileAccess] User not found in DB for UID: ${req.user?.uid}`);
      return res.status(404).send('User not found');
    }

    const rootDir = process.cwd();
    const filePath = path.resolve(rootDir, 'uploads/licenses', filename);
    if (!fs.existsSync(filePath)) {
      console.error(`[FileAccess] File not found on disk: ${filePath}`);
      return res.status(404).send('File not found');
    }

    // Check permissions
    const isOwner = user.uploadedDocuments?.some(doc => doc.url.includes(filename));
    const isAdmin = user.role === 'Admin';
    
    console.log(`[FileAccess] Permissions check - User: ${user.email}, Role: ${user.role}, IsAdmin: ${isAdmin}, IsOwner: ${isOwner}`);

    if (!isOwner && !isAdmin) {
      console.warn(`[FileAccess] Access denied to license for user ${user.email}`);
      return res.status(403).send('Access denied');
    }

    console.log(`[FileAccess] Serving license: ${filename} to ${user.email}`);
    res.sendFile(filePath);
  } catch (error) {
    console.error(`[FileAccess] Error serving ${req.params.filename}:`, error);
    res.status(500).send('Error retrieving file');
  }
});

// GET /api/users/profile
router.get('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[ProfileFetch] User: ${user.email}, Status: ${user.verificationStatus}`);
    res.json(user);
  } catch (error: any) {
    console.error('[ProfileFetch] Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
});

// PATCH /api/users/verify/:id - Admin Only
router.patch('/verify/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const adminUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!adminUser || adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: Admin only' });
    }

    const { status } = req.body; // 'Approved' or 'Rejected'
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const userToVerify = await User.findById(req.params.id);
    if (!userToVerify) {
      return res.status(404).json({ error: 'User not found' });
    }

    userToVerify.verificationStatus = status;
    userToVerify.isVerified = (status === 'Approved');
    await userToVerify.save();

    res.json({ message: `User ${status.toLowerCase()} successfully`, user: userToVerify });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// GET /api/users/pending - Admin Only
router.get('/pending', verifyToken, async (req: AuthRequest, res) => {
  try {
    const adminUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!adminUser || adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: Admin only' });
    }

    const pendingUsers = await User.find({ 
      verificationStatus: 'Pending', 
      role: { $ne: 'Admin' }
    });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Admin: Get Users pending verification
router.get('/pending-approvals', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const admin = await User.findOne({ firebaseUid: req.user!.uid });
    if (admin?.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });

    const pending = await User.find({ 
      verificationStatus: 'Pending'
    });
    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { sendApprovalEmail, sendRejectionEmail } from '../services/mailService.ts';

// Admin: Approve/Reject User Verification
router.post('/approve/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const admin = await User.findOne({ firebaseUid: req.user!.uid });
    if (admin?.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });

    const { status, reason } = req.body; // 'Approved' or 'Rejected'
    const userToVerify = await User.findById(req.params.id);
    
    if (!userToVerify) return res.status(404).json({ error: 'User not found' });

    userToVerify.verificationStatus = status;
    userToVerify.isVerified = (status === 'Approved');

    await userToVerify.save();

    // Trigger email notification
    if (userToVerify.email) {
      if (status === 'Approved') {
        sendApprovalEmail(userToVerify.email, userToVerify.displayName || 'User');
      } else if (status === 'Rejected') {
        sendRejectionEmail(userToVerify.email, userToVerify.displayName || 'User', reason);
      }
    }

    res.json(userToVerify);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Get all registered users
router.get('/all-users', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const admin = await User.findOne({ firebaseUid: req.user!.uid });
    if (admin?.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });

    const users = await User.find({ 
      firebaseUid: { $ne: req.user!.uid }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a user profile (Admin or Self)
router.delete('/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const requesterUid = req.user!.uid;
    const admin = await User.findOne({ firebaseUid: requesterUid });
    const isAdmin = admin?.role === 'Admin';

    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check permissions: Admin or Self
    if (!isAdmin && userToDelete.firebaseUid !== requesterUid) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own account' });
    }

    console.log(`[DeleteUser] Request to delete user: ${userToDelete.email} (Firebase UID: ${userToDelete.firebaseUid}) by ${isAdmin ? 'Admin' : 'Self'}`);
    
    if (!userToDelete.firebaseUid) {
      console.warn(`[DeleteUser] User has no Firebase UID: ${userToDelete.email}. Proceeding with DB removal.`);
    } else {
      // Try to delete from Firebase Auth (might fail if Service/API is disabled in project)
      try {
        console.log(`[DeleteUser] Attempting Firebase Auth deletion for UID: ${userToDelete.firebaseUid}`);
        await getAuth().deleteUser(userToDelete.firebaseUid);
        console.log(`[DeleteUser] Firebase Auth record deleted successfully.`);
      } catch (firebaseErr: any) {
        // Specifically catch the "API not enabled" or "Service Disabled" errors
        if (firebaseErr.code === 'auth/internal-error' || firebaseErr.message.includes('identitytoolkit.googleapis.com')) {
          console.error(`[DeleteUser] FIREBASE CONFIG ERROR: Identity Toolkit API is likely disabled in your Google Cloud Console.`);
          console.warn(`[DeleteUser] Skipping Auth deletion. The user record in MongoDB will still be removed.`);
        } else {
          console.error(`[DeleteUser] Firebase Auth deletion warning:`, firebaseErr.code, firebaseErr.message);
        }
      }
    }

    // Hard delete from MongoDB - This allows the database to stay in sync even if Auth service fails
    console.log(`[DeleteUser] Hard deleting record from MongoDB: ${userToDelete._id}`);
    await User.findByIdAndDelete(userToDelete._id);
    
    console.log(`[DeleteUser] User removed from DB: ${userToDelete.email}`);
    res.json({ 
      message: 'User removed from database. (Note: Firebase Auth deletion may have been skipped due to API settings)',
      email: userToDelete.email
    });
  } catch (error: any) {
    console.error(`[DeleteUser] Critical Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/system/wipe - Super Admin Cleanup
router.post('/system/wipe', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const requester = await User.findOne({ firebaseUid: req.user!.uid });
    if (!requester || requester.role !== 'Admin') {
      return res.status(403).json({ error: 'Super Admin access required' });
    }

    console.log(`[SystemWipe] TRUNCATION REQUESTED BY: ${requester.email}`);

    const auth = getAuth();
    let firebaseDeleted = 0;
    let nextToken: string | undefined;

    // 1. Purge Firebase Auth
    try {
      do {
        const listUsers = await auth.listUsers(1000, nextToken);
        const uids = listUsers.users.map(u => u.uid);
        if (uids.length > 0) {
          const deleteBatch = await auth.deleteUsers(uids);
          firebaseDeleted += deleteBatch.successCount;
        }
        nextToken = listUsers.pageToken;
      } while (nextToken);
    } catch (authError: any) {
      if (authError.message.includes('identitytoolkit.googleapis.com')) {
        console.error(`[SystemWipe] Identity Toolkit API is likely disabled. Skipping Firebase Auth purge.`);
      } else {
        console.error(`[SystemWipe] Firebase Auth purge failed:`, authError.message);
      }
    }

    // 2. Purge MongoDB
    // We use deleteMany to clear the documents while preserving collections
    await User.deleteMany({});
    
    // Dynamically clear other collections if they exist
    const collections = ['donations', 'ngorequirements', 'usagereports'];
    for (const collName of collections) {
      try {
        await mongoose.connection.db.collection(collName).deleteMany({});
      } catch (e) {
        console.warn(`[SystemWipe] Could not clear collection ${collName}:`, (e as Error).message);
      }
    }

    console.log(`[SystemWipe] Successfully cleared ${firebaseDeleted} Firebase accounts and all DB records.`);
    res.json({ 
      message: 'System wipe successful. All accounts and data have been permanently removed.',
      accountsRemoved: firebaseDeleted
    });
  } catch (error: any) {
    console.error('[SystemWipe] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
