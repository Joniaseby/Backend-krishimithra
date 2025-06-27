const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve static files from 'uploads' folder

// ✅ MongoDB connection
mongoose.connect('mongodb+srv://Jonia:Jonia@cluster0.yrmt07y.mongodb.net/krishimithra?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// ✅ Mongoose schema
const detailSchema = new mongoose.Schema({
  name: String,
  contact: String,
  tools: String,
  place: String
});
const Detail = mongoose.model('Detail', detailSchema);

// ✅ Routes
app.post('/api/add', async (req, res) => {
  try {
    const detail = new Detail(req.body);
    await detail.save();
    res.json({ message: "Details added successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/view', async (req, res) => {
  try {
    const allDetails = await Detail.find();
    res.json(allDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/delete/:id', async (req, res) => {
  try {
    await Detail.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload image
app.post('/api/upload', upload.single('toolImage'), (req, res) => {
  res.json({ message: 'Image uploaded successfully', filename: req.file.filename });
});

// ✅ Get list of uploaded images
app.get('/api/images', (req, res) => {
  const dir = path.join(__dirname, 'uploads');
  fs.readdir(dir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load images' });
    }
    res.json(files);
  });
});
//Delete API for Images
app.delete('/api/image/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ error: 'File delete failed' });
    res.json({ message: 'Image deleted successfully' });
  });
});


// ✅ Start server (Only once!)
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ✅ User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});
const User = mongoose.model('User', userSchema);

// ✅ Register user (optional for now)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'All fields required' });

  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: 'User already exists' });

  const user = new User({ username, password }); // For production, hash password!
  await user.save();
  res.json({ message: 'User registered successfully' });
});

// ✅ Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password }); // In production, compare hashed passwords
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ message: 'Login successful' });
});
