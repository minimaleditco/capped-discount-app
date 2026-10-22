(function () {
  const BACKEND_URL = "https://capped-discount-app.onrender.com";
  let sessionData = null;
  let productData = null;
  let orderStatusUrl = null;

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState === "interactive" || document.readyState === "complete") {
    init();
  }

  function init() {
    const buyBtn = $("pcod-fast-buy-btn");
    const backdrop = $("pcod-modal-backdrop");
    const closeBtn = $("pcod-close-modal-btn");
    const submitBtn = $("pcod-submit-payment-btn");
    const simConfirmBtn = $("pcod-sim-confirm-btn");
    const simCancelBtn = $("pcod-sim-cancel-btn");
    const receiptDoneBtn = $("pcod-view-receipt-btn");

    const gpayBtn = $("pcod-upi-gpay-btn");
    const phonepeBtn = $("pcod-upi-phonepe-btn");
    const paytmBtn = $("pcod-upi-paytm-btn");
    const qrBtn = $("pcod-upi-qr-btn");

    if (!buyBtn || !backdrop) return;

    buyBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openCheckout();
    });

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });

    if (submitBtn) submitBtn.addEventListener("click", handlePaymentSubmit);
    if (simConfirmBtn) simConfirmBtn.addEventListener("click", () => handleUpiPay("Razorpay UPI"));
    if (gpayBtn) gpayBtn.addEventListener("click", () => handleUpiPay("Google Pay"));
    if (phonepeBtn) phonepeBtn.addEventListener("click", () => handleUpiPay("PhonePe"));
    if (paytmBtn) paytmBtn.addEventListener("click", () => handleUpiPay("Paytm"));
    if (qrBtn) qrBtn.addEventListener("click", () => handleUpiPay("UPI QR Code"));

    if (simCancelBtn) simCancelBtn.addEventListener("click", function () {
      resetSimulatorBtn();
      switchView("checkout");
    });

    if (receiptDoneBtn) receiptDoneBtn.addEventListener("click", function () {
      if (orderStatusUrl) {
        window.location.href = orderStatusUrl;
      } else {
        closeModal();
        window.location.reload();
      }
    });
  }

  function openCheckout() {
    const buyBtn = $("pcod-fast-buy-btn");
    const backdrop = $("pcod-modal-backdrop");
    if (!buyBtn || !backdrop) return;

    let variantId = buyBtn.getAttribute("data-variant-id");
    const variantInput = document.querySelector(
      'form[action*="/cart/add"] [name="id"], form[action*="/cart/add"] select[name="id"]'
    );
    if (variantInput && variantInput.value && !isNaN(Number(variantInput.value))) {
      variantId = variantInput.value;
    }

    productData = {
      productId: buyBtn.getAttribute("data-product-id"),
      variantId: variantId,
      title: buyBtn.getAttribute("data-product-title") || "Product",
      price: parseFloat(buyBtn.getAttribute("data-product-price") || "0"),
      image: buyBtn.getAttribute("data-product-image"),
      shop: buyBtn.getAttribute("data-shop"),
    };

    backdrop.style.display = "flex";
    switchView("loading");
    showError();

    fetch(`${BACKEND_URL}/api/partial-cod/fast-checkout/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop: productData.shop,
        items: [
          {
            variantId: productData.variantId,
            title: productData.title,
            price: productData.price,
            quantity: 1,
            imageUrl: productData.image,
          },
        ],
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) {
          showError(res.error || "Failed to load checkout rules.");
          switchView("checkout");
          return;
        }
        sessionData = res;
        renderSummary(res);
        switchView("checkout");

        if (typeof window.fbq === "function") {
          window.fbq("track", "InitiateCheckout", {
            value: res.total,
            currency: "INR",
            content_name: productData.title,
          });
        }
      })
      .catch(() => {
        showError("Unable to connect to checkout service. Please check connection.");
        switchView("checkout");
      });
  }

  function renderSummary(data) {
    const img = $("pcod-product-img");
    const name = $("pcod-product-name");
    const pr = $("pcod-product-price");
    const tot = $("pcod-summary-total");
    const dep = $("pcod-summary-deposit");
    const bal = $("pcod-summary-balance");
    const btnText = $("pcod-submit-btn-text");
    const simAmount = $("pcod-sim-amount");

    if (img && productData.image) img.src = productData.image;
    if (name) name.textContent = productData.title;
    if (pr) pr.textContent = `₹${productData.price.toLocaleString("en-IN")}`;
    if (tot) tot.textContent = `₹${data.total.toLocaleString("en-IN")}`;
    if (dep) dep.textContent = `₹${data.deposit.toLocaleString("en-IN")}`;
    if (bal) bal.textContent = `₹${data.balance.toLocaleString("en-IN")}`;
    if (btnText) btnText.textContent = `Pay ₹${data.deposit.toLocaleString("en-IN")} Advance Deposit via UPI →`;
    if (simAmount) simAmount.textContent = `₹${data.deposit.toFixed(2)}`;
  }

  function handlePaymentSubmit() {
    showError();
    const phone = $("pcod-input-phone")?.value.trim() || "";
    const name = $("pcod-input-name")?.value.trim() || "";
    const address = $("pcod-input-address")?.value.trim() || "";
    const city = $("pcod-input-city")?.value.trim() || "";
    const zip = $("pcod-input-zip")?.value.trim() || "";

    if (!phone || phone.length < 10) {
      return showError("Please enter a valid 10-digit mobile number.");
    }
    if (!name || name.length < 2) {
      return showError("Please enter your full name.");
    }
    if (!address || address.length < 5) {
      return showError("Please enter your complete street address.");
    }
    if (!city) {
      return showError("Please enter your city.");
    }
    if (!zip || zip.length < 6) {
      return showError("Please enter a valid 6-digit PIN code.");
    }

    const gateway = sessionData?.gateway || "simulator";
    if (gateway === "razorpay" && sessionData?.keyId) {
      openRazorpayGateway();
    } else {
      resetSimulatorBtn();
      switchView("simulator");
    }
  }

  function resetSimulatorBtn() {
    const simBtn = $("pcod-sim-confirm-btn");
    if (simBtn) {
      simBtn.disabled = false;
      simBtn.textContent = `⚡ Pay ₹${sessionData ? sessionData.deposit : 100} Advance Deposit via UPI`;
    }
  }

  function handleUpiPay(methodName) {
    const simBtn = $("pcod-sim-confirm-btn");
    if (simBtn) {
      simBtn.disabled = true;
      simBtn.textContent = `Authorizing ₹${sessionData ? sessionData.deposit : 100} on ${methodName}...`;
    }

    setTimeout(() => {
      if (simBtn) {
        simBtn.textContent = `✓ Payment Approved via ${methodName}! Creating order...`;
      }
      finalizePayment({
        gateway: "simulator",
        paymentId: `pay_${methodName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}`,
        orderId: sessionData.gatewayOrderId,
        signature: "upi_verified",
      });
    }, 700);
  }

  function openRazorpayGateway() {
    if (typeof window.Razorpay === "undefined") {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => launchRazorpay();
      document.head.appendChild(script);
    } else {
      launchRazorpay();
    }
  }

  function launchRazorpay() {
    const phone = $("pcod-input-phone")?.value.trim() || "";
    const name = $("pcod-input-name")?.value.trim() || "";

    const options = {
      key: sessionData.keyId,
      amount: Math.round(sessionData.deposit * 100),
      currency: "INR",
      name: productData.shop,
      description: `Advance Deposit for ${productData.title}`,
      order_id: sessionData.gatewayOrderId,
      prefill: {
        name: name,
        contact: phone,
      },
      handler: function (response) {
        finalizePayment({
          gateway: "razorpay",
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      theme: {
        color: "#0C2340",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  function finalizePayment(paymentInfo) {
    switchView("loading");
    showError();

    const phone = $("pcod-input-phone")?.value.trim() || "";
    const name = $("pcod-input-name")?.value.trim() || "";
    const address = $("pcod-input-address")?.value.trim() || "";
    const city = $("pcod-input-city")?.value.trim() || "";
    const zip = $("pcod-input-zip")?.value.trim() || "";

    const nameParts = name.split(" ").filter(Boolean);
    const firstName = nameParts[0] || name || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "Shopper";
    const cleanPhone = phone.replace(/[^0-9]/g, "");

    const payload = {
      shop: productData.shop,
      paymentDetails: paymentInfo,
      orderDetails: {
        items: [
          {
            variantId: productData.variantId,
            title: productData.title,
            price: String(productData.price),
            quantity: 1,
          },
        ],
        customer: {
          firstName: firstName,
          lastName: lastName,
          phone: `+91${cleanPhone}`,
          email: `${cleanPhone}@customer.shopify`,
        },
        shippingAddress: {
          firstName: firstName,
          lastName: lastName,
          address1: address,
          city: city,
          province: "Delhi",
          zip: zip,
          phone: `+91${cleanPhone}`,
        },
        total: sessionData.total,
        deposit: sessionData.deposit,
        balance: sessionData.balance,
        currency: "INR",
      },
    };

    fetch(`${BACKEND_URL}/api/partial-cod/fast-checkout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        let res;
        try {
          res = await r.json();
        } catch (parseErr) {
          throw new Error(`Server response error (${r.status})`);
        }
        if (!r.ok || !res.success) {
          throw new Error(res.error || `Failed to create order (${r.status})`);
        }
        return res;
      })
      .then((res) => {
        const orderNameElem = $("pcod-success-order-name");
        const receiptDepositElem = $("pcod-receipt-deposit");
        const receiptBalanceElem = $("pcod-receipt-balance");

        if (orderNameElem) orderNameElem.textContent = res.orderName || "Order Confirmed";
        if (receiptDepositElem) receiptDepositElem.textContent = `₹${res.depositAmount.toLocaleString("en-IN")}`;
        if (receiptBalanceElem) receiptBalanceElem.textContent = `₹${res.remainingBalance.toLocaleString("en-IN")}`;

        if (typeof window.fbq === "function") {
          window.fbq("track", "Purchase", {
            value: sessionData.total,
            currency: "INR",
            content_name: productData.title,
          });
        }
        if (typeof window.gtag === "function") {
          window.gtag("event", "purchase", {
            transaction_id: res.orderName,
            value: sessionData.total,
            currency: "INR",
          });
        }

        orderStatusUrl = res.statusPageUrl;

        // If Shopify's official Thank You / Order Status URL is returned, redirect directly!
        if (res.statusPageUrl) {
          window.location.href = res.statusPageUrl;
          return;
        }

        switchView("success");
      })
      .catch((errObj) => {
        console.error("[Partial COD Fast Checkout Error]:", errObj);
        resetSimulatorBtn();
        const msg = errObj && errObj.message === "Load failed"
          ? "Network connection interrupted. Please try again."
          : (errObj?.message || "Failed to confirm order. Please try again.");
        showError(msg);
        switchView("checkout");
      });
  }

  function switchView(name) {
    const loadingView = $("pcod-loading-view");
    const checkoutView = $("pcod-checkout-view");
    const simulatorView = $("pcod-simulator-view");
    const successView = $("pcod-success-view");

    if (loadingView) loadingView.style.display = name === "loading" ? "block" : "none";
    if (checkoutView) checkoutView.style.display = name === "checkout" ? "block" : "none";
    if (simulatorView) simulatorView.style.display = name === "simulator" ? "block" : "none";
    if (successView) successView.style.display = name === "success" ? "block" : "none";
  }

  function showError(msg) {
    const banner = $("pcod-error-banner");
    if (!banner) return;
    if (!msg) {
      banner.textContent = "";
      banner.style.display = "none";
    } else {
      banner.textContent = msg;
      banner.style.display = "block";
    }
  }

  function closeModal() {
    const backdrop = $("pcod-modal-backdrop");
    if (backdrop) backdrop.style.display = "none";
    resetSimulatorBtn();
    showError();
  }
})();
