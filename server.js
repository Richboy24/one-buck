// server.js — JWT backend with global /spin route
const path = require('path');

const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(bodyParser.json());

let isSpinning = false; // basic lock to prevent race conditions

function loadDB() {
  return JSON.parse(fs.readFileSync('db.json', 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
}

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

app.post('/spin', authenticateToken, (req, res) => {
  if (isSpinning) return res.status(429).json({ message: 'Please wait...' });
  isSpinning = true;

  try {
    const db = loadDB();
    const user = db.users.find(u => u.username === req.user.username);
    if (!user || user.balance < 1) {
      isSpinning = false;
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.balance -= 1;
    db.globalSpinCount = (db.globalSpinCount || 0) + 1;

    let message = 'Try again';
    let won = false;

    if (db.globalSpinCount % 11 === 0) {
      user.balance += 8;
      message = 'You won $8!';
      won = true;
    }

    saveDB(db);
    res.json({ message, won, balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  } finally {
    isSpinning = false;
  }
});
app.get('/admin-users', (req, res) => {
  const db = loadDB();
  res.json(db.users);
});


app.listen(PORT, () => {
  console.log(`JWT Wallet Backend running on port ${PORT}`);
});
