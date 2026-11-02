"use strict";(function(){const P="https://capped-discount-app.onrender.com";let F="product",M={variantId:"",quantity:1,price:0,title:"",image:"",shop:""},_=null;function i(o){return document.getElementById(o)}function $(){var o,e;return window.Shopify&&window.Shopify.shop||((o=document.querySelector('meta[name="shopify-digital-wallet-domain"]'))==null?void 0:o.getAttribute("content"))||((e=document.getElementById("pcod-fast-buy-btn"))==null?void 0:e.getAttribute("data-shop"))||""}function q(){let o=i("pcod-choice-modal-backdrop");if(o)return o;const e=`
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
            <span class="pcod-deal-icon">\u2728</span>
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

          <!-- Delivery pincode (only shown when a pincode deposit rule exists) -->
          <div class="pcod-pincode-block" id="pcod-pincode-block" style="display: none;">
            <label class="pcod-pincode-label" for="pcod-pincode-input">Delivery pincode</label>
            <input
              type="text"
              id="pcod-pincode-input"
              class="pcod-pincode-input"
              inputmode="numeric"
              autocomplete="postal-code"
              maxlength="10"
              placeholder="e.g. 400053"
            />
            <div class="pcod-pincode-help">Used to calculate your cash-on-delivery deposit.</div>
            <div class="pcod-pincode-error" id="pcod-pincode-error" style="display: none;"></div>
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
                <span class="pcod-prepaid-tag" id="pcod-prepaid-tag">\u26A1 Extra 5% OFF on Prepaid</span>
                <div class="pcod-price-stack">
                  <span class="pcod-card-price" id="pcod-prepaid-price">\u20B90</span>
                  <span class="pcod-original-price" id="pcod-prepaid-orig-price" style="display: none;">\u20B90</span>
                  <span class="pcod-save-badge" id="pcod-prepaid-save-badge" style="display: none;">Save \u20B90</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 1: Full Prepaid</div>
                <div class="pcod-card-desc" id="pcod-prepaid-desc">Pay 100% online now via UPI, Cards, or Netbanking. Extra prepaid savings applied automatically.</div>
              </div>
              <button type="button" class="pcod-select-btn pcod-btn-prepaid" id="pcod-btn-choose-prepaid">
                <span class="pcod-btn-text" id="pcod-prepaid-btn-label">Pay Full \u20B90 Online \u2192</span>
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
                <span class="pcod-save-badge" id="pcod-cod-tag" style="display: none;">Save \u20B90</span>
                <div class="pcod-price-stack">
                  <div class="pcod-card-price-split">
                    <span class="pcod-price-now" id="pcod-cod-now">\u20B90 Now</span>
                    <span class="pcod-price-doorstep" id="pcod-cod-doorstep">+ \u20B90 COD</span>
                  </div>
                  <span class="pcod-original-price" id="pcod-cod-orig-price" style="display: none;">Total \u20B90</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 2: Partial Cash on Delivery</div>
                <div class="pcod-card-desc">Pay only <strong id="pcod-cod-desc-deposit">\u20B90</strong> advance deposit online to confirm shipping. Pay the remaining <strong id="pcod-cod-desc-balance">\u20B90</strong> in cash at your doorstep.<span id="pcod-cod-desc-saving" style="display: none; color: #059669; font-weight: 600;"></span></div>
              </div>
              <button type="button" class="pcod-select-btn pcod-btn-cod" id="pcod-btn-choose-cod">
                <span class="pcod-btn-text" id="pcod-cod-btn-label">Pay Deposit & Confirm COD \u2192</span>
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
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-send-btn">Send SMS Code \u2192</button>
            </div>

            <!-- Code Input Step (shadcn InputOTP 6-Box Grid) -->
            <div class="pcod-otp-code-group" id="pcod-otp-code-group" style="display: none;">
              <div class="pcod-otp-sent-text" id="pcod-otp-sent-text">\u2705 6-digit code sent to your mobile SMS inbox!</div>
              <div class="pcod-otp-slots-row" id="pcod-otp-slots-row">
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="0" autocomplete="one-time-code" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="1" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="2" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="3" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="4" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="5" />
              </div>
              <input type="hidden" id="pcod-otp-code-input" value="" />
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-verify-btn">Verify SMS & Place Order \u2192</button>
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
            <span>Encrypted 256-Bit SSL \u2022 Official Shopify Checkout</span>
          </div>
        </div>
      </div>
    </div>`;return document.body.insertAdjacentHTML("beforeend",e),G(),i("pcod-choice-modal-backdrop")}function G(){const o=i("pcod-choice-modal-backdrop"),e=i("pcod-choice-close-btn"),t=i("pcod-btn-choose-prepaid"),n=i("pcod-btn-choose-cod");e&&!e.getAttribute("data-pcod-bound")&&(e.setAttribute("data-pcod-bound","true"),e.addEventListener("click",Q)),o&&!o.getAttribute("data-pcod-bound")&&(o.setAttribute("data-pcod-bound","true"),o.addEventListener("click",function(r){r.target===o&&Q()})),t&&!t.getAttribute("data-pcod-bound")&&(t.setAttribute("data-pcod-bound","true"),t.addEventListener("click",pt)),n&&!n.getAttribute("data-pcod-bound")&&(n.setAttribute("data-pcod-bound","true"),n.addEventListener("click",ft));const s=i("pcod-coupon-apply-btn"),a=i("pcod-coupon-input");s&&!s.getAttribute("data-pcod-bound")&&(s.setAttribute("data-pcod-bound","true"),s.addEventListener("click",function(){const r=a?a.value.trim():"";r&&j(r)})),a&&!a.getAttribute("data-pcod-bound")&&(a.setAttribute("data-pcod-bound","true"),a.addEventListener("keydown",function(r){if(r.key==="Enter"){r.preventDefault();const v=a.value.trim();v&&j(v)}}));const d=i("pcod-otp-back-btn"),c=i("pcod-otp-send-btn"),p=i("pcod-otp-verify-btn"),h=i("pcod-otp-resend-btn"),y=i("pcod-otp-slots-row");if(y&&!y.getAttribute("data-pcod-bound")){let C=function(){let b="";r.forEach(function(f){b+=f.value||"",f.value?f.classList.add("filled"):f.classList.remove("filled")}),v&&(v.value=b)};var g=C;y.setAttribute("data-pcod-bound","true");const r=y.querySelectorAll(".pcod-otp-slot"),v=i("pcod-otp-code-input");r.forEach(function(b,f){b.addEventListener("input",function(){const m=this.value.replace(/[^0-9]/g,"");this.value=m?m[m.length-1]:"",C(),this.value&&f<r.length-1&&r[f+1].focus()}),b.addEventListener("keydown",function(m){m.key==="Backspace"&&!this.value&&f>0?(r[f-1].focus(),r[f-1].value="",C()):m.key==="ArrowLeft"&&f>0?r[f-1].focus():m.key==="ArrowRight"&&f<r.length-1&&r[f+1].focus()}),b.addEventListener("paste",function(m){m.preventDefault();const S=(m.clipboardData||window.clipboardData).getData("text").replace(/[^0-9]/g,"");if(S){r.forEach(function(w,O){w.value=S[O]||""}),C();const A=Math.min(S.length,r.length-1);r[A].focus()}})})}d&&!d.getAttribute("data-pcod-bound")&&(d.setAttribute("data-pcod-bound","true"),d.addEventListener("click",X)),c&&!c.getAttribute("data-pcod-bound")&&(c.setAttribute("data-pcod-bound","true"),c.addEventListener("click",et)),p&&!p.getAttribute("data-pcod-bound")&&(p.setAttribute("data-pcod-bound","true"),p.addEventListener("click",ut)),h&&!h.getAttribute("data-pcod-bound")&&(h.setAttribute("data-pcod-bound","true"),h.addEventListener("click",function(){const r=i("pcod-otp-phone-group"),v=i("pcod-otp-code-group");r&&(r.style.display="block"),v&&(v.style.display="none"),et()}))}function J(){lt(),q(),G();const o=i("pcod-fast-buy-btn");o&&!o.getAttribute("data-pcod-bound")&&(o.setAttribute("data-pcod-bound","true"),o.addEventListener("click",function(e){e.preventDefault(),z()})),document.addEventListener("click",ct,!0)}function ct(o){const e=o.target;if(!e||e.closest("#pcod-choice-modal")||e.closest("#pcod-fast-buy-btn"))return;if(e.closest('button[name="checkout"], input[name="checkout"], #checkout, button#CartDrawer-Checkout, a[href="/checkout"], a[href*="/checkout"], .cart__checkout-button, [data-cart-checkout], button.cart__checkout, .cart-drawer__checkout')){o.preventDefault(),o.stopPropagation(),dt();return}if(e.closest(".shopify-payment-button__button, button[data-testid='Checkout-button']")){o.preventDefault(),o.stopPropagation(),z();return}}async function at(){var h,y,g,r,v,C,b;const o=i("pcod-fast-buy-btn");let e=o&&o.getAttribute("data-variant-id")||"",t=parseFloat(o&&o.getAttribute("data-product-price")||"0"),n=o&&o.getAttribute("data-product-title")||"",s=o&&o.getAttribute("data-product-image")||"",a=1;const d=document.querySelector('form[action*="/cart/add"] [name="id"], form[action*="/cart/add"] select[name="id"], select.product-form__variants, [name="id"]');d&&d.value&&!isNaN(Number(d.value))&&(e=d.value);const c=document.querySelector('form[action*="/cart/add"] [name="quantity"], input[name="quantity"]');if(c&&c.value&&!isNaN(Number(c.value))&&Number(c.value)>0&&(a=parseInt(c.value,10)),!t||t<=0||!n||n==="Product")try{const f=window.location.pathname.replace(/\/$/,"");if(f.includes("/products/")){const m=await fetch(f+".js");if(m.ok){const S=await m.json();if(S){n=S.title||n,s=S.featured_image||s;const A=e||S.variants&&((h=S.variants[0])==null?void 0:h.id),w=((y=S.variants)==null?void 0:y.find(O=>String(O.id)===String(A)))||((g=S.variants)==null?void 0:g[0]);w&&(e=String(w.id),t=w.price/100,w.featured_image&&w.featured_image.src&&(s=w.featured_image.src))}}}}catch(f){console.warn("[PCOD] Could not fetch product .js:",f)}if((!t||t<=0)&&((v=(r=window.ShopifyAnalytics)==null?void 0:r.meta)!=null&&v.product))try{const f=window.ShopifyAnalytics.meta.product;n=f.title||n;const m=e||window.ShopifyAnalytics.meta.selectedVariantId,S=((C=f.variants)==null?void 0:C.find(A=>String(A.id)===String(m)))||((b=f.variants)==null?void 0:b[0]);S&&(e=String(S.id),t=S.price/100)}catch(f){}if(!t||t<=0){const f=document.querySelector(".price__regular .price-item--regular, .price-item--sale, .price-item, .product__price, [data-product-price], .price");if(f){const m=f.textContent.replace(/[^0-9.]/g,"");m&&!isNaN(parseFloat(m))&&(t=parseFloat(m))}}if(!n||n==="Product"){const f=document.querySelector(".product__title h1, .product-title, h1.product__title, h1");f&&f.textContent.trim()?n=f.textContent.trim():n="Product"}if(!s){const f=document.querySelector(".product__media img, .product-featured-media img, .product-single__photo img, img.image-magnify-lightbox");f&&f.src&&(s=f.src)}const p=$();return M={variantId:e,quantity:a,price:t,title:n,image:s,shop:p},M}function B(o){const e=u.depositSettings||{type:"percentage",value:10};let t=e.type==="percentage"?Math.round(o*(Number(e.value)||10)/100):Number(e.value)||100;return t=Math.max(1,Math.min(o,t)),t}async function z(){F="product",q();const o=i("pcod-choice-modal-backdrop");if(!o)return;const e=await at(),t=e.price*e.quantity,n=B(t),s=Math.max(0,Math.round((t-n)*100)/100);K({title:e.title,image:e.image,meta:`Quantity: ${e.quantity} \u2022 Subtotal: \u20B9${t.toLocaleString("en-IN")}`,total:t,deposit:n,balance:s}),o.style.display="flex"}async function dt(){F="cart",q();const o=i("pcod-choice-modal-backdrop");if(o)try{const t=await(await fetch("/cart.js")).json();if(!t||!t.items||t.items.length===0){window.location.href="/cart";return}_=t;const n=(t.total_discount||0)/100;let s=t.total_price/100;if(t.original_total_price&&t.original_total_price>t.total_price&&(s=t.original_total_price/100),k=s,n>0){let y="Store Auto Discount";if(t.cart_level_discount_applications&&t.cart_level_discount_applications.length>0)y=t.cart_level_discount_applications[0].title||y;else if(t.items){for(const g of t.items)if(g.discounts&&g.discounts.length>0){y=g.discounts[0].title||y;break}}u.autoDiscount={code:"AUTO",title:y,discountAmount:n,discountSummary:`${y} (Store Auto Offer)`,isAuto:!0},(!l||l.isAuto)&&(l=u.autoDiscount)}else u.autoDiscount=null,l&&l.isAuto&&(l=null);const a=s,d=B(a),c=Math.max(0,Math.round((a-d)*100)/100),p=t.items[0],h=t.items.length===1?p.title:`${p.title} + ${t.items.length-1} other item${t.items.length>2?"s":""}`;K({title:h,image:p.image||"",meta:`${t.item_count} item${t.item_count>1?"s":""} in cart \u2022 Total: \u20B9${a.toLocaleString("en-IN")}`,total:a,deposit:d,balance:c}),o.style.display="flex"}catch(e){console.warn("[Cart Modal Fetch Error]:",e),window.location.href="/checkout"}}let k=0,l=null,u={depositSettings:{type:"percentage",value:10},autoDiscount:null,coupons:[],requiresPincode:!1,prepaidOffer:{enabled:!0,type:"percentage",value:5,badgeText:"\u26A1 Extra 5% OFF on Prepaid"}};function Y(o){if(!u.coupons||u.coupons.length===0)return;const e=u.autoDiscount&&Number(u.autoDiscount.discountAmount)||0;let t=null,n=e;for(const s of u.coupons){const a=s.minSubtotal?Number(s.minSubtotal):0;if(a>0&&o<a)continue;let d=0;s.type==="percentage"?(d=Math.round(o*s.value/100*100)/100,s.maxCap&&d>s.maxCap&&(d=s.maxCap)):d=Number(s.value)||0,d=Math.min(d,o),d>n&&(n=d,t={code:s.code,title:s.title||`${s.code}`,discountAmount:d,discountSummary:`${s.title||s.code} (Best Deal Applied)`,isAuto:!1})}if(t&&t.discountAmount>0){l=t;const s=i("pcod-coupon-input");s&&(s.value=t.code);const a=i("pcod-coupon-applied-msg");if(a){a.style.display="flex",a.style.background="#DCFCE7",a.style.borderColor="#86EFAC",a.style.color="#166534",a.innerHTML=`
          <span>\u{1F389} Best Deal <strong>${t.code}</strong> auto-applied! Saved \u20B9${t.discountAmount.toLocaleString("en-IN")}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;const d=i("pcod-coupon-remove-btn");d&&d.addEventListener("click",I)}}}async function st(o){try{const e=$();if(!e){console.warn("[Store Offers] Shopify shop domain unavailable; skipping offer lookup."),D(),x();return}const t=await fetch(`${P}/api/partial-cod/coupons?shop=${encodeURIComponent(e)}&subtotal=${o}`);if(t.ok){const n=await t.json();n.depositSettings&&(u.depositSettings=n.depositSettings),u.coupons=Array.isArray(n.coupons)?n.coupons:[],n.prepaidOffer&&(u.prepaidOffer=n.prepaidOffer),u.autoDiscount=n.autoDiscount||null,u.requiresPincode=Boolean(n.requiresPincode),rt(),l||Y(o),D(),x()}}catch(e){console.warn("[Store Offers Fetch Fallback]:",e),D(),x()}}function Z(){if(!u.autoDiscount||u.autoDiscount.discountAmount<=0)return;l=u.autoDiscount;const o=i("pcod-coupon-input");o&&(o.value="");const e=i("pcod-coupon-applied-msg");e&&(e.style.display="flex",e.style.background="#FEF3C7",e.style.borderColor="#FCD34D",e.style.color="#92400E",e.innerHTML=`
        <span>\u26A1 Store Auto Discount <strong>${u.autoDiscount.title}</strong> is locked in! Saved \u20B9${u.autoDiscount.discountAmount.toLocaleString("en-IN")}</span>
      `),D(),x()}function D(){const o=i("pcod-available-coupons-wrap"),e=i("pcod-coupon-chips"),t=i("pcod-available-coupons-title");if(!e)return;const n=u.autoDiscount&&u.autoDiscount.discountAmount>0,s=u.coupons&&u.coupons.length>0;if(!n&&!s){o&&(o.style.display="none");return}o&&(o.style.display="block"),t&&s&&(t.textContent=`Available Coupons (${u.coupons.length} Offers)`);let a="";if(u.autoDiscount){const c=l&&l.isAuto;a+=`
        <div class="pcod-discount-card pcod-auto-card ${c?"applied":""}" data-is-auto="true">
          <div class="pcod-discount-card-left">
            <div class="pcod-discount-badge-icon pcod-auto-badge">
              <span style="font-size: 16px; color: #FFFFFF;">\u26A1</span>
            </div>
            <div class="pcod-discount-info">
              <div class="pcod-discount-title">${u.autoDiscount.title}</div>
              <div class="pcod-discount-subtitle">\u26A1 Store Auto Discount (Applied by Default)</div>
              <div class="pcod-discount-tag-row">
                <span class="pcod-discount-code-box">AUTO APPLIED</span>
                <span class="pcod-discount-unlock-tag" style="background: #FEF3C7; color: #92400E;">Default Savings</span>
              </div>
            </div>
          </div>
          <div class="pcod-discount-card-right">
            <div class="pcod-discount-applied-pill">\u2713 Applied</div>
          </div>
        </div>
      `}a+=(u.coupons||[]).map(function(c){const p=l&&!l.isAuto&&l.code.toUpperCase()===c.code.toUpperCase(),h=c.minSubtotal?Number(c.minSubtotal):0,y=h>0&&k<h,g=y?Math.ceil(h-k):0;let r=0;c.type==="percentage"?(r=Math.round(k*c.value/100*100)/100,c.maxCap&&r>c.maxCap&&(r=c.maxCap)):r=Number(c.value)||0,r=Math.min(r,k);let v=c.title;v||(v=c.type==="percentage"?`${c.value}% OFF${c.maxCap?` (Max \u20B9${c.maxCap})`:""}`:`Flat \u20B9${c.value} OFF${h>0?` above \u20B9${h}`:""}`);let C="";p?C=`<span class="pcod-discount-unlock-tag" style="background: #ECFDF5; color: #065F46; font-weight: 700;">\u2713 Active \u2022 Saved \u20B9${r.toLocaleString("en-IN")}</span>`:y?C=`<span class="pcod-discount-unlock-tag" style="background: #FEE2E2; color: #991B1B; font-weight: 600;">\u{1F512} Not Applicable: Add \u20B9${g.toLocaleString("en-IN")} more</span>`:C=`<span class="pcod-discount-unlock-tag" style="background: #EFF6FF; color: #1E40AF; font-weight: 600;">\u2728 Saves \u20B9${r.toLocaleString("en-IN")} with this code</span>`;let b="";return p?b=`
            <div class="pcod-discount-applied-pill">\u2713 Applied</div>
            <button type="button" class="pcod-discount-remove-link" data-remove-code="${c.code}">Remove</button>
          `:y?b=`
            <button type="button" class="pcod-discount-apply-action disabled" disabled style="opacity: 0.6; cursor: not-allowed;">NOT APPLICABLE</button>
          `:b=`
            <button type="button" class="pcod-discount-apply-action" data-apply-code="${c.code}">APPLY</button>
            <svg class="pcod-chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="#94A3B8" stroke-width="2" fill="none">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          `,`
          <div class="pcod-discount-card ${p?"applied":""} ${y?"locked":""}" data-coupon-code="${c.code}" data-min-sub="${h}">
            <div class="pcod-discount-card-left">
              <div class="pcod-discount-badge-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="5" x2="5" y2="19"></line>
                  <circle cx="6.5" cy="6.5" r="2.5"></circle>
                  <circle cx="17.5" cy="17.5" r="2.5"></circle>
                </svg>
              </div>
              <div class="pcod-discount-info">
                <div class="pcod-discount-title">${v}</div>
                <div class="pcod-discount-subtitle">Use code <strong>${c.code}</strong></div>
                <div class="pcod-discount-tag-row">
                  <span class="pcod-discount-code-box">${c.code}</span>
                  ${C}
                </div>
              </div>
            </div>
            <div class="pcod-discount-card-right">
              ${b}
            </div>
          </div>
        `}).join(""),e.innerHTML=a;const d=e.querySelector(".pcod-auto-card");d&&d.addEventListener("click",function(){Z()}),e.querySelectorAll(".pcod-discount-card:not(.pcod-auto-card)").forEach(function(c){c.addEventListener("click",function(p){if(p.target.closest(".pcod-discount-remove-link")){p.stopPropagation(),I();return}const h=this.getAttribute("data-coupon-code"),y=Number(this.getAttribute("data-min-sub")||0);if(y>0&&k<y){const r=Math.ceil(y-k),v=i("pcod-coupon-applied-msg");v&&(v.style.display="flex",v.style.background="#FEF2F2",v.style.borderColor="#FCA5A5",v.style.color="#DC2626",v.innerHTML=`<span>\u26A0\uFE0F Coupon <strong>${h}</strong> is not applicable for this order: Minimum order of \u20B9${y} required (Add \u20B9${r} more).</span>`);return}const g=i("pcod-coupon-input");g&&(g.value=h),j(h)})})}async function j(o){const e=i("pcod-coupon-input"),t=i("pcod-coupon-apply-btn"),n=i("pcod-coupon-applied-msg"),s=String(o||(e?e.value:"")).trim().toUpperCase();if(!s)return;t&&(t.disabled=!0,t.textContent="Applying...");const a=(u.coupons||[]).find(d=>d.code.toUpperCase()===s);if(a){const d=a.minSubtotal?Number(a.minSubtotal):0;if(d>0&&k<d){const p=Math.ceil(d-k);n&&(n.style.display="flex",n.style.background="#FEF2F2",n.style.borderColor="#FCA5A5",n.style.color="#DC2626",n.innerHTML=`<span>\u26A0\uFE0F Coupon <strong>${a.code}</strong> is not applicable for this order: Minimum order of \u20B9${d} required (Add \u20B9${p} more).</span>`),t&&(t.disabled=!1,t.textContent="Apply");return}let c=0;if(a.type==="percentage"?(c=Math.round(k*a.value/100*100)/100,a.maxCap&&c>a.maxCap&&(c=a.maxCap)):c=Number(a.value)||0,c=Math.min(c,k),l={code:a.code,title:a.title||`${a.code}`,discountAmount:c,discountSummary:`${a.title||a.code} (Applied)`,isAuto:!1},e&&(e.value=a.code),n){n.style.display="flex",n.style.background="#DCFCE7",n.style.borderColor="#86EFAC",n.style.color="#166534",n.innerHTML=`
          <span>\u{1F389} Code <strong>${a.code}</strong> applied! Saved \u20B9${c.toLocaleString("en-IN")}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;const p=i("pcod-coupon-remove-btn");p&&p.addEventListener("click",I)}D(),x()}try{const d=$(),c=await fetch(`${P}/api/partial-cod/coupons`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:d,code:s,subtotal:k})}),p=await c.json();if(!c.ok||!p.valid){if(!a)throw new Error(p.error||`Coupon '${s}' is not valid for this order.`)}else{if(l=p,p.depositSettings&&(u.depositSettings=p.depositSettings),p.coupons&&Array.isArray(p.coupons)&&p.coupons.length>0&&(u.coupons=p.coupons),e&&(e.value=p.code),n){n.style.display="flex",n.style.background="#DCFCE7",n.style.borderColor="#86EFAC",n.style.color="#166534",n.innerHTML=`
            <span>\u{1F389} Code <strong>${p.code}</strong> applied! Saved \u20B9${p.discountAmount.toLocaleString("en-IN")}${u.autoDiscount?" (Replaces Auto Discount)":""}</span>
            <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">${u.autoDiscount?"Revert to Auto Offer":"Remove"}</button>
          `;const h=i("pcod-coupon-remove-btn");h&&h.addEventListener("click",I)}D(),x()}}catch(d){a||(l=null,n&&(n.style.display="flex",n.style.background="#FEF2F2",n.style.borderColor="#FCA5A5",n.style.color="#DC2626",n.innerHTML=`<span>\u26A0\uFE0F ${d.message||"Failed to apply coupon."}</span>`),D(),x())}finally{t&&(t.disabled=!1,t.textContent="Apply")}}function I(){const o=i("pcod-coupon-input");if(o&&(o.value=""),u.autoDiscount){Z();return}l=null;const e=i("pcod-coupon-applied-msg");e&&(e.style.display="none",e.style.background="#DCFCE7",e.style.borderColor="#86EFAC",e.style.color="#166534",e.innerHTML=""),D(),x()}function x(){const o=l&&!l.isAuto&&Number(l.discountAmount)||0,e=u.autoDiscount&&Number(u.autoDiscount.discountAmount)||0,t=Math.max(o,e),n=Math.max(0,k-t);let s=0;const a=u.prepaidOffer;a&&a.enabled&&a.value>0&&(a.type==="percentage"?s=Math.round(n*a.value/100*100)/100:s=a.value,s=Math.min(s,n));const d=Math.max(0,Math.round((n-s)*100)/100),c=Math.round((k-d)*100)/100,p=i("pcod-auto-deal-banner"),h=i("pcod-auto-deal-text");if(p&&h)if(t>0){const yt=o>=e&&o>0?`Best Deal '${l.code}' Auto-Applied`:`Automatic Discount${u.autoDiscount&&u.autoDiscount.title?` '${u.autoDiscount.title}'`:""} Applied by Shopify`;h.innerHTML=`<strong>${yt}:</strong> You save <strong>\u20B9${t.toLocaleString("en-IN")}</strong> on this order!`,p.style.display="flex"}else p.style.display="none";const y=i("pcod-prepaid-price"),g=i("pcod-prepaid-orig-price"),r=i("pcod-prepaid-save-badge"),v=i("pcod-prepaid-tag"),C=i("pcod-prepaid-btn-label");y&&(y.textContent=`\u20B9${d.toLocaleString("en-IN")}`),c>0?(g&&(g.textContent=`\u20B9${k.toLocaleString("en-IN")}`,g.style.display="inline"),r&&(r.textContent=`Save \u20B9${c.toLocaleString("en-IN")}`,r.style.display="inline")):(g&&(g.style.display="none"),r&&(r.style.display="none")),v&&(a&&a.enabled?(v.textContent=a.badgeText||"\u26A1 Extra 5% OFF on Prepaid",v.style.display="inline-block"):v.style.display="none"),C&&(C.textContent=c>0?`Pay Full \u20B9${d.toLocaleString("en-IN")} Online (Save \u20B9${c.toLocaleString("en-IN")}) \u2192`:`Pay Full \u20B9${d.toLocaleString("en-IN")} Online \u2192`);const b=B(n),f=Math.max(0,Math.round((n-b)*100)/100),m=i("pcod-cod-now"),S=i("pcod-cod-doorstep"),A=i("pcod-cod-orig-price"),w=i("pcod-cod-tag"),O=i("pcod-cod-desc-deposit"),nt=i("pcod-cod-desc-balance"),L=i("pcod-cod-desc-saving"),it=i("pcod-cod-btn-label");m&&(m.textContent=`\u20B9${b.toLocaleString("en-IN")} Now`),S&&(S.textContent=`+ \u20B9${f.toLocaleString("en-IN")} on Delivery`),O&&(O.textContent=`\u20B9${b.toLocaleString("en-IN")}`),nt&&(nt.textContent=`\u20B9${f.toLocaleString("en-IN")}`),t>0?(A&&(A.textContent=`Total \u20B9${k.toLocaleString("en-IN")}`,A.style.display="inline"),w&&(w.textContent=`Save \u20B9${t.toLocaleString("en-IN")}`,w.style.display="inline"),L&&(L.textContent=` (Total order reduced from \u20B9${k.toLocaleString("en-IN")} to \u20B9${n.toLocaleString("en-IN")})`,L.style.display="inline")):(A&&(A.style.display="none"),w&&(w.style.display="none"),L&&(L.style.display="none")),it&&(it.textContent=`Pay \u20B9${b.toLocaleString("en-IN")} Deposit & Confirm COD \u2192`)}function K({title:o,image:e,meta:t,total:n,deposit:s,balance:a}){k=n,(!l||l.isAuto)&&Y(n);const d=i("pcod-choice-img"),c=i("pcod-choice-prod-name"),p=i("pcod-choice-prod-meta");d&&(e?(d.src=e,d.style.display="block"):d.style.display="none"),c&&(c.textContent=o),p&&(p.textContent=t),D(),x(),st(n);const h=i("pcod-btn-choose-prepaid"),y=i("pcod-btn-choose-cod");h&&(h.disabled=!1,h.style.opacity="1"),y&&(y.disabled=!1,y.style.opacity="1")}function Q(){const o=i("pcod-choice-modal-backdrop");o&&(o.style.display="none")}function pt(){const o=i("pcod-btn-choose-prepaid"),e=i("pcod-prepaid-btn-label");o&&(o.disabled=!0,o.style.opacity="0.8"),e&&(e.textContent="Opening Checkout...");let t=0;const n=u.prepaidOffer,s=l?l.discountAmount:0,a=Math.max(0,k-s);if(n&&n.enabled&&n.value>0&&(n.type==="percentage"?t=Math.round(a*n.value/100*100)/100:t=n.value,t=Math.min(t,a)),t>0){T("","",!0,t);return}let d="/checkout";if(F!=="cart"&&M&&M.variantId){const{variantId:c,quantity:p}=M;d=`/cart/${c}:${p}`}l&&!l.isAuto&&l.code&&(d+=(d.includes("?")?"&":"?")+`discount=${encodeURIComponent(l.code)}`),window.location.href=d}let R="",N="";function W(){const o=i("pcod-cards-container"),e=i("pcod-coupon-section"),t=i("pcod-otp-step");o&&(o.style.display="none"),e&&(e.style.display="none"),t&&(t.style.display="block");const n=i("pcod-otp-phone-input");n&&n.focus()}function X(){const o=i("pcod-cards-container"),e=i("pcod-coupon-section"),t=i("pcod-otp-step");o&&(o.style.display="block"),e&&(e.style.display="block"),t&&(t.style.display="none"),E("");const n=i("pcod-btn-choose-cod");n&&(n.disabled=!1,n.style.opacity="1")}function E(o){const e=i("pcod-otp-error");e&&(o?(e.textContent=o,e.style.display="block"):e.style.display="none")}function U(o){const e=i("pcod-pincode-error");e&&(o?(e.textContent=o,e.style.display="block"):e.style.display="none")}function rt(){const o=i("pcod-pincode-block");o&&(o.style.display=u.requiresPincode?"block":"none",u.requiresPincode||U(""))}function V(){const o=i("pcod-pincode-input");return o?o.value.replace(/[^0-9a-zA-Z]/g,"").slice(0,10):""}function lt(){try{window.Shopify&&typeof window.Shopify.loadFeatures=="function"&&!window.Shopify.customerPrivacy&&window.Shopify.loadFeatures([{name:"consent-tracking-api",version:"0.1"}],function(){})}catch(o){console.warn("[Consent API] unavailable:",o)}}function tt(){try{const o=window.Shopify&&window.Shopify.customerPrivacy;if(!o)return;const e=typeof o.marketingAllowed=="function"?o.marketingAllowed():void 0,t=typeof o.saleOfDataAllowed=="function"?o.saleOfDataAllowed():void 0;return e===!1||t===!1?!1:e===!0&&t!==!1?!0:void 0}catch(o){return}}function H(o){if(o||!u.requiresPincode)return!0;if(V().length>=3)return U(""),!0;U("Enter your delivery pincode so we can calculate the COD deposit.");const e=i("pcod-pincode-block");e&&e.scrollIntoView({behavior:"smooth",block:"center"});const t=i("pcod-pincode-input");return t&&t.focus(),!1}function ot(){const o=i("pcod-btn-choose-cod"),e=i("pcod-btn-choose-prepaid");o&&(o.disabled=!1,o.style.opacity="1"),e&&(e.disabled=!1,e.style.opacity="1");const t=i("pcod-otp-verify-btn");t&&(t.disabled=!1,t.textContent="Verify SMS & Place Order \u2192"),x()}async function et(){const o=i("pcod-otp-phone-input"),e=i("pcod-otp-send-btn"),t=o?o.value.replace(/[^0-9]/g,""):"";if(H(!1)){if(!t||t.length<10){E("Please enter a valid 10-digit mobile number.");return}E(""),e&&(e.disabled=!0,e.textContent="Sending SMS code...");try{const n=$(),s=await fetch(`${P}/api/partial-cod/otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"send",shop:n,phone:t,channel:"sms"})}),a=await s.json();if(!s.ok||!a.success)throw new Error(a.error||"Failed to deliver SMS OTP.");const d=i("pcod-otp-phone-group"),c=i("pcod-otp-code-group");d&&(d.style.display="none"),c&&(c.style.display="block");const p=i("pcod-otp-sent-text");p&&(p.textContent=a.debugOtp?`\u2705 Simulator SMS OTP: ${a.debugOtp}`:`\u2705 6-digit code sent via SMS to +91 ${t}!`);const h=i("pcod-otp-code-input");h&&(h.value="");const y=document.querySelectorAll(".pcod-otp-slot");y.forEach(function(g){g.value="",g.classList.remove("filled")}),y.length>0&&y[0].focus()}catch(n){E(n.message||"Failed to deliver SMS OTP. Please check your number.")}finally{e&&(e.disabled=!1,e.textContent="Send SMS Code \u2192")}}}async function ut(){const o=i("pcod-otp-phone-input"),e=i("pcod-otp-code-input"),t=i("pcod-otp-verify-btn"),n=o?o.value.replace(/[^0-9]/g,""):"",s=e?e.value.trim():"";if(!s||s.length<4){E("Please enter the 6-digit SMS verification code.");return}E(""),t&&(t.disabled=!0,t.textContent="Verifying & Placing Order...");try{const a=$(),d=await fetch(`${P}/api/partial-cod/otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",shop:a,phone:n,otp:s})}),c=await d.json();if(!d.ok||!c.success||!c.verified)throw new Error(c.error||"Invalid SMS verification code. Please try again.");R=n,N=c.token,await T(n,c.token)}catch(a){E(a.message||"Verification failed. Please re-enter the code."),t&&(t.disabled=!1,t.textContent="Verify SMS & Place Order \u2192")}}async function ft(){if(!H(!1))return;const o=i("pcod-btn-choose-cod"),e=i("pcod-cod-btn-label");o&&(o.disabled=!0,o.style.opacity="0.8"),e&&(e.textContent="Verifying order...");try{const t=$();if(!N)try{if((await(await fetch(`${P}/api/partial-cod/otp?action=check&shop=${encodeURIComponent(t)}`)).json()).required){W();return}}catch(n){console.warn("[OTP Check API]:",n),W();return}await T(R,N)}catch(t){console.warn("[OTP Check Fallback]:",t),await T(R,N)}}async function T(o,e,t,n){if(!H(!!t)){X(),ot();return}const s=i("pcod-btn-choose-cod"),a=i("pcod-btn-choose-prepaid"),d=i(t?"pcod-prepaid-btn-label":"pcod-cod-btn-label");d&&(d.textContent=t?"Opening Prepaid Checkout...":"Opening Partial COD Checkout...");try{const c=$(),p=l&&!l.isAuto&&Number(l.discountAmount)||0,h=Math.max(0,k-p),y=t?0:B(h);let g;const r=window.Shopify&&window.Shopify.currency&&window.Shopify.currency.active||"INR";if(F==="cart"&&_)g={shop:c,currency:r,isPrepaid:!!t,prepaidDiscount:n||0,deposit:y,items:_.items.map(b=>({variantId:b.id,quantity:b.quantity,price:b.price/100,title:b.title,sku:b.sku})),phone:o||void 0,otpToken:e||void 0,pincode:V()||void 0,marketingConsent:tt(),couponCode:l&&!l.isAuto?l.code:void 0,couponDiscount:l&&!l.isAuto?l.discountAmount:0};else{const{variantId:b,quantity:f,price:m,title:S}=M;g={shop:c,currency:r,isPrepaid:!!t,prepaidDiscount:n||0,deposit:y,variantId:b,quantity:f,price:m,title:S,phone:o||void 0,otpToken:e||void 0,pincode:V()||void 0,marketingConsent:tt(),couponCode:l&&!l.isAuto?l.code:void 0,couponDiscount:l&&!l.isAuto?l.discountAmount:0}}const v=await fetch(`${P}/api/partial-cod/draft-checkout`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(g)}),C=await v.json();if(!v.ok||!C.success||!C.invoiceUrl)throw new Error(C.error||"Unable to open checkout.");window.location.href=C.invoiceUrl}catch(c){console.error("[Checkout Error]:",c),alert(c.message||"Failed to open checkout. Please try again."),ot()}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",J):J()})();
