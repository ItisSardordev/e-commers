const API = "/api";
let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

const productsEl = document.getElementById("products");
const cartCountEl = document.getElementById("cart-count");
const cartModal = document.getElementById("cart-modal");
const openCartBtn = document.getElementById("open-cart");
const closeCartBtn = document.getElementById("close-cart");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const checkoutBtn = document.getElementById("checkout");

function updateCartUI() {
  cartCountEl.textContent = cart.reduce((s, i) => s + i.qty, 0);
  cartItemsEl.innerHTML = "";
  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.qty;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.image}" />
      <div style="flex:1">
        <div>${item.title}</div>
        <div style="font-size:13px;color:#666">$${item.price} x ${item.qty}</div>
      </div>
      <div>
        <button onclick="changeQty(${item.id}, -1)">-</button>
        <button onclick="changeQty(${item.id}, 1)">+</button>
      </div>
    `;
    cartItemsEl.appendChild(div);
  });
  cartTotalEl.textContent = total.toFixed(2);
  localStorage.setItem("cart", JSON.stringify(cart));
}

function changeQty(id, delta) {
  const i = cart.find((c) => c.id === id);
  if (!i) return;
  i.qty += delta;
  if (i.qty <= 0) cart = cart.filter((c) => c.id !== id);
  updateCartUI();
}

function addToCart(id) {
  const p = products.find((x) => x.id === id);
  const existing = cart.find((c) => c.id === id);
  if (existing) existing.qty++;
  else
    cart.push({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.image,
      qty: 1,
    });
  updateCartUI();
  const btn = document.querySelector(`#btn-${id}`);
  if (btn)
    btn.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.9)" },
        { transform: "scale(1)" },
      ],
      { duration: 250 }
    );
}

async function fetchProducts() {
  const res = await fetch(API + "/products");
  products = await res.json();
  renderProducts();
  updateCartUI();
}

function renderProducts() {
  productsEl.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" />
      <h3>${p.title}</h3>
      <p>${p.desc || ""}</p>
      <div class="price">$${Number(p.price).toFixed(2)}</div>
      <button class="btn" id="btn-${p.id}" onclick="addToCart(${
      p.id
    })">Savatchaga qo'shish</button>
    `;
    productsEl.appendChild(card);
  });
}

openCartBtn.addEventListener("click", () => cartModal.classList.add("show"));
closeCartBtn.addEventListener("click", () =>
  cartModal.classList.remove("show")
);

checkoutBtn.addEventListener("click", async () => {
  if (cart.length === 0) return alert("Savatcha bo'sh");
  const name = prompt("Ismingiz:");
  const phone = prompt("Telefon:");
  const address = prompt("Manzil:");
  if (!name || !phone) return alert("Ma'lumot to'liq emas");
  const customer = { name, phone, address };

  const method = prompt("To'lov usuli: stripe yoki paypal?", "stripe");
  if (method === "stripe") {
    const res = await fetch(API + "/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart, customer }),
    });
    const data = await res.json();
    if (data.url) window.location = data.url;
    else alert("Stripe xatosi");
  } else if (method === "paypal") {
    // PayPal flow: client-side Buttons are rendered below, but here we create order server-side and then prompt to approve via PayPal Buttons
    alert(
      "PayPal tugmasini pastdagi PayPal oynasidan ishlating (yoki sahifani yangilang)."
    );
    // Render PayPal buttons (re-render) with current cart
    renderPayPalButtons(cart, customer);
  } else {
    alert("Noto'g'ri usul");
  }
});

// PayPal Buttons renderer
function renderPayPalButtons(items, customer) {
  // remove previous
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";
  if (typeof paypal === "undefined") {
    container.innerText =
      "PayPal SDK yuklanmagan. index.html ichidagi client-id ni to'ldiring.";
    return;
  }
  paypal
    .Buttons({
      createOrder: function () {
        return fetch(API + "/paypal/create-order", {
          method: "post",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items, customer }),
        })
          .then((res) => res.json())
          .then((data) => data.id);
      },
      onApprove: function (data) {
        return fetch(API + "/paypal/capture-order", {
          method: "post",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderID: data.orderID }),
        })
          .then((res) => res.json())
          .then((resp) => {
            if (resp.success) {
              alert("Buyurtma muvaffaqiyatli yakunlandi");
              cart = [];
              localStorage.removeItem("cart");
              updateCartUI();
              cartModal.classList.remove("show");
            } else alert("Capture xatosi");
          });
      },
    })
    .render("#paypal-button-container");
}

window.changeQty = changeQty;
window.addToCart = addToCart;

fetchProducts();
