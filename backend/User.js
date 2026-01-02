const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  id: {
    type: String,
    required: true,
  },
  images: {
    type: [String],
    default: [],
  },
  username: {
    type: String,
    required: true,
  },
  // ✅ Add these:
  views: {
    type: Number,
    default: 0,
  },
  likes: {
    type: [String],
    default: [],
  },
  dislikes: {
    type: [String],
    default: [],
  },
 comments: {
  type: [
    new mongoose.Schema({
      username: String,
      text: String,
      timestamp: {
        type: Date,
         default: Date.now
      },
      likes: {
        type: [String],
        default: []
      },
      dislikes: {
        type: [String],
        default: []
      }
    }) // ✅ KEEP _id enabled by default
  ],
  default: []
}
});

// User schema to hold user details and an array of content
const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  content: { 
    type: [contentSchema], 
    default: [] // Embedded content objects
   },

   
  notifications: {
  type: [
    new mongoose.Schema({
      type: { type: String, enum: ['like', 'dislike', 'comment'], required: true },
      from: { type: String, required: true },
      to: { type: String, required: true }, // ✅ ADD THIS
      contentId: { type: String, required: true },
      contentTitle: { type: String },
      targetType: { type: String, enum: ['content', 'comment'], default: 'content' },
      timestamp: { type: Date, default: Date.now },
      read: { type: Boolean, default: false }
    }, { _id: true }) // ✅ ADD THIS
  ],
  default: []
}
});

userSchema.index({ "content.id": 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
