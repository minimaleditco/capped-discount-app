(function () {
  const BACKEND_URL = "https://capped-discount-app.onrender.com";

  let activeProduct = {
    variantId: "",
    quantity: 1,
    price: 0,
    title: "",
    image: "",
    shop: "",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    const buyBtn = $("pcod-fast-buy-btn");
    const backdrop = $("pcod-choice-modal-backdrop");
    const closeBtn = $("pcod-choice-close-btn");
    const prepaidBtn = $("pcod-btn-choose-prepaid");
    const codBtn = $("pcod-btn-choose-cod");

    if (buyBtn && !buyBtn.getAttribute("data-pcod-bound")) {
      buyBtn.setAttribute("data-pcod-bound", "true");
      buyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openChoiceModal();
      });
    }

    // Also attach to theme native dynamic checkout button if present
    const nativeBuyBtn = document.querySelector(".shopify-payment-button__button, button[data-testid='Checkout-button']");
    if (nativeBuyBtn && !nativeBuyBtn.getAttribute("data-pcod-intercept")) {
      nativeBuyBtn.setAttribute("data-pcod-intercept", "true");
      nativeBuyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openChoiceModal();
      }, true);
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeChoiceModal);
    }

    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) closeChoiceModal();
      });
    }

    if (prepaidBtn) {
      prepaidBtn.addEventListener("click", handlePrepaidCheckout);
    }

    if (codBtn) {
      codBtn.addEventListener("click", handleCodCheckout);
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
    const shop = buyBtn ? buyBtn.getAttribute("data-shop") || window.location.hostname : window.location.hostname;

    activeProduct = { variantId, quantity, price, title, image, shop };
    return activeProduct;
  }

  function openChoiceModal() {
    const details = readProductDetails();
    const backdrop = $("pcod-choice-modal-backdrop");
    if (!backdrop) return;

    const total = details.price * details.quantity;
    const deposit = total > 100 ? 100 : total;
    const balance = Math.max(0, Math.round((total - deposit) * 100) / 100);

    // Update Modal DOM
    const imgElem = $("pcod-choice-img");
    const nameElem = $("pcod-choice-prod-name");
    const metaElem = $("pcod-choice-prod-meta");

    if (imgElem && details.image) imgElem.src = details.image;
    if (nameElem) nameElem.textContent = details.title;
    if (metaElem) metaElem.textContent = `Quantity: ${details.quantity} • Subtotal: ₹${total.toLocaleString("en-IN")}`;

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

    backdrop.style.display = "flex";
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

    // Direct redirect to Shopify native standard checkout with full price
    const { variantId, quantity } = activeProduct;
    if (variantId) {
      window.location.href = `/cart/${variantId}:${quantity}`;
    } else {
      window.location.href = "/checkout";
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
      const { shop, variantId, quantity, price, title } = activeProduct;
      const res = await fetch(`${BACKEND_URL}/api/partial-cod/draft-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          variantId,
          quantity,
          price,
          title,
          deposit: 100,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.invoiceUrl) {
        throw new Error(data.error || "Unable to open Partial COD checkout.");
      }

      // Direct redirect to Shopify native checkout configured for 100 INR deposit!
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
