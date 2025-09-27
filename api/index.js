// api/index.js
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const serverless = require("serverless-http"); // Required for Vercel
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// --------------------
// DB Connection (serverless safe)
// --------------------
let isConnected;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 5,
  });
  isConnected = true;
  console.log("MongoDB connected ✅");
}

// --------------------
// Multer (memory storage, no disk writes on Vercel)
// --------------------
const upload = multer({ storage: multer.memoryStorage() });

// --------------------
// Schemas & Models
// --------------------
const Product =
  mongoose.models.Product ||
  mongoose.model(
    "Product",
    new mongoose.Schema({
      name: String,
      price: Number,
      category: String,
      imageUrl: String,
    })
  );

const Order =
  mongoose.models.Order ||
  mongoose.model(
    "Order",
    new mongoose.Schema({
      customerName: String,
      customerPhone: String,
      product: String,
      quantity: { type: Number, default: 1 },
      totalPrice: Number,
      status: { type: String, default: "Pending" },
      createdAt: { type: Date, default: Date.now },
    })
  );

// --------------------
// Routes
// --------------------
app.get("/", (req, res) => res.json({ message: "API is running 🚀" }));

// Create Product
app.post("/products", upload.single("image"), async (req, res) => {
  try {
    await connectDB();

    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    // Upload to imgbb
    const base64Image = req.file.buffer.toString("base64");
    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      { image: base64Image },
      { headers: { "Content-Type": "application/json" } }
    );

    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      imageUrl: imgbbRes.data.data.url,
    });

    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Get all Products
app.get("/products", async (req, res) => {
  try {
    await connectDB();
    const products = await Product.find().sort({ _id: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Update Product
app.put("/products/:id", async (req, res) => {
  try {
    await connectDB();
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete Product
app.delete("/products/:id", async (req, res) => {
  try {
    await connectDB();
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// Orders CRUD
app.post("/orders", async (req, res) => {
  try {
    await connectDB();
    const order = new Order(req.body);
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    await connectDB();
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    await connectDB();
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    await connectDB();
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// --------------------
// Local Dev & Vercel Export
// --------------------
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Local API running at ${port}`));
}

module.exports = require("serverless-http")(app);
