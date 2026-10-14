const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const configuredUsername = process.env.AUTH_STUB_USERNAME;
const configuredPassword = process.env.AUTH_STUB_PASSWORD;
const USERS = configuredUsername && configuredPassword
  ? { [configuredUsername]: { password: configuredPassword, roles: ['MISSION_OPERATOR'] } }
  : {};

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'invalid username or password' });
  }
  const token = jwt.sign(
    { sub: username, roles: user.roles },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  res.json({ token });
});

app.get('/health', (req, res) => res.json({ status: 'up' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`mission-auth-stub listening on http://localhost:${PORT}`);
});
