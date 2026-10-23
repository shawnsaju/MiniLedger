import express from 'express';

const app = express();
const PORT = 4000;

// Lets the server read JSON sent in request bodies
app.use(express.json());

// A "route": when someone visits GET /health, run this function
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});