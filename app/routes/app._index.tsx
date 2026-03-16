import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  ProgressBar,
  Box,
  InlineGrid,
  Select,
  Spinner,
} from "@shopify/polaris";
import { useState, useCallback, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import {
  generateTheme,
  createGenerationJob,
  getDefaultConfig,
} from "../services/theme-generator.server";
import db from "../db.server";
import type { MerchantConfig, BenefitItem, FaqItem, ReviewItem, FeatureItem, ComparisonItem, PercentageStat, ImageTextSection, CopyGenerationInput, GeneratedCopy, ImageCategory, GeneratedImage } from "../types";
import { IMAGE_CATEGORIES } from "../types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const defaultConfig = getDefaultConfig();

  try {
    const { session } = await authenticate.admin(request);

    // Load saved wizard state if it exists
    const savedState = await db.wizardState.findUnique({
      where: { shop: session.shop },
    });

    if (savedState) {
      return json({
        defaultConfig: JSON.parse(savedState.config) as MerchantConfig,
        savedStep: savedState.step,
        savedCopyInput: savedState.copyInput ? JSON.parse(savedState.copyInput) : null,
        savedCopyGenerated: savedState.copyGenerated,
      });
    }
  } catch (err) {
    // Auth may fail on initial embedded load before App Bridge provides token
    // Return defaults and let App Bridge handle auth for subsequent requests
    if (err instanceof Response) {
      console.log("[AppIndex] Auth not ready, returning defaults");
    } else {
      throw err;
    }
  }

  return json({
    defaultConfig,
    savedStep: 1,
    savedCopyInput: null,
    savedCopyGenerated: false,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const configJson = formData.get("config") as string;

  if (!configJson) {
    return json({ error: "Missing configuration" }, { status: 400 });
  }

  try {
    const config: MerchantConfig = JSON.parse(configJson);
    const jobId = await createGenerationJob(session.shop, config);
    const result = await generateTheme(admin, session.shop, config, jobId);

    return json({
      success: true,
      themeId: result.themeId,
      previewUrl: result.previewUrl,
      filesUploaded: result.filesUploaded,
    });
  } catch (error: any) {
    return json(
      { error: error.message || "Theme generation failed" },
      { status: 500 }
    );
  }
};

export default function Index() {
  const { defaultConfig, savedStep, savedCopyInput, savedCopyGenerated } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isGenerating = navigation.state === "submitting";

  // ─── State ───
  const [config, setConfig] = useState<MerchantConfig>(defaultConfig);
  const [step, setStep] = useState(savedStep || 1);
  const totalSteps = 6;

  // ─── Auto-save wizard state ───
  const saveFetcher = useFetcher();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-save: saves 1s after last change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const formData = new FormData();
      formData.set("step", String(step));
      formData.set("config", JSON.stringify(config));
      formData.set("copyInput", JSON.stringify(copyInput));
      formData.set("copyGenerated", String(copyGenerated));
      saveFetcher.submit(formData, { method: "post", action: "/app/api/wizard-state" });
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [config, step, copyInput, copyGenerated]);

  // ─── Copy Generation State ───
  const copyFetcher = useFetcher<{ success?: boolean; copy?: GeneratedCopy; error?: string }>();
  const isCopyGenerating = copyFetcher.state === "submitting" || copyFetcher.state === "loading";
  const [copyInput, setCopyInput] = useState<CopyGenerationInput>(
    savedCopyInput || {
      productName: "",
      productDescription: "",
      productUrl: "",
      buyerPersona: "",
      negativeReviews: "",
      language: "it",
      brandName: "",
      niche: "",
    }
  );
  const [copyGenerated, setCopyGenerated] = useState(savedCopyGenerated || false);

  // ─── Image Generation State ───
  const imageFetcher = useFetcher<{ success?: boolean; image?: GeneratedImage; error?: string }>();
  const isImageGenerating = imageFetcher.state === "submitting" || imageFetcher.state === "loading";
  const [productImageBase64, setProductImageBase64] = useState<string>("");
  const [productImageMimeType, setProductImageMimeType] = useState<string>("image/jpeg");
  const [productImagePreview, setProductImagePreview] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory>("product_photo");
  const [generatedImages, setGeneratedImages] = useState<Array<{ base64: string; mimeType: string; category: ImageCategory }>>([]);
  const [showImageGen, setShowImageGen] = useState(false);

  // Apply generated copy when fetcher returns (useEffect, not during render)
  useEffect(() => {
    if (copyFetcher.data?.success && copyFetcher.data?.copy && !copyGenerated) {
      const copy = copyFetcher.data.copy;
      setConfig((prev) => ({
        ...prev,
        brandName: copyInput.brandName || prev.brandName,
        missionText: copy.missionText,
        product: {
          ...prev.product,
          title: copy.productTitle,
          subtitle: copy.productSubtitle,
          description: copy.productDescription,
          benefits: copy.benefits,
          features: copy.features,
        },
        faqs: copy.faqs,
        cta: {
          ...prev.cta,
          mainButtonText: copy.ctaButtonText,
          guaranteeTitle: copy.guaranteeTitle,
          guaranteeDescription: copy.guaranteeDescription,
        },
        guarantees: {
          ...prev.guarantees,
          text1: copy.guaranteeText1,
          text2: copy.guaranteeText2,
          text3: copy.guaranteeText3,
        },
        comparison: {
          ...prev.comparison,
          heading: copy.comparisonHeading,
          description: copy.comparisonDescription,
          items: copy.comparisonItems.map((item: { feature: string }) => ({
            feature: item.feature,
            productHas: true,
            competitorHas: false,
          })),
        },
        percentages: {
          heading: copy.percentagesHeading,
          stats: copy.percentageStats,
        },
        imageTextSections: copy.imageTextSections.map((sec: { heading: string; text: string; buttonLabel: string }, i: number) => ({
          heading: sec.heading,
          text: sec.text,
          buttonLabel: sec.buttonLabel,
          imageUrl: config.imageTextSections?.[i]?.imageUrl || "",
          layout: i % 2 === 0 ? "image_first" as const : "text_first" as const,
        })),
        homepage: {
          ...prev.homepage,
          whyChooseUs: {
            heading: copy.whyChooseUsHeading,
            points: copy.whyChooseUsPoints,
          },
        },
      }));
      setCopyGenerated(true);
    }
  }, [copyFetcher.data]);

  // Apply generated image when fetcher returns (useEffect, not during render)
  useEffect(() => {
    if (imageFetcher.data?.success && imageFetcher.data?.image) {
      const img = imageFetcher.data.image;
      setGeneratedImages((prev) => {
        const alreadyAdded = prev.some((g) => g.category === img.category && g.base64 === img.imageBase64);
        if (alreadyAdded) return prev;
        return [...prev, { base64: img.imageBase64, mimeType: img.mimeType, category: img.category }];
      });
    }
  }, [imageFetcher.data]);

  // ─── Updaters ───
  const updateField = useCallback(
    (path: string, value: any) => {
      setConfig((prev) => {
        const newConfig = JSON.parse(JSON.stringify(prev));
        const keys = path.split(".");
        let obj = newConfig;
        for (let i = 0; i < keys.length - 1; i++) {
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        return newConfig;
      });
    },
    []
  );

  const updateBenefit = useCallback(
    (index: number, field: keyof BenefitItem, value: string) => {
      setConfig((prev) => {
        const newConfig = JSON.parse(JSON.stringify(prev));
        newConfig.product.benefits[index][field] = value;
        return newConfig;
      });
    },
    []
  );

  const updateFeature = useCallback(
    (index: number, field: keyof FeatureItem, value: string) => {
      setConfig((prev) => {
        const newConfig = JSON.parse(JSON.stringify(prev));
        newConfig.product.features[index][field] = value;
        return newConfig;
      });
    },
    []
  );

  const updateFaq = useCallback(
    (index: number, field: keyof FaqItem, value: string) => {
      setConfig((prev) => {
        const newConfig = JSON.parse(JSON.stringify(prev));
        newConfig.faqs[index][field] = value;
        return newConfig;
      });
    },
    []
  );

  const addReview = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      reviews: [
        ...prev.reviews,
        { name: "", rating: 5, text: "", imageUrl: "", verified: true },
      ],
    }));
  }, []);

  const updateReview = useCallback(
    (index: number, field: keyof ReviewItem, value: any) => {
      setConfig((prev) => {
        const newConfig = JSON.parse(JSON.stringify(prev));
        newConfig.reviews[index][field] = value;
        return newConfig;
      });
    },
    []
  );

  const addFaq = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { question: "", answer: "" }],
    }));
  }, []);

  const addImageTextSection = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      imageTextSections: [
        ...prev.imageTextSections,
        { heading: "", text: "", imageUrl: "", buttonLabel: "", layout: "image_first" as const },
      ],
    }));
  }, []);

  const addComparisonItem = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      comparison: {
        ...prev.comparison,
        items: [
          ...prev.comparison.items,
          { feature: "", productHas: true, competitorHas: false },
        ],
      },
    }));
  }, []);

  // ─── Copy Generation ───
  const handleGenerateCopy = useCallback(() => {
    const inputWithBrand = { ...copyInput, brandName: copyInput.brandName || config.brandName };
    const formData = new FormData();
    formData.set("input", JSON.stringify(inputWithBrand));
    setCopyGenerated(false);
    copyFetcher.submit(formData, { method: "post", action: "/app/api/generate-copy" });
  }, [copyInput, config.brandName, copyFetcher]);

  const updateCopyInput = useCallback(
    (field: keyof CopyGenerationInput, value: string) => {
      setCopyInput((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // ─── Image Generation ───
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/jpeg;base64,..."
      const match = result.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        setProductImageMimeType(match[1]);
        setProductImageBase64(match[2]);
        setProductImagePreview(result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerateImage = useCallback(() => {
    if (!productImageBase64 || !selectedCategory) return;

    const input = {
      productImageBase64,
      productImageMimeType,
      category: selectedCategory,
      productName: config.product.title || copyInput.productName || "Product",
      productDescription: config.product.description || copyInput.productDescription || "",
      language: copyInput.language || "it",
    };

    const formData = new FormData();
    formData.set("input", JSON.stringify(input));
    imageFetcher.submit(formData, { method: "post", action: "/app/api/generate-image" });
  }, [productImageBase64, productImageMimeType, selectedCategory, config.product.title, config.product.description, copyInput, imageFetcher]);

  // ─── Submit ───
  const handleGenerate = useCallback(() => {
    const formData = new FormData();
    formData.set("config", JSON.stringify(config));
    submit(formData, { method: "post" });
  }, [config, submit]);

  // ─── Render Steps ───
  const renderStep1 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 1: AI Copy Generation</Text>
      <Banner tone="info">
        <p>
          Provide your product info, buyer persona, and customer objections.
          Our AI copywriter will generate all the persuasive copy for your landing page and homepage.
        </p>
      </Banner>

      <Card>
        <FormLayout>
          <TextField
            label="Product Name"
            value={copyInput.productName}
            onChange={(v) => updateCopyInput("productName", v)}
            autoComplete="off"
            helpText="The name of the product you're selling"
          />
          <TextField
            label="Brand Name"
            value={copyInput.brandName}
            onChange={(v) => updateCopyInput("brandName", v)}
            autoComplete="off"
          />
          <TextField
            label="Niche"
            value={copyInput.niche || ""}
            onChange={(v) => updateCopyInput("niche", v)}
            autoComplete="off"
            helpText="e.g. fitness, beauty, kitchen, tech"
          />
          <TextField
            label="Product Description"
            value={copyInput.productDescription}
            onChange={(v) => updateCopyInput("productDescription", v)}
            multiline={5}
            autoComplete="off"
            helpText="Detailed description of the product, its features, how it works, what problem it solves"
          />
          <TextField
            label="Product URL (optional)"
            value={copyInput.productUrl || ""}
            onChange={(v) => updateCopyInput("productUrl", v)}
            autoComplete="off"
            helpText="Link to the existing product page or landing page for reference"
          />
        </FormLayout>
      </Card>

      <Card>
        <FormLayout>
          <TextField
            label="Buyer Persona"
            value={copyInput.buyerPersona}
            onChange={(v) => updateCopyInput("buyerPersona", v)}
            multiline={4}
            autoComplete="off"
            helpText="Who is your target customer? Age, gender, interests, pain points, desires, lifestyle..."
          />
          <TextField
            label="Negative Reviews / Objections"
            value={copyInput.negativeReviews}
            onChange={(v) => updateCopyInput("negativeReviews", v)}
            multiline={5}
            autoComplete="off"
            helpText="Paste negative reviews from Amazon or list common customer objections. The AI uses these to craft objection-destroying copy."
          />
          <Select
            label="Language"
            options={[
              { label: "Italiano", value: "it" },
              { label: "English", value: "en" },
            ]}
            value={copyInput.language}
            onChange={(v) => updateCopyInput("language", v as "it" | "en")}
          />
        </FormLayout>
      </Card>

      <InlineStack gap="300" blockAlign="center">
        <Button
          variant="primary"
          size="large"
          loading={isCopyGenerating}
          onClick={handleGenerateCopy}
          disabled={!copyInput.productName || !copyInput.productDescription || !copyInput.buyerPersona || !copyInput.negativeReviews}
        >
          Generate Copy with AI
        </Button>
        {isCopyGenerating && (
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text as="span" variant="bodySm" tone="subdued">
              Generating persuasive copy... this may take 20-30 seconds
            </Text>
          </InlineStack>
        )}
      </InlineStack>

      {copyFetcher.data?.error && (
        <Banner tone="critical">
          <p>Error generating copy: {copyFetcher.data.error}</p>
        </Banner>
      )}

      {copyGenerated && (
        <Banner tone="success">
          <p>
            Copy generated successfully! All text fields have been filled in.
            Click "Next" to review and customize the generated copy in each step.
          </p>
        </Banner>
      )}
    </BlockStack>
  );

  const renderStep2 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 2: Brand</Text>
      <Card>
        <FormLayout>
          <TextField
            label="Brand Name"
            value={config.brandName}
            onChange={(v) => updateField("brandName", v)}
            autoComplete="off"
          />
          <TextField
            label="Logo URL"
            value={config.logoUrl || ""}
            onChange={(v) => updateField("logoUrl", v)}
            helpText="URL of your logo image (will be connected to image skill later)"
            autoComplete="off"
          />
          <TextField
            label="Mission Text"
            value={config.missionText || ""}
            onChange={(v) => updateField("missionText", v)}
            multiline={3}
            helpText="Brief mission statement for the homepage"
            autoComplete="off"
          />
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Colors</Text>
      <Card>
        <FormLayout>
          <InlineGrid columns={2} gap="400">
            <TextField
              label="Primary / Brand Color"
              value={config.colors.primary}
              onChange={(v) => updateField("colors.primary", v)}
              autoComplete="off"
              helpText="#hex format"
            />
            <TextField
              label="Heading Text Color"
              value={config.colors.heading}
              onChange={(v) => updateField("colors.heading", v)}
              autoComplete="off"
            />
            <TextField
              label="Body Text Color"
              value={config.colors.body}
              onChange={(v) => updateField("colors.body", v)}
              autoComplete="off"
            />
            <TextField
              label="Button Background"
              value={config.colors.buttonBg}
              onChange={(v) => updateField("colors.buttonBg", v)}
              autoComplete="off"
            />
            <TextField
              label="Button Text Color"
              value={config.colors.buttonText}
              onChange={(v) => updateField("colors.buttonText", v)}
              autoComplete="off"
            />
            <TextField
              label="Border Color"
              value={config.colors.borderColor}
              onChange={(v) => updateField("colors.borderColor", v)}
              autoComplete="off"
            />
          </InlineGrid>
        </FormLayout>
      </Card>
    </BlockStack>
  );

  const renderStep3 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 3: Product</Text>
      <Card>
        <FormLayout>
          <TextField
            label="Product Title"
            value={config.product.title}
            onChange={(v) => updateField("product.title", v)}
            autoComplete="off"
          />
          <TextField
            label="Subtitle"
            value={config.product.subtitle}
            onChange={(v) => updateField("product.subtitle", v)}
            autoComplete="off"
            helpText="Short tagline under the title"
          />
          <TextField
            label="Description"
            value={config.product.description}
            onChange={(v) => updateField("product.description", v)}
            multiline={4}
            autoComplete="off"
          />
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Benefits (emoji + text)</Text>
      <Card>
        <BlockStack gap="300">
          {config.product.benefits.map((benefit, i) => (
            <InlineStack key={i} gap="200" blockAlign="end">
              <Box width="60px">
                <TextField
                  label={i === 0 ? "Emoji" : ""}
                  value={benefit.emoji}
                  onChange={(v) => updateBenefit(i, "emoji", v)}
                  autoComplete="off"
                />
              </Box>
              <Box width="100%">
                <TextField
                  label={i === 0 ? "Benefit text" : ""}
                  value={benefit.text}
                  onChange={(v) => updateBenefit(i, "text", v)}
                  autoComplete="off"
                />
              </Box>
            </InlineStack>
          ))}
          <Button
            onClick={() =>
              updateField("product.benefits", [
                ...config.product.benefits,
                { emoji: "✅", text: "" },
              ])
            }
          >
            Add benefit
          </Button>
        </BlockStack>
      </Card>

      <Text variant="headingMd" as="h3">Features (for benefits section)</Text>
      <Card>
        <BlockStack gap="300">
          {config.product.features.map((feature, i) => (
            <FormLayout key={i}>
              <InlineGrid columns={3} gap="200">
                <TextField
                  label={i === 0 ? "Icon/Emoji" : ""}
                  value={feature.icon}
                  onChange={(v) => updateFeature(i, "icon", v)}
                  autoComplete="off"
                />
                <TextField
                  label={i === 0 ? "Title" : ""}
                  value={feature.title}
                  onChange={(v) => updateFeature(i, "title", v)}
                  autoComplete="off"
                />
                <TextField
                  label={i === 0 ? "Description" : ""}
                  value={feature.description}
                  onChange={(v) => updateFeature(i, "description", v)}
                  autoComplete="off"
                />
              </InlineGrid>
            </FormLayout>
          ))}
        </BlockStack>
      </Card>

      <Divider />

      <Text variant="headingMd" as="h3">AI Image Generation (Optional)</Text>
      <Banner tone="warning">
        <p>
          This section is optional. You can skip it and proceed to the next step.
          Image generation uses AI and may not always work reliably.
        </p>
      </Banner>

      {!showImageGen ? (
        <Button onClick={() => setShowImageGen(true)}>
          Show Image Generation
        </Button>
      ) : (
        <>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingSm" as="h4">1. Upload product photo</Text>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                style={{ marginBottom: "8px" }}
              />
              {productImagePreview && (
                <div style={{ maxWidth: "200px" }}>
                  <img
                    src={productImagePreview}
                    alt="Product preview"
                    style={{ width: "100%", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                </div>
              )}

              <Text variant="headingSm" as="h4">2. Select category</Text>
              <Select
                label="Image Category"
                options={IMAGE_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
                value={selectedCategory}
                onChange={(v) => setSelectedCategory(v as ImageCategory)}
                helpText={
                  selectedCategory === "product_photo" ? "Clean studio packshot, no text, no graphics" :
                  selectedCategory === "lifestyle" ? "Product in realistic environment with natural lighting" :
                  selectedCategory === "ingredients" ? "Key ingredients displayed around the product" :
                  selectedCategory === "infographic" ? "4-6 informational callouts around the product" :
                  selectedCategory === "how_to_process" ? "3-5 step visual guide for using the product" :
                  selectedCategory === "social_proof" ? "Customer review/testimonial card layout" : ""
                }
              />

              <InlineStack gap="300" blockAlign="center">
                <Button
                  variant="primary"
                  loading={isImageGenerating}
                  onClick={handleGenerateImage}
                  disabled={!productImageBase64}
                >
                  Generate Image
                </Button>
                {isImageGenerating && (
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner size="small" />
                    <Text as="span" variant="bodySm" tone="subdued">
                      Generating image... this may take 15-30 seconds
                    </Text>
                  </InlineStack>
                )}
              </InlineStack>

              {imageFetcher.data?.error && (
                <Banner tone="critical">
                  <p>Error: {imageFetcher.data.error}</p>
                </Banner>
              )}
            </BlockStack>
          </Card>

          {generatedImages.length > 0 && (
            <>
              <Text variant="headingMd" as="h3">Generated Images ({generatedImages.length})</Text>
              <Card>
                <BlockStack gap="400">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                    {generatedImages.map((img, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <img
                          src={`data:${img.mimeType};base64,${img.base64}`}
                          alt={`Generated ${img.category}`}
                          style={{ width: "100%", borderRadius: "8px", border: "1px solid #ddd" }}
                        />
                        <Text as="p" variant="bodySm" tone="subdued">
                          {IMAGE_CATEGORIES.find((c) => c.value === img.category)?.label || img.category}
                        </Text>
                      </div>
                    ))}
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Generated images will be available for use in theme sections.
                    You can generate more images by selecting different categories above.
                  </Text>
                </BlockStack>
              </Card>
            </>
          )}
        </>
      )}
    </BlockStack>
  );

  const renderStep4 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 4: Social Proof</Text>

      <Card>
        <FormLayout>
          <InlineGrid columns={2} gap="400">
            <TextField
              label="Average Rating"
              type="number"
              value={String(config.reviewRating)}
              onChange={(v) => updateField("reviewRating", parseFloat(v) || 0)}
              autoComplete="off"
            />
            <TextField
              label="Review Count"
              type="number"
              value={String(config.reviewCount)}
              onChange={(v) => updateField("reviewCount", parseInt(v) || 0)}
              autoComplete="off"
            />
          </InlineGrid>
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Reviews</Text>
      {config.reviews.map((review, i) => (
        <Card key={i}>
          <FormLayout>
            <InlineGrid columns={2} gap="200">
              <TextField
                label="Reviewer Name"
                value={review.name}
                onChange={(v) => updateReview(i, "name", v)}
                autoComplete="off"
              />
              <TextField
                label="Rating"
                type="number"
                value={String(review.rating)}
                onChange={(v) =>
                  updateReview(i, "rating", parseInt(v) || 5)
                }
                autoComplete="off"
              />
            </InlineGrid>
            <TextField
              label="Review Text"
              value={review.text}
              onChange={(v) => updateReview(i, "text", v)}
              multiline={3}
              autoComplete="off"
            />
            <TextField
              label="Image URL"
              value={review.imageUrl || ""}
              onChange={(v) => updateReview(i, "imageUrl", v)}
              autoComplete="off"
              helpText="Will be connected to image skill later"
            />
          </FormLayout>
        </Card>
      ))}
      <Button onClick={addReview}>Add Review</Button>

      <Divider />

      <Text variant="headingMd" as="h3">FAQs</Text>
      {config.faqs.map((faq, i) => (
        <Card key={i}>
          <FormLayout>
            <TextField
              label="Question"
              value={faq.question}
              onChange={(v) => updateFaq(i, "question", v)}
              autoComplete="off"
            />
            <TextField
              label="Answer"
              value={faq.answer}
              onChange={(v) => updateFaq(i, "answer", v)}
              multiline={3}
              autoComplete="off"
            />
          </FormLayout>
        </Card>
      ))}
      <Button onClick={addFaq}>Add FAQ</Button>
    </BlockStack>
  );

  const renderStep5 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 5: Landing Page Sections</Text>

      <Text variant="headingMd" as="h3">CTA / Guarantee</Text>
      <Card>
        <FormLayout>
          <TextField
            label="Main Button Text"
            value={config.cta.mainButtonText}
            onChange={(v) => updateField("cta.mainButtonText", v)}
            autoComplete="off"
          />
          <TextField
            label="Guarantee Title"
            value={config.cta.guaranteeTitle}
            onChange={(v) => updateField("cta.guaranteeTitle", v)}
            autoComplete="off"
            helpText="E.g. 'Try risk-free: 30 days money back'"
          />
          <TextField
            label="Guarantee Description"
            value={config.cta.guaranteeDescription}
            onChange={(v) => updateField("cta.guaranteeDescription", v)}
            multiline={3}
            autoComplete="off"
          />
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Guarantee Icons (under buy button)</Text>
      <Card>
        <FormLayout>
          <InlineGrid columns={2} gap="200">
            <TextField
              label="Icon 1"
              value={config.guarantees.icon1}
              onChange={(v) => updateField("guarantees.icon1", v)}
              autoComplete="off"
              helpText="truck, box, heart, globe, shield, etc."
            />
            <TextField
              label="Text 1"
              value={config.guarantees.text1}
              onChange={(v) => updateField("guarantees.text1", v)}
              autoComplete="off"
            />
            <TextField
              label="Icon 2"
              value={config.guarantees.icon2}
              onChange={(v) => updateField("guarantees.icon2", v)}
              autoComplete="off"
            />
            <TextField
              label="Text 2"
              value={config.guarantees.text2}
              onChange={(v) => updateField("guarantees.text2", v)}
              autoComplete="off"
            />
            <TextField
              label="Icon 3"
              value={config.guarantees.icon3}
              onChange={(v) => updateField("guarantees.icon3", v)}
              autoComplete="off"
            />
            <TextField
              label="Text 3"
              value={config.guarantees.text3}
              onChange={(v) => updateField("guarantees.text3", v)}
              autoComplete="off"
            />
          </InlineGrid>
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Comparison Table</Text>
      <Card>
        <FormLayout>
          <TextField
            label="Heading"
            value={config.comparison.heading}
            onChange={(v) => updateField("comparison.heading", v)}
            autoComplete="off"
          />
          <TextField
            label="Description"
            value={config.comparison.description}
            onChange={(v) => updateField("comparison.description", v)}
            multiline={2}
            autoComplete="off"
          />
          <InlineGrid columns={2} gap="200">
            <TextField
              label="Our Product Label"
              value={config.comparison.productTitle}
              onChange={(v) => updateField("comparison.productTitle", v)}
              autoComplete="off"
            />
            <TextField
              label="Competitors Label"
              value={config.comparison.competitorTitle}
              onChange={(v) => updateField("comparison.competitorTitle", v)}
              autoComplete="off"
            />
          </InlineGrid>
        </FormLayout>
        <Box paddingBlockStart="300">
          <BlockStack gap="200">
            {config.comparison.items.map((item, i) => (
              <TextField
                key={i}
                label={i === 0 ? "Feature (we have it, they don't)" : ""}
                value={item.feature}
                onChange={(v) => {
                  const newItems = [...config.comparison.items];
                  newItems[i] = { ...newItems[i], feature: v };
                  updateField("comparison.items", newItems);
                }}
                autoComplete="off"
              />
            ))}
            <Button onClick={addComparisonItem}>Add comparison</Button>
          </BlockStack>
        </Box>
      </Card>

      <Text variant="headingMd" as="h3">Image + Text Sections</Text>
      {config.imageTextSections.map((sec, i) => (
        <Card key={i}>
          <FormLayout>
            <TextField
              label="Heading"
              value={sec.heading}
              onChange={(v) => {
                const newSections = [...config.imageTextSections];
                newSections[i] = { ...newSections[i], heading: v };
                updateField("imageTextSections", newSections);
              }}
              autoComplete="off"
            />
            <TextField
              label="Text"
              value={sec.text}
              onChange={(v) => {
                const newSections = [...config.imageTextSections];
                newSections[i] = { ...newSections[i], text: v };
                updateField("imageTextSections", newSections);
              }}
              multiline={3}
              autoComplete="off"
            />
            <Select
              label="Layout"
              options={[
                { label: "Image first", value: "image_first" },
                { label: "Text first", value: "text_first" },
              ]}
              value={sec.layout}
              onChange={(v) => {
                const newSections = [...config.imageTextSections];
                newSections[i] = { ...newSections[i], layout: v as any };
                updateField("imageTextSections", newSections);
              }}
            />
          </FormLayout>
        </Card>
      ))}
      <Button onClick={addImageTextSection}>Add image + text section</Button>
    </BlockStack>
  );

  const renderStep6 = () => (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">Step 6: Homepage</Text>

      <Card>
        <FormLayout>
          <TextField
            label="Hero Image URL"
            value={config.homepage.heroImageUrl || ""}
            onChange={(v) => updateField("homepage.heroImageUrl", v)}
            autoComplete="off"
            helpText="Main banner image for homepage"
          />
          <TextField
            label="Featured Collection Handle"
            value={config.homepage.collectionHandle || ""}
            onChange={(v) => updateField("homepage.collectionHandle", v)}
            autoComplete="off"
            helpText="E.g. 'frontpage' or 'best-sellers'"
          />
        </FormLayout>
      </Card>

      <Text variant="headingMd" as="h3">Why Choose Us</Text>
      <Card>
        <FormLayout>
          <TextField
            label="Section Heading"
            value={config.homepage.whyChooseUs.heading}
            onChange={(v) => updateField("homepage.whyChooseUs.heading", v)}
            autoComplete="off"
          />
          {config.homepage.whyChooseUs.points.map((point, i) => (
            <InlineGrid key={i} columns={2} gap="200">
              <TextField
                label={i === 0 ? "Title" : ""}
                value={point.title}
                onChange={(v) => {
                  const newPoints = [...config.homepage.whyChooseUs.points];
                  newPoints[i] = { ...newPoints[i], title: v };
                  updateField("homepage.whyChooseUs.points", newPoints);
                }}
                autoComplete="off"
              />
              <TextField
                label={i === 0 ? "Description" : ""}
                value={point.description}
                onChange={(v) => {
                  const newPoints = [...config.homepage.whyChooseUs.points];
                  newPoints[i] = { ...newPoints[i], description: v };
                  updateField("homepage.whyChooseUs.points", newPoints);
                }}
                autoComplete="off"
              />
            </InlineGrid>
          ))}
        </FormLayout>
      </Card>

      <Divider />

      <Banner tone="info">
        <p>
          Ready to generate! The theme will be created as an unpublished theme
          on your store. You can preview it before publishing.
        </p>
      </Banner>
    </BlockStack>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  return (
    <Page title="Theme Builder" subtitle="Generate a complete store theme from your configuration">
      <Layout>
        <Layout.Section>
          {/* Progress */}
          <Box paddingBlockEnd="400">
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm">
                  Step {step} of {totalSteps}
                </Text>
                <Text as="p" variant="bodySm">
                  {Math.round((step / totalSteps) * 100)}%
                </Text>
              </InlineStack>
              <ProgressBar progress={(step / totalSteps) * 100} size="small" />
            </BlockStack>
          </Box>

          {/* Success/Error banners */}
          {actionData && "success" in actionData && actionData.success && (
            <Box paddingBlockEnd="400">
              <Banner tone="success">
                <p>
                  Theme generated successfully! {actionData.filesUploaded} files
                  uploaded. Theme ID: {actionData.themeId}
                </p>
                {actionData.previewUrl && (
                  <p>
                    <a href={actionData.previewUrl} target="_blank" rel="noopener">
                      Preview your theme
                    </a>
                  </p>
                )}
              </Banner>
            </Box>
          )}

          {actionData && "error" in actionData && actionData.error && (
            <Box paddingBlockEnd="400">
              <Banner tone="critical">
                <p>Error: {actionData.error}</p>
              </Banner>
            </Box>
          )}

          {/* Step content */}
          {renderCurrentStep()}

          {/* Navigation */}
          <Box paddingBlockStart="400">
            <InlineStack align="space-between">
              <Button
                disabled={step === 1}
                onClick={() => setStep((s) => s - 1)}
              >
                Previous
              </Button>

              {step < totalSteps ? (
                <Button
                  variant="primary"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="primary"
                  loading={isGenerating}
                  onClick={handleGenerate}
                >
                  Generate Theme
                </Button>
              )}
            </InlineStack>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
