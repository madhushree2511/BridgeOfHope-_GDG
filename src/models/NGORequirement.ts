import mongoose from 'mongoose';

const ngoRequirementSchema = new mongoose.Schema({
  ngo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  documentUrl: { type: String }, // URL to PDF/CSV official requirements
  categoriesNeeded: [{
    type: String,
    enum: ['Food', 'Furniture', 'Books', 'Clothes', 'Stationery', 'Other']
  }],
  urgency: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  }
}, {
  timestamps: true,
});

export const NGORequirement = mongoose.model('NGORequirement', ngoRequirementSchema);
