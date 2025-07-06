const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

const app        = express();
const JWT_SECRET = 'CHANGE_THIS_SECRET';         // 👉 move to .env in production
const PORT       = 5000;

/* ───────────────────────────────────
   Middleware
─────────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

/* ───────────────────────────────────
   MongoDB Connection
─────────────────────────────────── */
mongoose
  .connect(
    'mongodb+srv://Jonia:Jonia@cluster0.yrmt07y.mongodb.net/krishimithra?retryWrites=true&w=majority&appName=Cluster0',
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ───────────────────────────────────
   Multer (Image Upload Config)
─────────────────────────────────── */
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const uploadImage = multer({ storage: imageStorage });

/* ───────────────────────────────────
   Mongoose Models
─────────────────────────────────── */
const productSchema = new mongoose.Schema({
  name:      String,
  contact:   String,
  tools:     String,
  place:     String,
  image:     String,
  price:     String,
  condition: String,
  ownerId:   String, // Optional owner link
});
const Product = mongoose.model('Product', productSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  name:     String,
  email:    String,
  contact:  String,
  place:    String,
  avatar:   String,
});
const User = mongoose.model('User', userSchema);

/* ───────────────────────────────────
   Auth Middleware
─────────────────────────────────── */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/* ───────────────────────────────────
   Product Routes
─────────────────────────────────── */
app.post('/api/add', uploadImage.single('toolImage'), async (req, res) => {
  try {
    const { name, contact, tools, place, price, condition } = req.body;
    const image = req.file ? req.file.filename : null;

    const ownerId = req.headers.authorization
      ? jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET).id
      : null;

    await new Product({ name, contact, tools, place, price, condition, image, ownerId }).save();
    res.json({ message: 'Product added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Auth Routes
─────────────────────────────────── */
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, name, email, contact, place } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
    if (await User.findOne({ username })) return res.status(400).json({ error: 'User already exists' });

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
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '2h' });
    const { name, email, contact, place } = user;
    res.json({ message: 'Login successful', token, user: { name, email, contact, place } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Profile Routes
─────────────────────────────────── */
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
    const { name, email, contact, place } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.userId,
      { name, email, contact, place },
      { new: true, select: '-password' }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/profile', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Avatar Upload (Optional)
─────────────────────────────────── */
app.post('/api/profile/avatar', authMiddleware, uploadImage.single('avatar'), async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.userId,
      { avatar: req.file.filename },
      { new: true, select: '-password' }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────────────────────
   Start Server
─────────────────────────────────── */
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
