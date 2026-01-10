const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] }
  },
  { _id: true, versionKey: false }
);

const contentSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: Date, default: Date.now },
    id: { type: String, required: true },
    images: { type: [imageSchema], default: [] },
    username: { type: String, required: true },
    views: { type: Number, default: 0 },
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    comments: { type: [commentSchema], default: [] }
  },
  { versionKey: false }
);

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['like', 'dislike', 'comment'], required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    contentId: { type: String, required: true },
    contentTitle: { type: String },
    targetType: { type: String, enum: ['content', 'comment'], default: 'content' },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  },
  { _id: true, versionKey: false }
);

// User schema to hold user details and an array of content
// ✅ User schema
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    emailVerified: { type: Boolean, default: false },
emailVerifiedAt: { type: Date },
emailVerifySentAt: { type: Date },

    content: { type: [contentSchema], default: [] },

    favorites: { type: [String], default: [] },


    notifications: { type: [notificationSchema], default: [] }
  },
  { versionKey: false }
);
   
userSchema.index({ "content.id": 1 });
userSchema.index({ favorites: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
