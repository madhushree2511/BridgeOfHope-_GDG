import express from 'express';
import { User } from '../models/User.ts';
import { verifyToken, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// POST /api/users/register
router.post('/register', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    const { uid, email } = req.user!;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Check if user already exists
    let user = await User.findOne({ firebaseUid: uid });

    if (user) {
      return res.status(200).json({ message: 'User already exists', user });
    }

    // Create new user
    user = new User({
      firebaseUid: uid,
      email,
      role,
      isVerified: false, // Default is false, needs admin approval for some roles
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// GET /api/users/profile
router.get('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/verify/:id - Admin Only
router.patch('/verify/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    // Basic admin check (could be refined with a dedicated middleware)
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

    const pendingUsers = await User.find({ verificationStatus: 'Pending', role: { $ne: 'Admin' } });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// POST /api/users/upload-doc - User upload
router.post('/upload-doc', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { name, url, docType } = req.body;
    if (!url || !docType) {
      return res.status(400).json({ error: 'URL and document type are required' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.uploadedDocuments.push({ name: name || 'Document', url, docType });
    user.verificationStatus = 'Pending'; // Reset to pending if new document uploaded
    await user.save();

    res.json({ message: 'Document uploaded successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

export default router;
