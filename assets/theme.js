document.addEventListener('DOMContentLoaded', function() {
  initVariantSelection();
  initAjaxCart();
  initAccordions();
  initCartDrawerEvents();
});

/* Sizing dropdown & variant matching */
function initVariantSelection() {
  document.querySelectorAll('.PI__select').forEach(select => {
    const placeholderText = select.parentNode.querySelector('.PI__placeholder-text');
    
    // Set initial text
    if (placeholderText && select.options.length > 0) {
      placeholderText.textContent = select.options[select.selectedIndex].text;
    }

    select.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      
      // Update custom overlay text
      if (placeholderText) {
        placeholderText.textContent = selectedOption.text;
      }

      // Check variant availability
      const form = this.closest('form');
      const submitBtn = form.querySelector('.add-to-cart-submit-btn');
      if (submitBtn) {
        const isAvailable = selectedOption.getAttribute('data-available') === 'true';
        if (isAvailable) {
          submitBtn.removeAttribute('disabled');
          submitBtn.textContent = 'ADD TO CART';
        } else {
          submitBtn.setAttribute('disabled', 'disabled');
          submitBtn.textContent = 'SOLD OUT';
        }
      }

      // Option: Update price tag dynamically if prices differ per size
      const priceTag = form.closest('.product-details-wrapper, .product-section-inner')?.querySelector('.product-price-tag');
      const priceStr = selectedOption.getAttribute('data-price-formatted');
      if (priceTag && priceStr) {
        priceTag.textContent = priceStr;
      }
    });
  });
}

/* AJAX Cart additions */
function initAjaxCart() {
  document.addEventListener('submit', function(e) {
    const form = e.target.closest('.product-ajax-form');
    if (!form) return;

    e.preventDefault();

    const submitBtn = form.querySelector('.add-to-cart-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.setAttribute('disabled', 'disabled');
    submitBtn.textContent = 'ADDING...';

    const formData = new FormData(form);

    fetch('/cart/add.js', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Add to cart failed');
      }
      return response.json();
    })
    .then(data => {
      // Success adding - refresh cart drawer using Section Rendering API
      refreshCartDrawer(true);
    })
    .catch(error => {
      console.error('Error adding to cart:', error);
      alert('Could not add item to cart. Please try again.');
    })
    .finally(() => {
      submitBtn.removeAttribute('disabled');
      submitBtn.textContent = originalText;
    });
  });
}

/* Refresh the cart drawer dynamically */
function refreshCartDrawer(openDrawerAfter = false) {
  fetch('/?sections=cart-drawer')
    .then(response => response.json())
    .then(sections => {
      const htmlString = sections['cart-drawer'];
      if (!htmlString) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      const newDrawerContent = doc.getElementById('CartDrawerContent');
      const currentDrawerContent = document.getElementById('CartDrawerContent');
      if (newDrawerContent && currentDrawerContent) {
        currentDrawerContent.innerHTML = newDrawerContent.innerHTML;
      }

      // Update cart count badge
      const headerCartCount = document.querySelector('.site-header .cart-count');
      
      let totalCount = 0;
      doc.querySelectorAll('.qty-adjust-input').forEach(input => {
        totalCount += parseInt(input.value) || 0;
      });

      if (headerCartCount) {
        headerCartCount.textContent = totalCount;
      }

      bindDrawerInteractiveEvents();

      if (openDrawerAfter) {
        openCartDrawer();
      }
    })
    .catch(error => {
      console.error('Error updating cart drawer:', error);
    });
}

/* Open/Close drawer functions */
function openCartDrawer() {
  const drawer = document.getElementById('CartDrawer');
  if (drawer) {
    drawer.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('CartDrawer');
  if (drawer) {
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

/* Cart Drawer Bindings */
function initCartDrawerEvents() {
  document.addEventListener('click', function(e) {
    if (e.target.id === 'CartToggle') {
      e.preventDefault();
      openCartDrawer();
    }
    if (e.target.id === 'CartDrawerClose' || e.target.id === 'CartDrawerBackdrop') {
      closeCartDrawer();
    }
  });

  bindDrawerInteractiveEvents();
}

/* Bind item additions/subtractions in drawer */
function bindDrawerInteractiveEvents() {
  const drawerContent = document.getElementById('CartDrawerContent');
  if (!drawerContent) return;

  drawerContent.querySelectorAll('.qty-adjust-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentNode.querySelector('.qty-adjust-input');
      const lineIndex = input.getAttribute('data-line-item-index');
      const delta = parseInt(this.getAttribute('data-qty-delta'));
      const currentVal = parseInt(input.value) || 0;
      
      const newVal = Math.max(0, currentVal + delta);
      input.value = newVal;

      updateLineItemQuantity(lineIndex, newVal);
    });
  });

  drawerContent.querySelectorAll('.qty-adjust-input').forEach(input => {
    input.addEventListener('change', function() {
      const lineIndex = this.getAttribute('data-line-item-index');
      const newVal = Math.max(0, parseInt(this.value) || 0);
      updateLineItemQuantity(lineIndex, newVal);
    });
  });

  drawerContent.querySelectorAll('.cart-drawer-item-remove-link').forEach(link => {
    link.addEventListener('click', function() {
      const lineIndex = this.getAttribute('data-remove-line-index');
      updateLineItemQuantity(lineIndex, 0);
    });
  });
}

function updateLineItemQuantity(lineIndex, quantity) {
  const drawerContent = document.getElementById('CartDrawerContent');
  if (drawerContent) {
    drawerContent.style.opacity = '0.5';
  }

  fetch('/cart/change.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      line: lineIndex,
      quantity: quantity
    })
  })
  .then(response => response.json())
  .then(data => {
    refreshCartDrawer(false);
  })
  .catch(error => {
    console.error('Error updating cart quantity:', error);
  })
  .finally(() => {
    if (drawerContent) {
      drawerContent.style.opacity = '1';
    }
  });
}

/* Accordions for Product detail disclosures */
function initAccordions() {
  document.addEventListener('click', function(e) {
    const toggle = e.target.closest('.desc-accordion-toggle');
    if (!toggle) return;

    const accordion = toggle.closest('.product-desc-accordion');
    const content = accordion.querySelector('.desc-accordion-content');

    if (accordion.classList.contains('active')) {
      accordion.classList.remove('active');
      content.style.maxHeight = '0px';
    } else {
      const productBlock = accordion.closest('.product-details-wrapper');
      if (productBlock) {
        productBlock.querySelectorAll('.product-desc-accordion.active').forEach(activeAcc => {
          activeAcc.classList.remove('active');
          activeAcc.querySelector('.desc-accordion-content').style.maxHeight = '0px';
        });
      }

      accordion.classList.add('active');
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
}

/* Size Chart Unit Toggle Listener */
document.addEventListener('click', function(e) {
  const toggleBtn = e.target.closest('.unit-toggle-btn');
  if (!toggleBtn) return;
  
  const container = toggleBtn.closest('.product-desc-accordion');
  if (!container) return;
  
  container.querySelectorAll('.unit-toggle-btn').forEach(btn => btn.classList.remove('active'));
  toggleBtn.classList.add('active');
  
  const unit = toggleBtn.getAttribute('data-unit');
  const cmTable = container.querySelector('.size-chart-table.unit-cm');
  const inchTable = container.querySelector('.size-chart-table.unit-inch');
  const content = container.querySelector('.desc-accordion-content');
  
  if (unit === 'cm') {
    if (cmTable) cmTable.style.display = 'table';
    if (inchTable) inchTable.style.display = 'none';
  } else {
    if (cmTable) cmTable.style.display = 'none';
    if (inchTable) inchTable.style.display = 'table';
  }
  
  // Update accordion height to prevent clipping
  if (content && container.classList.contains('active')) {
    content.style.maxHeight = content.scrollHeight + 'px';
  }
});

