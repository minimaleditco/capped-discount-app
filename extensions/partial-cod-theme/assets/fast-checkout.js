(function () {
  const BACKEND_URL = "https://capped-discount-app.onrender.com";

  let activeMode = "product"; // "product" or "cart"
  let activeProduct = {
    variantId: "",
    quantity: 1,
    price: 0,
    title: "",
    image: "",
    shop: "",
  };
  let activeCart = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getShopDomain() {
    return (
      (window.Shopify && window.Shopify.shop) ||
      document.getElementById("pcod-fast-buy-btn")?.getAttribute("data-shop") ||
      window.location.hostname
    );
  }

  function ensureModalExists() {
    let backdrop = $("pcod-choice-modal-backdrop");
    if (backdrop) return backdrop;

    const modalHtml = `
    <div class="pcod-modal-backdrop" id="pcod-choice-modal-backdrop" style="display: none;">
      <div class="pcod-choice-modal" id="pcod-choice-modal">
        <!-- Header -->
        <div class="pcod-choice-header">
          <div>
            <div class="pcod-shield-badge">🔒 256-Bit SSL Secure Checkout</div>
            <h3 class="pcod-choice-title">Choose How You'd Like to Pay</h3>
          </div>
          <button type="button" class="pcod-choice-close" id="pcod-choice-close-btn" aria-label="Close">&times;</button>
        </div>

        <!-- Product / Cart Mini Summary -->
        <div class="pcod-choice-product">
          <img id="pcod-choice-img" src="" alt="Item" class="pcod-choice-thumb" />
          <div class="pcod-choice-prod-info">
            <div class="pcod-choice-prod-name" id="pcod-choice-prod-name">Order Items</div>
            <div class="pcod-choice-prod-meta" id="pcod-choice-prod-meta">Calculating...</div>
          </div>
        </div>

        <!-- Option Cards Container -->
        <div class="pcod-cards-container">
          <!-- Option 1: Full Prepaid -->
          <div class="pcod-option-card pcod-card-prepaid" id="pcod-card-prepaid">
            <div class="pcod-card-top">
              <span class="pcod-badge pcod-badge-green">⚡ Fastest Dispatch</span>
              <span class="pcod-card-price" id="pcod-prepaid-price">₹0</span>
            </div>
            <div class="pcod-card-body">
              <div class="pcod-card-title">Option 1: Full Prepaid</div>
              <div class="pcod-card-desc">Pay 100% online now via UPI, Cards, or Netbanking. Fastest order processing & instant dispatch.</div>
            </div>
            <button type="button" class="pcod-select-btn pcod-btn-prepaid" id="pcod-btn-choose-prepaid">
              <span class="pcod-btn-text" id="pcod-prepaid-btn-label">Pay Full ₹0 Online →</span>
            </button>
          </div>

          <!-- Option 2: Partial COD -->
          <div class="pcod-option-card pcod-card-cod" id="pcod-card-cod">
            <div class="pcod-card-top">
              <span class="pcod-badge pcod-badge-orange">📦 Pay Rest on Delivery</span>
              <div class="pcod-card-price-split">
                <span class="pcod-price-now" id="pcod-cod-now">₹100 Now</span>
                <span class="pcod-price-doorstep" id="pcod-cod-doorstep">+ ₹0 COD</span>
              </div>
            </div>
            <div class="pcod-card-body">
              <div class="pcod-card-title">Option 2: Partial Cash on Delivery</div>
              <div class="pcod-card-desc">Pay only <strong id="pcod-cod-desc-deposit">₹100</strong> advance deposit online to confirm shipping. Pay the remaining <strong id="pcod-cod-desc-balance">₹0</strong> in cash at your doorstep.</div>
            </div>
            <button type="button" class="pcod-select-btn pcod-btn-cod" id="pcod-btn-choose-cod">
              <span class="pcod-btn-text" id="pcod-cod-btn-label">Pay ₹100 Deposit & Confirm COD →</span>
            </button>
          </div>
        </div>

        <!-- Security Footer -->
        <div class="pcod-choice-footer">
          <span>🛡️ Buyer Protection Guaranteed • Official Shopify Checkout</span>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    bindModalListeners();
    return $("pcod-choice-modal-backdrop");
  }

  function bindModalListeners() {
    const backdrop = $("pcod-choice-modal-backdrop");
    const closeBtn = $("pcod-choice-close-btn");
    const prepaidBtn = $("pcod-btn-choose-prepaid");
    const codBtn = $("pcod-btn-choose-cod");

    if (closeBtn && !closeBtn.getAttribute("data-pcod-bound")) {
      closeBtn.setAttribute("data-pcod-bound", "true");
      closeBtn.addEventListener("click", closeChoiceModal);
    }

    if (backdrop && !backdrop.getAttribute("data-pcod-bound")) {
      backdrop.setAttribute("data-pcod-bound", "true");
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) closeChoiceModal();
      });
    }

    if (prepaidBtn && !prepaidBtn.getAttribute("data-pcod-bound")) {
      prepaidBtn.setAttribute("data-pcod-bound", "true");
      prepaidBtn.addEventListener("click", handlePrepaidCheckout);
    }

    if (codBtn && !codBtn.getAttribute("data-pcod-bound")) {
      codBtn.setAttribute("data-pcod-bound", "true");
      codBtn.addEventListener("click", handleCodCheckout);
    }
  }

  function init() {
    ensureModalExists();
    bindModalListeners();

    // 1. Bind dedicated Product Page button if present
    const buyBtn = $("pcod-fast-buy-btn");
    if (buyBtn && !buyBtn.getAttribute("data-pcod-bound")) {
      buyBtn.setAttribute("data-pcod-bound", "true");
      buyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openProductChoiceModal();
      });
    }

    // 2. Attach global click listener for Cart Checkout buttons and theme native Buy buttons
    document.addEventListener("click", handleGlobalClick, true);
  }

  function handleGlobalClick(e) {
    const target = e.target;
    if (!target) return;

    // Ignore clicks inside our own modal or on our own buttons
    if (target.closest("#pcod-choice-modal") || target.closest("#pcod-fast-buy-btn")) {
      return;
    }

    // A. Intercept Cart Checkout Buttons (on /cart or inside slide-out Cart Drawer)
    const cartCheckoutBtn = target.closest(
      'button[name="checkout"], input[name="checkout"], #checkout, button#CartDrawer-Checkout, a[href="/checkout"], a[href*="/checkout"], .cart__checkout-button, [data-cart-checkout], button.cart__checkout, .cart-drawer__checkout'
    );

    if (cartCheckoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      openCartChoiceModal();
      return;
    }

    // B. Intercept theme native dynamic "Buy it now" button on product page
    const nativeBuyBtn = target.closest(
      ".shopify-payment-button__button, button[data-testid='Checkout-button']"
    );
    if (nativeBuyBtn) {
      e.preventDefault();
      e.stopPropagation();
      openProductChoiceModal();
      return;
    }
  }

  function readProductDetails() {
    const buyBtn = $("pcod-fast-buy-btn");
    let variantId = buyBtn ? buyBtn.getAttribute("data-variant-id") : "";

    const variantInput = document.querySelector(
      'form[action*="/cart/add"] [name="id"], form[action*="/cart/add"] select[name="id"], select.product-form__variants, [name="id"]'
    );
    if (variantInput && variantInput.value && !isNaN(Number(variantInput.value))) {
      variantId = variantInput.value;
    }

    let quantity = 1;
    const qtyInput = document.querySelector(
      'form[action*="/cart/add"] [name="quantity"], input[name="quantity"]'
    );
    if (qtyInput && qtyInput.value && !isNaN(Number(qtyInput.value)) && Number(qtyInput.value) > 0) {
      quantity = parseInt(qtyInput.value, 10);
    }

    const price = parseFloat(buyBtn ? buyBtn.getAttribute("data-product-price") || "0" : "0");
    const title = buyBtn ? buyBtn.getAttribute("data-product-title") || "Product" : "Product";
    const image = buyBtn ? buyBtn.getAttribute("data-product-image") || "" : "";
    const shop = getShopDomain();

    activeProduct = { variantId, quantity, price, title, image, shop };
    return activeProduct;
  }

  function openProductChoiceModal() {
    activeMode = "product";
    const details = readProductDetails();
    ensureModalExists();
    const backdrop = $("pcod-choice-modal-backdrop");
    if (!backdrop) return;

    const total = details.price * details.quantity;
    const deposit = total > 100 ? 100 : total;
    const balance = Math.max(0, Math.round((total - deposit) * 100) / 100);

    populateModalUI({
      title: details.title,
      image: details.image,
      meta: `Quantity: ${details.quantity} • Subtotal: ₹${total.toLocaleString("en-IN")}`,
      total,
      deposit,
      balance,
    });

    backdrop.style.display = "flex";
  }

  async function openCartChoiceModal() {
    activeMode = "cart";
    ensureModalExists();
    const backdrop = $("pcod-choice-modal-backdrop");
    if (!backdrop) return;

    try {
      const res = await fetch("/cart.js");
      const cart = await res.json();

      if (!cart || !cart.items || cart.items.length === 0) {
        window.location.href = "/cart";
        return;
      }

      activeCart = cart;
      const total = cart.total_price / 100;
      const deposit = total > 100 ? 100 : total;
      const balance = Math.max(0, Math.round((total - deposit) * 100) / 100);

      const firstItem = cart.items[0];
      const cartTitle =
        cart.items.length === 1
          ? firstItem.title
          : `${firstItem.title} + ${cart.items.length - 1} other item${cart.items.length > 2 ? "s" : ""}`;

      populateModalUI({
        title: cartTitle,
        image: firstItem.image || "",
        meta: `${cart.item_count} item${cart.item_count > 1 ? "s" : ""} in cart • Total: ₹${total.toLocaleString("en-IN")}`,
        total,
        deposit,
        balance,
      });

      backdrop.style.display = "flex";
    } catch (err) {
      console.warn("[Cart Modal Fetch Error]:", err);
      window.location.href = "/checkout";
    }
  }

  function populateModalUI({ title, image, meta, total, deposit, balance }) {
    const imgElem = $("pcod-choice-img");
    const nameElem = $("pcod-choice-prod-name");
    const metaElem = $("pcod-choice-prod-meta");

    if (imgElem) {
      if (image) {
        imgElem.src = image;
        imgElem.style.display = "block";
      } else {
        imgElem.style.display = "none";
      }
    }
    if (nameElem) nameElem.textContent = title;
    if (metaElem) metaElem.textContent = meta;

    // Option 1 (Full Prepaid)
    const prepaidPrice = $("pcod-prepaid-price");
    const prepaidBtnLabel = $("pcod-prepaid-btn-label");
    if (prepaidPrice) prepaidPrice.textContent = `₹${total.toLocaleString("en-IN")}`;
    if (prepaidBtnLabel) prepaidBtnLabel.textContent = `Pay Full ₹${total.toLocaleString("en-IN")} Online →`;

    // Option 2 (Partial COD)
    const codNow = $("pcod-cod-now");
    const codDoorstep = $("pcod-cod-doorstep");
    const descDeposit = $("pcod-cod-desc-deposit");
    const descBalance = $("pcod-cod-desc-balance");
    const codBtnLabel = $("pcod-cod-btn-label");

    if (codNow) codNow.textContent = `₹${deposit.toLocaleString("en-IN")} Now`;
    if (codDoorstep) codDoorstep.textContent = `+ ₹${balance.toLocaleString("en-IN")} on Delivery`;
    if (descDeposit) descDeposit.textContent = `₹${deposit.toLocaleString("en-IN")}`;
    if (descBalance) descBalance.textContent = `₹${balance.toLocaleString("en-IN")}`;
    if (codBtnLabel) codBtnLabel.textContent = `Pay ₹${deposit.toLocaleString("en-IN")} Deposit & Confirm COD →`;

    // Reset button states
    const prepaidBtn = $("pcod-btn-choose-prepaid");
    const codBtn = $("pcod-btn-choose-cod");
    if (prepaidBtn) {
      prepaidBtn.disabled = false;
      prepaidBtn.style.opacity = "1";
    }
    if (codBtn) {
      codBtn.disabled = false;
      codBtn.style.opacity = "1";
    }
  }

  function closeChoiceModal() {
    const backdrop = $("pcod-choice-modal-backdrop");
    if (backdrop) backdrop.style.display = "none";
  }

  function handlePrepaidCheckout() {
    const prepaidBtn = $("pcod-btn-choose-prepaid");
    const label = $("pcod-prepaid-btn-label");
    if (prepaidBtn) {
      prepaidBtn.disabled = true;
      prepaidBtn.style.opacity = "0.8";
    }
    if (label) label.textContent = "Opening Standard Checkout...";

    if (activeMode === "cart") {
      window.location.href = "/checkout";
    } else {
      const { variantId, quantity } = activeProduct;
      if (variantId) {
        window.location.href = `/cart/${variantId}:${quantity}`;
      } else {
        window.location.href = "/checkout";
      }
    }
  }

  async function handleCodCheckout() {
    const codBtn = $("pcod-btn-choose-cod");
    const label = $("pcod-cod-btn-label");
    if (codBtn) {
      codBtn.disabled = true;
      codBtn.style.opacity = "0.8";
    }
    if (label) label.textContent = "Opening Partial COD Checkout...";

    try {
      const shop = getShopDomain();
      let payload;

      if (activeMode === "cart" && activeCart) {
        payload = {
          shop,
          items: activeCart.items.map((it) => ({
            variantId: it.id,
            quantity: it.quantity,
            price: it.price / 100,
            title: it.title,
          })),
          deposit: 100,
        };
      } else {
        const { variantId, quantity, price, title } = activeProduct;
        payload = {
          shop,
          variantId,
          quantity,
          price,
          title,
          deposit: 100,
        };
      }

      const res = await fetch(`${BACKEND_URL}/api/partial-cod/draft-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.invoiceUrl) {
        throw new Error(data.error || "Unable to open Partial COD checkout.");
      }

      // Redirect to Shopify Native Draft Checkout
      window.location.href = data.invoiceUrl;
    } catch (err) {
      console.error("[Partial COD Checkout Error]:", err);
      alert(err.message || "Failed to open Partial COD checkout. Please try again.");
      if (codBtn) {
        codBtn.disabled = false;
        codBtn.style.opacity = "1";
      }
      if (label) label.textContent = "Pay ₹100 Deposit & Confirm COD →";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
