import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ['Admin', 'Donor', 'Orphanage', 'OldAgeHome'],
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  uploadedDocuments: [
    {
      name: String,
      url: String,
      docType: String, // e.g., 'Business License', 'ID Proof'
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

export const User = mongoose.model('User', userSchema);
