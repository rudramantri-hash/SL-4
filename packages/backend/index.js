const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory data store
let users = [
  { id: 1, email: 'test@example.com', name: 'Test User' }
];

let products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' },
  { id: 2, name: 'Mouse', price: 29.99, category: 'Electronics' }
];

let cart = [];

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Deflake Test Backend</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .method { font-weight: bold; color: #007bff; }
      </style>
    </head>
    <body>
      <h1>🚀 Deflake Test Backend</h1>
      <p>This server provides test endpoints for the MCP auto-healing framework.</p>
      
      <h2>Available Endpoints:</h2>
      <div class="endpoint">
        <span class="method">GET</span> <code>/</code> - This page
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <code>/login</code> - Login page
      </div>
      <div class="method">GET</span> <code>/search</code> - Search page
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <code>/products</code> - Products page
      </div>
      <div class="endpoint">
        <span class="method">GET</span> <code>/api/users</code> - Get users
      </div>
      <div class="endpoint">
        <span class="method">POST</span> <code>/api/login</code> - Login API
      </div>
    </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Deflake Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f8f9fa; }
        .login-form { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .error { color: red; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="login-form">
        <h2>🔐 Login</h2>
        <form id="loginForm">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="Enter your email" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Enter your password" required>
          </div>
          <button type="submit" role="button" name="Log in">Log in</button>
        </form>
        <div id="error" class="error" style="display: none;"></div>
      </div>
      
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
              window.location.href = '/dashboard';
            } else {
              const error = await response.text();
              document.getElementById('error').textContent = error;
              document.getElementById('error').style.display = 'block';
            }
          } catch (err) {
            document.getElementById('error').textContent = 'Login failed';
            document.getElementById('error').style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get('/search', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Search - Deflake Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f8f9fa; }
        .search-container { max-width: 600px; margin: 100px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .search-box { display: flex; gap: 10px; margin-bottom: 20px; }
        input[type="search"] { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
        button { padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .results { margin-top: 20px; }
        .product { padding: 15px; border: 1px solid #eee; margin: 10px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="search-container">
        <h2>🔍 Search Products</h2>
        <div class="search-box">
          <input type="search" id="searchInput" placeholder="Search products..." role="searchbox">
          <button type="button" role="button" name="Search">Search</button>
        </div>
        <div id="results" class="results" data-testid="search-results" style="display: none;">
          <h3>Search Results:</h3>
          <div id="productList"></div>
        </div>
      </div>
      
      <script>
        document.querySelector('button[name="Search"]').addEventListener('click', () => {
          const query = document.getElementById('searchInput').value;
          if (query.trim()) {
            document.getElementById('results').style.display = 'block';
            document.getElementById('productList').innerHTML = '<div class="product">Searching for: ' + query + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get('/products', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Products - Deflake Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f8f9fa; }
        .products-container { max-width: 800px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .product { border: 1px solid #eee; padding: 20px; margin: 20px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .product-info h3 { margin: 0 0 10px 0; }
        .product-info p { margin: 5px 0; color: #666; }
        .price { font-size: 24px; font-weight: bold; color: #007bff; }
        button { padding: 12px 24px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
        button:hover { background: #218838; }
        .cart-count { position: fixed; top: 20px; right: 20px; background: #007bff; color: white; padding: 10px 15px; border-radius: 20px; }
      </style>
    </head>
    <body>
      <div class="cart-count" data-testid="cart-count">0</div>
      <div class="products-container">
        <h2>🛍️ Products</h2>
        <div class="product">
          <div class="product-info">
            <h3>Laptop</h3>
            <p>High-performance laptop for work and gaming</p>
            <p class="price">$999.99</p>
          </div>
          <button role="button" name="Add to Cart" onclick="addToCart()">Add to Cart</button>
        </div>
        <div class="product">
          <div class="product-info">
            <h3>Mouse</h3>
            <p>Wireless optical mouse</p>
            <p class="price">$29.99</p>
          </div>
          <button role="button" name="Add to Cart" onclick="addToCart()">Add to Cart</button>
        </div>
      </div>
      
      <script>
        let cartCount = 0;
        function addToCart() {
          cartCount++;
          document.querySelector('[data-testid="cart-count"]').textContent = cartCount;
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard - Deflake Test</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f8f9fa; }
        .dashboard { max-width: 800px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .welcome { text-align: center; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; color: #007bff; }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="welcome">
          <h1 role="heading" name="Welcome">Welcome to Your Dashboard</h1>
          <p>You have successfully logged in!</p>
        </div>
        <div class="stats">
          <div class="stat-card">
            <div class="stat-number">5</div>
            <div>Active Projects</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">12</div>
            <div>Completed Tasks</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">98%</div>
            <div>Success Rate</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'test@example.com' && password === 'password123') {
    res.json({ success: true, user: { email, name: 'Test User' } });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Deflake backend server running on http://localhost:${PORT}`);
  console.log(`📱 Test endpoints available:`);
  console.log(`   - GET  / (home)`);
  console.log(`   - GET  /login (login page)`);
  console.log(`   - GET  /search (search page)`);
  console.log(`   - GET  /products (products page)`);
  console.log(`   - GET  /dashboard (dashboard page)`);
  console.log(`   - POST /api/login (login API)`);
});
