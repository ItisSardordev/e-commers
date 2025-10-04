require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");
let paypalEnv;
if ((process.env.PAYPAL_ENVIRONMENT || "sandbox") === "live") {
  paypalEnv = new paypal.core.LiveEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
} else {
  paypalEnv = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  );
}
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const productsPath = path.join(__dirname, "products.json");
const ordersPath = path.join(__dirname, "orders.json");
const adminsPath = path.join(__dirname, "admins.json");

function readJSON(p) {
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// create default products/orders/admins if missing
if (!fs.existsSync(productsPath)) {
  writeJSON(productsPath, [
    {
      id: 1,
      title: "23L Suv Butilkasi",
      price: 2.5,
      image: "https://via.placeholder.com/300x200?text=Suvo",
      desc: "Sifatli toza suv.",
    },
    {
      id: 2,
      title: "Metal skoba",
      price: 5.0,
      image: "https://via.placeholder.com/300x200?text=Skoba",
      desc: "Mustahkam metal skoba.",
    },
  ]);
}
if (!fs.existsSync(ordersPath)) writeJSON(ordersPath, []);
if (!fs.existsSync(adminsPath)) {
  // if ADMIN_PASSWORD_HASH is provided in env, use it; otherwise create a placeholder admin with empty hash
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  writeJSON(adminsPath, [
    {
      id: 1,
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      passwordHash: hash,
    },
  ]);
}

// AUTH helpers
const JWT_SECRET = process.env.JWT_SECRET || "secret";
function generateToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, {
    expiresIn: "8h",
  });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// PUBLIC APIs
app.get("/api/products", (req, res) => {
  const products = readJSON(productsPath);
  res.json(products);
});

app.post("/api/orders", (req, res) => {
  const order = req.body;
  const orders = readJSON(ordersPath);
  order.id = Date.now();
  order.date = new Date().toISOString();
  orders.push(order);
  writeJSON(ordersPath, orders);
  res.json({ success: true, orderId: order.id });
});

// STRIPE: create a Checkout session (redirect)
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { items, customer } = req.body;
    const line_items = items.map((i) => ({
      price_data: {
        currency: "usd",
        product_data: { name: i.title },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.qty,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
      metadata: { customer: JSON.stringify(customer || {}) },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "stripe error" });
  }
});

// PAYPAL: create order
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { items, customer } = req.body;
    const total = items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2);
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: total },
        },
      ],
    });
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "paypal error" });
  }
});

// PAYPAL: capture order
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderID } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await paypalClient.execute(request);
    const orders = readJSON(ordersPath);
    orders.push({
      id: Date.now(),
      source: "paypal",
      paypalOrder: orderID,
      created: new Date().toISOString(),
    });
    writeJSON(ordersPath, orders);
    res.json({ success: true, capture: capture.result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "capture error" });
  }
});

// ADMIN AUTH
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const admins = readJSON(adminsPath);
  const admin = admins.find((a) => a.email === email);
  if (!admin) return res.status(401).json({ error: "Invalid" });
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid" });
  const token = generateToken(admin);
  res.json({ token, email: admin.email });
});

// Protected admin endpoints
app.get("/api/admin/orders", authMiddleware, (req, res) => {
  const orders = readJSON(ordersPath);
  res.json(orders);
});

app.get("/api/admin/products", authMiddleware, (req, res) => {
  const products = readJSON(productsPath);
  res.json(products);
});

app.post("/api/admin/products", authMiddleware, (req, res) => {
  const products = readJSON(productsPath);
  const p = req.body;
  p.id = Date.now();
  products.push(p);
  writeJSON(productsPath, products);
  res.json({ success: true, product: p });
});

app.delete("/api/admin/products/:id", authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  let products = readJSON(productsPath);
  products = products.filter((p) => p.id !== id);
  writeJSON(productsPath, products);
  res.json({ success: true });
});

// admin create (register) — only existing admin can create
app.post("/api/admin/create", authMiddleware, async (req, res) => {
  const { email, password } = req.body;
  const admins = readJSON(adminsPath);
  if (admins.find((a) => a.email === email))
    return res.status(400).json({ error: "exists" });
  const hash = await bcrypt.hash(password, 10);
  const newAdmin = { id: Date.now(), email, passwordHash: hash };
  admins.push(newAdmin);
  writeJSON(adminsPath, admins);
  res.json({ success: true });
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
