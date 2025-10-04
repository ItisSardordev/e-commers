const API = "/api";
let adminToken = localStorage.getItem("adminToken") || null;

const loginArea = document.getElementById("login-area");
const panelArea = document.getElementById("panel-area");
const loginMsg = document.getElementById("login-msg");

function showPanel(show) {
  if (show) {
    loginArea.style.display = "none";
    panelArea.style.display = "block";
  } else {
    loginArea.style.display = "block";
    panelArea.style.display = "none";
  }
}
showPanel(!!adminToken);

document.getElementById("admin-login").onclick = async () => {
  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-pass").value;
  if (!email || !password)
    return (loginMsg.innerText = "Email va parol kiriting");
  try {
    const res = await fetch(API + "./admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      adminToken = data.token;
      localStorage.setItem("adminToken", adminToken);
      loginMsg.innerText = "Kirish muvaffaqiyatli";
      showPanel(true);
    } else {
      loginMsg.innerText = "Kirish xatosi";
    }
  } catch (e) {
    console.error(e);
    loginMsg.innerText = "Xatolik";
  }
};

document.getElementById("logout").onclick = () => {
  adminToken = null;
  localStorage.removeItem("adminToken");
  showPanel(false);
};

// Load products
document.getElementById("load-products").onclick = async () => {
  const res = await fetch(API + "/products");
  const products = await res.json();
  renderProducts(products);
};

// Add product (protected)
document.getElementById("add-product").onclick = async () => {
  if (!adminToken) return alert("Avval login qiling");
  const title = document.getElementById("p-title").value;
  const price = Number(document.getElementById("p-price").value || 0);
  const image = document.getElementById("p-image").value;
  const desc = document.getElementById("p-desc").value;
  if (!title || !price) return alert("Ma'lumot to'liq emas");
  const res = await fetch(API + "/admin/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + adminToken,
    },
    body: JSON.stringify({ title, price, image, desc }),
  });
  const data = await res.json();
  if (data.success) {
    alert("Mahsulot qo'shildi");
    document.getElementById("p-title").value = "";
    document.getElementById("p-price").value = "";
    document.getElementById("p-image").value = "";
    document.getElementById("p-desc").value = "";
    document.getElementById("load-products").click();
  } else {
    alert("Xatolik: " + JSON.stringify(data));
  }
};

function renderProducts(products) {
  const ul = document.getElementById("product-list");
  ul.innerHTML = "";
  products.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
      <img src="${p.image || "https://via.placeholder.com/80"}" width="60" />
      <div style="flex:1">
        <div><strong>${p.title}</strong></div>
        <div>$${p.price}</div>
      </div>
      <div>
        <button onclick="deleteProduct(${p.id})">O'chirish</button>
      </div>
    </div>`;
    ul.appendChild(li);
  });
}

window.deleteProduct = async (id) => {
  if (!adminToken) return alert("Avval login qiling");
  if (!confirm("Rostdan o'chirishni xohlaysizmi?")) return;
  const res = await fetch(API + "/admin/products/" + id, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + adminToken },
  });
  const data = await res.json();
  if (data.success) {
    alert("O'chirildi");
    document.getElementById("load-products").click();
  } else alert("Xato");
};

// Load orders
document.getElementById("load-orders").onclick = async () => {
  if (!adminToken) return alert("Avval login qiling");
  const res = await fetch(API + "/admin/orders", {
    headers: { Authorization: "Bearer " + adminToken },
  });
  if (res.status !== 200) return alert("Avtorizatsiya xatosi");
  const orders = await res.json();
  document.getElementById("orders-output").innerHTML =
    "<pre>" + JSON.stringify(orders, null, 2) + "</pre>";
};
