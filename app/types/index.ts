/**
 * Configuration collected from the merchant wizard.
 * This drives the entire theme generation process.
 */
export interface MerchantConfig {
  // Brand
  brandName: string;
  logoUrl?: string;
  missionText?: string;

  // Colors
  colors: {
    primary: string;       // brand color (buttons, accents)
    heading: string;       // heading text color
    body: string;          // body text color
    buttonBg: string;      // button background
    buttonText: string;    // button text
    borderColor: string;   // container borders
  };

  // Product
  product: {
    title: string;
    subtitle: string;
    description: string;
    benefits: BenefitItem[];
    features: FeatureItem[];
    images: string[];         // URLs of product images
    lifestyleImages: string[]; // URLs of lifestyle/context images
  };

  // Social Proof
  reviews: ReviewItem[];
  reviewRating: number;       // e.g. 4.8
  reviewCount: number;        // e.g. 152

  // FAQ
  faqs: FaqItem[];

  // CTA
  cta: {
    mainButtonText: string;         // e.g. "Add to Cart"
    guaranteeTitle: string;         // e.g. "Try risk-free: 30 days..."
    guaranteeDescription: string;
    guaranteeIcon: string;          // e.g. "certification"
  };

  // Guarantees (icon bar under buy button)
  guarantees: {
    text1: string;
    icon1: string;
    text2: string;
    icon2: string;
    text3: string;
    icon3: string;
  };

  // Comparison section
  comparison: {
    productTitle: string;        // "Our Product"
    competitorTitle: string;     // "Others"
    heading: string;
    description: string;
    items: ComparisonItem[];
  };

  // Percentages section
  percentages: {
    heading: string;
    stats: PercentageStat[];
  };

  // Image with text sections
  imageTextSections: ImageTextSection[];

  // Homepage
  homepage: {
    heroImageUrl?: string;
    collectionHandle?: string;   // featured collection
    whyChooseUs: {
      heading: string;
      points: Array<{ title: string; description: string }>;
    };
  };
}

export interface BenefitItem {
  emoji: string;
  text: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface ReviewItem {
  name: string;
  rating: number;
  text: string;
  imageUrl?: string;
  verified?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ComparisonItem {
  feature: string;
  productHas: boolean;
  competitorHas: boolean;
}

export interface PercentageStat {
  percentage: number;
  text: string;
}

export interface ImageTextSection {
  heading: string;
  text: string;
  imageUrl?: string;
  buttonLabel?: string;
  layout: "image_first" | "text_first";
}

/**
 * Represents a single theme file to be uploaded
 */
export interface ThemeFile {
  key: string;    // e.g. "sections/main-product.liquid"
  value: string;  // file content
}

/**
 * Status of theme generation job
 */
export type GenerationStatus =
  | "pending"
  | "generating"
  | "uploading"
  | "completed"
  | "failed";

/**
 * Input for the AI copy generator.
 * The merchant provides this info, then the AI generates all copy.
 */
export interface CopyGenerationInput {
  productName: string;
  productDescription: string;       // detailed description or landing page link
  productUrl?: string;              // optional product/landing URL for reference
  buyerPersona: string;             // who is the target customer
  negativeReviews: string;          // objections, complaints, negative reviews
  language: "it" | "en";            // output language
  brandName: string;
  niche?: string;                   // e.g. "fitness", "beauty", "kitchen"
}

/**
 * Structured copy output from the AI.
 * Maps directly to MerchantConfig copy fields.
 */
export interface GeneratedCopy {
  // Product section
  productTitle: string;
  productSubtitle: string;
  productDescription: string;
  benefits: BenefitItem[];
  features: FeatureItem[];

  // Social proof
  faqs: FaqItem[];
  reviewHeading: string;
  reviewSubheading: string;

  // CTA / Guarantee
  ctaButtonText: string;
  guaranteeTitle: string;
  guaranteeDescription: string;

  // Guarantees bar
  guaranteeText1: string;
  guaranteeText2: string;
  guaranteeText3: string;

  // Comparison
  comparisonHeading: string;
  comparisonDescription: string;
  comparisonItems: Array<{ feature: string }>;

  // Percentages / stats
  percentagesHeading: string;
  percentageStats: PercentageStat[];

  // Image + text sections
  imageTextSections: Array<{
    heading: string;
    text: string;
    buttonLabel: string;
  }>;

  // Homepage
  missionText: string;
  whyChooseUsHeading: string;
  whyChooseUsPoints: Array<{ title: string; description: string }>;
}

/**
 * Image generation categories (Ecommerce Visual Art Director)
 */
export type ImageCategory =
  | "how_to_process"
  | "infographic"
  | "ingredients"
  | "lifestyle"
  | "product_photo"
  | "social_proof";

export const IMAGE_CATEGORIES: Array<{ value: ImageCategory; label: string }> = [
  { value: "product_photo", label: "Product Photo" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "ingredients", label: "Ingredients" },
  { value: "infographic", label: "Infographic" },
  { value: "how_to_process", label: "How To / Process" },
  { value: "social_proof", label: "Social Proof" },
];

/**
 * Input for the AI image generator.
 */
export interface ImageGenerationInput {
  productImageBase64: string;         // base64-encoded product image
  productImageMimeType: string;       // e.g. "image/jpeg", "image/png"
  category: ImageCategory;
  productName: string;
  productDescription?: string;
  language: "it" | "en";
}

/**
 * Output from the AI image generator.
 */
export interface GeneratedImage {
  imageBase64: string;                // base64-encoded generated image
  mimeType: string;                   // e.g. "image/png"
  category: ImageCategory;
}
