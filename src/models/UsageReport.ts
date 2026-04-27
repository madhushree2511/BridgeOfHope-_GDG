import mongoose from 'mongoose';

const UsageReportSchema = new mongoose.Schema({
  ngo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  itemsUsed: [{
    name: String,
    quantity: Number
  }],
  peopleHelped: { type: Number, required: true },
  impactDescription: { type: String },
  evidenceImageUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const UsageReport = mongoose.model('UsageReport', UsageReportSchema);
