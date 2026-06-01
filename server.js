import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT       = process.env.PORT       || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "degistir-beni-gizli-key";


const TEST_USERS = [

  { username: "admin",    password: "admin123", name: "Admin",          role: "admin"   },
];


app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Kullanıcı adı ve şifre gerekli." });
  }

  const user = TEST_USERS.find(
    (u) => u.username === username.trim() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı." });
  }

  const { password: _, ...userData } = user;
  const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });

  return res.json({ token, user: userData });
});


app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Token bulunamadı." });

  try {
    const { iat, exp, ...user } = jwt.verify(token, JWT_SECRET);
    return res.json({ user });
  } catch {
    return res.status(401).json({ message: "Token geçersiz veya süresi dolmuş." });
  }
});


app.post("/api/auth/logout", (_req, res) => {
  res.json({ message: "Çıkış yapıldı." });
});

app.listen(PORT, () => {
  console.log(`✓ Backend çalışıyor → http://localhost:${PORT}`);
});
