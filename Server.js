/**
 * server.js  –  Backend with profile support
 * -----------------------------------------
 */
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

const app = express();
const JWT_SECRET = 'CHANGE_THIS_SECRET'; // 🔐 Move to env in production

/* ───────────────────────────────────
   Middleware
─────────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // serve images

/* ───────────────────────────────────
   MongoDB
─────────────────────────────────── */
mongoose
  .connect(
    'mongodb+srv://Jonia:Jonia@cluster0.yrmt07y.mongodb.net/krishimithra?retryWrites=true&w=majority&appName=Cluster0',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ───────────────────────────────────
   Multer (file upload)
─────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

/* ───────────────────────────────────
   Schemas & Models
─────────────────────────────────── */
const detailSchema = new mongoose.Schema({
  name: String,
  contact: String,
  tools: String,
  place: String,
  image: String, // filename only
});
const Detail = mongoose.model('Detail', detailSchema);
const Product = Detail; // alias

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,          // hashed
  name:     String,
  email:    String,
  contact:  String,
  place:    String,
  avatar:   String           // optional avatar filename
});
const User = mongoose.model('User', userSchema);

/* ───────────────────────────────────
   Auth Helpers
─────────────────────────────────── */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/* ───────────────────────────────────
   Product / Detail Routes
─────────────────────────────────── */
app.post('/api/add', upload.single('toolImage'), async (req, res) => {
  try {
    const { name, contact, tools, place } = req.body;
    const image = req.file ? req.file.filename : null;
    const detail = new Detail({ name, contact, tools, place, image });
    await detail.save();
    res.json({ message: 'Details added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Image helper routes
─────────────────────────────────── */
app.post('/api/upload', upload.single('toolImage'), (req, res) => {
  res.json({ message: 'Image uploaded', filename: req.file.filename });
});

/* ───────────────────────────────────
   Auth & Profile Routes
─────────────────────────────────── */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name, email, contact, place } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
    if (await User.findOne({ username })) return res.status(400).json({ error: 'User exists' });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, password: hashed, name, email, contact, place }).save();
    res.json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---- PROFILE ---- */
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = (({ name, email, contact, place }) => ({ name, email, contact, place }))(req.body);
    const updated = await User.findByIdAndUpdate(req.userId, allowed, { new: true, select: '-password' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Start server
─────────────────────────────────── */
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
