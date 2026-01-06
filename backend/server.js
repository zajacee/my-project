if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// ===== ZOHO MAIL API (no SMTP) =====
let zohoTokenCache = { accessToken: null, expiresAt: 0 };

async function getZohoAccessToken() {
  const domain = process.env.ZOHO_ACCOUNT_DOMAIN || "zoho.eu";

  if (zohoTokenCache.accessToken && Date.now() < zohoTokenCache.expiresAt - 60_000) {
    return zohoTokenCache.accessToken;
  }

  const tokenRes = await fetch(`https://accounts.${domain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`Zoho token error: ${JSON.stringify(tokenJson)}`);
  }

  const expiresInSec = Number(tokenJson.expires_in) || 3600;
  zohoTokenCache.accessToken = tokenJson.access_token;
  zohoTokenCache.expiresAt = Date.now() + expiresInSec * 1000;

  return zohoTokenCache.accessToken;
}

async function sendZohoMail({ toAddress, subject, html, replyTo }) {
  const domain = process.env.ZOHO_ACCOUNT_DOMAIN || "zoho.eu";
  const accessToken = await getZohoAccessToken();

  const payload = {
    fromAddress: process.env.ZOHO_FROM_ADDRESS,
    toAddress,
    subject,
    content: html,
    mailFormat: "html",
  };

  if (replyTo) payload.replyTo = replyTo;

  const resp = await fetch(
    `https://mail.${domain}/api/accounts/${process.env.ZOHO_ACCOUNT_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Zoho send error: ${resp.status} ${JSON.stringify(json)}`);
  }

  return json;
}

const cloudinary = require('cloudinary').v2;
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer'); // Import Multer

const { randomUUID } = require('crypto');
const { Types } = require('mongoose'); // at the top of your file

const app = express();

const crypto = require('crypto');

const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET;
if (!PASSWORD_RESET_SECRET) {
  throw new Error("Missing PASSWORD_RESET_SECRET env variable");
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signResetToken(payloadObj) {
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = base64url(
    crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(payload).digest()
  );
  return `${payload}.${sig}`;
}

function verifyResetToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;

  const expected = base64url(
    crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(payload).digest()
  );

  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (!json?.uid || !json?.exp) return null;
  if (Date.now() > json.exp) return null;

  return json;
}


// ✅ Behind Render proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  throw new Error("Missing SECRET_KEY env variable");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("⚠️ Cloudinary delete failed:", publicId, err.message);
  }
}

const mongoose = require('mongoose');
const User = require('./User'); // Adjust the path accordingly

// Multer config for Cloudinary (memory storage)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Je možné nahrať iba obrazové súbory'));
    }

    cb(null, true);
  }
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
  });
  
// Middleware

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://dajtovon.sk';

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));


// ================= FORGOT PASSWORD =================
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
    if (!emailOk) return res.status(400).json({ message: "Zadajte platný e-mail." });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // vždy odpovedz OK (anti-enumeration)
    res.json({ success: true, message: "Ak e-mail existuje, poslali sme odkaz na obnovenie hesla." });

    if (!user) return;

    const token = signResetToken({
      uid: String(user._id),
      exp: Date.now() + 30 * 60 * 1000
    });

    const base = (process.env.PUBLIC_FRONTEND_URL || 'https://dajtovon.sk').replace(/\/+$/, '');
    const resetUrl = `${base}/reset-password.html?token=${encodeURIComponent(token)}`;

    await sendZohoMail({
      toAddress: user.email,
      subject: "Obnovenie hesla – DajToVon",
      html: `
        <p>Prišla nám požiadavka na obnovenie hesla k Vášmu účtu.</p>
        <p>Pre obnovenie hesla prosím kliknite na odkaz nižšie (platný 30 minút):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <hr>
        <p>Ak ste o obnovenie hesla nepožiadali vy, tento e-mail prosím ignorujte.
Z bezpečnostných dôvodov sa v tomto prípade na Vašom účte nevykonajú žiadne zmeny.</p>
      `
    });

  } catch (err) {
    console.error("❌ forgot-password:", err);
    res.json({ success: true, message: "Ak e-mail existuje, poslali sme odkaz na obnovenie hesla." });
  }
});

// ================= RESET PASSWORD =================
app.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ message: "Neplatná požiadavka." });
    }

    // min. 8 znakov + aspoň jedna číslica
    const passwordOk = /^(?=.*\d).{8,}$/.test(String(password));
    if (!passwordOk) {
      return res.status(400).json({
        message: "Heslo musí mať minimálne 8 znakov a aspoň jednu číslicu."
      });
    }

    const payload = verifyResetToken(token);
    if (!payload) {
      return res.status(400).json({
        message: "Odkaz je neplatný alebo expirovaný."
      });
    }

    const user = await User.findById(payload.uid);
    if (!user) {
      return res.status(400).json({
        message: "Odkaz je neplatný alebo expirovaný."
      });
    }

    user.password = await bcrypt.hash(String(password), 10);
    await user.save();

    res.json({
      success: true,
      message: "Heslo bolo úspešne zmenené."
    });

  } catch (err) {
    console.error("❌ reset-password:", err);
    res.status(500).json({
      message: "Chyba servera. Skúste neskôr."
    });
  }
});



// === Simple in-memory rate limiter (IP / user / optional resource) ===
const RATE_STORE = new Map();

function makeRateLimiter({ windowMs, max, keyFn, onLimit }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);

    let bucket = RATE_STORE.get(key);
    if (!bucket) {
      bucket = [];
      RATE_STORE.set(key, bucket);
    }
    while (bucket.length && (now - bucket[0]) > windowMs) bucket.shift();

    if (bucket.length >= max) {
      const retryAfterSec = Math.ceil((windowMs - (now - bucket[0])) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      if (typeof onLimit === 'function') onLimit(req, key);
      return res.status(429).json({ message: `Príliš veľa požiadaviek. Skúste to prosím znova o ${retryAfterSec} s.` });
    }

    bucket.push(now);
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of RATE_STORE) {
    if (!bucket.length) { RATE_STORE.delete(key); continue; }
    const last = bucket[bucket.length - 1];
    if (now - last > 20 * 60_000) RATE_STORE.delete(key);
  }
}, 10 * 60_000).unref();

// app.set('trust proxy', true); // zapni v produkcii za proxy

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}


// ✅ **Authentication Middleware**
const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized access. Please log in." });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token" });
        }
        req.user = decoded; 
        next();
    });
};

// Apply this middleware to protected routes
app.get('/protected-route', authenticateUser, (req, res) => {
    // Your protected logic here
    res.json({ message: "You have access to this protected route." });
  });

  app.get('/api/me', authenticateUser, (req, res) => {
  res.json({
    username: req.user.username,
    email: req.user.email   // pridali sme email
  });
});


// ✅ **User Registration**
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Prosím, vyplňte všetky polia" });
    }

    try {
        // Check if the user already exists in the database
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: "Zadané používateľské meno alebo e-mail už existuje" });
        }

        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user instance
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            content: []  // Empty content field for the new user
        });

        // Save the user to the database
        await newUser.save();

        res.status(201).json({ message: "Registrácia prebehla úspešne!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba servera, skúste to prosím neskôr" });
    }
});

// ✅ **User Login**
app.post('/login', async (req, res) => {
    const { email, username, password } = req.body;

    try {
        // Find the user by email or username
        const user = await User.findOne({ $or: [{ email }, { username }] });

        // If the user doesn't exist or the password is incorrect
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Neplatné prihlasovacie údaje" });
        }

        // Create a JWT token with the user's details
        const token = jwt.sign({ username: user.username, email: user.email }, SECRET_KEY, { expiresIn: '1h' });

       // Set the token in cookies
       const isProd = process.env.NODE_ENV === 'production';

res.cookie('token', token, {
  httpOnly: true,
  secure: isProd,                 // prod true (HTTPS)
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  maxAge: 3600000
});


        // Send a success message with the user's username
        res.json({ message: "Prihlásenie prebehlo úspešne!", username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba servera, skúste to prosím neskôr" });
    }
});

// ✅ **Add Content (Updated)**: Handle image file uploads
app.post('/api/content', authenticateUser, (req, res) => {
  upload.array('images', 6)(req, res, async (err) => {
    // ✅ Multer / fileFilter error -> pošli pekný JSON pre frontend
    if (err) {
      if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ message: 'Maximálna povolená veľkosť obrázku je 5 MB.' });
        }
        return res.status(400).json({ message: 'Chyba pri nahrávaní obrázkov. Maximálny povolený počet súborov je 6.' });
      }
      // napr. txt súbor -> "Iba obrazové súbory sú povolené"
      return res.status(400).json({ message: err.message || 'Neplatný súbor.' });
    }

const { topic, content, category, date } = req.body;
const loggedInUser = req.user.username;

if (!topic?.trim() || !content?.trim() || !category?.trim() || !date?.trim()) {
  return res.status(400).json({ message: "Prosím, vyplňte všetky polia" });
}

try {
  const user = await User.findOne({ username: loggedInUser });

  if (!user) {
    return res.status(404).json({ message: "Zadaný používateľ neexistuje" });
  }

  const uploaded = await Promise.all(
  (req.files || []).map(file =>
    uploadBufferToCloudinary(file.buffer, {
      folder: 'dajtovon/posts',
      resource_type: 'image',
    })
  )
);

const images = uploaded.map(r => ({
  url: r.secure_url,
  publicId: r.public_id
}));

  const newContent = {
    topic,
    content,
    category,
    date: new Date(date),
    id: randomUUID(),
    images: images,
    username: loggedInUser,
    views: 0,
    likes: [],
    dislikes: [],
    comments: []
  };

  user.content.push(newContent);
  await user.save();

  return res.json({
    success: true,
    message: "Obsah bol pridaný!",
    id: newContent.id
  });
} catch (error) {
  console.error("❌ Chyba pri ukladaní obsahu:", error);
  return res.status(500).json({ message: "Chyba servera" });
}
});
});


// ✅ **Get ALL Public Content**
app.get('/all-content', async (req, res) => {
    try {
        // Fetch all users and their content from the database
        const allUsers = await User.find({}); // Fetch all users from the database

        // Map through all users to get their content
        const allContent = allUsers.flatMap(user => user.content.map(content => ({
            username: user.username,
            content
        })));

        const enrichedContent = allUsers.flatMap(user => 
  user.content.map(item => ({
    username: user.username,
    content: {
      ...item.toObject(),
      views: item.views || 0,
       likesCount: item.likes?.length || 0,
    dislikesCount: item.dislikes?.length || 0,
    commentsCount: item.comments?.length || 0
    }
  }))
);

res.json({ allContent: enrichedContent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba servera, skúste to prosím neskôr" }); // Server error in Slovak
    }
});

// ✅ Register a view on content open
app.post('/view/:id', async (req, res) => {
  const { id } = req.params;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });  // ✅ add this check!

  item.views = (item.views || 0) + 1;

  await user.save();
  res.json({ success: true });
});

app.post('/like/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.username;
  const username = req.user.username; // ✅ Add this line

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  if (!Array.isArray(item.likes)) {
    item.likes = [];
  }
  if (!Array.isArray(item.dislikes)) {
    item.dislikes = [];
  }

  if (!item.likes.includes(userId)) {
    item.likes.push(userId);
    item.dislikes = item.dislikes.filter(u => u !== userId);
  }

     if (username !== user.username) { 
      await User.updateOne(
  { username: user.username },
  {
    $push: {
      notifications: {
        $each: [{
          type: 'like',
          from: username,
          to: user.username, // ✅ ADD THIS
          contentId: item.id,
          contentTitle: item.topic,
          targetType: 'content',
          timestamp: new Date()
        }],
        $position: 0, // Add to beginning       
      }
    }
  }
);

// Fetch the updated user to get the _id of the latest notification
const updatedUser = await User.findOne({ username: user.username });
const latestNotification = { ...updatedUser.notifications[0].toObject(), to: user.username };

// Emit with full notification including `_id`
const sockets = connectedUsers[latestNotification.to];
console.log('📨 Attempting to send notification:');
console.log({
  to: latestNotification.to,
  from: latestNotification.from,
  sockets: sockets ? Array.from(sockets) : '❌ No sockets found',
  notification: latestNotification
});

if (sockets) {
  for (const socketId of sockets) {
    console.log(`📤 Emitting to socket ${socketId}`);
    io.to(socketId).emit('notification', latestNotification);
  }
} else {
  console.warn(`⚠️ No active sockets found for ${latestNotification.to}`);
}
}

  await user.save();
  res.json({ success: true });
});

app.post('/dislike/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.username;
  const username = req.user.username; // ✅ Add this line

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  // Ensure likes/dislikes arrays exist
  if (!Array.isArray(item.dislikes)) item.dislikes = [];
  if (!Array.isArray(item.likes)) item.likes = [];

  // Handle dislike logic
  if (!item.dislikes.includes(userId)) {
    item.dislikes.push(userId);
    item.likes = item.likes.filter(u => u !== userId); // Remove like if exists
  }

  
   if (username !== user.username) { 
    await User.updateOne(
  { username: user.username },
  {
    $push: {
      notifications: {
        $each: [{
          type: 'dislike',
          from: username,
          to: user.username, // ✅ ADD THIS
          contentId: item.id,
          contentTitle: item.topic,
          targetType: 'content',
          timestamp: new Date()
        }],
        $position: 0, // Add to beginning       
      }
    }
  }
);

// Fetch the updated user to get the _id of the latest notification
const updatedUser = await User.findOne({ username: user.username });
const latestNotification = { ...updatedUser.notifications[0].toObject(), to: user.username };

// Emit with full notification including `_id`
const sockets = connectedUsers[latestNotification.to];
console.log('📨 Attempting to send notification:');
console.log({
  to: latestNotification.to,
  from: latestNotification.from,
  sockets: sockets ? Array.from(sockets) : '❌ No sockets found',
  notification: latestNotification
});

if (sockets) {
  for (const socketId of sockets) {
    console.log(`📤 Emitting to socket ${socketId}`);
    io.to(socketId).emit('notification', latestNotification);
  }
} else {
  console.warn(`⚠️ No active sockets found for ${latestNotification.to}`);
}
 }

  await user.save();
  res.json({ success: true });
 });

app.post('/comment/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const username = req.user.username;

  if (!text?.trim()) return res.status(400).json({ error: "Comment text is required" });

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  if (!Array.isArray(item.comments)) {
    item.comments = []; // Initialize comments array if missing
  }


item.comments.push({
  _id: new Types.ObjectId(), // ✅ assign MongoDB ID manually
  username,
  text,
  timestamp: new Date(),
  likes: [],
  dislikes: []
});

  const userId = req.user.username;
  

 
   if (username !== user.username) { 
    await User.updateOne(
  { username: user.username },
  {
    $push: {
      notifications: {
        $each: [{
          type: 'comment',
          from: username,
          to: user.username, // ✅ ADD THIS
          contentId: item.id,
          contentTitle: item.topic,
          targetType: 'content',
          timestamp: new Date()
        }],
        $position: 0, // Add to beginning       
      }
    }
  }
);

// Fetch the updated user to get the _id of the latest notification
const updatedUser = await User.findOne({ username: user.username });
const latestNotification = { ...updatedUser.notifications[0].toObject(), to: user.username };

// Emit with full notification including `_id`
const sockets = connectedUsers[latestNotification.to];
console.log('📨 Attempting to send notification:');
console.log({
  to: latestNotification.to,
  from: latestNotification.from,
  sockets: sockets ? Array.from(sockets) : '❌ No sockets found',
  notification: latestNotification
});

if (sockets) {
  for (const socketId of sockets) {
    console.log(`📤 Emitting to socket ${socketId}`);
    io.to(socketId).emit('notification', latestNotification);
  }
} else {
  console.warn(`⚠️ No active sockets found for ${latestNotification.to}`);
}
 }


  await user.save();
  res.json({ success: true });
});


app.post('/comment-like/:id/:commentId', authenticateUser, async (req, res) => {
  const { id, commentId } = req.params;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  const comment = item.comments.find(c => String(c._id) === String(commentId));
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  comment.likes = comment.likes || [];
  comment.dislikes = comment.dislikes || [];

  const alreadyLiked = comment.likes.includes(username);
  const alreadyDisliked = comment.dislikes.includes(username);

  if (alreadyLiked) {
    // toggle off like
    comment.likes = comment.likes.filter(u => u !== username);
  } else {
    comment.likes.push(username);
    if (alreadyDisliked) {
      comment.dislikes = comment.dislikes.filter(u => u !== username); // remove dislike
    }
  }

     
  if (username !== comment.username) {
  await User.updateOne(
    { username: comment.username },
    {
      $push: {
        notifications: {
          $each: [{
            type: 'like',
            from: username,
            to: comment.username,
            contentId: item.id,
            contentTitle: item.topic,
            targetType: 'comment',
            timestamp: new Date()
          }],
          $position: 0,         
        }
      }
    }
  );

  const updatedUser = await User.findOne({ username: comment.username });
  const latestNotification = { ...updatedUser.notifications[0].toObject(), to: comment.username };

  const sockets = connectedUsers[comment.username];
  console.log('📨 Attempting to send notification to comment author:', comment.username);

  if (sockets) {
    for (const socketId of sockets) {
      console.log(`📤 Emitting to socket ${socketId}`);
      io.to(socketId).emit('notification', latestNotification);
    }
  } else {
    console.warn(`⚠️ No active sockets found for ${comment.username}`);
  }
}

  await user.save();
  res.json({ success: true });
});


app.post('/comment-dislike/:id/:commentId', authenticateUser, async (req, res) => {
  const { id, commentId } = req.params;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  const comment = item.comments.find(c => String(c._id) === String(commentId));
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  comment.likes = comment.likes || [];
  comment.dislikes = comment.dislikes || [];

  const alreadyLiked = comment.likes.includes(username);
  const alreadyDisliked = comment.dislikes.includes(username);

  if (alreadyDisliked) {
    // 🔁 Toggle off dislike
    comment.dislikes = comment.dislikes.filter(u => u !== username);
  } else {
    comment.dislikes.push(username);
    if (alreadyLiked) {
      comment.likes = comment.likes.filter(u => u !== username); // 🔁 Remove like if switching
    }
  }

 if (username !== comment.username) {
  await User.updateOne(
    { username: comment.username },
    {
      $push: {
        notifications: {
          $each: [{
            type: 'dislike',
            from: username,
            to: comment.username,
            contentId: item.id,
            contentTitle: item.topic,
            targetType: 'comment',
            timestamp: new Date()
          }],
          $position: 0,         
        }
      }
    }
  );

  const updatedUser = await User.findOne({ username: comment.username });
  const latestNotification = { ...updatedUser.notifications[0].toObject(), to: comment.username };

  const sockets = connectedUsers[comment.username];
  console.log('📨 Attempting to send notification to comment author:', comment.username);

  if (sockets) {
    for (const socketId of sockets) {
      console.log(`📤 Emitting to socket ${socketId}`);
      io.to(socketId).emit('notification', latestNotification);
    }
  } else {
    console.warn(`⚠️ No active sockets found for ${comment.username}`);
  }
}

  await user.save();
  res.json({ success: true });
});


// ✅ Neutralize like/dislike (remove both)
app.post('/comment-neutral/:id/:commentId', authenticateUser, async (req, res) => {
  const { id, commentId } = req.params;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  const comment = item.comments.find(c => String(c._id) === String(commentId));
  if (!comment) return res.status(404).json({ error: "Comment not found" });

 if (!comment.likes) comment.likes = [];
if (!comment.dislikes) comment.dislikes = [];

comment.likes = comment.likes.filter(u => u !== username);
comment.dislikes = comment.dislikes.filter(u => u !== username);

  await user.save();
  res.status(200).json({ message: "Reaction reset" });
});

app.post('/neutral/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  item.likes = (item.likes || []).filter(u => u !== username);
  item.dislikes = (item.dislikes || []).filter(u => u !== username);

  await user.save();
  res.status(200).json({ message: "Reaction neutralized" });
});

// ✅ Edit comment by timestamp
app.put('/comment/:id/:commentId', authenticateUser, async (req, res) => {
  const { id, commentId } = req.params;
  const { text } = req.body;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  const comment = item.comments.find(c => String(c._id) === String(commentId));
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  if (comment.username !== username) {
    return res.status(403).json({ error: "Not authorized to edit this comment" });
  }

  comment.text = text;
  await user.save();
  res.json({ success: true });
});


// ✅ Delete comment by timestamp
app.delete('/comment/:id/:commentId', authenticateUser, async (req, res) => {
  const { id, commentId } = req.params;
  const username = req.user.username;

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item || !Array.isArray(item.comments)) {
    return res.status(404).json({ error: "Comments not found" });
  }

  const index = item.comments.findIndex(c => String(c._id) === String(commentId));
  if (index === -1) return res.status(404).json({ error: "Comment not found" });

  const comment = item.comments[index];
  if (comment.username !== username) {
    return res.status(403).json({ error: "Not authorized to delete this comment" });
  }

  item.comments.splice(index, 1);
  await user.save();
  res.json({ success: true });
});


app.get('/stats/:id', async (req, res) => {
  const { id } = req.params;
  let currentUser = null;

  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = jwt.verify(token, SECRET_KEY);
      currentUser = decoded.username;
    }
  } catch (e) {
    // Not logged in, fine
  }

  const user = await User.findOne({ "content.id": id });
  if (!user) return res.status(404).json({ error: "Content not found" });

  const item = user.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ error: "Content item not found" });

  const userReactions = {};

  if (currentUser) {
    // 🔁 Add comment reactions
    for (const comment of item.comments || []) {
      if (comment.likes?.includes(currentUser)) {
        userReactions[String(comment._id)] = "like";
      } else if (comment.dislikes?.includes(currentUser)) {
        userReactions[String(comment._id)] = "dislike";
      }
    }

    // ✅ Add content-level reaction too
    if (item.likes?.includes(currentUser)) {
      userReactions['content'] = "like";
    } else if (item.dislikes?.includes(currentUser)) {
      userReactions['content'] = "dislike";
    }
  }

  res.json({
    views: item.views || 0,
    likes: item.likes?.length || 0,
    dislikes: item.dislikes?.length || 0,
    userReactions,
    comments: (item.comments || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(comment => ({
        _id: comment._id,
        username: comment.username,
        text: comment.text,
        timestamp: comment.timestamp,
        likes: comment.likes?.length || 0,
        dislikes: comment.dislikes?.length || 0
      }))
  });
});


// ✅ **Get User-Specific Content (Private)**
app.get('/user-content', authenticateUser, async (req, res) => {
    const loggedInUser = req.user.username;

    try {
        const user = await User.findOne({ username: loggedInUser });

        if (user) {
            // Wrap each content item with a username key
            const wrappedContent = user.content.map(contentItem => ({
                username: user.username,
                content: contentItem
            }));

            res.json({ userContent: wrappedContent }); // Match the structure of /all-content
        } else {
            res.status(404).json({ message: "Zadaný používateľ neexistuje" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba servera, skúste to prosím neskôr" });
    }
});

// ✅ **Logout**
app.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  res.json({ message: "Odhlásenie prebehlo úspešne!" });
});

// ✅ DELETE a content item
app.delete('/delete-content/:id', authenticateUser, async (req, res) => {
    const loggedInUser = req.user.username;
    const contentIdToDelete = req.params.id;
  
    try {
      const user = await User.findOne({ username: loggedInUser });
  
      if (!user) {
        return res.status(404).json({ message: "Používateľ nenájdený" });
      }
  
      // Find the content to delete
      const contentToDelete = user.content.find(item => String(item.id) === String(contentIdToDelete));

  
      if (!contentToDelete) {
        return res.status(404).json({ message: "Obsah s daným ID neexistuje" });
      }
  
      if (Array.isArray(contentToDelete.images)) {
  await Promise.all(
    contentToDelete.images.map(img =>
      deleteFromCloudinary(img.publicId)
    )
  );
}
 
      // Remove the content from user's content array
      user.content = user.content.filter(item => String(item.id) !== String(contentIdToDelete));
      await user.save();
  
      res.json({ success: true, message: "Obsah bol odstránený" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Chyba servera pri mazaní obsahu" });
    }
  });


  // ✅ Supports ?limit=5 or ?limit=all
app.get('/api/notifications', authenticateUser, async (req, res) => {
  const username = req.user.username;
  const limitParam = req.query.limit;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "Používateľ nenájdený" });

    let sorted = [...user.notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (limitParam !== 'all') {
      const limit = parseInt(limitParam) || 5;
      sorted = sorted.slice(0, limit);
    }

    res.json(sorted);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ message: "Chyba servera pri načítaní notifikácií" });
  }
});

// Mark single notification as read
app.post('/api/notifications/read/:id', authenticateUser, async (req, res) => {
  const { username } = req.user;
  const notificationId = req.params.id;

  if (!notificationId || notificationId === "undefined") {
    console.warn("⚠️ Invalid notification ID:", notificationId);
    return res.status(400).json({ error: "Invalid notification ID" });
  }

  try {
    console.log("🔵 Marking notification read for:", username, notificationId);

    const result = await User.updateOne(
      { username, "notifications._id": notificationId },
      { $set: { "notifications.$.read": true } }
    );

    if (result.modifiedCount > 0) {
      return res.sendStatus(200);
    } else {
      console.warn("⚠️ Notification not found or already read.");
      return res.sendStatus(404);
    }
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.sendStatus(500);
  }
});


// ✅ PUT update content by ID
app.put('/edit-content/:id', authenticateUser, (req, res) => {
  upload.array('images', 6)(req, res, async (err) => {
    // ✅ Multer / fileFilter error -> JSON pre frontend
    if (err) {
      if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ message: 'Maximálna povolená veľkosť obrázku je 5 MB.' });
        }
        return res.status(400).json({ message: 'Chyba pri nahrávaní obrázkov. Maximálny povolený počet súborov je 6.' });
      }
      return res.status(400).json({
        message: err.message || 'Nahraný súbor má nepodporovaný formát.'
      });
    }

    const loggedInUser = req.user.username;
    const contentIdToEdit = req.params.id;
    const { topic, content, category, existingImages } = req.body;

    // Parse kept images
    let keepImages = [];
    try {
        if (existingImages) {
            keepImages = JSON.parse(existingImages); // Array of { url, publicId }
        }
    } catch (err) {
        console.error("❌ Failed to parse existingImages:", err);
    }


    // 🔐 SAFETY FILTER – povolí len { url, publicId }
keepImages = (keepImages || []).filter(
  x => x && typeof x === 'object' && x.url && x.publicId
);
    

    try {
        const user = await User.findOne({ username: loggedInUser });
        if (!user) {
            return res.status(404).json({ message: "Používateľ nenájdený" });
        }

        const contentItem = user.content.find(item => String(item.id) === String(contentIdToEdit));
        if (!contentItem) {
            return res.status(404).json({ message: "Obsah s daným ID neexistuje" });
        }

        const uploaded = await Promise.all(
  (req.files || []).map(file =>
    uploadBufferToCloudinary(file.buffer, {
      folder: 'dajtovon/posts',
      resource_type: 'image',
    })
  )
);

const newImages = uploaded.map(r => ({
  url: r.secure_url,
  publicId: r.public_id
}));

const finalImageList = [...keepImages, ...newImages];

const finalPublicIds = new Set(finalImageList.map(x => x.publicId));
const removed = (contentItem.images || []).filter(
  img => img?.publicId && !finalPublicIds.has(img.publicId)
);

await Promise.all(
  removed.map(img => deleteFromCloudinary(img.publicId))
);


        // Update content fields
        contentItem.topic = topic || contentItem.topic;
        contentItem.content = content || contentItem.content;
        contentItem.category = category || contentItem.category;
        contentItem.date = new Date();
        contentItem.images = finalImageList; // keep + new

        await user.save();
        res.json({ success: true, message: "Obsah bol upravený" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba servera pri úprave obsahu" });
    }
});
});

const contactPageLimiter = makeRateLimiter({
  windowMs: 30 * 60_000, // 30 minút
  max: 3,                // max 3 správy za okno
  keyFn: (req) => `contactPage:${getClientIp(req)}`
});

app.post('/send-message', contactPageLimiter, async (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ message: "Email a správa sú povinné." });
  }

   const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).json({ message: "Zadajte platnú e-mailovú adresu." });
  }

  // Escape minimal risky stuff for the email body
  const escape = (s='') => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  

try {
  await sendZohoMail({
    toAddress: process.env.ZOHO_TO_ADDRESS, // admin recipient
    replyTo: email,
    subject: "Kontaktný formulár - nová správa",
    html: `
      <p><strong>Od:</strong> ${escape(email)}</p>
      <p><strong>Správa:</strong><br>${escape(message).replace(/\n/g,'<br>')}</p>
    `,
  });

  res.json({ message: "Vaša správa bola úspešne odoslaná!" });
} catch (err) {
  console.error("Chyba pri odosielaní emailu:", err);
  res.status(500).json({ message: "Nepodarilo sa odoslať správu." });
}
});

// Rate limit pre kontaktovanie autora: 3 správy / 10 min / používateľ / príspevok
const contactAuthorLimiter = makeRateLimiter({
  windowMs: 10 * 60_000, // 10 minút
  max: 3,
  keyFn: (req) => {
    const user = req.user?.username || 'anon';
    const contentId = req.params.id || 'no-id';
    return `contact:${contentId}:${user}`;
  }
});

app.post('/contact-author/:id', authenticateUser, contactAuthorLimiter, async (req, res) => {
  const { id } = req.params;
  const { message, name } = req.body || {};

  if (!message || message.trim().length < 5) {
    return res.status(400).json({ message: "Správa je príliš krátka." });
  }

  // nájdi autora daného príspevku
  const owner = await User.findOne({ "content.id": String(id) });
  if (!owner) return res.status(404).json({ message: "Obsah neexistuje." });

  const item = owner.content.find(c => String(c.id) === String(id));
  if (!item) return res.status(404).json({ message: "Položka obsahu neexistuje." });

  // odosielateľ = prihlásený používateľ
  const senderEmail = req.user.email;
  const senderName = (name && String(name).trim()) ? String(name).trim() : req.user.username;

  // sanitácia pre HTML mail
  const esc = (s='') => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const PUBLIC_FRONTEND_URL = process.env.PUBLIC_FRONTEND_URL || 'https://dajtovon.sk';

const publicUrl =
  `${PUBLIC_FRONTEND_URL}/content-detail.html?contentId=${encodeURIComponent(id)}`;

  try {
    await sendZohoMail({
  toAddress: owner.email,      // autor príspevku
  replyTo: process.env.ZOHO_FROM_ADDRESS, // overená Zoho adresa     
  subject: `Správa k Vášmu príspevku: ${item.topic}`,
  html: `
  <p>
  Z portálu
  <a href="https://dajtovon.sk" target="_blank" rel="noopener noreferrer">
    <strong>DajToVon.sk</strong>
  </a>
  Vám prišla nová správa.
</p>
  
    <p><strong>Príspevok:</strong> ${esc(item.topic)}</p>
    <p><strong>Odosielateľ:</strong> ${esc(senderName)} &lt;${esc(senderEmail)}&gt;</p>
    <p><strong>Správa:</strong><br>${esc(message).replace(/\n/g,'<br>')}</p>
    <hr>
     <p>
    <a href="mailto:${esc(senderEmail)}?subject=${encodeURIComponent('Re: ' + item.topic)}">
      Odpovedať používateľovi
    </a>
  </p>
    <p><a href="${publicUrl}">Otvoriť príspevok</a></p>
  `,
    });

    res.json({ message: "Vaša správa bola odoslaná autorovi." });
  } catch (err) {
    console.error("❌ contact-author:", err);
    res.status(500).json({ message: "Nepodarilo sa odoslať správu. Skúste neskôr." });
  }
});


// ✅ Health check endpoint (Render)
app.get('/health', (req, res) => res.status(200).send('ok'));

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const connectedUsers = {}; // username -> Set of socket IDs

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

io.on('connection', (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on('register-username', (username) => {
    if (!username) return;

    // Remove socket from any previous username
    for (const sockets of Object.values(connectedUsers)) {
      sockets.delete(socket.id);
    }

    if (!connectedUsers[username]) connectedUsers[username] = new Set();
    connectedUsers[username].add(socket.id);

    socket.username = username;
    socket.emit('username-registered', username);
  });

  socket.on('disconnect', () => {
    for (const [username, sockets] of Object.entries(connectedUsers)) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        console.log(`🔴 Socket disconnected: ${socket.id} for user ${username}`);
        if (sockets.size === 0) delete connectedUsers[username];
        break;
      }
    }
  });
});



