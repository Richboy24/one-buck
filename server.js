const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'yoursecretkey';

app.use(cors());
app.use(bodyParser.json());

// Helpers
function loadDB() {
  return JSON.parse(fs.readFileSync('db.json', 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
}

// Middleware to protect routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Auth & wallet routes
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(403).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

app.get('/wallet', authenticateToken, (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.sendStatus(404);
  res.json({ balance: user.balance });
});

app.post('/deposit-request', authenticateToken, (req, res) => {
  const { amount, method } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.sendStatus(404);
  user.deposits.push({ amount, method, status: 'pending' });
  saveDB(db);
  res.json({ message: 'Deposit request submitted' });
});

app.post('/withdraw-request', authenticateToken, (req, res) => {
  const { amount, method } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user || user.balance < amount) return res.status(400).json({ message: 'Insufficient funds' });
  user.balance -= amount;
  user.withdraws.push({ amount, method, status: 'pending' });
  saveDB(db);
  res.json({ message: 'Withdrawal requested', balance: user.balance });
});

app.post('/play', authenticateToken, (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user || user.balance < 1) return res.status(400).json({ message: 'Insufficient balance' });

  user.balance -= 1;

  // 11th spin logic
  db.totalSpins = (db.totalSpins || 0) + 1;
  const isWinner = db.totalSpins % 11 === 0;

  saveDB(db);
  res.json({ message: 'Play processed', balance: user.balance, win: isWinner });
});

app.post('/win', authenticateToken, (req, res) => {
  const { amount } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.sendStatus(404);
  user.balance += amount;
  saveDB(db);
  res.json({ message: 'Winnings added', balance: user.balance });
});

// Admin login (simple password check)
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === 'amin24') {
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, message: 'Wrong password' });
  }
});

// Admin: get all users
app.get('/admin-users', (req, res) => {
  const db = loadDB();
  res.json(db.users);
});

// Admin: adjust balance
app.post('/admin-adjust', (req, res) => {
  const { username, amount } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.balance += amount;
  if (user.balance < 0) user.balance = 0;
  saveDB(db);
  res.json({ message: `Balance updated. New balance: $${user.balance}` });
});

// Admin: approve deposit
app.post('/admin-approve', (req, res) => {
  const { username, index } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user || !user.deposits[index]) return res.status(400).json({ message: 'Invalid request' });

  const deposit = user.deposits[index];
  if (deposit.status === 'approved') {
    return res.status(400).json({ message: 'Already approved' });
  }

  deposit.status = 'approved';
  user.balance += deposit.amount;
  saveDB(db);

  res.json({ message: 'Deposit approved and balance updated.' });
});

// Serve admin panel HTML
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ JWT Wallet Backend with 11th Spin Win Logic running on port ${PORT}`);
});
