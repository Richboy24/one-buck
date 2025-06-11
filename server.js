
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

app.post('/deposit-request', authenticateToken, (req, res) => {
  const { amount, method } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.sendStatus(404);
  user.deposits.push({ amount, method, status: "pending" });
  saveDB(db);
  res.json({ message: "Deposit request submitted" });
});

app.post('/play', authenticateToken, (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user || user.balance < 1) return res.status(400).json({ message: "Insufficient balance" });
  user.balance -= 1;
  saveDB(db);
  res.json({ message: "Play processed", balance: user.balance });
});

app.post('/win', authenticateToken, (req, res) => {
  const { amount } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.sendStatus(404);
  user.balance += amount;
  saveDB(db);
  res.json({ message: "Winnings added", balance: user.balance });
});

app.post('/withdraw-request', authenticateToken, (req, res) => {
  const { amount, method } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === req.user.username);
  if (!user || user.balance < amount) return res.status(400).json({ message: "Insufficient funds" });
  user.balance -= amount;
  user.withdraws.push({ amount, method, status: "pending" });
  saveDB(db);
  res.json({ message: "Withdrawal requested", balance: user.balance });
});

app.listen(PORT, () => {
  console.log(`JWT Wallet Backend running on port ${PORT}`);
});
