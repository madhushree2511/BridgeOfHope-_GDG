import express from 'express';
import { NGORequirement } from '../models/NGORequirement.ts';
import { User } from '../models/User.ts';
import { Donation } from '../models/Donation.ts';
import { verifyToken, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// List all NGO Requirements (Dataset Hub)
router.get('/requirements', async (req, res) => {
  try {
    const requirements = await NGORequirement.find()
      .populate('ngo', 'displayName email role ngoDetails')
      .sort({ urgency: 1 });
    res.json(requirements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Post a new requirement (For NGOs or Admin)
router.post('/requirements', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    const isAdmin = user?.role === 'Admin';
    const isNGO = user?.role === 'Orphanage' || user?.role === 'OldAgeHome';

    if (!user || (!isNGO && !isAdmin)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (isNGO && !user.isVerified) {
      return res.status(403).json({ 
        error: 'Verification Required', 
        details: 'NGOs must be verified by an admin before they can post requirements.' 
      });
    }

    const requirement = new NGORequirement({
      ...req.body,
      ngo: isAdmin ? req.body.ngo || user._id : user._id
    });

    await requirement.save();
    res.status(201).json(requirement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// NGO: Delete my own requirement
router.delete('/my-requirements/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const requirement = await NGORequirement.findById(req.params.id);
    if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

    // Check if the user is the owner or an admin
    if (requirement.ngo.toString() !== user._id.toString() && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await NGORequirement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a requirement
router.delete('/requirements/:id', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (user?.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });

    await NGORequirement.findByIdAndDelete(req.params.id);
    res.json({ message: 'Requirement deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin/Donors: Fetch all verified NGOs (for selection in forms)
router.get('/verified-ngos', async (req, res) => {
  try {
    const ngos = await User.find({ 
      role: { $in: ['Orphanage', 'OldAgeHome'] },
      isVerified: true 
    }).select('displayName _id email');
    res.json(ngos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trust Score Implementation
// TrustScore = (0.4 * GoogleRating) + (0.6 * InternalRating)
router.get('/trust-score/:ngoId', async (req, res) => {
  try {
    const ngo = await User.findById(req.params.ngoId);
    if (!ngo || !ngo.isVerified) {
      return res.json({
        ngoId: req.params.ngoId,
        googleRating: 0,
        internalRating: 0,
        trustScore: "0.00",
        formula: 'TrustScore = 0 (NGO Not Verified)'
      });
    }

    // In a real app, you'd fetch googleRating from Google Business API
    // Mocking Google Rating for this demo
    const googleRating = 4.2; 
    
    // Internal Rating: Average of impact report ratings or specific reviews (to be implemented)
    // For now, calculating based on successful distribution rate
    const totalDonations = await Donation.countDocuments({ ngo: req.params.ngoId });
    const successDonations = await Donation.countDocuments({ ngo: req.params.ngoId, status: 'Distributed' });
    
    const internalRating = totalDonations > 0 ? (successDonations / totalDonations) * 5 : 5;
    
    const trustScore = (0.4 * googleRating) + (0.6 * internalRating);
    
    res.json({
      ngoId: req.params.ngoId,
      googleRating,
      internalRating,
      trustScore: trustScore.toFixed(2),
      formula: 'TrustScore = (0.4 * GoogleRating) + (0.6 * InternalRating)'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { UsageReport } from '../models/UsageReport.ts';

// NGO: Submit Usage Report
router.post('/usage-report', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user || (user.role !== 'Orphanage' && user.role !== 'OldAgeHome')) {
      return res.status(403).json({ error: 'Only NGOs can submit reports' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Verification Required', 
        details: 'NGOs must be verified by an admin before they can submit impact reports.' 
      });
    }

    const report = new UsageReport({
      ...req.body,
      evidenceImageUrl: req.body.evidenceImageUrl,
      ngo: user._id
    });

    await report.save();
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Get aggregate utilization stats
router.get('/utilization-stats', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (user?.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });

    // Mocking some data for visualization if no real reports yet
    const stats = [
      { name: 'Food', rate: 85 },
      { name: 'Furniture', rate: 40 },
      { name: 'Books', rate: 95 },
      { name: 'Clothes', rate: 70 },
      { name: 'Stationery', rate: 90 },
    ];
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
