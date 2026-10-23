(function () {
  const BACKEND_URL = "https://capped-discount-app.onrender.com";

  function init() {
    const buyBtn = document.getElementById("pcod-fast-buy-btn");
    if (!buyBtn || buyBtn.getAttribute("data-pcod-bound")) return;
    buyBtn.setAttribute("data-pcod-bound", "true");

    buyBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      if (buyBtn.disabled) return;

      const originalHtml = buyBtn.innerHTML;
      buyBtn.disabled = true;
      buyBtn.style.opacity = "0.85";
      buyBtn.style.cursor = "wait";

      const titleSpan = buyBtn.querySelector(".pcod-btn-title");
      if (titleSpan) {
        titleSpan.textContent = "Opening Shopify Checkout...";
      }

      try {
        let variantId = buyBtn.getAttribute("data-variant-id");
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

        const price = parseFloat(buyBtn.getAttribute("data-product-price") || "0");
        const title = buyBtn.getAttribute("data-product-title") || "Product";
        const shop = buyBtn.getAttribute("data-shop") || window.location.hostname;

        if (typeof window.fbq === "function") {
          window.fbq("track", "InitiateCheckout", {
            content_name: title,
            currency: "INR",
            value: price * quantity,
          });
        }
        if (typeof window.gtag === "function") {
          window.gtag("event", "begin_checkout", {
            items: [{ item_name: title, price: price, quantity: quantity }],
            currency: "INR",
            value: price * quantity,
          });
        }

        const res = await fetch(`${BACKEND_URL}/api/partial-cod/draft-checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shop,
            variantId: variantId,
            quantity: quantity,
            price: price,
            title: title,
            deposit: 100,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.invoiceUrl) {
          throw new Error(data.error || "Unable to generate Shopify checkout. Please try again.");
        }

        // Redirect directly to Shopify Native Checkout!
        window.location.href = data.invoiceUrl;
      } catch (err) {
        console.error("[Partial COD Checkout Error]:", err);
        alert(err.message || "Failed to launch Shopify checkout. Please try again.");
        buyBtn.disabled = false;
        buyBtn.style.opacity = "1";
        buyBtn.style.cursor = "pointer";
        buyBtn.innerHTML = originalHtml;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
