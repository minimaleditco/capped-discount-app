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
      ""
    );
  }

  function ensureModalExists() {
    let backdrop = $("pcod-choice-modal-backdrop");
    if (backdrop) return backdrop;

    const modalHtml = `
    <div class="pcod-modal-backdrop" id="pcod-choice-modal-backdrop" style="display: none;">
      <div class="pcod-choice-modal" id="pcod-choice-modal">
        <!-- Mobile pull indicator handle (shadcn Drawer) -->
        <div class="pcod-mobile-pull-handle"></div>

        <!-- Sticky Header (shadcn DialogHeader) -->
        <div class="pcod-choice-header">
          <div>
            <div class="pcod-shield-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
              <span>256-Bit SSL Secure Checkout</span>
            </div>
            <h3 class="pcod-choice-title">Choose How You'd Like to Pay</h3>
          </div>
          <button type="button" class="pcod-choice-close" id="pcod-choice-close-btn" aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Inner Scrollable Container -->
        <div class="pcod-modal-scroll-area" id="pcod-modal-scroll-area">
          <!-- Slide-Down Best Deal Announcement Banner -->
          <div id="pcod-auto-deal-banner" class="pcod-auto-deal-banner" style="display: none;">
            <span class="pcod-deal-icon">✨</span>
            <span id="pcod-auto-deal-text" class="pcod-deal-text"><strong>Best Deal Auto-Applied:</strong> Extra savings unlocked!</span>
          </div>

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
                <span class="pcod-badge pcod-badge-green">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>Fastest Dispatch</span>
                </span>
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
                <span class="pcod-badge pcod-badge-orange">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m7.5 4.27 9 5.15"></path>
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                    <path d="m3.3 7 8.7 5 8.7-5"></path>
                    <path d="M12 22V12"></path>
                  </svg>
                  <span>Pay Rest on Delivery</span>
                </span>
                <span class="pcod-save-badge" id="pcod-cod-tag" style="display: none;">Save ₹0</span>
                <div class="pcod-price-stack">
                  <div class="pcod-card-price-split">
                    <span class="pcod-price-now" id="pcod-cod-now">₹0 Now</span>
                    <span class="pcod-price-doorstep" id="pcod-cod-doorstep">+ ₹0 COD</span>
                  </div>
                  <span class="pcod-original-price" id="pcod-cod-orig-price" style="display: none;">Total ₹0</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 2: Partial Cash on Delivery</div>
                <div class="pcod-card-desc">Pay only <strong id="pcod-cod-desc-deposit">₹0</strong> advance deposit online to confirm shipping. Pay the remaining <strong id="pcod-cod-desc-balance">₹0</strong> in cash at your doorstep.<span id="pcod-cod-desc-saving" style="display: none; color: #059669; font-weight: 600;"></span></div>
              </div>
              <button type="button" class="pcod-select-btn pcod-btn-cod" id="pcod-btn-choose-cod">
                <span class="pcod-btn-text" id="pcod-cod-btn-label">Pay Deposit & Confirm COD →</span>
              </button>
            </div>
          </div>

          <!-- Coupon & Best Deals Section -->
          <div class="pcod-coupon-section" id="pcod-coupon-section">
            <div class="pcod-coupon-section-title-row">
              <svg class="pcod-coupon-section-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
                <path d="M7 7h.01"></path>
              </svg>
              <span class="pcod-coupon-section-heading">Apply Coupons & Exclusive Offers</span>
            </div>

            <!-- Manual Coupon Code Input -->
            <div class="pcod-coupon-input-row">
              <input type="text" id="pcod-coupon-input" class="pcod-coupon-input" placeholder="ENTER COUPON CODE" />
              <button type="button" id="pcod-coupon-apply-btn" class="pcod-coupon-apply-btn">Apply</button>
            </div>

            <!-- Coupon Status Message Banner -->
            <div id="pcod-coupon-applied-msg" class="pcod-coupon-applied-msg" style="display: none;"></div>

            <!-- Available Offer Cards List -->
            <div class="pcod-available-coupons-wrap" id="pcod-available-coupons-wrap">
              <div class="pcod-available-coupons-title" id="pcod-available-coupons-title">Available Coupons</div>
              <div class="pcod-coupon-cards-list" id="pcod-coupon-chips"></div>
            </div>
          </div>

          <!-- SMS OTP Verification Step (shadcn InputOTP) -->
          <div class="pcod-otp-step" id="pcod-otp-step" style="display: none;">
            <div class="pcod-otp-header">
              <button type="button" class="pcod-otp-back-btn" id="pcod-otp-back-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
                <span>Change Payment Option</span>
              </button>
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

            <!-- Code Input Step (shadcn InputOTP 6-Box Grid) -->
            <div class="pcod-otp-code-group" id="pcod-otp-code-group" style="display: none;">
              <div class="pcod-otp-sent-text" id="pcod-otp-sent-text">✅ 6-digit code sent to your mobile SMS inbox!</div>
              <div class="pcod-otp-slots-row" id="pcod-otp-slots-row">
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="0" autocomplete="one-time-code" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="1" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="2" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="3" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="4" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="5" />
              </div>
              <input type="hidden" id="pcod-otp-code-input" value="" />
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-verify-btn">Verify SMS & Place Order →</button>
              <div class="pcod-otp-resend">
                <button type="button" class="pcod-otp-resend-btn" id="pcod-otp-resend-btn">Didn't receive code? Resend SMS</button>
              </div>
            </div>

            <div class="pcod-otp-error" id="pcod-otp-error" style="display: none;"></div>
          </div>

          <!-- Security Footer -->
          <div class="pcod-choice-footer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Encrypted 256-Bit SSL • Official Shopify Checkout</span>
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
    const slotContainer = $("pcod-otp-slots-row");

    if (slotContainer && !slotContainer.getAttribute("data-pcod-bound")) {
      slotContainer.setAttribute("data-pcod-bound", "true");
      const slots = slotContainer.querySelectorAll(".pcod-otp-slot");
      const hiddenInput = $("pcod-otp-code-input");

      function syncOtpFromSlots() {
        let code = "";
        slots.forEach(function (s) {
          code += (s.value || "");
          if (s.value) s.classList.add("filled");
          else s.classList.remove("filled");
        });
        if (hiddenInput) hiddenInput.value = code;
      }

      slots.forEach(function (slot, idx) {
        slot.addEventListener("input", function () {
          const val = this.value.replace(/[^0-9]/g, "");
          this.value = val ? val[val.length - 1] : "";
          syncOtpFromSlots();
          if (this.value && idx < slots.length - 1) {
            slots[idx + 1].focus();
          }
        });

        slot.addEventListener("keydown", function (e) {
          if (e.key === "Backspace" && !this.value && idx > 0) {
            slots[idx - 1].focus();
            slots[idx - 1].value = "";
            syncOtpFromSlots();
          } else if (e.key === "ArrowLeft" && idx > 0) {
            slots[idx - 1].focus();
          } else if (e.key === "ArrowRight" && idx < slots.length - 1) {
            slots[idx + 1].focus();
          }
        });

        slot.addEventListener("paste", function (e) {
          e.preventDefault();
          const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/[^0-9]/g, "");
          if (pasted) {
            slots.forEach(function (s, i) {
              s.value = pasted[i] || "";
            });
            syncOtpFromSlots();
            const focusIdx = Math.min(pasted.length, slots.length - 1);
            slots[focusIdx].focus();
          }
        });
      });
    }

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

  function calculateDeposit(amount) {
    const ds = storeOffers.depositSettings || { type: "percentage", value: 10 };
    let dep = ds.type === "percentage"
      ? Math.round((amount * (Number(ds.value) || 10)) / 100)
      : (Number(ds.value) || 100);
    dep = Math.max(1, Math.min(amount, dep));
    return dep;
  }

  async function openProductChoiceModal() {
    activeMode = "product";
    ensureModalExists();
    const backdrop = $("pcod-choice-modal-backdrop");
    if (!backdrop) return;

    const details = await resolveProductDetails();

    const total = details.price * details.quantity;
    const deposit = calculateDeposit(total);
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
      const rawAutoDiscount = (cart.total_discount || 0) / 100;
      let originalTotal = cart.total_price / 100;
      if (cart.original_total_price && cart.original_total_price > cart.total_price) {
        originalTotal = cart.original_total_price / 100;
      }

      baseOrderTotal = originalTotal;

      // Detect and lock in storewide automatic discount ONLY if it provides positive discount (> 0)
      if (rawAutoDiscount > 0) {
        let autoTitle = "Store Auto Discount";
        if (cart.cart_level_discount_applications && cart.cart_level_discount_applications.length > 0) {
          autoTitle = cart.cart_level_discount_applications[0].title || autoTitle;
        } else if (cart.items) {
          for (const it of cart.items) {
            if (it.discounts && it.discounts.length > 0) {
              autoTitle = it.discounts[0].title || autoTitle;
              break;
            }
          }
        }
        storeOffers.autoDiscount = {
          code: "AUTO",
          title: autoTitle,
          discountAmount: rawAutoDiscount,
          discountSummary: `${autoTitle} (Store Auto Offer)`,
          isAuto: true,
        };
        // Lock in by default unless a manual coupon was previously entered
        if (!activeCoupon || activeCoupon.isAuto) {
          activeCoupon = storeOffers.autoDiscount;
        }
      } else {
        storeOffers.autoDiscount = null;
        if (activeCoupon && activeCoupon.isAuto) {
          activeCoupon = null;
        }
      }

      const total = originalTotal;
      const deposit = calculateDeposit(total);
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
  // Coupons come exclusively from the merchant's live Shopify discounts.
  // Hardcoded fallbacks (DIWALI50/SAVE80/SAVE299) used to be auto-applied here
  // and then honoured by the server, granting discounts that did not exist.
  let storeOffers = {
    depositSettings: { type: "percentage", value: 10 },
    autoDiscount: null,
    coupons: [],
    prepaidOffer: {
      enabled: true,
      type: "percentage",
      value: 5,
      badgeText: "⚡ Extra 5% OFF on Prepaid",
    },
  };

  function autoApplyBestCoupon(subtotal) {
    if (!storeOffers.coupons || storeOffers.coupons.length === 0) return;

    let bestCoupon = null;
    let maxSavings = 0;

    for (const c of storeOffers.coupons) {
      const minSub = c.minSubtotal ? Number(c.minSubtotal) : 0;
      if (minSub > 0 && subtotal < minSub) continue;

      let savings = 0;
      if (c.type === "percentage") {
        savings = Math.round(((subtotal * c.value) / 100) * 100) / 100;
        if (c.maxCap && savings > c.maxCap) {
          savings = c.maxCap;
        }
      } else {
        savings = Number(c.value) || 0;
      }
      savings = Math.min(savings, subtotal);

      if (savings > maxSavings) {
        maxSavings = savings;
        bestCoupon = {
          code: c.code,
          title: c.title || `${c.code}`,
          discountAmount: savings,
          discountSummary: `${c.title || c.code} (Best Deal Applied)`,
          isAuto: false,
        };
      }
    }

    if (bestCoupon && bestCoupon.discountAmount > 0) {
      activeCoupon = bestCoupon;
      const input = $("pcod-coupon-input");
      if (input) input.value = bestCoupon.code;
      const msgElem = $("pcod-coupon-applied-msg");
      if (msgElem) {
        msgElem.style.display = "flex";
        msgElem.style.background = "#DCFCE7";
        msgElem.style.borderColor = "#86EFAC";
        msgElem.style.color = "#166534";
        msgElem.innerHTML = `
          <span>🎉 Best Deal <strong>${bestCoupon.code}</strong> auto-applied! Saved ₹${bestCoupon.discountAmount.toLocaleString("en-IN")}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;
        const removeBtn = $("pcod-coupon-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", handleRemoveCoupon);
        }
      }
    }
  }

  async function loadStoreOffers(subtotal) {
    try {
      const shop = getShopDomain();
      if (!shop) {
        console.warn("[Store Offers] Shopify shop domain unavailable; skipping offer lookup.");
        renderCouponChips();
        recalculateModalPrices();
        return;
      }
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/coupons?shop=${encodeURIComponent(shop)}&subtotal=${subtotal}`);
      if (res.ok) {
        const data = await res.json();
        if (data.depositSettings) {
          storeOffers.depositSettings = data.depositSettings;
        }
        // Always trust the server list, including an empty one. Previously an
        // empty response left the hardcoded fallback coupons in place.
        storeOffers.coupons = Array.isArray(data.coupons) ? data.coupons : [];
        if (data.prepaidOffer) {
          storeOffers.prepaidOffer = data.prepaidOffer;
        }
        // Automatic discounts are applied natively by Shopify at checkout.
        // They must NOT be re-applied here as a fake coupon code, because the
        // server now validates every code against the live discount list.
        storeOffers.autoDiscount = null;

        // Auto-apply the highest discount deal if user hasn't manually selected another
        if (!activeCoupon || activeCoupon.isAuto) {
          autoApplyBestCoupon(subtotal);
        }

        renderCouponChips();
        recalculateModalPrices();
      }
    } catch (e) {
      console.warn("[Store Offers Fetch Fallback]:", e);
      renderCouponChips();
      recalculateModalPrices();
    }
  }

  function applyAutoDiscount() {
    if (!storeOffers.autoDiscount || storeOffers.autoDiscount.discountAmount <= 0) return;
    activeCoupon = storeOffers.autoDiscount;
    const input = $("pcod-coupon-input");
    if (input) input.value = "";
    const msgElem = $("pcod-coupon-applied-msg");
    if (msgElem) {
      msgElem.style.display = "flex";
      msgElem.style.background = "#FEF3C7";
      msgElem.style.borderColor = "#FCD34D";
      msgElem.style.color = "#92400E";
      msgElem.innerHTML = `
        <span>⚡ Store Auto Discount <strong>${storeOffers.autoDiscount.title}</strong> is locked in! Saved ₹${storeOffers.autoDiscount.discountAmount.toLocaleString("en-IN")}</span>
      `;
    }
    renderCouponChips();
    recalculateModalPrices();
  }

  function renderCouponChips() {
    const wrap = $("pcod-available-coupons-wrap");
    const container = $("pcod-coupon-chips");
    const titleElem = $("pcod-available-coupons-title");
    if (!container) return;

    const hasAuto = storeOffers.autoDiscount && storeOffers.autoDiscount.discountAmount > 0;
    const hasCoupons = storeOffers.coupons && storeOffers.coupons.length > 0;

    if (!hasAuto && !hasCoupons) {
      if (wrap) wrap.style.display = "none";
      return;
    }

    if (wrap) wrap.style.display = "block";
    if (titleElem && hasCoupons) {
      titleElem.textContent = `Available Coupons (${storeOffers.coupons.length} Offers)`;
    }

    let html = "";

    // 1. Render Auto-Discount Card at the very top if present
    if (storeOffers.autoDiscount) {
      const isAutoActive = activeCoupon && activeCoupon.isAuto;
      html += `
        <div class="pcod-discount-card pcod-auto-card ${isAutoActive ? "applied" : ""}" data-is-auto="true">
          <div class="pcod-discount-card-left">
            <div class="pcod-discount-badge-icon pcod-auto-badge">
              <span style="font-size: 16px; color: #FFFFFF;">⚡</span>
            </div>
            <div class="pcod-discount-info">
              <div class="pcod-discount-title">${storeOffers.autoDiscount.title}</div>
              <div class="pcod-discount-subtitle">⚡ Store Auto Discount (Applied by Default)</div>
              <div class="pcod-discount-tag-row">
                <span class="pcod-discount-code-box">AUTO APPLIED</span>
                <span class="pcod-discount-unlock-tag" style="background: #FEF3C7; color: #92400E;">Default Savings</span>
              </div>
            </div>
          </div>
          <div class="pcod-discount-card-right">
            ${
              isAutoActive
                ? `<div class="pcod-discount-applied-pill">✓ Applied</div>`
                : `<button type="button" class="pcod-discount-apply-action pcod-reapply-auto-btn">RE-APPLY AUTO</button>`
            }
          </div>
        </div>
      `;
    }

    // 2. Render Promotional Coupons
    html += (storeOffers.coupons || [])
      .map(function (c) {
        const isActive = activeCoupon && !activeCoupon.isAuto && activeCoupon.code.toUpperCase() === c.code.toUpperCase();
        const minSub = c.minSubtotal ? Number(c.minSubtotal) : 0;
        const isLocked = minSub > 0 && baseOrderTotal < minSub;
        const diff = isLocked ? Math.ceil(minSub - baseOrderTotal) : 0;

        let potentialSavings = 0;
        if (c.type === "percentage") {
          potentialSavings = Math.round(((baseOrderTotal * c.value) / 100) * 100) / 100;
          if (c.maxCap && potentialSavings > c.maxCap) {
            potentialSavings = c.maxCap;
          }
        } else {
          potentialSavings = Number(c.value) || 0;
        }
        potentialSavings = Math.min(potentialSavings, baseOrderTotal);

        let title = c.title;
        if (!title) {
          title =
            c.type === "percentage"
              ? `${c.value}% OFF${c.maxCap ? ` (Max ₹${c.maxCap})` : ""}`
              : `Flat ₹${c.value} OFF${minSub > 0 ? ` above ₹${minSub}` : ""}`;
        }

        let tagHtml = "";
        if (isActive) {
          tagHtml = `<span class="pcod-discount-unlock-tag" style="background: #ECFDF5; color: #065F46; font-weight: 700;">✓ Active • Saved ₹${potentialSavings.toLocaleString("en-IN")}</span>`;
        } else if (isLocked) {
          tagHtml = `<span class="pcod-discount-unlock-tag" style="background: #FEE2E2; color: #991B1B; font-weight: 600;">🔒 Not Applicable: Add ₹${diff.toLocaleString("en-IN")} more</span>`;
        } else {
          tagHtml = `<span class="pcod-discount-unlock-tag" style="background: #EFF6FF; color: #1E40AF; font-weight: 600;">✨ Saves ₹${potentialSavings.toLocaleString("en-IN")} with this code</span>`;
        }

        let rightActionHtml = "";
        if (isActive) {
          rightActionHtml = `
            <div class="pcod-discount-applied-pill">✓ Applied</div>
            <button type="button" class="pcod-discount-remove-link" data-remove-code="${c.code}">Remove</button>
          `;
        } else if (isLocked) {
          rightActionHtml = `
            <button type="button" class="pcod-discount-apply-action disabled" disabled style="opacity: 0.6; cursor: not-allowed;">NOT APPLICABLE</button>
          `;
        } else {
          rightActionHtml = `
            <button type="button" class="pcod-discount-apply-action" data-apply-code="${c.code}">APPLY</button>
            <svg class="pcod-chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="#94A3B8" stroke-width="2" fill="none">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          `;
        }

        return `
          <div class="pcod-discount-card ${isActive ? "applied" : ""} ${isLocked ? "locked" : ""}" data-coupon-code="${c.code}" data-min-sub="${minSub}">
            <div class="pcod-discount-card-left">
              <div class="pcod-discount-badge-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
                  ${tagHtml}
                </div>
              </div>
            </div>
            <div class="pcod-discount-card-right">
              ${rightActionHtml}
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = html;

    // Listeners for auto card
    const autoCard = container.querySelector(".pcod-auto-card");
    if (autoCard) {
      autoCard.addEventListener("click", function () {
        applyAutoDiscount();
      });
    }

    // Listeners for coupon cards
    container.querySelectorAll(".pcod-discount-card:not(.pcod-auto-card)").forEach(function (card) {
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
            msgElem.style.background = "#FEF2F2";
            msgElem.style.borderColor = "#FCA5A5";
            msgElem.style.color = "#DC2626";
            msgElem.innerHTML = `<span>⚠️ Coupon <strong>${code}</strong> is not applicable for this order: Minimum order of ₹${minSub} required (Add ₹${diff} more).</span>`;
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

    // Instant local evaluation if code exists in storeOffers.coupons
    const localMatch = (storeOffers.coupons || []).find((c) => c.code.toUpperCase() === rawCode);

    if (localMatch) {
      const minSub = localMatch.minSubtotal ? Number(localMatch.minSubtotal) : 0;
      if (minSub > 0 && baseOrderTotal < minSub) {
        const diff = Math.ceil(minSub - baseOrderTotal);
        if (msgElem) {
          msgElem.style.display = "flex";
          msgElem.style.background = "#FEF2F2";
          msgElem.style.borderColor = "#FCA5A5";
          msgElem.style.color = "#DC2626";
          msgElem.innerHTML = `<span>⚠️ Coupon <strong>${localMatch.code}</strong> is not applicable for this order: Minimum order of ₹${minSub} required (Add ₹${diff} more).</span>`;
        }
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.textContent = "Apply";
        }
        return;
      }

      let discountAmount = 0;
      if (localMatch.type === "percentage") {
        discountAmount = Math.round(((baseOrderTotal * localMatch.value) / 100) * 100) / 100;
        if (localMatch.maxCap && discountAmount > localMatch.maxCap) {
          discountAmount = localMatch.maxCap;
        }
      } else {
        discountAmount = Number(localMatch.value) || 0;
      }
      discountAmount = Math.min(discountAmount, baseOrderTotal);

      activeCoupon = {
        code: localMatch.code,
        title: localMatch.title || `${localMatch.code}`,
        discountAmount,
        discountSummary: `${localMatch.title || localMatch.code} (Applied)`,
        isAuto: false,
      };

      if (input) input.value = localMatch.code;

      if (msgElem) {
        msgElem.style.display = "flex";
        msgElem.style.background = "#DCFCE7";
        msgElem.style.borderColor = "#86EFAC";
        msgElem.style.color = "#166534";
        msgElem.innerHTML = `
          <span>🎉 Code <strong>${localMatch.code}</strong> applied! Saved ₹${discountAmount.toLocaleString("en-IN")}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;
        const removeBtn = $("pcod-coupon-remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("click", handleRemoveCoupon);
        }
      }

      renderCouponChips();
      recalculateModalPrices();
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
        if (!localMatch) {
          throw new Error(data.error || `Coupon '${rawCode}' is not valid for this order.`);
        }
      } else {
        activeCoupon = data;
        if (data.depositSettings) {
          storeOffers.depositSettings = data.depositSettings;
        }
        if (data.coupons && Array.isArray(data.coupons) && data.coupons.length > 0) {
          storeOffers.coupons = data.coupons;
        }
        if (input) input.value = data.code;

        if (msgElem) {
          msgElem.style.display = "flex";
          msgElem.style.background = "#DCFCE7";
          msgElem.style.borderColor = "#86EFAC";
          msgElem.style.color = "#166534";
          msgElem.innerHTML = `
            <span>🎉 Code <strong>${data.code}</strong> applied! Saved ₹${data.discountAmount.toLocaleString("en-IN")}${storeOffers.autoDiscount ? " (Replaces Auto Discount)" : ""}</span>
            <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">${storeOffers.autoDiscount ? "Revert to Auto Offer" : "Remove"}</button>
          `;
          const removeBtn = $("pcod-coupon-remove-btn");
          if (removeBtn) {
            removeBtn.addEventListener("click", handleRemoveCoupon);
          }
        }

        renderCouponChips();
        recalculateModalPrices();
      }
    } catch (err) {
      if (!localMatch) {
        activeCoupon = null;
        if (msgElem) {
          msgElem.style.display = "flex";
          msgElem.style.background = "#FEF2F2";
          msgElem.style.borderColor = "#FCA5A5";
          msgElem.style.color = "#DC2626";
          msgElem.innerHTML = `<span>⚠️ ${err.message || "Failed to apply coupon."}</span>`;
        }
        renderCouponChips();
        recalculateModalPrices();
      }
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = "Apply";
      }
    }
  }

  function handleRemoveCoupon() {
    const input = $("pcod-coupon-input");
    if (input) input.value = "";

    // If an auto-discount exists on the store, revert back to locking it in!
    if (storeOffers.autoDiscount) {
      applyAutoDiscount();
      return;
    }

    activeCoupon = null;
    const msgElem = $("pcod-coupon-applied-msg");
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

    // 0. Update Deal Announcement Banner (Slide-down)
    const dealBanner = $("pcod-auto-deal-banner");
    const dealText = $("pcod-auto-deal-text");
    if (dealBanner && dealText) {
      if (couponDiscount > 0 && activeCoupon) {
        dealText.innerHTML = `<strong>Best Deal '${activeCoupon.code}' Auto-Applied:</strong> You save <strong>₹${couponDiscount.toLocaleString("en-IN")}</strong> on this order!`;
        dealBanner.style.display = "flex";
      } else {
        dealBanner.style.display = "none";
      }
    }

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
    const deposit = calculateDeposit(effectiveSubtotal);
    const balance = Math.max(0, Math.round((effectiveSubtotal - deposit) * 100) / 100);

    const codNow = $("pcod-cod-now");
    const codDoorstep = $("pcod-cod-doorstep");
    const codOrigPrice = $("pcod-cod-orig-price");
    const codTag = $("pcod-cod-tag");
    const descDeposit = $("pcod-cod-desc-deposit");
    const descBalance = $("pcod-cod-desc-balance");
    const descSaving = $("pcod-cod-desc-saving");
    const codBtnLabel = $("pcod-cod-btn-label");

    if (codNow) codNow.textContent = `₹${deposit.toLocaleString("en-IN")} Now`;
    if (codDoorstep) codDoorstep.textContent = `+ ₹${balance.toLocaleString("en-IN")} on Delivery`;
    if (descDeposit) descDeposit.textContent = `₹${deposit.toLocaleString("en-IN")}`;
    if (descBalance) descBalance.textContent = `₹${balance.toLocaleString("en-IN")}`;

    if (couponDiscount > 0) {
      if (codOrigPrice) {
        codOrigPrice.textContent = `Total ₹${baseOrderTotal.toLocaleString("en-IN")}`;
        codOrigPrice.style.display = "inline";
      }
      if (codTag) {
        codTag.textContent = `Save ₹${couponDiscount.toLocaleString("en-IN")}`;
        codTag.style.display = "inline";
      }
      if (descSaving) {
        descSaving.textContent = ` (Total order reduced from ₹${baseOrderTotal.toLocaleString("en-IN")} to ₹${effectiveSubtotal.toLocaleString("en-IN")})`;
        descSaving.style.display = "inline";
      }
    } else {
      if (codOrigPrice) codOrigPrice.style.display = "none";
      if (codTag) codTag.style.display = "none";
      if (descSaving) descSaving.style.display = "none";
    }

    if (codBtnLabel) codBtnLabel.textContent = `Pay ₹${deposit.toLocaleString("en-IN")} Deposit & Confirm COD →`;
  }

  function populateModalUI({ title, image, meta, total, deposit, balance }) {
    baseOrderTotal = total;

    // Immediately evaluate and auto-apply best deal from store offers
    if (!activeCoupon || activeCoupon.isAuto) {
      autoApplyBestCoupon(total);
    }

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

    // Immediate synchronous render so modal never has an empty/unrendered coupon area
    renderCouponChips();
    recalculateModalPrices();

    // Asynchronously fetch fresh live offers from backend
    loadStoreOffers(total);

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
    if (label) label.textContent = "Opening Checkout...";

    // Calculate if extra prepaid discount is active
    let extraPrepaid = 0;
    const pOffer = storeOffers.prepaidOffer;
    const couponDiscount = activeCoupon ? activeCoupon.discountAmount : 0;
    const effectiveSubtotal = Math.max(0, baseOrderTotal - couponDiscount);
    if (pOffer && pOffer.enabled && pOffer.value > 0) {
      if (pOffer.type === "percentage") {
        extraPrepaid = Math.round(((effectiveSubtotal * pOffer.value) / 100) * 100) / 100;
      } else {
        extraPrepaid = pOffer.value;
      }
      extraPrepaid = Math.min(extraPrepaid, effectiveSubtotal);
    }

    // If an extra prepaid discount is active, create a single prepaid draft order
    // to charge the exact discounted price and prevent any extra coupon entry at checkout
    if (extraPrepaid > 0) {
      executeDraftCheckout("", "", true, extraPrepaid);
      return;
    }

    // Standard Shopify checkout handoff with the single active coupon code
    let checkoutUrl = "/checkout";
    if (activeMode !== "cart" && activeProduct && activeProduct.variantId) {
      const { variantId, quantity } = activeProduct;
      checkoutUrl = `/cart/${variantId}:${quantity}`;
    }

    // If a manual coupon is active, pass it to checkout (which deactivates conflicting auto discounts)
    // If store auto discount is active, do NOT pass a discount param, allowing Shopify's native Function to apply the auto discount!
    if (activeCoupon && !activeCoupon.isAuto && activeCoupon.code) {
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
      }
      const slots = document.querySelectorAll(".pcod-otp-slot");
      slots.forEach(function (s) {
        s.value = "";
        s.classList.remove("filled");
      });
      if (slots.length > 0) slots[0].focus();
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

  async function executeDraftCheckout(phone, otpToken, isPrepaid, prepaidDiscount) {
    const codBtn = $("pcod-btn-choose-cod");
    const prepaidBtn = $("pcod-btn-choose-prepaid");
    const label = isPrepaid ? $("pcod-prepaid-btn-label") : $("pcod-cod-btn-label");
    if (label) label.textContent = isPrepaid ? "Opening Prepaid Checkout..." : "Opening Partial COD Checkout...";

    try {
      const shop = getShopDomain();
      const couponDiscount = activeCoupon ? activeCoupon.discountAmount : 0;
      const effectiveSubtotal = Math.max(0, baseOrderTotal - couponDiscount);
      const calculatedDeposit = isPrepaid ? 0 : calculateDeposit(effectiveSubtotal);
      let payload;

      const storeCurrency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || "INR";

      if (activeMode === "cart" && activeCart) {
        payload = {
          shop,
          currency: storeCurrency,
          isPrepaid: !!isPrepaid,
          prepaidDiscount: prepaidDiscount || 0,
          deposit: calculatedDeposit,
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
          currency: storeCurrency,
          isPrepaid: !!isPrepaid,
          prepaidDiscount: prepaidDiscount || 0,
          deposit: calculatedDeposit,
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
        throw new Error(data.error || "Unable to open checkout.");
      }

      // Redirect to Shopify Native Draft Checkout
      window.location.href = data.invoiceUrl;
    } catch (err) {
      console.error("[Checkout Error]:", err);
      alert(err.message || "Failed to open checkout. Please try again.");
      if (codBtn) {
        codBtn.disabled = false;
        codBtn.style.opacity = "1";
      }
      if (prepaidBtn) {
        prepaidBtn.disabled = false;
        prepaidBtn.style.opacity = "1";
      }
      const codLabel = $("pcod-cod-btn-label");
      if (codLabel) codLabel.textContent = "Pay Deposit & Confirm COD →";
      const prepLabel = $("pcod-prepaid-btn-label");
      if (prepLabel) prepLabel.textContent = "Pay Full Online →";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
