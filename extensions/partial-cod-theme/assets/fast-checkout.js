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
      document.querySelector('meta[name="shopify-digital-wallet-domain"]')?.getAttribute("content") ||
      document.getElementById("pcod-fast-buy-btn")?.getAttribute("data-shop") ||
      "minimal-discount-test-3.myshopify.com"
    );
  }

  function ensureModalExists() {
    let backdrop = $("pcod-choice-modal-backdrop");
    if (backdrop) return backdrop;

    const modalHtml = `
    <div class="pcod-modal-backdrop" id="pcod-choice-modal-backdrop" style="display: none;">
      <div class="pcod-choice-modal" id="pcod-choice-modal">
        <!-- Mobile pull indicator handle -->
        <div class="pcod-mobile-pull-handle"></div>

        <!-- Sticky Header -->
        <div class="pcod-choice-header">
          <div>
            <div class="pcod-shield-badge">🔒 256-Bit SSL Secure Checkout</div>
            <h3 class="pcod-choice-title">Choose How You'd Like to Pay</h3>
          </div>
          <button type="button" class="pcod-choice-close" id="pcod-choice-close-btn" aria-label="Close">&times;</button>
        </div>

        <!-- Inner Scrollable Container (Effortless scrolling on mobile & small screens) -->
        <div class="pcod-modal-scroll-area" id="pcod-modal-scroll-area">
          <!-- Product / Cart Mini Summary -->
          <div class="pcod-choice-product">
            <img id="pcod-choice-img" src="" alt="Item" class="pcod-choice-thumb" />
            <div class="pcod-choice-prod-info">
              <div class="pcod-choice-prod-name" id="pcod-choice-prod-name">Order Items</div>
              <div class="pcod-choice-prod-meta" id="pcod-choice-prod-meta">Calculating...</div>
            </div>
          </div>

          <!-- Option Cards Container (Full Prepaid & Partial COD) -->
          <div class="pcod-cards-container" id="pcod-cards-container">
            <!-- Option 1: Full Prepaid -->
            <div class="pcod-option-card pcod-card-prepaid" id="pcod-card-prepaid">
              <div class="pcod-card-top">
                <span class="pcod-badge pcod-badge-green">⚡ Fastest Dispatch</span>
                <span class="pcod-prepaid-tag" id="pcod-prepaid-tag">⚡ Extra 5% OFF on Prepaid</span>
                <div class="pcod-price-stack">
                  <span class="pcod-card-price" id="pcod-prepaid-price">₹0</span>
                  <span class="pcod-original-price" id="pcod-prepaid-orig-price" style="display: none;">₹0</span>
                  <span class="pcod-save-badge" id="pcod-prepaid-save-badge" style="display: none;">Save ₹0</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 1: Full Prepaid</div>
                <div class="pcod-card-desc" id="pcod-prepaid-desc">Pay 100% online now via UPI, Cards, or Netbanking. Extra prepaid savings applied automatically.</div>
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

          <!-- Coupon & Best Deals Section (Placed BELOW Payment Options) -->
          <div class="pcod-coupon-section" id="pcod-coupon-section">
            <div class="pcod-coupon-section-title-row">
              <span class="pcod-coupon-section-icon">🏷️</span>
              <span class="pcod-coupon-section-heading">Apply Coupons & Exclusive Offers</span>
            </div>

            <!-- Manual Coupon Code Input -->
            <div class="pcod-coupon-input-row">
              <input type="text" id="pcod-coupon-input" class="pcod-coupon-input" placeholder="ENTER COUPON CODE" />
              <button type="button" id="pcod-coupon-apply-btn" class="pcod-coupon-apply-btn">Apply</button>
            </div>

            <!-- Coupon Status Message Banner -->
            <div id="pcod-coupon-applied-msg" class="pcod-coupon-applied-msg" style="display: none;"></div>

            <!-- Available Offer Cards List (Matching Reference Image) -->
            <div class="pcod-available-coupons-wrap" id="pcod-available-coupons-wrap" style="display: none;">
              <div class="pcod-available-coupons-title">Available Coupons</div>
              <div class="pcod-coupon-cards-list" id="pcod-coupon-chips"></div>
            </div>
          </div>

          <!-- SMS OTP Verification Step -->
          <div class="pcod-otp-step" id="pcod-otp-step" style="display: none;">
            <div class="pcod-otp-header">
              <button type="button" class="pcod-otp-back-btn" id="pcod-otp-back-btn">← Change Payment Option</button>
            </div>
            <div class="pcod-otp-title">Verify Mobile via SMS</div>
            <div class="pcod-otp-desc">To confirm your Partial COD order, please enter your mobile number. A 6-digit SMS verification code will be sent.</div>

            <!-- Phone Input Step -->
            <div class="pcod-otp-phone-group" id="pcod-otp-phone-group">
              <div class="pcod-otp-input-wrap">
                <span class="pcod-otp-prefix">+91</span>
                <input type="tel" id="pcod-otp-phone-input" class="pcod-otp-input" placeholder="10-digit mobile number" maxlength="10" />
              </div>
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-send-btn">Send SMS Code →</button>
            </div>

            <!-- Code Input Step -->
            <div class="pcod-otp-code-group" id="pcod-otp-code-group" style="display: none;">
              <div class="pcod-otp-sent-text" id="pcod-otp-sent-text">✅ 6-digit code sent to your mobile SMS inbox!</div>
              <div class="pcod-otp-input-wrap">
                <input type="text" id="pcod-otp-code-input" class="pcod-otp-input pcod-code" placeholder="------" maxlength="6" />
              </div>
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-verify-btn">Verify SMS & Place Order →</button>
              <div class="pcod-otp-resend">
                <button type="button" class="pcod-otp-resend-btn" id="pcod-otp-resend-btn">Didn't receive code? Resend SMS</button>
              </div>
            </div>

            <div class="pcod-otp-error" id="pcod-otp-error" style="display: none;"></div>
          </div>

          <!-- Security Footer -->
          <div class="pcod-choice-footer">
            <span>🛡️ Buyer Protection Guaranteed • Official Shopify Checkout</span>
          </div>
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

    // Coupon listeners
    const applyCouponBtn = $("pcod-coupon-apply-btn");
    const couponInput = $("pcod-coupon-input");

    if (applyCouponBtn && !applyCouponBtn.getAttribute("data-pcod-bound")) {
      applyCouponBtn.setAttribute("data-pcod-bound", "true");
      applyCouponBtn.addEventListener("click", function () {
        const val = couponInput ? couponInput.value.trim() : "";
        if (val) handleApplyCoupon(val);
      });
    }

    if (couponInput && !couponInput.getAttribute("data-pcod-bound")) {
      couponInput.setAttribute("data-pcod-bound", "true");
      couponInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = couponInput.value.trim();
          if (val) handleApplyCoupon(val);
        }
      });
    }

    const otpBackBtn = $("pcod-otp-back-btn");
    const otpSendBtn = $("pcod-otp-send-btn");
    const otpVerifyBtn = $("pcod-otp-verify-btn");
    const otpResendBtn = $("pcod-otp-resend-btn");

    if (otpBackBtn && !otpBackBtn.getAttribute("data-pcod-bound")) {
      otpBackBtn.setAttribute("data-pcod-bound", "true");
      otpBackBtn.addEventListener("click", hideOtpStep);
    }
    if (otpSendBtn && !otpSendBtn.getAttribute("data-pcod-bound")) {
      otpSendBtn.setAttribute("data-pcod-bound", "true");
      otpSendBtn.addEventListener("click", handleSendOtp);
    }
    if (otpVerifyBtn && !otpVerifyBtn.getAttribute("data-pcod-bound")) {
      otpVerifyBtn.setAttribute("data-pcod-bound", "true");
      otpVerifyBtn.addEventListener("click", handleVerifyOtp);
    }
    if (otpResendBtn && !otpResendBtn.getAttribute("data-pcod-bound")) {
      otpResendBtn.setAttribute("data-pcod-bound", "true");
      otpResendBtn.addEventListener("click", function () {
        const phoneGroup = $("pcod-otp-phone-group");
        const codeGroup = $("pcod-otp-code-group");
        if (phoneGroup) phoneGroup.style.display = "block";
        if (codeGroup) codeGroup.style.display = "none";
        handleSendOtp();
      });
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

  async function resolveProductDetails() {
    const buyBtn = $("pcod-fast-buy-btn");
    let variantId = buyBtn ? buyBtn.getAttribute("data-variant-id") || "" : "";
    let price = parseFloat(buyBtn ? buyBtn.getAttribute("data-product-price") || "0" : "0");
    let title = buyBtn ? buyBtn.getAttribute("data-product-title") || "" : "";
    let image = buyBtn ? buyBtn.getAttribute("data-product-image") || "" : "";
    let quantity = 1;

    // 1. Get current selected variant input from the theme's product form
    const variantInput = document.querySelector(
      'form[action*="/cart/add"] [name="id"], form[action*="/cart/add"] select[name="id"], select.product-form__variants, [name="id"]'
    );
    if (variantInput && variantInput.value && !isNaN(Number(variantInput.value))) {
      variantId = variantInput.value;
    }

    // 2. Get quantity
    const qtyInput = document.querySelector(
      'form[action*="/cart/add"] [name="quantity"], input[name="quantity"]'
    );
    if (qtyInput && qtyInput.value && !isNaN(Number(qtyInput.value)) && Number(qtyInput.value) > 0) {
      quantity = parseInt(qtyInput.value, 10);
    }

    // 3. If price is missing or 0, try Shopify's native product endpoint: /products/<handle>.js
    if (!price || price <= 0 || !title || title === "Product") {
      try {
        const path = window.location.pathname.replace(/\/$/, "");
        if (path.includes("/products/")) {
          const res = await fetch(path + ".js");
          if (res.ok) {
            const productJson = await res.json();
            if (productJson) {
              title = productJson.title || title;
              image = productJson.featured_image || image;

              const currentVId = variantId || (productJson.variants && productJson.variants[0]?.id);
              const matchedVariant =
                productJson.variants?.find((v) => String(v.id) === String(currentVId)) ||
                productJson.variants?.[0];

              if (matchedVariant) {
                variantId = String(matchedVariant.id);
                price = matchedVariant.price / 100; // Shopify .js returns price in cents!
                if (matchedVariant.featured_image && matchedVariant.featured_image.src) {
                  image = matchedVariant.featured_image.src;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[PCOD] Could not fetch product .js:", err);
      }
    }

    // 4. If price is still missing or 0, try window.ShopifyAnalytics
    if ((!price || price <= 0) && window.ShopifyAnalytics?.meta?.product) {
      try {
        const sap = window.ShopifyAnalytics.meta.product;
        title = sap.title || title;
        const currentVId = variantId || window.ShopifyAnalytics.meta.selectedVariantId;
        const matchedVariant =
          sap.variants?.find((v) => String(v.id) === String(currentVId)) || sap.variants?.[0];
        if (matchedVariant) {
          variantId = String(matchedVariant.id);
          price = matchedVariant.price / 100;
        }
      } catch (err) {}
    }

    // 5. If price is still missing, parse from DOM price text
    if (!price || price <= 0) {
      const priceElem = document.querySelector(
        ".price__regular .price-item--regular, .price-item--sale, .price-item, .product__price, [data-product-price], .price"
      );
      if (priceElem) {
        const text = priceElem.textContent.replace(/[^0-9.]/g, "");
        if (text && !isNaN(parseFloat(text))) {
          price = parseFloat(text);
        }
      }
    }

    // 6. Title fallback
    if (!title || title === "Product") {
      const titleElem = document.querySelector(
        ".product__title h1, .product-title, h1.product__title, h1"
      );
      if (titleElem && titleElem.textContent.trim()) {
        title = titleElem.textContent.trim();
      } else {
        title = "Product";
      }
    }

    // 7. Image fallback
    if (!image) {
      const imgElem = document.querySelector(
        ".product__media img, .product-featured-media img, .product-single__photo img, img.image-magnify-lightbox"
      );
      if (imgElem && imgElem.src) {
        image = imgElem.src;
      }
    }

    const shop = getShopDomain();
    activeProduct = { variantId, quantity, price, title, image, shop };
    return activeProduct;
  }

  async function openProductChoiceModal() {
    activeMode = "product";
    ensureModalExists();
    const backdrop = $("pcod-choice-modal-backdrop");
    if (!backdrop) return;

    const details = await resolveProductDetails();

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

  let baseOrderTotal = 0;
  let activeCoupon = null;
  let storeOffers = {
    coupons: [
      { code: "GET150", title: "Flat ₹150 OFF above ₹299", type: "fixed", value: 150, minSubtotal: 299 },
      { code: "GET200", title: "Flat ₹200 OFF above ₹399", type: "fixed", value: 200, minSubtotal: 399 },
      { code: "SAVE10", title: "10% OFF on all items", type: "percentage", value: 10, maxCap: 100 },
    ],
    prepaidOffer: {
      enabled: true,
      type: "percentage",
      value: 5,
      badgeText: "⚡ Extra 5% OFF on Prepaid",
    },
  };

  async function loadStoreOffers(subtotal) {
    try {
      const shop = getShopDomain();
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/coupons?shop=${encodeURIComponent(shop)}&subtotal=${subtotal}`);
      if (res.ok) {
        const data = await res.json();
        if (data.coupons && Array.isArray(data.coupons)) {
          storeOffers.coupons = data.coupons;
        }
        if (data.prepaidOffer) {
          storeOffers.prepaidOffer = data.prepaidOffer;
        }
        renderCouponChips();
      }
    } catch (e) {
      console.warn("[Store Offers Fetch Fallback]:", e);
      renderCouponChips();
    }
  }

  function renderCouponChips() {
    const wrap = $("pcod-available-coupons-wrap");
    const container = $("pcod-coupon-chips");
    if (!container) return;

    if (!storeOffers.coupons || storeOffers.coupons.length === 0) {
      if (wrap) wrap.style.display = "none";
      return;
    }

    if (wrap) wrap.style.display = "block";
    container.innerHTML = storeOffers.coupons
      .map(function (c) {
        const isActive = activeCoupon && activeCoupon.code.toUpperCase() === c.code.toUpperCase();
        const minSub = c.minSubtotal ? Number(c.minSubtotal) : 0;
        const isLocked = minSub > 0 && baseOrderTotal < minSub;
        const diff = isLocked ? Math.ceil(minSub - baseOrderTotal) : 0;

        let title = c.title;
        if (!title) {
          title =
            c.type === "percentage"
              ? `${c.value}% OFF${c.maxCap ? ` (Max ₹${c.maxCap})` : ""}`
              : `Flat ₹${c.value} OFF${minSub > 0 ? ` above ₹${minSub}` : ""}`;
        }

        return `
          <div class="pcod-discount-card ${isActive ? "applied" : ""} ${isLocked ? "locked" : ""}" data-coupon-code="${c.code}" data-min-sub="${minSub}">
            <div class="pcod-discount-card-left">
              <div class="pcod-discount-badge-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="5" x2="5" y2="19"></line>
                  <circle cx="6.5" cy="6.5" r="2.5"></circle>
                  <circle cx="17.5" cy="17.5" r="2.5"></circle>
                </svg>
              </div>
              <div class="pcod-discount-info">
                <div class="pcod-discount-title">${title}</div>
                <div class="pcod-discount-subtitle">Use code <strong>${c.code}</strong></div>
                <div class="pcod-discount-tag-row">
                  <span class="pcod-discount-code-box">${c.code}</span>
                  ${isLocked ? `<span class="pcod-discount-unlock-tag">Add ₹${diff.toLocaleString("en-IN")} more to unlock</span>` : ""}
                </div>
              </div>
            </div>
            <div class="pcod-discount-card-right">
              ${
                isActive
                  ? `
                <div class="pcod-discount-applied-pill">✓ Applied</div>
                <button type="button" class="pcod-discount-remove-link" data-remove-code="${c.code}">Remove</button>
              `
                  : `
                <button type="button" class="pcod-discount-apply-action ${isLocked ? "disabled" : ""}" ${isLocked ? "disabled" : ""}>
                  ${isLocked ? "LOCKED" : "APPLY"}
                </button>
                <svg class="pcod-chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="#94A3B8" stroke-width="2" fill="none">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              `
              }
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".pcod-discount-card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".pcod-discount-remove-link")) {
          e.stopPropagation();
          handleRemoveCoupon();
          return;
        }

        const code = this.getAttribute("data-coupon-code");
        const minSub = Number(this.getAttribute("data-min-sub") || 0);

        if (minSub > 0 && baseOrderTotal < minSub) {
          const diff = Math.ceil(minSub - baseOrderTotal);
          const msgElem = $("pcod-coupon-applied-msg");
          if (msgElem) {
            msgElem.style.display = "flex";
            msgElem.style.background = "#FEF3C7";
            msgElem.style.borderColor = "#FCD34D";
            msgElem.style.color = "#92400E";
            msgElem.innerHTML = `<span>⚠️ Add ₹${diff.toLocaleString("en-IN")} more items to cart to unlock code <strong>${code}</strong> (Min ₹${minSub}).</span>`;
          }
          return;
        }

        const input = $("pcod-coupon-input");
        if (input) input.value = code;
        handleApplyCoupon(code);
      });
    });
  }

  async function handleApplyCoupon(codeToApply) {
    const input = $("pcod-coupon-input");
    const applyBtn = $("pcod-coupon-apply-btn");
    const msgElem = $("pcod-coupon-applied-msg");
    const rawCode = String(codeToApply || (input ? input.value : "")).trim().toUpperCase();

    if (!rawCode) return;

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = "Applying...";
    }

    try {
      const shop = getShopDomain();
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          code: rawCode,
          subtotal: baseOrderTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || `Coupon '${rawCode}' is not valid for this order.`);
      }

      activeCoupon = data;
      if (input) input.value = data.code;

      if (msgElem) {
        msgElem.style.display = "flex";
        msgElem.style.background = "#DCFCE7";
        msgElem.style.borderColor = "#86EFAC";
        msgElem.style.color = "#166534";
        msgElem.innerHTML = `
          <span>🎉 Code <strong>${data.code}</strong> applied! Saved ₹${data.discountAmount.toLocaleString("en-IN")} (${data.discountSummary})</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;
        const removeBtn = $("pcod-coupon-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", handleRemoveCoupon);
        }
      }

      renderCouponChips();
      recalculateModalPrices();
    } catch (err) {
      if (msgElem) {
        msgElem.style.display = "flex";
        msgElem.style.background = "#FEF2F2";
        msgElem.style.borderColor = "#FCA5A5";
        msgElem.style.color = "#DC2626";
        msgElem.innerHTML = `<span>⚠️ ${err.message || "Failed to apply coupon."}</span>`;
      }
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = "Apply";
      }
    }
  }

  function handleRemoveCoupon() {
    activeCoupon = null;
    const input = $("pcod-coupon-input");
    const msgElem = $("pcod-coupon-applied-msg");
    if (input) input.value = "";
    if (msgElem) {
      msgElem.style.display = "none";
      msgElem.style.background = "#DCFCE7";
      msgElem.style.borderColor = "#86EFAC";
      msgElem.style.color = "#166534";
      msgElem.innerHTML = "";
    }
    renderCouponChips();
    recalculateModalPrices();
  }

  function recalculateModalPrices() {
    const couponDiscount = activeCoupon ? activeCoupon.discountAmount : 0;
    const effectiveSubtotal = Math.max(0, baseOrderTotal - couponDiscount);

    // Extra Prepaid Discount calculation
    let extraPrepaid = 0;
    const pOffer = storeOffers.prepaidOffer;
    if (pOffer && pOffer.enabled && pOffer.value > 0) {
      if (pOffer.type === "percentage") {
        extraPrepaid = Math.round(((effectiveSubtotal * pOffer.value) / 100) * 100) / 100;
      } else {
        extraPrepaid = pOffer.value;
      }
      extraPrepaid = Math.min(extraPrepaid, effectiveSubtotal);
    }

    const prepaidTotal = Math.max(0, Math.round((effectiveSubtotal - extraPrepaid) * 100) / 100);
    const totalPrepaidSavings = Math.round((baseOrderTotal - prepaidTotal) * 100) / 100;

    // 1. Update Option 1 (Full Prepaid) UI
    const prepaidPrice = $("pcod-prepaid-price");
    const prepaidOrigPrice = $("pcod-prepaid-orig-price");
    const prepaidSaveBadge = $("pcod-prepaid-save-badge");
    const prepaidTag = $("pcod-prepaid-tag");
    const prepaidBtnLabel = $("pcod-prepaid-btn-label");

    if (prepaidPrice) prepaidPrice.textContent = `₹${prepaidTotal.toLocaleString("en-IN")}`;

    if (totalPrepaidSavings > 0) {
      if (prepaidOrigPrice) {
        prepaidOrigPrice.textContent = `₹${baseOrderTotal.toLocaleString("en-IN")}`;
        prepaidOrigPrice.style.display = "inline";
      }
      if (prepaidSaveBadge) {
        prepaidSaveBadge.textContent = `Save ₹${totalPrepaidSavings.toLocaleString("en-IN")}`;
        prepaidSaveBadge.style.display = "inline";
      }
    } else {
      if (prepaidOrigPrice) prepaidOrigPrice.style.display = "none";
      if (prepaidSaveBadge) prepaidSaveBadge.style.display = "none";
    }

    if (prepaidTag) {
      if (pOffer && pOffer.enabled) {
        prepaidTag.textContent = pOffer.badgeText || "⚡ Extra 5% OFF on Prepaid";
        prepaidTag.style.display = "inline-block";
      } else {
        prepaidTag.style.display = "none";
      }
    }

    if (prepaidBtnLabel) {
      prepaidBtnLabel.textContent = totalPrepaidSavings > 0
        ? `Pay Full ₹${prepaidTotal.toLocaleString("en-IN")} Online (Save ₹${totalPrepaidSavings.toLocaleString("en-IN")}) →`
        : `Pay Full ₹${prepaidTotal.toLocaleString("en-IN")} Online →`;
    }

    // 2. Update Option 2 (Partial COD) UI
    let deposit = effectiveSubtotal > 100 ? 100 : effectiveSubtotal;
    const balance = Math.max(0, Math.round((effectiveSubtotal - deposit) * 100) / 100);

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
  }

  function populateModalUI({ title, image, meta, total, deposit, balance }) {
    baseOrderTotal = total;
    activeCoupon = null;

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

    // Load available promotional coupon deals & prepaid rules
    loadStoreOffers(total);

    // Initial pricing recalculation
    recalculateModalPrices();

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

    let checkoutUrl = "/checkout";
    if (activeMode !== "cart" && activeProduct && activeProduct.variantId) {
      const { variantId, quantity } = activeProduct;
      checkoutUrl = `/cart/${variantId}:${quantity}`;
    }

    // Pass coupon code to checkout if applied
    if (activeCoupon && activeCoupon.code) {
      checkoutUrl += (checkoutUrl.includes("?") ? "&" : "?") + `discount=${encodeURIComponent(activeCoupon.code)}`;
    }

    window.location.href = checkoutUrl;
  }

  let verifiedPhone = "";
  let verifiedToken = "";

  function showOtpStep() {
    const cards = $("pcod-cards-container");
    const couponSec = $("pcod-coupon-section");
    const otpStep = $("pcod-otp-step");
    if (cards) cards.style.display = "none";
    if (couponSec) couponSec.style.display = "none";
    if (otpStep) otpStep.style.display = "block";
    const phoneInput = $("pcod-otp-phone-input");
    if (phoneInput) phoneInput.focus();
  }

  function hideOtpStep() {
    const cards = $("pcod-cards-container");
    const couponSec = $("pcod-coupon-section");
    const otpStep = $("pcod-otp-step");
    if (cards) cards.style.display = "block";
    if (couponSec) couponSec.style.display = "block";
    if (otpStep) otpStep.style.display = "none";
    setOtpError("");
    const codBtn = $("pcod-btn-choose-cod");
    if (codBtn) {
      codBtn.disabled = false;
      codBtn.style.opacity = "1";
    }
  }

  function setOtpError(msg) {
    const errElem = $("pcod-otp-error");
    if (errElem) {
      if (msg) {
        errElem.textContent = msg;
        errElem.style.display = "block";
      } else {
        errElem.style.display = "none";
      }
    }
  }

  async function handleSendOtp() {
    const phoneInput = $("pcod-otp-phone-input");
    const sendBtn = $("pcod-otp-send-btn");
    const rawPhone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, "") : "";

    if (!rawPhone || rawPhone.length < 10) {
      setOtpError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setOtpError("");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending SMS code...";
    }

    try {
      const shop = getShopDomain();
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", shop, phone: rawPhone, channel: "sms" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to deliver SMS OTP.");
      }

      const phoneGroup = $("pcod-otp-phone-group");
      const codeGroup = $("pcod-otp-code-group");
      if (phoneGroup) phoneGroup.style.display = "none";
      if (codeGroup) codeGroup.style.display = "block";

      const sentText = $("pcod-otp-sent-text");
      if (sentText) {
        sentText.textContent = data.debugOtp
          ? `✅ Simulator SMS OTP: ${data.debugOtp} (or 123456)`
          : `✅ 6-digit code sent via SMS to +91 ${rawPhone}!`;
      }

      const codeInput = $("pcod-otp-code-input");
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    } catch (err) {
      setOtpError(err.message || "Failed to deliver SMS OTP. Please check your number.");
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send SMS Code →";
      }
    }
  }

  async function handleVerifyOtp() {
    const phoneInput = $("pcod-otp-phone-input");
    const codeInput = $("pcod-otp-code-input");
    const verifyBtn = $("pcod-otp-verify-btn");

    const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, "") : "";
    const otp = codeInput ? codeInput.value.trim() : "";

    if (!otp || otp.length < 4) {
      setOtpError("Please enter the 6-digit SMS verification code.");
      return;
    }

    setOtpError("");
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = "Verifying & Placing Order...";
    }

    try {
      const shop = getShopDomain();
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", shop, phone, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.verified) {
        throw new Error(data.error || "Invalid SMS verification code. Please try again.");
      }

      verifiedPhone = phone;
      verifiedToken = data.token;

      // Proceed to Draft Checkout with verified phone, token, and coupon
      await executeDraftCheckout(phone, data.token);
    } catch (err) {
      setOtpError(err.message || "Verification failed. Please re-enter the code.");
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Verify SMS & Place Order →";
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
    if (label) label.textContent = "Verifying order...";

    try {
      const shop = getShopDomain();

      // Check if WhatsApp OTP is required
      if (!verifiedToken) {
        try {
          const checkRes = await fetch(`${BACKEND_URL}/api/partial-cod/otp?action=check&shop=${encodeURIComponent(shop)}`);
          const checkData = await checkRes.json();
          if (checkData.required) {
            showOtpStep();
            return;
          }
        } catch (checkErr) {
          console.warn("[OTP Check API]:", checkErr);
          showOtpStep();
          return;
        }
      }

      // If already verified or not required, proceed directly
      await executeDraftCheckout(verifiedPhone, verifiedToken);
    } catch (err) {
      console.warn("[OTP Check Fallback]:", err);
      await executeDraftCheckout(verifiedPhone, verifiedToken);
    }
  }

  async function executeDraftCheckout(phone, otpToken) {
    const codBtn = $("pcod-btn-choose-cod");
    const label = $("pcod-cod-btn-label");
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
            sku: it.sku,
          })),
          phone: phone || undefined,
          otpToken: otpToken || undefined,
          couponCode: activeCoupon ? activeCoupon.code : undefined,
          couponDiscount: activeCoupon ? activeCoupon.discountAmount : 0,
        };
      } else {
        const { variantId, quantity, price, title } = activeProduct;
        payload = {
          shop,
          variantId,
          quantity,
          price,
          title,
          phone: phone || undefined,
          otpToken: otpToken || undefined,
          couponCode: activeCoupon ? activeCoupon.code : undefined,
          couponDiscount: activeCoupon ? activeCoupon.discountAmount : 0,
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
      if (label) label.textContent = "Pay Deposit & Confirm COD →";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
