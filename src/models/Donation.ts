import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ngo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Recipient NGO (Orphanage/OldAgeHome)
  },
  items: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    category: { 
      type: String, 
      enum: ['Food', 'Furniture', 'Books', 'Clothes', 'Other'], 
      required: true 
    },
    condition: { 
      type: String, 
      enum: ['New', 'Good', 'Fair'],
      required: function(this: any) { return this.category !== 'Food'; }
    },
    expiryDate: {
      type: Date,
      required: function(this: any) { return this.category === 'Food'; }
    },
    mrpPrice: { type: Number },
    wishingPrice: { type: Number },
    imageUrl: { type: String }
  }],
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Collected', 'Distributed', 'Cancelled'],
    default: 'Pending'
  },
  pickupAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  contactNumber: {
    type: String,
  },
  impactReport: {
    peopleHelped: Number,
    usageDetails: String,
    evidenceImageUrl: String,
    submittedAt: Date
  }
}, {
  timestamps: true,
});

export const Donation = mongoose.model('Donation', donationSchema);
