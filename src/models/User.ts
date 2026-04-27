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
  displayName: {
    type: String,
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
  },
  ngoDetails: {
    officialName: String,
    location: String,
    city: String,
    pincode: String,
    contactNumber: String,
    profileImageUrl: String,
  },
  donorDetails: {
    shopName: String,
    location: String,
    pincode: String,
    contactNumber: String,
    shopImageUrl: String,
  },
  contactNumber: {
    type: String,
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
