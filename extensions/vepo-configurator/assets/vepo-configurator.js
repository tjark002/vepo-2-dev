/**
 * Vepo Product Configurator - Storefront JavaScript
 * All global names prefixed with "vepo" to avoid conflicts.
 * API endpoint: /apps/vepo
 * CSS prefix: .vepo_
 * Data attributes: data-vepo-*
 * LocalStorage key: vepoProductData
 * Cart attributes: _vepo_*
 */

(function () {
  "use strict";

  // ============================================================================
  // Globals
  // ============================================================================

  let vepoConfig = null;
  let vepoSettings = null;
  let vepoSelectedOptions = {};
  let vepoContainer = null;
  let vepoIsInitialRender = true; // Flag to prevent rules from running during initial render

  // ============================================================================
  // Init
  // ============================================================================

  function vepoInit() {
    vepoContainer = document.getElementById("vepo-configurator-block");
    if (!vepoContainer) return;

    const productId = vepoContainer.dataset.vepoProductId;
    if (!productId) return;

    vepoApplyStyles();
    vepoLoadConfig(productId);
  }

  function vepoApplyStyles() {
    if (!vepoContainer) return;
    const d = vepoContainer.dataset;

    vepoContainer.style.setProperty("--vepo-accent-color", d.vepoAccentColor || "#000");
    vepoContainer.style.setProperty("--vepo-btn-color", d.vepoBtnColor || "#000");
    vepoContainer.style.setProperty("--vepo-btn-text-color", d.vepoBtnTextColor || "#fff");
    vepoContainer.style.setProperty("--vepo-btn-font-size", (d.vepoBtnFontSize || 16) + "px");
    vepoContainer.style.setProperty("--vepo-btn-padding", (d.vepoBtnPadding || 12) + "px");
    vepoContainer.style.setProperty("--vepo-btn-radius", (d.vepoBtnRadius || 5) + "px");
    vepoContainer.style.setProperty(
      "--vepo-btn-full-width",
      d.vepoBtnFullWidth === "true" ? "100%" : "auto"
    );
    vepoContainer.style.setProperty("--vepo-input-bg", d.vepoInputBg || "#fff");
    vepoContainer.style.setProperty("--vepo-input-color", d.vepoInputColor || "#000");
    vepoContainer.style.setProperty("--vepo-input-radius", (d.vepoInputRadius || 5) + "px");
    vepoContainer.style.setProperty("--vepo-headline-color", d.vepoHeadlineColor || "#000");
    vepoContainer.style.setProperty("--vepo-headline-size", (d.vepoHeadlineSize || 16) + "px");
    vepoContainer.style.setProperty("--vepo-option-spacing", (d.vepoOptionSpacing || 16) + "px");
    vepoContainer.style.setProperty("--vepo-image-swatch-size", (d.vepoImageSwatchSize || 150) + "px");
    vepoContainer.style.setProperty("--vepo-required-color", d.vepoRequiredColor || "#ff0000");

    // Input style class
    var inputStyle = d.vepoInputStyle || "classic";
    vepoContainer.classList.remove("vepo_input_style--classic", "vepo_input_style--modern", "vepo_input_style--filled");
    vepoContainer.classList.add("vepo_input_style--" + inputStyle);

    // Hide surcharges
    if (d.vepoHideSurcharges === "true") {
      vepoContainer.classList.add("vepo_hide_surcharges");
    } else {
      vepoContainer.classList.remove("vepo_hide_surcharges");
    }
  }

  // ============================================================================
  // Load Configuration from App Proxy
  // ============================================================================

  async function vepoLoadConfig(productId) {
    try {
      let data = null;

      if (window.__vepoDataPromise) {
        data = await window.__vepoDataPromise;
        window.__vepoDataPromise = null;
      }

      if (!data) {
        try {
          const response = await fetch("/apps/vepo");
          if (response.ok) {
            data = await response.json();
          }
        } catch (e) { /* fall through to cache */ }
      }

      if (data) {
        localStorage.setItem(
          "vepoProductData",
          JSON.stringify({ data, timestamp: Date.now() })
        );
        vepoProcessConfig(data, productId);
        return;
      }

      var cached = localStorage.getItem("vepoProductData");
      if (cached) {
        var parsed = JSON.parse(cached);
        console.log("[Vepo] Network failed, using cached data");
        vepoProcessConfig(parsed.data, productId);
        return;
      }

      throw new Error("No data available");
    } catch (error) {
      console.error("[Vepo] Error loading config:", error);
      vepoContainer.innerHTML = "";
    }
  }

  function vepoProcessConfig(data, productId) {
    console.log("[Vepo] Processing config, productId:", productId);
    console.log("[Vepo] Data received:", JSON.stringify(data).substring(0, 500));

    if (!data || !data.productConfig) {
      console.log("[Vepo] No productConfig in data");
      vepoContainer.innerHTML = "";
      return;
    }

    vepoSettings = data.appSettings;

    // Find configuration for this product
    const gid = "gid://shopify/Product/" + productId;
    let matchedConfig = null;

    console.log("[Vepo] Looking for product GID:", gid);
    for (const config of data.productConfig) {
      console.log("[Vepo] Config:", config.title, "products:", JSON.stringify((config.configurableProducts || []).map(cp => cp.productId)));
      if (!config.configurableProducts) continue;
      for (const cp of config.configurableProducts) {
        if (cp.productId === gid) {
          matchedConfig = config;
          break;
        }
      }
      if (matchedConfig) break;
    }

    if (!matchedConfig) {
      console.log("[Vepo] No matching config found for this product");
      vepoContainer.innerHTML = "";
      return;
    }

    console.log("[Vepo] Matched config:", matchedConfig.title);
    vepoConfig = matchedConfig;

    // Order options
    let orderedOptions = matchedConfig.options || [];
    try {
      const order = JSON.parse(matchedConfig.optionOrder || "[]");
      if (order.length > 0) {
        const ordered = [];
        for (const id of order) {
          const opt = orderedOptions.find((o) => o.id === id);
          if (opt) ordered.push(opt);
        }
        for (const opt of orderedOptions) {
          if (!ordered.includes(opt)) ordered.push(opt);
        }
        orderedOptions = ordered;
      }
    } catch (e) {
      // Use default order
    }

    // Hide theme variant selectors for non-info modes
    if (matchedConfig.priceMode !== "info-only" && matchedConfig.priceMode !== "default") {
      vepoHideThemeVariantSelectors();
    }

    vepoRenderConfigurator(orderedOptions, matchedConfig);
  }

  // ============================================================================
  // Hide Theme Variant Selectors
  // ============================================================================

  function vepoHideThemeVariantSelectors() {
    // Hide variant selectors
    const variantSelectors = [
      'variant-radios',
      'variant-selects',
      '.product-form__input',
      '[data-section-type="product"] .selector-wrapper',
      '.product-single__variants',
      '.product__variants',
    ];

    for (const sel of variantSelectors) {
      const elements = document.querySelectorAll(sel);
      elements.forEach((el) => {
        if (el && !el.closest("#vepo-configurator-block")) {
          el.style.display = "none";
        }
      });
    }

    // Hide original product price display (common theme selectors)
    const priceSelectors = [
      '.price',
      '.product__price',
      '.product-price',
      '.product-single__price',
      '.price__container',
      '.price-container',
      '[data-product-price]',
      '.product-info__price',
      '.product__info-price',
      '.product-form__info-price',
      'price-per-item',
    ];

    for (const sel of priceSelectors) {
      const elements = document.querySelectorAll(sel);
      elements.forEach((el) => {
        if (el && !el.closest("#vepo-configurator-block")) {
          el.style.display = "none";
        }
      });
    }
  }

  // ============================================================================
  // Render Configurator
  // ============================================================================

  function vepoRenderConfigurator(options, config) {
    vepoContainer.innerHTML = "";
    vepoIsInitialRender = true; // Reset flag at start of render

    // In variant-price mode, force preselect, required, no multiselect on all selection options
    // so there's always a valid combination for price lookup
    // In price-formula mode, also preselect dimensionselect options so formulas have valid values
    const renderOptions = options.map((opt) => {
      if (
        config.priceMode === "variant-price" &&
        ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(opt.type)
      ) {
        return { ...opt, isPreselected: true, required: true, isMultiselect: false };
      }
      if (
        config.priceMode === "price-formula" &&
        opt.type === "dimensionselect"
      ) {
        return { ...opt, isPreselected: true };
      }
      return opt;
    });

    for (const option of renderOptions) {
      const optionEl = vepoRenderOption(option);
      if (optionEl) vepoContainer.appendChild(optionEl);
    }

    // Price preview for formula / variant-price modes
    if (config.priceMode === "price-formula" || config.priceMode === "variant-price") {
      const pricePreview = document.createElement("div");
      pricePreview.className = "vepo_price_preview";
      pricePreview.id = "vepo-price-preview";
      pricePreview.textContent = vepoFormatMoney(0);
      vepoContainer.appendChild(pricePreview);

      // Price subtext (e.g. "inkl. MwSt, zzgl. Versand")
      const priceSubtext = vepoContainer.dataset.vepoPriceSubtext;
      if (priceSubtext) {
        const subtextEl = document.createElement("div");
        subtextEl.className = "vepo_price_subtext";
        subtextEl.textContent = priceSubtext;
        vepoContainer.appendChild(subtextEl);
      }
    }

    // Quantity input
    const qtyStyle = vepoContainer.dataset.vepoQtyStyle || "simple";
    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "vepo_quantity vepo_quantity--" + qtyStyle;

    if (qtyStyle === "plus-minus") {
      qtyWrapper.innerHTML = `
        <label for="vepo-qty">Anzahl:</label>
        <div class="vepo_qty_controls">
          <button type="button" class="vepo_qty_btn vepo_qty_minus" aria-label="Menge verringern">&minus;</button>
          <input type="number" id="vepo-qty" value="1" min="1" />
          <button type="button" class="vepo_qty_btn vepo_qty_plus" aria-label="Menge erhöhen">&plus;</button>
        </div>
      `;
    } else if (qtyStyle === "stepper") {
      qtyWrapper.innerHTML = `
        <label for="vepo-qty">Anzahl:</label>
        <div class="vepo_qty_stepper">
          <button type="button" class="vepo_qty_stepper_btn vepo_qty_minus" aria-label="Menge verringern">&minus;</button>
          <span class="vepo_qty_stepper_value" id="vepo-qty-display">1</span>
          <input type="hidden" id="vepo-qty" value="1" />
          <button type="button" class="vepo_qty_stepper_btn vepo_qty_plus" aria-label="Menge erhöhen">&plus;</button>
        </div>
      `;
    } else {
      qtyWrapper.innerHTML = `
        <label for="vepo-qty">Anzahl:</label>
        <input type="number" id="vepo-qty" value="1" min="1" />
      `;
    }
    vepoContainer.appendChild(qtyWrapper);

    // Quantity +/- button handlers
    qtyWrapper.querySelectorAll(".vepo_qty_minus").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var input = document.getElementById("vepo-qty");
        var val = parseInt(input.value) || 1;
        if (val > 1) {
          input.value = val - 1;
          var display = document.getElementById("vepo-qty-display");
          if (display) display.textContent = val - 1;
        }
      });
    });
    qtyWrapper.querySelectorAll(".vepo_qty_plus").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var input = document.getElementById("vepo-qty");
        var val = parseInt(input.value) || 1;
        input.value = val + 1;
        var display = document.getElementById("vepo-qty-display");
        if (display) display.textContent = val + 1;
      });
    });

    // Add to Cart button
    const atcBtn = document.createElement("button");
    atcBtn.className = "vepo_atc_btn" + (vepoContainer.dataset.vepoBtnFullWidth === "true" ? " vepo_full_width" : "");
    atcBtn.textContent = "In den Warenkorb";
    atcBtn.id = "vepo-atc-btn";
    atcBtn.addEventListener("click", () => vepoSendConfig(config));
    vepoContainer.appendChild(atcBtn);

    // Apply rules initially (after all options are rendered)
    vepoApplyRules(config.rules || []);

    // Initial price calculation
    if (config.priceMode === "price-formula" || config.priceMode === "variant-price") {
      vepoUpdatePrice(config);
    }

    // Mark initial render as complete - rules will now be applied on user interactions
    vepoIsInitialRender = false;
  }

  // ============================================================================
  // Render individual option
  // ============================================================================

  function vepoRenderOption(option) {
    const wrapper = document.createElement("div");
    wrapper.className = "vepo_option";
    wrapper.id = "vepo-option-" + option.id;
    wrapper.dataset.vepoOptionName = option.name;
    wrapper.dataset.vepoOptionType = option.type;

    // Headline
    const headline = document.createElement("div");
    headline.className = "vepo_headline" + (option.required ? " vepo_required" : "");
    headline.textContent = option.name;

    if ((option.type === "text" || option.type === "file") &&
        option.hasAdditionalPrice && option.additionalPrice > 0 &&
        vepoConfig?.priceMode !== "variant-price" &&
        !vepoConfig?.surchargesInFormula) {
      const surcharge = document.createElement("span");
      surcharge.className = "vepo_surcharge";
      surcharge.textContent = "+" + vepoFormatMoney(option.additionalPrice);
      headline.appendChild(surcharge);
    }

    wrapper.appendChild(headline);

    // Description
    if (option.description) {
      const desc = document.createElement("div");
      desc.className = "vepo_description";
      desc.textContent = option.description;
      wrapper.appendChild(desc);
    }

    // Parse values
    let values = [];
    try {
      values = typeof option.values === "string" ? JSON.parse(option.values) : option.values || [];
    } catch (e) {
      values = [];
    }

    switch (option.type) {
      case "variantswatch":
        wrapper.appendChild(vepoRenderSwatches(option, values));
        break;
      case "dropdown":
        wrapper.appendChild(vepoRenderDropdown(option, values));
        break;
      case "colorswatch":
        wrapper.appendChild(vepoRenderColorSwatches(option, values));
        break;
      case "imageswatch":
        wrapper.appendChild(vepoRenderImageSwatches(option, values));
        break;
      case "dimension":
        wrapper.appendChild(vepoRenderDimension(option));
        break;
      case "dimensionselect":
        wrapper.appendChild(vepoRenderDimensionSelect(option, values));
        break;
      case "text":
        wrapper.appendChild(vepoRenderText(option));
        break;
      case "checkbox":
        wrapper.appendChild(vepoRenderCheckbox(option));
        break;
      case "date":
        wrapper.appendChild(vepoRenderDate(option));
        break;
      case "file":
        wrapper.appendChild(vepoRenderFileUpload(option));
        break;
    }

    return wrapper;
  }

  function vepoRenderSwatches(option, values) {
    const container = document.createElement("div");
    container.className = "vepo_swatches_container";

    values.forEach((val) => {
      const btn = document.createElement("button");
      btn.className = "vepo_button_swatch";
      btn.dataset.value = val.id || val.name;
      btn.textContent = val.name;
      if (val.surcharge && parseFloat(val.surcharge) > 0 &&
          vepoConfig?.priceMode !== "variant-price" &&
          !vepoConfig?.surchargesInFormula) {
        btn.innerHTML += `<span class="vepo_surcharge">+${val.surcharge}€</span>`;
      }
      btn.addEventListener("click", () => {
        if (option.isMultiselect) {
          btn.classList.toggle("vepo_selected");
        } else {
          container.querySelectorAll(".vepo_button_swatch").forEach((b) => b.classList.remove("vepo_selected"));
          btn.classList.add("vepo_selected");
        }
        vepoUpdateSelectedOptions(option, val.name, val.surcharge);
      });
      container.appendChild(btn);
    });

    if (option.isPreselected && values.length > 0) {
      const defaultVal = values.find((v) => v.isDefault) || values[0];
      const defaultIndex = values.indexOf(defaultVal);
      const buttons = container.querySelectorAll(".vepo_button_swatch");
      if (buttons[defaultIndex]) {
        buttons[defaultIndex].classList.add("vepo_selected");
        vepoUpdateSelectedOptions(option, defaultVal.name, defaultVal.surcharge);
      }
    }

    return container;
  }

  function vepoRenderDropdown(option, values) {
    const container = document.createElement("div");
    container.className = "vepo_dropdown_container";

    const select = document.createElement("select");
    select.className = "vepo_dropdown";
    select.id = "vepo-dropdown-" + option.id;

    // Add placeholder option if not preselected
    if (!option.isPreselected) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Bitte wählen...";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }

    values.forEach((val, index) => {
      const optionEl = document.createElement("option");
      optionEl.value = val.name;
      optionEl.dataset.value = val.id || val.name;
      optionEl.textContent = val.name;
      if (val.surcharge && parseFloat(val.surcharge) > 0 &&
          vepoConfig?.priceMode !== "variant-price" &&
          !vepoConfig?.surchargesInFormula) {
        optionEl.textContent += ` (+${val.surcharge}€)`;
      }
      optionEl.dataset.surcharge = val.surcharge || "0";
      
      const defaultVal = values.find((v) => v.isDefault);
      const isDefault = defaultVal ? val === defaultVal : index === 0;
      if (option.isPreselected && isDefault) {
        optionEl.selected = true;
      }
      
      select.appendChild(optionEl);
    });

    select.addEventListener("change", () => {
      const selectedOption = select.options[select.selectedIndex];
      const surcharge = selectedOption.dataset.surcharge || "0";
      vepoUpdateSelectedOptions(option, select.value, surcharge);
    });

    container.appendChild(select);

    if (option.isPreselected && values.length > 0) {
      const defaultVal = values.find((v) => v.isDefault) || values[0];
      vepoUpdateSelectedOptions(option, defaultVal.name, defaultVal.surcharge);
    }

    return container;
  }

  function vepoRenderColorSwatches(option, values) {
    const container = document.createElement("div");
    container.className = "vepo_color_swatches_container";

    values.forEach((val) => {
      const swatch = document.createElement("div");
      swatch.className = "vepo_color_swatch";
      swatch.dataset.value = val.id || val.name;
      swatch.style.cssText = `
        background-color: ${val.color || "#000"};
        width: 40px; height: 40px; min-width: 40px; min-height: 40px;
        border-radius: 50%; border: 2px solid #ddd;
        cursor: pointer; display: inline-block; flex-shrink: 0;
        visibility: visible; opacity: 1; overflow: visible;
        position: relative; z-index: 1;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
        transition: all 0.2s;
      `;
      swatch.title = val.name;
      swatch.addEventListener("click", () => {
        if (option.isMultiselect) {
          swatch.classList.toggle("vepo_selected");
        } else {
          container.querySelectorAll(".vepo_color_swatch").forEach((s) => s.classList.remove("vepo_selected"));
          swatch.classList.add("vepo_selected");
        }
        vepoUpdateSelectedOptions(option, val.name, val.surcharge);
      });
      container.appendChild(swatch);
    });

    if (option.isPreselected && values.length > 0) {
      const defaultVal = values.find((v) => v.isDefault) || values[0];
      const defaultIndex = values.indexOf(defaultVal);
      const swatches = container.querySelectorAll(".vepo_color_swatch");
      if (swatches[defaultIndex]) {
        swatches[defaultIndex].classList.add("vepo_selected");
      }
      vepoUpdateSelectedOptions(option, defaultVal.name, defaultVal.surcharge);
    }

    return container;
  }

  function vepoRenderImageSwatches(option, values) {
    const container = document.createElement("div");
    container.className = "vepo_image_swatch_container";

    values.forEach((val) => {
      const swatch = document.createElement("div");
      swatch.className = "vepo_image_swatch";
      swatch.dataset.value = val.id || val.name;

      if (val.imageUrl) {
        const img = document.createElement("img");
        img.src = val.imageUrl;
        img.alt = val.name;
        img.loading = "lazy";
        swatch.appendChild(img);
      }

      const label = document.createElement("div");
      label.className = "vepo_image_swatch_label";
      label.textContent = val.name;
      swatch.appendChild(label);

      swatch.addEventListener("click", () => {
        if (option.isMultiselect) {
          swatch.classList.toggle("vepo_selected");
        } else {
          container.querySelectorAll(".vepo_image_swatch").forEach((s) => s.classList.remove("vepo_selected"));
          swatch.classList.add("vepo_selected");
        }
        vepoUpdateSelectedOptions(option, val.name, val.surcharge);
      });
      container.appendChild(swatch);
    });

    if (option.isPreselected && values.length > 0) {
      const defaultVal = values.find((v) => v.isDefault) || values[0];
      const defaultIndex = values.indexOf(defaultVal);
      const swatches = container.querySelectorAll(".vepo_image_swatch");
      if (swatches[defaultIndex]) {
        swatches[defaultIndex].classList.add("vepo_selected");
      }
      vepoUpdateSelectedOptions(option, defaultVal.name, defaultVal.surcharge);
    }

    return container;
  }

  function vepoRenderDimension(option) {
    const wrapper = document.createElement("div");
    wrapper.className = "vepo_dimension_wrapper";

    const input = document.createElement("input");
    input.type = "number";
    input.className = "vepo_dimension_input";
    
    // Determine initial value: prefer default, fall back to min value for formula variables
    let initialValue = option.default || "";
    if (!initialValue && option.min !== undefined && option.min !== "") {
      initialValue = option.min;
    }
    
    input.value = initialValue;
    input.min = option.min || "";
    input.max = option.max || "";
    if (option.decimalPlaces >= 0) {
      input.step = Math.pow(10, -option.decimalPlaces).toString();
    } else {
      input.step = "any";
    }
    input.placeholder = option.placeholder || option.name;

    // Validate min/max on input
    input.addEventListener("input", () => {
      vepoUpdateSelectedOptions(option, input.value);
    });

    // Enforce min/max when user finishes typing (blur) or changes value
    input.addEventListener("blur", () => {
      vepoEnforceDimensionLimits(input, option);
    });

    input.addEventListener("change", () => {
      vepoEnforceDimensionLimits(input, option);
    });

    wrapper.appendChild(input);

    if (option.unit) {
      const unit = document.createElement("span");
      unit.className = "vepo_unit_suffix";
      unit.textContent = option.unit;
      wrapper.appendChild(unit);
    }

    // Set initial value if we have one (default or min)
    if (initialValue) {
      vepoUpdateSelectedOptions(option, String(initialValue));
    }

    return wrapper;
  }

  function vepoRenderDimensionSelect(option, values) {
    const container = document.createElement("div");
    container.className = "vepo_swatches_container";

    values.forEach((val) => {
      const btn = document.createElement("button");
      btn.className = "vepo_button_swatch";
      btn.dataset.value = val.id || val.name || String(val.numericValue);
      // Show name if available, otherwise show numeric value with unit
      const displayText = val.name || (val.numericValue + (option.unit ? " " + option.unit : ""));
      btn.textContent = displayText;
      btn.dataset.numericValue = val.numericValue;

      btn.addEventListener("click", () => {
        container.querySelectorAll(".vepo_button_swatch").forEach((b) => b.classList.remove("vepo_selected"));
        btn.classList.add("vepo_selected");
        // Store the numeric value for formula calculation
        vepoUpdateSelectedOptions(option, val.numericValue);
      });
      container.appendChild(btn);
    });

    if (option.isPreselected && values.length > 0) {
      const defaultVal = values.find((v) => v.isDefault) || values[0];
      const defaultIndex = values.indexOf(defaultVal);
      const buttons = container.querySelectorAll(".vepo_button_swatch");
      if (buttons[defaultIndex]) {
        buttons[defaultIndex].classList.add("vepo_selected");
        vepoUpdateSelectedOptions(option, defaultVal.numericValue);
      }
    }

    return container;
  }

  function vepoRenderText(option) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "vepo_textinput";
    input.placeholder = option.placeholder || "";
    if (option.maxLength > 0) {
      input.maxLength = option.maxLength;
    }
    input.addEventListener("input", () => {
      vepoUpdateSelectedOptions(option, input.value, option.additionalPrice);
    });
    return input;
  }

  function vepoRenderCheckbox(option) {
    const label = document.createElement("label");
    label.className = "vepo_checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      vepoUpdateSelectedOptions(option, input.checked ? "Ja" : "");
    });
    label.appendChild(input);

    const text = document.createElement("span");
    text.textContent = option.checkBoxLabel || option.name;
    if (option.hasAdditionalPrice && option.additionalPrice > 0 &&
        vepoConfig?.priceMode !== "variant-price" &&
        !vepoConfig?.surchargesInFormula) {
      text.innerHTML += `<span class="vepo_surcharge">+${option.additionalPrice}€</span>`;
    }
    label.appendChild(text);

    return label;
  }

  function vepoRenderDate(option) {
    const input = document.createElement("input");
    input.type = "date";
    input.className = "vepo_dateinput";
    if (!option.allowAllDates) {
      if (option.minDate) input.min = option.minDate;
      if (option.maxDate) input.max = option.maxDate;
    }
    input.addEventListener("change", () => {
      vepoUpdateSelectedOptions(option, input.value);
    });

    // Enforce min/max when user finishes typing (blur) or changes value
    input.addEventListener("blur", () => {
      vepoEnforceDateLimits(input, option);
    });

    input.addEventListener("change", () => {
      vepoEnforceDateLimits(input, option);
    });

    return input;
  }

  // ============================================================================
  // Date Validation
  // ============================================================================

  function vepoEnforceDateLimits(input, option) {
    if (!input.value || option.allowAllDates) return;

    const enteredDate = new Date(input.value);
    if (isNaN(enteredDate.getTime())) return;

    let clamped = false;

    if (option.minDate) {
      const minDate = new Date(option.minDate);
      if (enteredDate < minDate) {
        input.value = option.minDate;
        clamped = true;
      }
    }

    if (option.maxDate) {
      const maxDate = new Date(option.maxDate);
      if (enteredDate > maxDate) {
        input.value = option.maxDate;
        clamped = true;
      }
    }

    if (clamped) {
      // Update state with corrected value
      vepoUpdateSelectedOptions(option, input.value);

      // Brief visual feedback
      input.classList.add("vepo_date_clamped");
      setTimeout(() => {
        input.classList.remove("vepo_date_clamped");
      }, 300);
    }
  }

  function vepoRenderFileUpload(option) {
    const wrapper = document.createElement("div");
    wrapper.className = "vepo_fileupload";
    wrapper.textContent = "Datei auswählen oder hierher ziehen";

    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    if (option.allowedFileTypes) {
      input.accept = option.allowedFileTypes;
    }

    function handleFile(file) {
      if (option.allowedFileTypes) {
        var allowed = option.allowedFileTypes.split(",").map(function(t) { return t.trim().toLowerCase(); });
        var ext = "." + file.name.split(".").pop().toLowerCase();
        var mime = file.type.toLowerCase();
        var match = allowed.some(function(a) {
          return a === ext || a === mime || (a.endsWith("/*") && mime.startsWith(a.replace("/*", "/")));
        });
        if (!match) return;
      }
      // Transfer file to input for form submission
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      wrapper.textContent = file.name;
      wrapper.appendChild(input);
      vepoUpdateSelectedOptions(option, file.name, option.additionalPrice);
    }

    input.addEventListener("change", function() {
      if (input.files.length > 0) {
        handleFile(input.files[0]);
      }
    });

    wrapper.addEventListener("click", function() { input.click(); });

    // Drag & Drop
    wrapper.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.add("vepo_fileupload_dragover");
    });

    wrapper.addEventListener("dragleave", function(e) {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove("vepo_fileupload_dragover");
    });

    wrapper.addEventListener("drop", function(e) {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove("vepo_fileupload_dragover");
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  // ============================================================================
  // Dimension Validation
  // ============================================================================

  function vepoEnforceDimensionLimits(input, option) {
    let value = parseFloat(input.value);
    if (isNaN(value)) return;

    const min = option.min !== undefined && option.min !== "" ? parseFloat(option.min) : null;
    const max = option.max !== undefined && option.max !== "" ? parseFloat(option.max) : null;

    let clamped = false;

    if (min !== null && value < min) {
      value = min;
      clamped = true;
    }

    if (max !== null && value > max) {
      value = max;
      clamped = true;
    }

    if (clamped) {
      // Apply decimal places if specified
      if (option.decimalPlaces >= 0) {
        input.value = value.toFixed(option.decimalPlaces);
      } else {
        input.value = value;
      }
      // Update state with corrected value
      vepoUpdateSelectedOptions(option, input.value);

      // Brief visual feedback
      input.classList.add("vepo_dimension_clamped");
      setTimeout(() => {
        input.classList.remove("vepo_dimension_clamped");
      }, 300);
    }
  }

  // ============================================================================
  // State Management
  // ============================================================================

  function vepoUpdateSelectedOptions(option, value, surcharge) {
    vepoSelectedOptions[option.name] = {
      name: option.name,
      type: option.type,
      value: value,
      readable: value,
      surcharge: parseFloat(surcharge) || 0,
      required: option.required,
      optionId: option.id,
    };

    // Recalculate price and apply rules (but not during initial render)
    if (vepoConfig && !vepoIsInitialRender) {
      vepoUpdatePrice(vepoConfig);
      vepoApplyRules(vepoConfig.rules || []);
    }
  }

  // ============================================================================
  // Price Calculation
  // ============================================================================

  function vepoUpdatePrice(config) {
    const previewEl = document.getElementById("vepo-price-preview");
    if (!previewEl) return;

    if (config.priceMode === "price-formula") {
      let formula = config.priceFormula;

      for (const [name, opt] of Object.entries(vepoSelectedOptions)) {
        const regex = new RegExp("\\[" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g");
        if (opt.type === "dimension" || opt.type === "dimensionselect") {
          formula = formula.replace(regex, "(" + (opt.value || "0") + ")");
        } else if (config.surchargesInFormula) {
          formula = formula.replace(regex, "(" + String(opt.surcharge || 0) + ")");
        }
      }

      formula = formula.replace(/\)\(/g, ")*(");
      formula = formula.replace(/(\d)\(/g, "$1*(");
      formula = formula.replace(/\)(\d)/g, ")*$1");
      formula = formula.replace(/,/g, ".").replace(/x/gi, "*").replace(/÷/g, "/").replace(/%/g, "/100");
      // Translate: √(...) → Math.sqrt(...), ² → **2
      formula = formula.replace(/√\(/g, "Math.sqrt(");
      formula = formula.replace(/²/g, "**2");
      // Remove any remaining invalid characters
      formula = formula.replace(/[^\d+\-*/().Mathsqrt ]/g, "");

      let price = 0;
      try {
        price = new Function(`"use strict"; return (${formula})`)();
        if (isNaN(price) || !isFinite(price)) price = 0;
      } catch (e) {
        price = 0;
      }

      if (!config.surchargesInFormula) {
        for (const opt of Object.values(vepoSelectedOptions)) {
          if (opt.surcharge > 0) {
            price += opt.surcharge;
          }
        }
      }

      // Apply minimum price if set
      if (config.minimumPrice > 0) {
        price = Math.max(price, config.minimumPrice);
      }

      // Apply rounding if enabled
      if (config.roundingEnabled && config.roundingPrecision) {
        const precision = parseFloat(config.roundingPrecision) || 1;
        price = Math.round(price / precision) * precision;
      }

      price = Math.round(price * 100) / 100;
      previewEl.textContent = vepoFormatMoney(price);
      previewEl.dataset.vepoPrice = price;
    } else if (config.priceMode === "variant-price") {
      // Look up variant price
      const handle = Object.values(vepoSelectedOptions)
        .filter((o) => ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(o.type))
        .map((o) => o.value)
        .join(" / ");

      const variant = (config.virtualVariants || []).find((v) => v.variantHandle === handle);
      // In variant-price mode, surcharges are already baked into the variant price
      let price = variant ? variant.variantPrice : config.basePrice || 0;

      price = Math.round(price * 100) / 100;
      previewEl.textContent = vepoFormatMoney(price);
      previewEl.dataset.vepoPrice = price;
    }
  }

  function vepoFormatMoney(amount) {
    const currency = vepoContainer?.dataset.vepoCurrency || "EUR";
    try {
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: currency,
      }).format(amount);
    } catch (e) {
      return amount.toFixed(2) + " €";
    }
  }

  // ============================================================================
  // Rules Engine
  // ============================================================================

  function vepoCheckConditions(conditions) {
    for (const condition of conditions || []) {
      const optionEl = document.getElementById("vepo-option-" + condition.optionId);
      if (!optionEl) return false;

      const optionName = optionEl.dataset.vepoOptionName;
      const selectedOpt = vepoSelectedOptions[optionName];
      const selectedValue = String(selectedOpt ? selectedOpt.value : "");
      const conditionValue = String(condition.value);

      switch (condition.operator) {
        case "equals":
          if (selectedValue !== conditionValue) return false;
          break;
        case "not-equals":
          if (selectedValue === conditionValue) return false;
          break;
        case "greater-than":
          if (parseFloat(selectedValue) <= parseFloat(conditionValue)) return false;
          break;
        case "less-than":
          if (parseFloat(selectedValue) >= parseFloat(conditionValue)) return false;
          break;
        case "contains":
          if (!selectedValue.includes(conditionValue)) return false;
          break;
      }
    }
    return true;
  }

  function vepoApplyRules(rules) {
    if (!rules || rules.length === 0) return;

    // Track visibility state for options and specific swatches
    // Key: "option-{id}" or "swatch-{optionId}-{valueId}"
    // Value: { show: boolean, priority: number }
    const visibilityState = {};

    // Sort rules by priority (lower first, so higher priority rules can override)
    const sortedRules = [...rules].sort((a, b) => (a.priority || 0) - (b.priority || 0));

    for (const rule of sortedRules) {
      const allConditionsMet = vepoCheckConditions(rule.conditions);

      // Only apply the rule when its conditions are met.
      // When conditions aren't met, the rule has no effect — this allows
      // multiple rules targeting the same element to work independently.
      if (!allConditionsMet) continue;

      const key = rule.targetValueId
        ? "swatch-" + rule.targetOptionId + "-" + rule.targetValueId
        : "option-" + rule.targetOptionId;

      visibilityState[key] = { show: rule.show, priority: rule.priority || 0 };
    }

    // Reset all ruled elements to visible, then apply matched rules
    for (const rule of rules) {
      const key = rule.targetValueId
        ? "swatch-" + rule.targetOptionId + "-" + rule.targetValueId
        : "option-" + rule.targetOptionId;
      if (!(key in visibilityState)) {
        visibilityState[key] = { show: true, priority: 0 };
      }
    }

    // Apply visibility state to DOM
    for (const [key, state] of Object.entries(visibilityState)) {
      if (key.startsWith("option-")) {
        const optionId = key.replace("option-", "");
        const targetEl = document.getElementById("vepo-option-" + optionId);
        if (targetEl) {
          targetEl.classList.toggle("vepo_hidden", !state.show);
        }
      } else if (key.startsWith("swatch-")) {
        const parts = key.replace("swatch-", "").split("-");
        const optionId = parts[0];
        const valueId = parts.slice(1).join("-");
        
        const optionEl = document.getElementById("vepo-option-" + optionId);
        if (optionEl) {
          const swatches = optionEl.querySelectorAll(".vepo_button_swatch, .vepo_color_swatch, .vepo_image_swatch, .vepo_dropdown option");
          swatches.forEach((swatch) => {
            const swatchValue = swatch.dataset.value || swatch.dataset.numericValue || swatch.textContent?.trim() || swatch.value;
            if (swatchValue === valueId) {
              swatch.classList.toggle("vepo_hidden", !state.show);
              if (swatch.tagName === "OPTION") {
                swatch.hidden = !state.show;
                swatch.disabled = !state.show;
              }
            }
          });
        }
      }
    }
  }

  // ============================================================================
  // Add to Cart
  // ============================================================================

  async function vepoSendConfig(config) {
    const atcBtn = document.getElementById("vepo-atc-btn");
    if (!atcBtn) return;

    // Validate required options
    let hasError = false;
    for (const option of config.options || []) {
      const optionEl = document.getElementById("vepo-option-" + option.id);
      if (!optionEl || optionEl.classList.contains("vepo_hidden")) continue;

      if (option.required) {
        const selected = vepoSelectedOptions[option.name];
        if (!selected || !selected.value) {
          optionEl.classList.add("vepo_error");
          hasError = true;
        } else {
          optionEl.classList.remove("vepo_error");
        }
      }
    }

    if (hasError) return;

    atcBtn.disabled = true;
    atcBtn.textContent = "Wird hinzugefügt...";

    const productId = vepoContainer.dataset.vepoProductId;
    const quantity = parseInt(document.getElementById("vepo-qty")?.value) || 1;

    try {
      if (config.priceMode === "info-only" || config.priceMode === "default") {
        // Info mode: add to cart with properties only
        await vepoAddToCartInfoMode(productId, quantity, config);
      } else {
        // Price formula or variant price: create variant first
        await vepoAddToCartWithVariant(productId, quantity, config);
      }
    } catch (error) {
      console.error("[Vepo] Error adding to cart:", error);
      atcBtn.textContent = "Fehler - Bitte erneut versuchen";
      setTimeout(() => {
        atcBtn.textContent = "In den Warenkorb";
        atcBtn.disabled = false;
      }, 3000);
    }
  }

  async function vepoAddToCartInfoMode(productId, quantity, config) {
    const variantId = vepoContainer.dataset.vepoVariantId;
    const properties = vepoCollectProperties();

    const formData = {
      items: [{
        id: variantId,
        quantity: quantity,
        properties: properties,
      }],
    };

    const response = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Vepo] Cart add failed:", response.status, errorData);
      throw new Error(`Failed to add to cart: ${errorData.description || response.status}`);
    }

    vepoHandlePostCart(config);
  }

  async function vepoAddToCartWithVariant(productId, quantity, config) {
    const pricePreview = document.getElementById("vepo-price-preview");
    const price = pricePreview?.dataset.vepoPrice || "0";

    // Build config string for variant creation
    const configArray = Object.values(vepoSelectedOptions).map((opt) => ({
      name: opt.name,
      values: opt.value,
      readable: opt.readable,
      surcharge: opt.surcharge,
    }));

    const params = new URLSearchParams({
      productId: productId,
      config: JSON.stringify(configArray),
      p: price,
    });

    const response = await fetch("/apps/vepo/create?" + params.toString());
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[Vepo] Create variant failed:", response.status, errorBody);
      throw new Error("Failed to create variant");
    }

    const data = await response.json();
    console.log("[Vepo] Create variant response:", JSON.stringify(data));
    const variantID = data.productVariantID;
    const variantAlreadyExisted = data.variantAlreadyExists === true;
    const variantWasUpdated = data.variantWasUpdated === true;

    if (!variantID) throw new Error("No variant ID returned");

    // Extract numeric ID from GID
    const numericId = variantID.replace("gid://shopify/ProductVariant/", "");
    console.log("[Vepo] Variant ID:", variantID, "Numeric:", numericId,
      "Existed:", variantAlreadyExisted, "Updated:", variantWasUpdated);

    // If variant was just created or updated, Shopify needs time to index it.
    // Without this delay, /cart/add.js may return "sold out" temporarily.
    if (variantWasUpdated || !variantAlreadyExisted) {
      console.log("[Vepo] Variant was created/updated, waiting for Shopify indexing...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const properties = vepoCollectProperties();

    const cartData = {
      items: [{
        id: numericId,
        quantity: quantity,
        properties: properties,
      }],
    };

    // Retry cart add with escalating delays as safety net
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        const delay = attempt * 1500;
        console.log("[Vepo] Retrying cart add, attempt " + attempt + "/" + maxRetries + " (waiting " + delay + "ms)");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const cartResponse = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cartData),
      });

      if (cartResponse.ok) {
        vepoHandlePostCart(config);
        return;
      }

      const errorBody = await cartResponse.text().catch(() => "");
      console.error("[Vepo] Cart add attempt " + attempt + " failed:", cartResponse.status, errorBody);
      lastError = errorBody;
    }

    throw new Error("Failed to add to cart: " + (lastError || "unknown error"));
  }

  function vepoCollectProperties() {
    const properties = {};
    for (const [name, opt] of Object.entries(vepoSelectedOptions)) {
      if (opt.value) {
        properties[name] = opt.value;
        if (opt.unit) {
          properties[name] += " " + opt.unit;
        }
      }
    }
    return properties;
  }

  function vepoHandlePostCart(config) {
    const atcBtn = document.getElementById("vepo-atc-btn");

    if (config.redirectToDifferentPage && config.redirectLink) {
      window.location.href = config.redirectLink;
    } else {
      window.location.href = "/cart";
    }
  }

  // ============================================================================
  // Start
  // ============================================================================

  vepoInit();
})();
