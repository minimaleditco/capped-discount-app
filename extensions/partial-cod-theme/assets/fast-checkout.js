"use strict";(function(){const F="https://capped-discount-app.onrender.com",q=window.Shopify&&window.Shopify.currency&&window.Shopify.currency.active||"INR",ft=(()=>{try{return new Intl.NumberFormat(void 0,{style:"currency",currency:q})}catch(o){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"})}})();function f(o){const e=Number(o);return ft.format(Number.isFinite(e)?e:0)}let L="product",S={variantId:"",quantity:1,price:0,title:"",image:"",shop:""},I=null;function i(o){return document.getElementById(o)}function O(){var o,e;return window.Shopify&&window.Shopify.shop||((o=document.querySelector('meta[name="shopify-digital-wallet-domain"]'))==null?void 0:o.getAttribute("content"))||((e=document.getElementById("pcod-fast-buy-btn"))==null?void 0:e.getAttribute("data-shop"))||""}function H(){let o=i("pcod-choice-modal-backdrop");if(o)return o;const e=`
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
                  <span class="pcod-card-price" id="pcod-prepaid-price">${f(0)}</span>
                  <span class="pcod-original-price" id="pcod-prepaid-orig-price" style="display: none;">${f(0)}</span>
                  <span class="pcod-save-badge" id="pcod-prepaid-save-badge" style="display: none;">Save ${f(0)}</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 1: Full Prepaid</div>
                <div class="pcod-card-desc" id="pcod-prepaid-desc">Pay 100% online now via UPI, Cards, or Netbanking. Extra prepaid savings applied automatically.</div>
              </div>
              <button type="button" class="pcod-select-btn pcod-btn-prepaid" id="pcod-btn-choose-prepaid">
                <span class="pcod-btn-text" id="pcod-prepaid-btn-label">Pay Full ${f(0)} Online \u2192</span>
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
                <span class="pcod-save-badge" id="pcod-cod-tag" style="display: none;">Save ${f(0)}</span>
                <div class="pcod-price-stack">
                  <div class="pcod-card-price-split">
                    <span class="pcod-price-now" id="pcod-cod-now">${f(0)} Now</span>
                    <span class="pcod-price-doorstep" id="pcod-cod-doorstep">+ ${f(0)} COD</span>
                  </div>
                  <span class="pcod-original-price" id="pcod-cod-orig-price" style="display: none;">Total ${f(0)}</span>
                </div>
              </div>
              <div class="pcod-card-body">
                <div class="pcod-card-title">Option 2: Partial Cash on Delivery</div>
                <div class="pcod-card-desc">Pay only <strong id="pcod-cod-desc-deposit">${f(0)}</strong> advance deposit online to confirm shipping. Pay the remaining <strong id="pcod-cod-desc-balance">${f(0)}</strong> in cash at your doorstep.<span id="pcod-cod-desc-saving" style="display: none; color: #059669; font-weight: 600;"></span></div>
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

          <!-- OTP Verification Step (shadcn InputOTP) -->
          <div class="pcod-otp-step" id="pcod-otp-step" style="display: none;">
            <div class="pcod-otp-header">
              <button type="button" class="pcod-otp-back-btn" id="pcod-otp-back-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
                <span>Change Payment Option</span>
              </button>
            </div>
            <div class="pcod-otp-title">Verify Mobile</div>
            <div class="pcod-otp-desc">To confirm your Partial COD order, please enter your mobile number. A 6-digit verification code will be sent.</div>

            <!-- Phone Input Step -->
            <div class="pcod-otp-phone-group" id="pcod-otp-phone-group">
              <div class="pcod-otp-input-wrap">
                <span class="pcod-otp-prefix">+91</span>
                <input type="tel" id="pcod-otp-phone-input" class="pcod-otp-input" placeholder="10-digit mobile number" maxlength="10" />
              </div>
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-send-btn">Send verification code \u2192</button>
            </div>

            <!-- Code Input Step (shadcn InputOTP 6-Box Grid) -->
            <div class="pcod-otp-code-group" id="pcod-otp-code-group" style="display: none;">
              <div class="pcod-otp-sent-text" id="pcod-otp-sent-text">\u2705 6-digit verification code sent!</div>
              <div class="pcod-otp-slots-row" id="pcod-otp-slots-row">
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="0" autocomplete="one-time-code" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="1" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="2" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="3" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="4" />
                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pcod-otp-slot" data-slot="5" />
              </div>
              <input type="hidden" id="pcod-otp-code-input" value="" />
              <button type="button" class="pcod-otp-action-btn" id="pcod-otp-verify-btn">Verify & Place Order \u2192</button>
              <div class="pcod-otp-resend">
                <button type="button" class="pcod-otp-resend-btn" id="pcod-otp-resend-btn">Didn't receive code? Resend code</button>
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
    </div>`;return document.body.insertAdjacentHTML("beforeend",e),Z(),i("pcod-choice-modal-backdrop")}function Z(){const o=i("pcod-choice-modal-backdrop"),e=i("pcod-choice-close-btn"),t=i("pcod-btn-choose-prepaid"),n=i("pcod-btn-choose-cod");e&&!e.getAttribute("data-pcod-bound")&&(e.setAttribute("data-pcod-bound","true"),e.addEventListener("click",it)),o&&!o.getAttribute("data-pcod-bound")&&(o.setAttribute("data-pcod-bound","true"),o.addEventListener("click",function(u){u.target===o&&it()})),t&&!t.getAttribute("data-pcod-bound")&&(t.setAttribute("data-pcod-bound","true"),t.addEventListener("click",vt)),n&&!n.getAttribute("data-pcod-bound")&&(n.setAttribute("data-pcod-bound","true"),n.addEventListener("click",Ct));const s=i("pcod-pincode-input");s&&!s.getAttribute("data-pcod-bound")&&(s.setAttribute("data-pcod-bound","true"),s.addEventListener("input",function(){clearTimeout(ot),ot=setTimeout(j,600)}));const d=i("pcod-coupon-apply-btn"),a=i("pcod-coupon-input");d&&!d.getAttribute("data-pcod-bound")&&(d.setAttribute("data-pcod-bound","true"),d.addEventListener("click",function(){const u=a?a.value.trim():"";u&&G(u)})),a&&!a.getAttribute("data-pcod-bound")&&(a.setAttribute("data-pcod-bound","true"),a.addEventListener("keydown",function(u){if(u.key==="Enter"){u.preventDefault();const m=a.value.trim();m&&G(m)}}));const c=i("pcod-otp-back-btn"),b=i("pcod-otp-send-btn"),r=i("pcod-otp-verify-btn"),y=i("pcod-otp-resend-btn"),k=i("pcod-otp-slots-row");if(k&&!k.getAttribute("data-pcod-bound")){let C=function(){let h="";u.forEach(function(v){h+=v.value||"",v.value?v.classList.add("filled"):v.classList.remove("filled")}),m&&(m.value=h)};var A=C;k.setAttribute("data-pcod-bound","true");const u=k.querySelectorAll(".pcod-otp-slot"),m=i("pcod-otp-code-input");u.forEach(function(h,v){h.addEventListener("input",function(){const g=this.value.replace(/[^0-9]/g,"");this.value=g?g[g.length-1]:"",C(),this.value&&v<u.length-1&&u[v+1].focus()}),h.addEventListener("keydown",function(g){g.key==="Backspace"&&!this.value&&v>0?(u[v-1].focus(),u[v-1].value="",C()):g.key==="ArrowLeft"&&v>0?u[v-1].focus():g.key==="ArrowRight"&&v<u.length-1&&u[v+1].focus()}),h.addEventListener("paste",function(g){g.preventDefault();const $=(g.clipboardData||window.clipboardData).getData("text").replace(/[^0-9]/g,"");if($){u.forEach(function(P,B){P.value=$[B]||""}),C();const D=Math.min($.length,u.length-1);u[D].focus()}})})}c&&!c.getAttribute("data-pcod-bound")&&(c.setAttribute("data-pcod-bound","true"),c.addEventListener("click",at)),b&&!b.getAttribute("data-pcod-bound")&&(b.setAttribute("data-pcod-bound","true"),b.addEventListener("click",pt)),r&&!r.getAttribute("data-pcod-bound")&&(r.setAttribute("data-pcod-bound","true"),r.addEventListener("click",kt)),y&&!y.getAttribute("data-pcod-bound")&&(y.setAttribute("data-pcod-bound","true"),y.addEventListener("click",function(){const u=i("pcod-otp-phone-group"),m=i("pcod-otp-code-group");u&&(u.style.display="block"),m&&(m.style.display="none"),pt()}))}function K(){gt(),H(),Z(),document.querySelectorAll("#pcod-fast-buy-btn, .pcod-fast-buy-btn").forEach(function(e){e.getAttribute("data-pcod-bound")||(e.setAttribute("data-pcod-bound","true"),e.addEventListener("click",function(t){t.preventDefault();const n=e.getAttribute("data-mode"),s=e.getAttribute("data-variant-id");n==="cart"||!s?X():W()}))}),document.addEventListener("click",yt,!0)}function yt(o){const e=o.target;if(!e||e.closest("#pcod-choice-modal")||e.closest("#pcod-fast-buy-btn"))return;if(e.closest('button[name="checkout"], input[name="checkout"], #checkout, button#CartDrawer-Checkout, a[href="/checkout"], a[href*="/checkout"], .cart__checkout-button, [data-cart-checkout], button.cart__checkout, .cart-drawer__checkout')){o.preventDefault(),o.stopPropagation(),X();return}if(e.closest(".shopify-payment-button__button, button[data-testid='Checkout-button']")){o.preventDefault(),o.stopPropagation(),W();return}}async function bt(){var r,y,k,A,u,m,C;const o=i("pcod-fast-buy-btn");let e=o&&o.getAttribute("data-variant-id")||"",t=parseFloat(o&&o.getAttribute("data-product-price")||"0"),n=o&&o.getAttribute("data-product-title")||"",s=o&&o.getAttribute("data-product-image")||"",d=1;const a=document.querySelector('form[action*="/cart/add"] [name="id"], form[action*="/cart/add"] select[name="id"], select.product-form__variants, [name="id"]');a&&a.value&&!isNaN(Number(a.value))&&(e=a.value);const c=document.querySelector('form[action*="/cart/add"] [name="quantity"], input[name="quantity"]');if(c&&c.value&&!isNaN(Number(c.value))&&Number(c.value)>0&&(d=parseInt(c.value,10)),!t||t<=0||!n||n==="Product")try{const h=window.location.pathname.replace(/\/$/,"");if(h.includes("/products/")){const v=await fetch(h+".js");if(v.ok){const g=await v.json();if(g){n=g.title||n,s=g.featured_image||s;const $=e||g.variants&&((r=g.variants[0])==null?void 0:r.id),D=((y=g.variants)==null?void 0:y.find(P=>String(P.id)===String($)))||((k=g.variants)==null?void 0:k[0]);D&&(e=String(D.id),t=D.price/100,D.featured_image&&D.featured_image.src&&(s=D.featured_image.src))}}}}catch(h){console.warn("[PCOD] Could not fetch product .js:",h)}if((!t||t<=0)&&((u=(A=window.ShopifyAnalytics)==null?void 0:A.meta)!=null&&u.product))try{const h=window.ShopifyAnalytics.meta.product;n=h.title||n;const v=e||window.ShopifyAnalytics.meta.selectedVariantId,g=((m=h.variants)==null?void 0:m.find($=>String($.id)===String(v)))||((C=h.variants)==null?void 0:C[0]);g&&(e=String(g.id),t=g.price/100)}catch(h){}if(!t||t<=0){const h=document.querySelector(".price__regular .price-item--regular, .price-item--sale, .price-item, .product__price, [data-product-price], .price");if(h){const v=h.textContent.replace(/[^0-9.]/g,"");v&&!isNaN(parseFloat(v))&&(t=parseFloat(v))}}if(!n||n==="Product"){const h=document.querySelector(".product__title h1, .product-title, h1.product__title, h1");h&&h.textContent.trim()?n=h.textContent.trim():n="Product"}if(!s){const h=document.querySelector(".product__media img, .product-featured-media img, .product-single__photo img, img.image-magnify-lightbox");h&&h.src&&(s=h.src)}const b=O();return S={variantId:e,quantity:d,price:t,title:n,image:s,shop:b},S}function _(o){const e=l.depositSettings||{type:"percentage",value:10};let t=e.type==="percentage"?Math.round(o*(Number(e.value)||10)/100*100)/100:Number(e.value)||100;return t=Math.max(1,Math.min(o,t)),t}async function W(){L="product",H();const o=i("pcod-choice-modal-backdrop");if(!o)return;const e=await bt(),t=e.price*e.quantity,n=_(t),s=Math.max(0,Math.round((t-n)*100)/100);nt({title:e.title,image:e.image,meta:`Quantity: ${e.quantity} \u2022 Subtotal: ${f(t)}`,total:t,deposit:n,balance:s}),o.style.display="flex"}async function X(){L="cart",H();const o=i("pcod-choice-modal-backdrop");if(o)try{const t=await(await fetch("/cart.js")).json();if(!t||!t.items||t.items.length===0){window.location.href="/cart";return}I=t;const n=(t.total_discount||0)/100;let s=t.total_price/100;if(t.original_total_price&&t.original_total_price>t.total_price&&(s=t.original_total_price/100),w=s,n>0){let y="Store Auto Discount";if(t.cart_level_discount_applications&&t.cart_level_discount_applications.length>0)y=t.cart_level_discount_applications[0].title||y;else if(t.items){for(const k of t.items)if(k.discounts&&k.discounts.length>0){y=k.discounts[0].title||y;break}}l.autoDiscount={code:"AUTO",title:y,discountAmount:n,discountSummary:`${y} (Store Auto Offer)`,isAuto:!0},(!p||p.isAuto)&&(p=l.autoDiscount)}else l.autoDiscount=null,p&&p.isAuto&&(p=null);const d=s,a=_(d),c=Math.max(0,Math.round((d-a)*100)/100),b=t.items[0],r=t.items.length===1?b.title:`${b.title} + ${t.items.length-1} other item${t.items.length>2?"s":""}`;nt({title:r,image:b.image||"",meta:`${t.item_count} item${t.item_count>1?"s":""} in cart \u2022 Total: ${f(d)}`,total:d,deposit:a,balance:c}),o.style.display="flex"}catch(e){console.warn("[Cart Modal Fetch Error]:",e),window.location.href="/checkout"}}let w=0,p=null,l={depositSettings:{type:"percentage",value:10},autoDiscount:null,coupons:[],requiresPincode:!1,quote:null,prepaidOffer:{enabled:!0,type:"percentage",value:5,badgeText:"\u26A1 Extra 5% OFF on Prepaid"}};function tt(o){if(!l.coupons||l.coupons.length===0)return;const e=l.autoDiscount&&Number(l.autoDiscount.discountAmount)||0;let t=null,n=e;for(const s of l.coupons){const d=s.minSubtotal?Number(s.minSubtotal):0;if(d>0&&o<d)continue;let a=0;s.type==="percentage"?(a=Math.round(o*s.value/100*100)/100,s.maxCap&&a>s.maxCap&&(a=s.maxCap)):a=Number(s.value)||0,a=Math.min(a,o),a>n&&(n=a,t={code:s.code,title:s.title||`${s.code}`,discountAmount:a,discountSummary:`${s.title||s.code} (Best Deal Applied)`,isAuto:!1})}if(t&&t.discountAmount>0){p=t;const s=i("pcod-coupon-input");s&&(s.value=t.code);const d=i("pcod-coupon-applied-msg");if(d){d.style.display="flex",d.style.background="#DCFCE7",d.style.borderColor="#86EFAC",d.style.color="#166534",d.innerHTML=`
          <span>\u{1F389} Best Deal <strong>${t.code}</strong> auto-applied! Saved ${f(t.discountAmount)}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;const a=i("pcod-coupon-remove-btn");a&&a.addEventListener("click",R)}}}function J(){return L==="cart"&&I&&Array.isArray(I.items)?I.items.map(o=>({variantId:o.id,quantity:o.quantity,price:o.price/100,sku:o.sku||""})):S&&S.variantId?[{variantId:S.variantId,quantity:S.quantity,price:S.price,sku:""}]:[]}let ot=null;async function j(){try{const o=O();if(!o||w<=0)return;const e={shop:o,subtotal:w,code:p&&!p.isAuto?p.code:"",pincode:T()||"",currency:q,items:J()},n=await(await fetch(`${F}/api/partial-cod/coupons`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)})).json();n&&n.quote&&(l.quote=n.quote,x())}catch(o){console.warn("[Quote Refresh Failed]:",o)}}async function ht(o){try{const e=O();if(!e){console.warn("[Store Offers] Shopify shop domain unavailable; skipping offer lookup."),E(),x();return}const t=new URLSearchParams({shop:e,subtotal:String(o),currency:q}),n=T();n&&t.set("pincode",n);const s=J();s.length&&t.set("items",JSON.stringify(s));const d=await fetch(`${F}/api/partial-cod/coupons?${t.toString()}`);if(d.ok){const a=await d.json();a.depositSettings&&(l.depositSettings=a.depositSettings),l.coupons=Array.isArray(a.coupons)?a.coupons:[],a.prepaidOffer&&(l.prepaidOffer=a.prepaidOffer),l.autoDiscount=a.autoDiscount||null,l.quote=a.quote||null,l.requiresPincode=Boolean(a.requiresPincode),mt(),p||tt(o),E(),x(),p&&!p.isAuto&&await j()}}catch(e){console.warn("[Store Offers Fetch Fallback]:",e),E(),x()}}function et(){if(!l.autoDiscount||l.autoDiscount.discountAmount<=0)return;p=l.autoDiscount;const o=i("pcod-coupon-input");o&&(o.value="");const e=i("pcod-coupon-applied-msg");e&&(e.style.display="flex",e.style.background="#FEF3C7",e.style.borderColor="#FCD34D",e.style.color="#92400E",e.innerHTML=`
        <span>\u26A1 Store Auto Discount <strong>${l.autoDiscount.title}</strong> is locked in! Saved ${f(l.autoDiscount.discountAmount)}</span>
      `),E(),x(),j()}function E(){const o=i("pcod-available-coupons-wrap"),e=i("pcod-coupon-chips"),t=i("pcod-available-coupons-title");if(!e)return;const n=l.autoDiscount&&l.autoDiscount.discountAmount>0,s=l.coupons&&l.coupons.length>0;if(!n&&!s){o&&(o.style.display="none");return}o&&(o.style.display="block"),t&&s&&(t.textContent=`Available Coupons (${l.coupons.length} Offers)`);let d="";if(l.autoDiscount){const c=p&&p.isAuto;d+=`
        <div class="pcod-discount-card pcod-auto-card ${c?"applied":""}" data-is-auto="true">
          <div class="pcod-discount-card-left">
            <div class="pcod-discount-badge-icon pcod-auto-badge">
              <span style="font-size: 16px; color: #FFFFFF;">\u26A1</span>
            </div>
            <div class="pcod-discount-info">
              <div class="pcod-discount-title">${l.autoDiscount.title}</div>
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
      `}d+=(l.coupons||[]).map(function(c){const b=p&&!p.isAuto&&p.code.toUpperCase()===c.code.toUpperCase(),r=c.minSubtotal?Number(c.minSubtotal):0,y=r>0&&w<r,k=y?Math.ceil(r-w):0;let A=0;c.type==="percentage"?(A=Math.round(w*c.value/100*100)/100,c.maxCap&&A>c.maxCap&&(A=c.maxCap)):A=Number(c.value)||0,A=Math.min(A,w);let u=c.title;u||(u=c.type==="percentage"?`${c.value}% OFF${c.maxCap?` (Max ${f(c.maxCap)})`:""}`:`Flat ${f(c.value)} OFF${r>0?` above ${f(r)}`:""}`);let m="";b?m=`<span class="pcod-discount-unlock-tag" style="background: #ECFDF5; color: #065F46; font-weight: 700;">\u2713 Active \u2022 Saved ${f(A)}</span>`:y?m=`<span class="pcod-discount-unlock-tag" style="background: #FEE2E2; color: #991B1B; font-weight: 600;">\u{1F512} Not Applicable: Add ${f(k)} more</span>`:m=`<span class="pcod-discount-unlock-tag" style="background: #EFF6FF; color: #1E40AF; font-weight: 600;">\u2728 Saves ${f(A)} with this code</span>`;let C="";return b?C=`
            <div class="pcod-discount-applied-pill">\u2713 Applied</div>
            <button type="button" class="pcod-discount-remove-link" data-remove-code="${c.code}">Remove</button>
          `:y?C=`
            <button type="button" class="pcod-discount-apply-action disabled" disabled style="opacity: 0.6; cursor: not-allowed;">NOT APPLICABLE</button>
          `:C=`
            <button type="button" class="pcod-discount-apply-action" data-apply-code="${c.code}">APPLY</button>
            <svg class="pcod-chevron-icon" viewBox="0 0 24 24" width="16" height="16" stroke="#94A3B8" stroke-width="2" fill="none">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          `,`
          <div class="pcod-discount-card ${b?"applied":""} ${y?"locked":""}" data-coupon-code="${c.code}" data-min-sub="${r}">
            <div class="pcod-discount-card-left">
              <div class="pcod-discount-badge-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="5" x2="5" y2="19"></line>
                  <circle cx="6.5" cy="6.5" r="2.5"></circle>
                  <circle cx="17.5" cy="17.5" r="2.5"></circle>
                </svg>
              </div>
              <div class="pcod-discount-info">
                <div class="pcod-discount-title">${u}</div>
                <div class="pcod-discount-subtitle">Use code <strong>${c.code}</strong></div>
                <div class="pcod-discount-tag-row">
                  <span class="pcod-discount-code-box">${c.code}</span>
                  ${m}
                </div>
              </div>
            </div>
            <div class="pcod-discount-card-right">
              ${C}
            </div>
          </div>
        `}).join(""),e.innerHTML=d;const a=e.querySelector(".pcod-auto-card");a&&a.addEventListener("click",function(){et()}),e.querySelectorAll(".pcod-discount-card:not(.pcod-auto-card)").forEach(function(c){c.addEventListener("click",function(b){if(b.target.closest(".pcod-discount-remove-link")){b.stopPropagation(),R();return}const r=this.getAttribute("data-coupon-code"),y=Number(this.getAttribute("data-min-sub")||0);if(y>0&&w<y){const A=Math.ceil(y-w),u=i("pcod-coupon-applied-msg");u&&(u.style.display="flex",u.style.background="#FEF2F2",u.style.borderColor="#FCA5A5",u.style.color="#DC2626",u.innerHTML=`<span>\u26A0\uFE0F Coupon <strong>${r}</strong> is not applicable for this order: Minimum order of ${f(y)} required (Add ${f(A)} more).</span>`);return}const k=i("pcod-coupon-input");k&&(k.value=r),G(r)})})}async function G(o){const e=i("pcod-coupon-input"),t=i("pcod-coupon-apply-btn"),n=i("pcod-coupon-applied-msg"),s=String(o||(e?e.value:"")).trim().toUpperCase();if(!s)return;t&&(t.disabled=!0,t.textContent="Applying...");const d=(l.coupons||[]).find(a=>a.code.toUpperCase()===s);if(d){const a=d.minSubtotal?Number(d.minSubtotal):0;if(a>0&&w<a){const b=Math.ceil(a-w);n&&(n.style.display="flex",n.style.background="#FEF2F2",n.style.borderColor="#FCA5A5",n.style.color="#DC2626",n.innerHTML=`<span>\u26A0\uFE0F Coupon <strong>${d.code}</strong> is not applicable for this order: Minimum order of ${f(a)} required (Add ${f(b)} more).</span>`),t&&(t.disabled=!1,t.textContent="Apply");return}let c=0;if(d.type==="percentage"?(c=Math.round(w*d.value/100*100)/100,d.maxCap&&c>d.maxCap&&(c=d.maxCap)):c=Number(d.value)||0,c=Math.min(c,w),p={code:d.code,title:d.title||`${d.code}`,discountAmount:c,discountSummary:`${d.title||d.code} (Applied)`,isAuto:!1},e&&(e.value=d.code),n){n.style.display="flex",n.style.background="#DCFCE7",n.style.borderColor="#86EFAC",n.style.color="#166534",n.innerHTML=`
          <span>\u{1F389} Code <strong>${d.code}</strong> applied! Saved ${f(c)}</span>
          <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">Remove</button>
        `;const b=i("pcod-coupon-remove-btn");b&&b.addEventListener("click",R)}E(),x()}try{const a=O(),c=T(),b=await fetch(`${F}/api/partial-cod/coupons`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shop:a,code:s,subtotal:w,pincode:c,currency:q,items:J()})}),r=await b.json();if(r&&r.quote&&(l.quote=r.quote),!b.ok||!r.valid){if(!d)throw new Error(r.error||`Coupon '${s}' is not valid for this order.`)}else{if(p=r,r.depositSettings&&(l.depositSettings=r.depositSettings),r.coupons&&Array.isArray(r.coupons)&&r.coupons.length>0&&(l.coupons=r.coupons),e&&(e.value=r.code),n){n.style.display="flex",n.style.background="#DCFCE7",n.style.borderColor="#86EFAC",n.style.color="#166534",n.innerHTML=`
            <span>\u{1F389} Code <strong>${r.code}</strong> applied! Saved ${f(r.discountAmount)}${l.autoDiscount?" (Replaces Auto Discount)":""}</span>
            <button type="button" class="pcod-coupon-remove-btn" id="pcod-coupon-remove-btn">${l.autoDiscount?"Revert to Auto Offer":"Remove"}</button>
          `;const y=i("pcod-coupon-remove-btn");y&&y.addEventListener("click",R)}E(),x()}}catch(a){d||(p=null,n&&(n.style.display="flex",n.style.background="#FEF2F2",n.style.borderColor="#FCA5A5",n.style.color="#DC2626",n.innerHTML=`<span>\u26A0\uFE0F ${a.message||"Failed to apply coupon."}</span>`),E(),x())}finally{t&&(t.disabled=!1,t.textContent="Apply")}}function R(){const o=i("pcod-coupon-input");if(o&&(o.value=""),l.autoDiscount){et();return}p=null;const e=i("pcod-coupon-applied-msg");e&&(e.style.display="none",e.style.background="#DCFCE7",e.style.borderColor="#86EFAC",e.style.color="#166534",e.innerHTML=""),E(),x(),j()}function x(){const o=p&&!p.isAuto&&Number(p.discountAmount)||0,e=l.autoDiscount&&Number(l.autoDiscount.discountAmount)||0,t=l.quote,n=t&&Math.abs(Number(t.subtotal)-w)<.01,s=n?Number(t.discountAmount)||0:Math.max(o,e),d=n?Number(t.effectiveTotal)||0:Math.max(0,w-s);let a=0;const c=l.prepaidOffer;c&&c.enabled&&c.value>0&&(c.type==="percentage"?a=Math.round(d*c.value/100*100)/100:a=c.value,a=Math.min(a,d));const b=n?Number(t.prepaidTotal)||0:Math.max(0,Math.round((d-a)*100)/100),r=n?Number(t.prepaidSavings)||0:Math.round((w-b)*100)/100,y=i("pcod-auto-deal-banner"),k=i("pcod-auto-deal-text");if(y&&k)if(s>0){const wt=o>=e&&o>0?`Best Deal '${p.code}' Auto-Applied`:`Automatic Discount${l.autoDiscount&&l.autoDiscount.title?` '${l.autoDiscount.title}'`:""} Applied by Shopify`;k.innerHTML=`<strong>${wt}:</strong> You save <strong>${f(s)}</strong> on this order!`,y.style.display="flex"}else y.style.display="none";const A=i("pcod-prepaid-price"),u=i("pcod-prepaid-orig-price"),m=i("pcod-prepaid-save-badge"),C=i("pcod-prepaid-tag"),h=i("pcod-prepaid-btn-label");A&&(A.textContent=f(b)),r>0?(u&&(u.textContent=f(w),u.style.display="inline"),m&&(m.textContent=`Save ${f(r)}`,m.style.display="inline")):(u&&(u.style.display="none"),m&&(m.style.display="none")),C&&(c&&c.enabled?(C.textContent=c.badgeText||"\u26A1 Extra 5% OFF on Prepaid",C.style.display="inline-block"):C.style.display="none"),h&&(h.textContent=r>0?`Pay Full ${f(b)} Online (Save ${f(r)}) \u2192`:`Pay Full ${f(b)} Online \u2192`);const v=n?Number(t.deposit)||0:_(d),g=n?Number(t.balance)||0:Math.max(0,Math.round((d-v)*100)/100),$=i("pcod-cod-now"),D=i("pcod-cod-doorstep"),P=i("pcod-cod-orig-price"),B=i("pcod-cod-tag"),rt=i("pcod-cod-desc-deposit"),lt=i("pcod-cod-desc-balance"),N=i("pcod-cod-desc-saving"),ut=i("pcod-cod-btn-label");$&&($.textContent=`${f(v)} Now`),D&&(D.textContent=`+ ${f(g)} on Delivery`),rt&&(rt.textContent=f(v)),lt&&(lt.textContent=f(g)),s>0?(P&&(P.textContent=`Total ${f(w)}`,P.style.display="inline"),B&&(B.textContent=`Save ${f(s)}`,B.style.display="inline"),N&&(N.textContent=` (Total order reduced from ${f(w)} to ${f(d)})`,N.style.display="inline")):(P&&(P.style.display="none"),B&&(B.style.display="none"),N&&(N.style.display="none")),ut&&(ut.textContent=`Pay ${f(v)} Deposit & Confirm COD \u2192`)}function nt({title:o,image:e,meta:t,total:n,deposit:s,balance:d}){w=n,(!p||p.isAuto)&&tt(n);const a=i("pcod-choice-img"),c=i("pcod-choice-prod-name"),b=i("pcod-choice-prod-meta");a&&(e?(a.src=e,a.style.display="block"):a.style.display="none"),c&&(c.textContent=o),b&&(b.textContent=t),E(),x(),ht(n);const r=i("pcod-btn-choose-prepaid"),y=i("pcod-btn-choose-cod");r&&(r.disabled=!1,r.style.opacity="1"),y&&(y.disabled=!1,y.style.opacity="1")}function it(){const o=i("pcod-choice-modal-backdrop");o&&(o.style.display="none")}function vt(){const o=i("pcod-btn-choose-prepaid"),e=i("pcod-prepaid-btn-label");o&&(o.disabled=!0,o.style.opacity="0.8"),e&&(e.textContent="Opening Checkout...");let t=0;const n=l.prepaidOffer,s=p?p.discountAmount:0,d=Math.max(0,w-s);if(n&&n.enabled&&n.value>0&&(n.type==="percentage"?t=Math.round(d*n.value/100*100)/100:t=n.value,t=Math.min(t,d)),t>0){V("","",!0,t);return}let a="/checkout";if(L!=="cart"&&S&&S.variantId){const{variantId:c,quantity:b}=S;a=`/cart/${c}:${b}`}p&&!p.isAuto&&p.code&&(a+=(a.includes("?")?"&":"?")+`discount=${encodeURIComponent(p.code)}`),window.location.href=a}let Y="",U="";function ct(){const o=i("pcod-cards-container"),e=i("pcod-coupon-section"),t=i("pcod-otp-step");o&&(o.style.display="none"),e&&(e.style.display="none"),t&&(t.style.display="block");const n=i("pcod-otp-phone-input");n&&n.focus()}function at(){const o=i("pcod-cards-container"),e=i("pcod-coupon-section"),t=i("pcod-otp-step");o&&(o.style.display="block"),e&&(e.style.display="block"),t&&(t.style.display="none"),M("");const n=i("pcod-btn-choose-cod");n&&(n.disabled=!1,n.style.opacity="1")}function M(o){const e=i("pcod-otp-error");e&&(o?(e.textContent=o,e.style.display="block"):e.style.display="none")}function z(o){const e=i("pcod-pincode-error");e&&(o?(e.textContent=o,e.style.display="block"):e.style.display="none")}function mt(){const o=i("pcod-pincode-block");o&&(o.style.display=l.requiresPincode?"block":"none",l.requiresPincode||z(""))}function T(){const o=i("pcod-pincode-input");return o?o.value.replace(/[^0-9a-zA-Z]/g,"").slice(0,10):""}function gt(){try{window.Shopify&&typeof window.Shopify.loadFeatures=="function"&&!window.Shopify.customerPrivacy&&window.Shopify.loadFeatures([{name:"consent-tracking-api",version:"0.1"}],function(){})}catch(o){console.warn("[Consent API] unavailable:",o)}}function dt(){try{const o=window.Shopify&&window.Shopify.customerPrivacy;if(!o)return;const e=typeof o.marketingAllowed=="function"?o.marketingAllowed():void 0,t=typeof o.saleOfDataAllowed=="function"?o.saleOfDataAllowed():void 0;return e===!1||t===!1?!1:e===!0&&t!==!1?!0:void 0}catch(o){return}}function Q(o){if(o||!l.requiresPincode)return!0;if(T().length>=3)return z(""),!0;z("Enter your delivery pincode so we can calculate the COD deposit.");const e=i("pcod-pincode-block");e&&e.scrollIntoView({behavior:"smooth",block:"center"});const t=i("pcod-pincode-input");return t&&t.focus(),!1}function st(){const o=i("pcod-btn-choose-cod"),e=i("pcod-btn-choose-prepaid");o&&(o.disabled=!1,o.style.opacity="1"),e&&(e.disabled=!1,e.style.opacity="1");const t=i("pcod-otp-verify-btn");t&&(t.disabled=!1,t.textContent="Verify & Place Order \u2192"),x()}async function pt(){const o=i("pcod-otp-phone-input"),e=i("pcod-otp-send-btn"),t=o?o.value.replace(/[^0-9]/g,""):"";if(Q(!1)){if(!t||t.length<10){M("Please enter a valid 10-digit mobile number.");return}M(""),e&&(e.disabled=!0,e.textContent="Sending verification code...");try{const n=O(),s=await fetch(`${F}/api/partial-cod/otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"send",shop:n,phone:t})}),d=await s.json();if(!s.ok||!d.success)throw new Error(d.error||"Failed to deliver the verification code.");const a=i("pcod-otp-phone-group"),c=i("pcod-otp-code-group");a&&(a.style.display="none"),c&&(c.style.display="block");const b=i("pcod-otp-sent-text");b&&(b.textContent=d.debugOtp?`\u2705 Simulator OTP: ${d.debugOtp}`:`\u2705 6-digit code sent to +91 ${t}!`);const r=i("pcod-otp-code-input");r&&(r.value="");const y=document.querySelectorAll(".pcod-otp-slot");y.forEach(function(k){k.value="",k.classList.remove("filled")}),y.length>0&&y[0].focus()}catch(n){M(n.message||"Failed to deliver the verification code. Please check your number.")}finally{e&&(e.disabled=!1,e.textContent="Send verification code \u2192")}}}async function kt(){const o=i("pcod-otp-phone-input"),e=i("pcod-otp-code-input"),t=i("pcod-otp-verify-btn"),n=o?o.value.replace(/[^0-9]/g,""):"",s=e?e.value.trim():"";if(!s||s.length<4){M("Please enter the 6-digit verification code.");return}M(""),t&&(t.disabled=!0,t.textContent="Verifying & Placing Order...");try{const d=O(),a=await fetch(`${F}/api/partial-cod/otp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"verify",shop:d,phone:n,otp:s})}),c=await a.json();if(!a.ok||!c.success||!c.verified)throw new Error(c.error||"Invalid verification code. Please try again.");Y=n,U=c.token,await V(n,c.token)}catch(d){M(d.message||"Verification failed. Please re-enter the code."),t&&(t.disabled=!1,t.textContent="Verify & Place Order \u2192")}}async function Ct(){if(!Q(!1))return;const o=i("pcod-btn-choose-cod"),e=i("pcod-cod-btn-label");o&&(o.disabled=!0,o.style.opacity="0.8"),e&&(e.textContent="Verifying order...");try{const t=O();if(!U)try{if((await(await fetch(`${F}/api/partial-cod/otp?action=check&shop=${encodeURIComponent(t)}`)).json()).required){ct();return}}catch(n){console.warn("[OTP Check API]:",n),ct();return}await V(Y,U)}catch(t){console.warn("[OTP Check Fallback]:",t),await V(Y,U)}}async function V(o,e,t,n){if(!Q(!!t)){at(),st();return}const s=i("pcod-btn-choose-cod"),d=i("pcod-btn-choose-prepaid"),a=i(t?"pcod-prepaid-btn-label":"pcod-cod-btn-label");a&&(a.textContent=t?"Opening Prepaid Checkout...":"Opening Partial COD Checkout...");try{const c=O(),b=p&&!p.isAuto&&Number(p.discountAmount)||0,r=Math.max(0,w-b),y=t?0:_(r);let k;const A=window.Shopify&&window.Shopify.currency&&window.Shopify.currency.active||"INR";if(L==="cart"&&I)k={shop:c,currency:A,isPrepaid:!!t,prepaidDiscount:n||0,deposit:y,items:I.items.map(C=>({variantId:C.id,quantity:C.quantity,price:C.price/100,title:C.title,sku:C.sku})),phone:o||void 0,otpToken:e||void 0,pincode:T()||void 0,marketingConsent:dt(),couponCode:p&&!p.isAuto?p.code:void 0,couponDiscount:p&&!p.isAuto?p.discountAmount:0};else{const{variantId:C,quantity:h,price:v,title:g}=S;k={shop:c,currency:A,isPrepaid:!!t,prepaidDiscount:n||0,deposit:y,variantId:C,quantity:h,price:v,title:g,phone:o||void 0,otpToken:e||void 0,pincode:T()||void 0,marketingConsent:dt(),couponCode:p&&!p.isAuto?p.code:void 0,couponDiscount:p&&!p.isAuto?p.discountAmount:0}}const u=await fetch(`${F}/api/partial-cod/draft-checkout`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(k)}),m=await u.json();if(!u.ok||!m.success||!m.invoiceUrl)throw new Error(m.error||"Unable to open checkout.");window.location.href=m.invoiceUrl}catch(c){console.error("[Checkout Error]:",c),alert(c.message||"Failed to open checkout. Please try again."),st()}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",K):K()})();
