import express from 'express';
import { Donation } from '../models/Donation.ts';
import { User } from '../models/User.ts';
import { verifyToken, AuthRequest } from '../middleware/auth.ts';

const router = express.Router();

// Middleware to check if database is online
router.use((req, res, next) => {
  if (req.app.get('dbStatus') === 'OFFLINE') {
    return res.status(503).json({ error: 'Database connection offline' });
  }
  next();
});

// Create a donation (Strict Gatekeeping)
router.post('/', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Verification Required', 
        details: 'You must be verified by an admin before you can list donations.' 
      });
    }

    const donation = new Donation({
      ...req.body,
      donor: user._id,
      status: 'Pending'
    });

    await donation.save();
    res.status(201).json(donation);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all donations for the current donor
router.get('/my-donations', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const donations = await Donation.find({ donor: user._id }).sort({ createdAt: -1 });
    res.json(donations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available donations (For NGOs)
router.get('/available', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const donations = await Donation.find({ status: 'Pending' })
      .populate('donor', 'displayName email')
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// NGO: Get my claimed donations
router.get('/my-claims', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const donations = await Donation.find({ ngo: user._id })
      .populate('donor', 'displayName email pickupAddress')
      .sort({ updatedAt: -1 });
    res.json(donations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// NGO: Claim a donation
router.post('/:id/claim', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user || (user.role !== 'Orphanage' && user.role !== 'OldAgeHome')) {
      return res.status(403).json({ error: 'Permission denied. Only NGO accounts can claim donations.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Verification Required', 
        details: 'NGOs must be verified by an admin before they can claim donations.' 
      });
    }

    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    
    if (donation.status !== 'Pending') {
      return res.status(400).json({ error: 'Donation is no longer available' });
    }

    donation.ngo = user._id;
    donation.status = 'Accepted';

    await donation.save();
    res.json(donation);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Post-donation NGO Usage Report (Impact Analysis)
router.post('/:id/report', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user || (user.role !== 'Orphanage' && user.role !== 'OldAgeHome')) {
      return res.status(403).json({ error: 'Permission denied. Only NGO accounts can report impact.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Verification Required', 
        details: 'NGOs must be verified by an admin before they can submit impact reports.' 
      });
    }

    const { peopleHelped, usageDetails, evidenceImageUrl } = req.body;
    const donation = await Donation.findById(req.params.id);
    
    if (!donation) return res.status(404).json({ error: 'Donation not found' });

    donation.impactReport = {
      peopleHelped,
      usageDetails,
      evidenceImageUrl,
      submittedAt: new Date()
    };
    donation.status = 'Distributed';

    await donation.save();
    res.json(donation);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin Dashboard Analytics
router.get('/analytics/dashboard', verifyToken, async (req: AuthRequest, res: any) => {
  try {
    console.log('[Analytics] Dashboard stats requested by:', req.user?.email);
    // Check if user is Admin
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (user?.role !== 'Admin') {
      console.warn('[Analytics] Unauthorized access attempt by:', req.user?.email);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Resource Distribution: Pie chart of categories (sum of quantities)
    const categoryDistribution = await Donation.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.category', count: { $sum: '$items.quantity' } } }
    ]).catch(err => {
      console.error('[Analytics] Category aggregation failed:', err);
      return [];
    });

    // Human Reach: Timeline of people helped
    const humanReach = await Donation.aggregate([
      { $match: { 'impactReport.peopleHelped': { $exists: true } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$impactReport.submittedAt" } },
        totalHelped: { $sum: "$impactReport.peopleHelped" }
      }},
      { $sort: { _id: 1 } }
    ]).catch(err => {
      console.error('[Analytics] Human reach aggregation failed:', err);
      return [];
    });

    // Utilization Rate: % of items distributed or claimed per category
    const categoryUtilization = await Donation.aggregate([
      { $unwind: '$items' },
      { $group: {
        _id: '$items.category',
        total: { $sum: '$items.quantity' },
        distributed: { 
          $sum: { 
            $cond: [ 
              { $in: ['$status', ['Claimed', 'PickedUp', 'Distributed']] }, 
              '$items.quantity', 
              0 
            ] 
          }
        }
      }},
      { $project: {
        name: '$_id',
        rate: { 
          $cond: [
            { $eq: ['$total', 0] },
            0,
            { $multiply: [ { $divide: ['$distributed', '$total'] }, 100 ] }
          ]
        }
      }}
    ]).catch(err => {
      console.error('[Analytics] Utilization aggregation failed:', err);
      return [];
    });

    console.log('[Analytics] Sending results. Category items:', categoryDistribution.length);
    res.json({
      categoryDistribution: categoryDistribution.map(item => ({ name: item._id, value: item.count })),
      humanReach: humanReach.map(item => ({ date: item._id, helped: item.totalHelped })),
      categoryUtilization: categoryUtilization
    });
  } catch (error: any) {
    console.error('[Analytics] Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
