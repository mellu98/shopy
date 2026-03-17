import type {
  MerchantConfig,
  BenefitItem,
  ReviewItem,
  FaqItem,
  ComparisonItem,
  ImageTextSection,
} from "~/types";

/**
 * Generates Shopify JSON templates based on the master structure,
 * substituting merchant-specific content.
 */

// ─── Utility: generate random block IDs like Shopify does ───
function blockId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${id}`;
}

// ─── Product Landing Page Template ───────────────────────────
export function buildProductTemplate(config: MerchantConfig): object {
  const sections: Record<string, any> = {};
  const order: string[] = [];

  // ── 1. MAIN PRODUCT SECTION (uses theme's main-product section) ──
  const mainBlocks: Record<string, any> = {};
  const mainBlockOrder: string[] = [];

  // Testimonial images block (social proof at top)
  const testimonialsId = blockId("testimonial_images");
  mainBlocks[testimonialsId] = {
    type: "testimonial-images",
    settings: {
      image_size: 1,
      image_space: -18,
      hide_img_2: true,
      hide_img_3: true,
      hide_img_4: true,
      hide_img_5: true,
      text_block: `<p>⭐⭐⭐⭐⭐ ${config.reviewRating} su 5</p>`,
      text_size: 13,
      text_style: "body",
    },
  };
  mainBlockOrder.push(testimonialsId);

  // Title
  const titleId = blockId("title");
  mainBlocks[titleId] = {
    type: "title",
    settings: { title_size: 28, title_height: 120, text_transform: "none" },
  };
  mainBlockOrder.push(titleId);

  // Subtitle
  if (config.product.subtitle) {
    const subtitleId = blockId("pp_text");
    mainBlocks[subtitleId] = {
      type: "pp_text",
      settings: {
        text: config.product.subtitle,
        text_style: "subtitle",
      },
    };
    mainBlockOrder.push(subtitleId);
  }

  // Price
  const priceId = blockId("price");
  mainBlocks[priceId] = {
    type: "price",
    settings: {
      price_style: "price",
      price_size: 20,
      badge_text_1: 13,
      price_first: false,
      badge_bg_1: "#ffffff",
      badge_price_1: "#cc0d39",
      price_size_2: 1,
      badge_price: "#8b8d8f",
      price_bold_2: false,
      sale_price_color: "#3b3b3b",
      regular_price_color: "#212121",
      price_bold: true,
      badge_hide: false,
      taxes_hide: true,
      shipping_hide: false,
      padding_top: 4,
      padding_bottom: 4,
    },
  };
  mainBlockOrder.push(priceId);

  // Benefits (emoji + text)
  for (const benefit of config.product.benefits) {
    const bId = blockId("benefit");
    mainBlocks[bId] = {
      type: "pp_text",
      settings: {
        text: `${benefit.emoji} ${benefit.text}`,
        text_style: "body",
      },
    };
    mainBlockOrder.push(bId);
  }

  // FOMO counter
  const fomoId = blockId("fomo");
  mainBlocks[fomoId] = {
    type: "fomo",
    settings: {
      fomo_text_before: "(x) Visitatori",
      text_style: "body",
      text_size: 14,
      color_scheme: "background-1",
      fomo_border_activate: false,
      fomo_border: 0,
      fomo_border_color: "#efefef",
      pill_color: "#fd0234",
      fomo_min: 5,
      fomo_max: 9,
      fomo_speed: 3,
      padding_top: 12,
      padding_bottom: 12,
      margin_top: 36,
      margin_bottom: 36,
    },
  };
  mainBlockOrder.push(fomoId);

  // Variant picker
  const variantId = blockId("variant_picker");
  mainBlocks[variantId] = {
    type: "variant_picker",
    disabled: true,
    settings: {
      picker_type: "button",
      label_style: "body",
      font_size: 14,
      font_style: "normal",
      swatchType: "color",
      optionName: "Color",
      swatchStyle: "round",
      swatchSize: 30,
      swatchHeight: 30,
      size_trigger: "",
      chart_id: "Size Chart",
      size_page: "",
    },
  };
  mainBlockOrder.push(variantId);

  // Buy buttons
  const buyId = blockId("buy_buttons");
  mainBlocks[buyId] = {
    type: "buy_buttons",
    settings: {
      show_dynamic_checkout: true,
      show_full_button: true,
      lm_main_button: config.colors.buttonBg,
      lm_main_button_gr: "",
      lm_main_text: config.colors.buttonText,
      lm_button_animation: "glowing",
      show_gift_card_recipient: true,
      skip_cart: true,
      cart_text: config.cta.mainButtonText || "Add to Cart",
    },
  };
  mainBlockOrder.push(buyId);

  // Payment icons
  const paymentId = blockId("payment");
  mainBlocks[paymentId] = {
    type: "payment",
    settings: {
      original: "custom",
      payment_icon: "visa,master,paypal,apple_pay,shopify-pay,google-pay",
      payment_content_alignment: "center",
    },
  };
  mainBlockOrder.push(paymentId);

  // Icons with text (guarantees)
  const iconsId = blockId("icons_with_text");
  mainBlocks[iconsId] = {
    type: "pp_icons_with_text",
    settings: {
      icons_size: 30,
      guarantee_1_icon: config.guarantees.icon1,
      guarantee_1_text: config.guarantees.text1,
      guarantee_2_icon: config.guarantees.icon2,
      guarantee_2_text: config.guarantees.text2,
      guarantee_3_icon: config.guarantees.icon3,
      guarantee_3_text: config.guarantees.text3,
    },
  };
  mainBlockOrder.push(iconsId);

  // Divider
  const div1Id = blockId("pp_divider");
  mainBlocks[div1Id] = { type: "pp_divider", settings: {} };
  mainBlockOrder.push(div1Id);

  // Review block (single featured review)
  if (config.reviews.length > 0) {
    const featuredReview = config.reviews[0];
    const reviewBlockId = blockId("review_block");
    mainBlocks[reviewBlockId] = {
      type: "pp_review_block",
      settings: {
        rating: featuredReview.rating,
        stars_color: "#facc15",
        ...(featuredReview.imageUrl ? { image: featuredReview.imageUrl } : {}),
        review: featuredReview.text,
        name: featuredReview.name,
      },
    };
    mainBlockOrder.push(reviewBlockId);
  }

  // Divider
  const div2Id = blockId("pp_divider");
  mainBlocks[div2Id] = { type: "pp_divider", settings: {} };
  mainBlockOrder.push(div2Id);

  // Expandable text blocks (shipping, returns)
  const expand1Id = blockId("expandable");
  mainBlocks[expand1Id] = {
    type: "pp_expandable_text",
    settings: {
      title: "Informazioni sulla spedizione",
      content:
        "<p>Offriamo spedizione tracciata e assicurata per tutti i nostri ordini.</p>",
      icon: "globe",
    },
  };
  mainBlockOrder.push(expand1Id);

  const expand2Id = blockId("expandable");
  mainBlocks[expand2Id] = {
    type: "pp_expandable_text",
    settings: {
      title: "Politica di reso",
      content:
        "<p>Offriamo una prova senza rischi. Se non sei soddisfatto, ti rimborseremo.</p>",
      icon: "back",
    },
  };
  mainBlockOrder.push(expand2Id);

  // Main section assembled
  sections["main"] = {
    type: "main-product",
    blocks: mainBlocks,
    block_order: mainBlockOrder,
    custom_css: [],
    settings: {
      enable_sticky_info: true,
      show_feature_media: false,
      color_scheme: "",
      show_container: true,
      container_radius: 10,
      container_padding: 30,
      container_color: "#ffffff",
      container_border_color: config.colors.borderColor,
      container_text: "",
      container_text_bg: "#212121",
      container_text_txt: "#ffffff",
      show_container_mb: true,
      container_padding_mb: 20,
      container_radius_mb: 8,
      container_color_mb: "#ffffff",
      container_border_color_mb: config.colors.borderColor,
      media_size: "medium",
      constrain_to_viewport: false,
      media_fit: "contain",
      gallery_layout: "stacked",
      thumbnail_size: 70,
      thumbnail_radius: 4,
      media_position: "left",
      image_zoom: "none",
      mobile_thumbnails: "show",
      show_full_image: true,
      first_image_size: 100,
      second_image_size: 0,
      hide_variants: true,
      enable_video_looping: true,
      padding_top: 8,
      padding_bottom: 76,
      padding_top_mb: 0,
      padding_bottom_mb: 36,
      heading_font_size: 24,
      body_font_size: 16,
      mobile_heading_font_size: 24,
      mobile_body_font_size: 14,
      pp_heading_color: config.colors.heading,
      pp_body_color: config.colors.body,
      pp_brand_color: config.colors.primary,
      pp_button_background_color: config.colors.buttonBg,
      pp_button_text_color: config.colors.buttonText,
      pp_border_radius: 16,
    },
  };
  order.push("main");

  // ── 2. BRANDS / LOGO SLIDER ──
  const brandsId = blockId("brands");
  sections[brandsId] = {
    type: "brands",
    blocks: {},
    block_order: [],
    name: "LOGO Slider",
    settings: {
      scroll_speed: 15,
      fade: false,
      color_scheme: "",
      padding_desktop: 16,
      padding_mobile: 8,
      padding_item_desktop: 36,
      padding_item_mobile: 24,
      padding_top: 0,
      padding_bottom: 0,
    },
  };
  order.push(brandsId);

  // ── 3. IMAGE WITH TEXT SECTIONS ──
  for (let i = 0; i < config.imageTextSections.length; i++) {
    const section = config.imageTextSections[i];
    const secId = blockId("image_with_text");
    const headingBlockId = blockId("heading");
    const textBlockId = blockId("text");
    const buttonBlockId = blockId("button");

    sections[secId] = {
      type: "pp-image-with-text-v1-0-0",
      blocks: {
        [headingBlockId]: {
          type: "heading",
          settings: { heading: section.heading },
        },
        [textBlockId]: {
          type: "text",
          settings: { text: section.text },
        },
        [buttonBlockId]: {
          type: "button",
          settings: {
            button_behaviour: "scroll_to_top",
            button_label: section.buttonLabel || config.cta.mainButtonText,
            button_link: "",
          },
        },
      },
      block_order: [headingBlockId, textBlockId, buttonBlockId],
      settings: {
        ...(section.imageUrl ? { image: section.imageUrl } : {}),
        image_alt: config.product.title,
        layout: section.layout,
        desktop_content_position: "center",
        desktop_content_alignment: "left",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 0,
      },
    };
    order.push(secId);
  }

  // ── 4. IMAGE WITH BENEFITS ──
  if (config.product.features.length > 0) {
    const benefitsSectionId = blockId("image_with_benefits");
    const benefitBlocks: Record<string, any> = {};
    const benefitBlockOrder: string[] = [];

    for (const feature of config.product.features) {
      const bId = blockId("benefit");
      benefitBlocks[bId] = {
        type: "benefit",
        settings: {
          icon: feature.icon,
          title: feature.title,
          description: feature.description,
        },
      };
      benefitBlockOrder.push(bId);
    }

    sections[benefitsSectionId] = {
      type: "pp-image-with-benefits-v1-0-0",
      blocks: benefitBlocks,
      block_order: benefitBlockOrder,
      settings: {
        heading: `Perché scegliere ${config.product.title}`,
        subtitle: config.product.description,
        ...(config.product.lifestyleImages?.[0] ? { image: config.product.lifestyleImages[0] } : {}),
        image_rounded_type: "circle",
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(benefitsSectionId);
  }

  // ── 5. DIFFERENCES / COMPARISON ──
  if (config.comparison.items.length > 0) {
    const diffId = blockId("differences");
    const diffBlocks: Record<string, any> = {};
    const diffBlockOrder: string[] = [];

    for (const item of config.comparison.items) {
      const cId = blockId("comparison");
      diffBlocks[cId] = {
        type: "comparison_item",
        settings: {
          feature: item.feature,
          product_has_feature: item.productHas,
          competitor_has_feature: item.competitorHas,
        },
      };
      diffBlockOrder.push(cId);
    }

    sections[diffId] = {
      type: "pp-differences-v1-0-0",
      blocks: diffBlocks,
      block_order: diffBlockOrder,
      settings: {
        heading: config.comparison.heading,
        description: config.comparison.description,
        button_label: "",
        button_link: "",
        product_title: config.comparison.productTitle,
        competitor_title: config.comparison.competitorTitle,
        button_behaviour: "scroll_to_top",
        layout: "text_first",
        content_position: "center",
        desktop_content_alignment: "left",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 0,
      },
    };
    order.push(diffId);
  }

  // ── 6. IMAGE WITH PERCENTAGE / STATS ──
  if (config.percentages.stats.length > 0) {
    const percId = blockId("image_with_percentage");
    const headBlockId = blockId("heading");
    const percItemsId = blockId("percentage_items");
    const percBtnId = blockId("button");

    const percSettings: Record<string, any> = {
      color_end: "#d1d5db",
    };
    config.percentages.stats.forEach((stat, i) => {
      const idx = i + 1;
      percSettings[`percentage_${idx}`] = stat.percentage;
      percSettings[`text_${idx}`] = stat.text;
    });

    sections[percId] = {
      type: "pp-image-with-percentage-v1-0-0",
      blocks: {
        [headBlockId]: {
          type: "heading",
          settings: { heading: config.percentages.heading },
        },
        [percItemsId]: {
          type: "percentage_items",
          settings: percSettings,
        },
        [percBtnId]: {
          type: "button",
          settings: {
            button_behaviour: "scroll_to_top",
            button_label: "Ordina Ora",
            button_link: "",
          },
        },
      },
      block_order: [headBlockId, percItemsId, percBtnId],
      settings: {
        ...(config.product.lifestyleImages?.[1]
          ? { image: config.product.lifestyleImages[1] }
          : config.product.lifestyleImages?.[0]
            ? { image: config.product.lifestyleImages[0] }
            : {}),
        layout: "image_first",
        desktop_content_alignment: "left",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(percId);
  }

  // ── 7. FAQs ──
  if (config.faqs.length > 0) {
    const faqSectionId = blockId("faqs");
    const faqBlocks: Record<string, any> = {};
    const faqBlockOrder: string[] = [];

    for (const faq of config.faqs) {
      const fId = blockId("faq");
      faqBlocks[fId] = {
        type: "faq_item",
        settings: {
          question: faq.question,
          answer: faq.answer,
        },
      };
      faqBlockOrder.push(fId);
    }

    sections[faqSectionId] = {
      type: "pp-faqs-v1-0-0",
      blocks: faqBlocks,
      block_order: faqBlockOrder,
      settings: {
        heading: "Domande frequenti",
        description: "",
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        button_behaviour: "scroll_to_top",
        button_label: "",
        button_link: "",
        faqitem_background: "",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(faqSectionId);
  }

  // ── 8. CALL TO ACTION ──
  const ctaId = blockId("call_to_action");
  const ctaHeadingId = blockId("heading");
  const ctaTextId = blockId("text");
  const ctaButtonId = blockId("button");

  sections[ctaId] = {
    type: "pp-call-to-action-v1-0-0",
    blocks: {
      [ctaHeadingId]: {
        type: "heading",
        settings: { heading: config.cta.guaranteeTitle },
      },
      [ctaTextId]: {
        type: "text",
        settings: { text: config.cta.guaranteeDescription },
      },
      [ctaButtonId]: {
        type: "button",
        settings: {
          button_behaviour: "scroll_to_top",
          button_label: config.cta.mainButtonText,
          button_link: "",
        },
      },
    },
    block_order: [ctaHeadingId, ctaTextId, ctaButtonId],
    settings: {
      guarantee_icon: config.cta.guaranteeIcon,
      icon_size: 72,
      desktop_content_alignment: "center",
      mobile_content_alignment: "center",
      section_background: "",
      padding_top: 30,
      padding_bottom: 30,
      padding_top_mobile: 30,
      padding_bottom_mobile: 30,
      margin_top: 30,
      margin_bottom: 30,
      margin_top_mobile: 30,
      margin_bottom_mobile: 30,
    },
  };
  order.push(ctaId);

  // ── 9. REVIEW GRID ──
  if (config.reviews.length > 1) {
    const reviewGridId = blockId("review_grid");
    const reviewBlocks: Record<string, any> = {};
    const reviewBlockOrder: string[] = [];

    for (const review of config.reviews) {
      const rId = blockId("review");
      reviewBlocks[rId] = {
        type: "review",
        settings: {
          ...(review.imageUrl ? { image: review.imageUrl } : {}),
          name: review.name,
          verified_text: "Acquirente Verificato",
          rating: review.rating,
          review_text: review.text,
        },
      };
      reviewBlockOrder.push(rId);
    }

    sections[reviewGridId] = {
      type: "pp-review-grid-v1-0-0",
      blocks: reviewBlocks,
      block_order: reviewBlockOrder,
      settings: {
        rating: 5,
        heading: "Ecco cosa dicono gli altri",
        subheading: "Feedback reale da clienti soddisfatti",
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(reviewGridId);
  }

  // ── 10. RECOMMENDED PRODUCTS ──
  const recoId = blockId("recommended_products");
  sections[recoId] = {
    type: "pp-recommended-products-v1-0-0",
    settings: {
      heading: "Prodotti consigliati",
      collection: "",
      desktop_content_alignment: "center",
      mobile_content_alignment: "center",
      section_background: "",
      padding_top: 30,
      padding_bottom: 30,
      padding_top_mobile: 30,
      padding_bottom_mobile: 30,
      margin_top: 30,
      margin_bottom: 30,
      margin_top_mobile: 30,
      margin_bottom_mobile: 0,
    },
  };
  order.push(recoId);

  return { sections, order };
}

// ─── Homepage Template ───────────────────────────────────────
export function buildHomepageTemplate(config: MerchantConfig): object {
  const sections: Record<string, any> = {};
  const order: string[] = [];

  // ── 1. SLIDESHOW / HERO ──
  const heroId = blockId("slideshow");
  const slideId = blockId("slide");
  sections[heroId] = {
    type: "slideshow",
    blocks: {
      [slideId]: {
        type: "slide",
        settings: {
          ...(config.homepage.heroImageUrl ? { image: config.homepage.heroImageUrl, image_mob: config.homepage.heroImageUrl } : {}),
          caption: "",
          block_cap_size: 14,
          cap_color: "#212121",
          heading: "",
          block_head_size_2: 40,
          "block_head_size-mobile": 30,
          block_head_line: 1,
          heading_size: "h2",
          subheading: "",
          button_label: "",
          link: "",
          "link-2": "",
          button_style_secondary: false,
          box_align: "middle-left",
          show_text_box: false,
          text_alignment: "left",
          image_overlay_opacity: 0,
          color_scheme: "background-1",
          text_alignment_mobile: "center",
          mobile_box_align: "center",
          mobile_text_spacing: 0,
        },
      },
    },
    block_order: [slideId],
    settings: {
      layout: "full_bleed",
      banner_border: 0,
      slide_height: "adapt_image",
      slider_visual: "counter",
      auto_rotate: false,
      hide_navigation: false,
      change_slides_speed: 5,
      show_text_below: true,
      accessibility_info: `Slideshow about ${config.brandName}`,
    },
  };
  order.push(heroId);

  // ── 2. MISSION / RICH TEXT ──
  const missionId = blockId("rich_text");
  const mHeadingId = blockId("heading");
  const mTextId = blockId("text");
  sections[missionId] = {
    type: "rich-text",
    blocks: {
      [mHeadingId]: {
        type: "heading",
        settings: { heading: "Mission", heading_size: "h1" },
      },
      [mTextId]: {
        type: "text",
        settings: {
          text: `<p>${config.missionText || `${config.brandName} - il tuo shop di fiducia.`}</p>`,
        },
      },
    },
    block_order: [mHeadingId, mTextId],
    settings: {
      desktop_content_position: "center",
      content_alignment: "center",
      color_scheme: "background-1",
      full_width: true,
      padding_top: 8,
      padding_bottom: 0,
    },
  };
  order.push(missionId);

  // ── 3. FEATURED COLLECTION ──
  const collectionId = blockId("featured_collection");
  sections[collectionId] = {
    type: "featured-collection",
    settings: {
      title: "",
      description: "",
      collection_text_alignment: "center",
      show_description: false,
      description_style: "body",
      collection: config.homepage.collectionHandle || "frontpage",
      show_collection_image: false,
      products_to_show: 9,
      columns_desktop: 3,
      full_width: false,
      show_view_all: true,
      view_all_style: "solid",
      enable_desktop_slider: false,
      navigation_on_desk: true,
      color_scheme: "",
      image_ratio: "adapt",
      image_no_crop: true,
      show_secondary_image: true,
      show_vendor: false,
      show_rating: false,
      show_scroll_tags: false,
      enable_quick_desc: false,
      quick_desc_legth: 90,
      quick_desc_size: 14,
      enable_quick_add: false,
      show_secondary_add: false,
      columns_mobile: "1",
      swipe_on_mobile: true,
      navigation_on_mobile: true,
      padding_top: 36,
      padding_bottom: 36,
    },
  };
  order.push(collectionId);

  // ── 4. IMAGE WITH BENEFITS (features from product config) ──
  if (config.product.features.length > 0) {
    const benefitsSectionId = blockId("image_with_benefits");
    const benefitBlocks: Record<string, any> = {};
    const benefitBlockOrder: string[] = [];

    for (const feature of config.product.features) {
      const bId = blockId("benefit");
      benefitBlocks[bId] = {
        type: "benefit",
        settings: {
          icon: feature.icon,
          title: feature.title,
          description: feature.description,
        },
      };
      benefitBlockOrder.push(bId);
    }

    sections[benefitsSectionId] = {
      type: "pp-image-with-benefits-v1-0-0",
      blocks: benefitBlocks,
      block_order: benefitBlockOrder,
      settings: {
        heading: `Perché scegliere ${config.brandName}`,
        subtitle: "",
        ...(config.product.lifestyleImages?.[0] ? { image: config.product.lifestyleImages[0] } : {}),
        image_rounded_type: "circle",
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(benefitsSectionId);
  }

  // ── 5. CUSTOMER REVIEWS (review grid) ──
  if (config.reviews.length > 0) {
    const reviewGridId = blockId("review_grid");
    const reviewBlocks: Record<string, any> = {};
    const reviewBlockOrder: string[] = [];

    for (const review of config.reviews) {
      const rId = blockId("review");
      reviewBlocks[rId] = {
        type: "review",
        settings: {
          ...(review.imageUrl ? { image: review.imageUrl } : {}),
          name: review.name,
          verified_text: "Acquirente Verificato",
          rating: review.rating,
          review_text: review.text,
        },
      };
      reviewBlockOrder.push(rId);
    }

    sections[reviewGridId] = {
      type: "pp-review-grid-v1-0-0",
      blocks: reviewBlocks,
      block_order: reviewBlockOrder,
      settings: {
        rating: 5,
        heading: "Cosa dicono i nostri clienti",
        subheading: `${config.reviewRating} stelle su 5 — ${config.reviewCount} recensioni`,
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(reviewGridId);
  }

  // ── 6. WHY CHOOSE US (image-with-text) ──
  const whyId = blockId("image_with_text");
  const whyHeadingId = blockId("heading");
  const whyTextId = blockId("text");

  let whyContent = "";
  for (const point of config.homepage.whyChooseUs.points) {
    whyContent += `<p><strong>${point.title}</strong><br/>${point.description}</p>`;
  }

  sections[whyId] = {
    type: "image-with-text",
    blocks: {
      [whyHeadingId]: {
        type: "heading",
        settings: {
          heading: config.homepage.whyChooseUs.heading,
          heading_size: "h2",
        },
      },
      [whyTextId]: {
        type: "text",
        settings: { text: whyContent, text_style: "body" },
      },
    },
    block_order: [whyHeadingId, whyTextId],
    settings: {
      height: "adapt",
      desktop_image_width: "medium",
      layout: "image_first",
      desktop_content_position: "top",
      desktop_content_alignment: "left",
      content_layout: "no-overlap",
      section_color_scheme: "",
      color_scheme: "",
      image_behavior: "none",
      mobile_content_alignment: "left",
      padding_top: 36,
      padding_bottom: 36,
    },
  };
  order.push(whyId);

  // ── 7. FAQs (if available) ──
  if (config.faqs.length > 0 && config.faqs[0].question) {
    const faqSectionId = blockId("faqs");
    const faqBlocks: Record<string, any> = {};
    const faqBlockOrder: string[] = [];

    for (const faq of config.faqs) {
      if (!faq.question) continue;
      const fId = blockId("faq");
      faqBlocks[fId] = {
        type: "faq_item",
        settings: {
          question: faq.question,
          answer: faq.answer,
        },
      };
      faqBlockOrder.push(fId);
    }

    sections[faqSectionId] = {
      type: "pp-faqs-v1-0-0",
      blocks: faqBlocks,
      block_order: faqBlockOrder,
      settings: {
        heading: "Domande frequenti",
        description: "",
        desktop_content_alignment: "center",
        mobile_content_alignment: "center",
        button_behaviour: "scroll_to_top",
        button_label: "",
        button_link: "",
        faqitem_background: "",
        section_background: "",
        padding_top: 30,
        padding_bottom: 30,
        padding_top_mobile: 30,
        padding_bottom_mobile: 30,
        margin_top: 30,
        margin_bottom: 30,
        margin_top_mobile: 30,
        margin_bottom_mobile: 30,
      },
    };
    order.push(faqSectionId);
  }

  return { sections, order };
}

/**
 * Build the settings_data.json with merchant colors/branding.
 * Preserves color_schemes structure while updating with merchant colors.
 * Removes store-specific image references that won't exist on the new store.
 */
export function buildSettingsData(
  config: MerchantConfig,
  originalSettings: any
): any {
  // Deep clone original settings
  const settings = JSON.parse(JSON.stringify(originalSettings));

  if (settings.current) {
    // Update primary color schemes with merchant colors
    if (settings.current.color_schemes) {
      // Update background-1 (main light scheme)
      if (settings.current.color_schemes["background-1"]) {
        settings.current.color_schemes["background-1"].settings.button = config.colors.buttonBg;
        settings.current.color_schemes["background-1"].settings.button_label = config.colors.buttonText;
        settings.current.color_schemes["background-1"].settings.text = config.colors.body;
      }
      // Update accent-2 (default card/section scheme)
      if (settings.current.color_schemes["accent-2"]) {
        settings.current.color_schemes["accent-2"].settings.button = config.colors.buttonBg;
        settings.current.color_schemes["accent-2"].settings.button_label = config.colors.buttonText;
        settings.current.color_schemes["accent-2"].settings.text = config.colors.body;
      }
    }

    // Remove store-specific image references (they won't exist on the new store)
    delete settings.current.logo;
    delete settings.current.favicon;
    delete settings.current.logo_white;
    delete settings.current.load_img;
    delete settings.current.brand_image;

    // Update brand info
    settings.current.brand_headline = config.brandName;
    settings.current.brand_description = `<p>${config.missionText || config.brandName}</p>`;

    // Clear store-specific cart drawer settings
    delete settings.current.cart_gift_icon;
  }

  return settings;
}
