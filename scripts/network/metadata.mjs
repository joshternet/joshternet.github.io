export function extractPageMetadata() {
  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\s+/g, " ").trim();
  }

  function meta(selector) {
    return document.querySelector(selector)?.getAttribute("content") || "";
  }

  function jsonLdObjects(value) {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => jsonLdObjects(entry));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const objects = [value];

    if (Array.isArray(value["@graph"])) {
      objects.push(...value["@graph"].flatMap((entry) => jsonLdObjects(entry)));
    }

    return objects;
  }

  function hasType(value, expectedType) {
    const type = value?.["@type"];

    if (typeof type === "string") {
      return type === expectedType;
    }

    if (Array.isArray(type)) {
      return type.includes(expectedType);
    }

    return false;
  }

  function extractJsonLdWebsite() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );

    for (const script of scripts) {
      const source = script.textContent || "";

      if (!source.trim()) {
        continue;
      }

      let parsed;

      try {
        parsed = JSON.parse(source);
      } catch {
        continue;
      }

      const objects = jsonLdObjects(parsed);

      for (const object of objects) {
        if (!hasType(object, "WebSite")) {
          continue;
        }

        return {
          name: normalizeText(object.name),
          description: normalizeText(object.description),
        };
      }
    }

    return {
      name: "",
      description: "",
    };
  }

  function usableParagraph(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (
      element.closest(
        [
          "nav",
          "header",
          "footer",
          "aside",
          "dialog",
          "script",
          "style",
          "noscript",
          "template",
          '[aria-hidden="true"]',
        ].join(","),
      )
    ) {
      return false;
    }

    const text = normalizeText(element.textContent || "");

    if (text.length < 80) {
      return false;
    }

    return true;
  }

  function extractMainDescription() {
    const containers = [
      ...document.querySelectorAll("main"),
      ...document.querySelectorAll('[role="main"]'),
      ...document.querySelectorAll("article"),
    ];

    const seen = new Set();

    for (const container of containers) {
      if (!(container instanceof HTMLElement) || seen.has(container)) {
        continue;
      }

      seen.add(container);

      for (const paragraph of container.querySelectorAll("p")) {
        if (!usableParagraph(paragraph)) {
          continue;
        }

        return normalizeText(paragraph.textContent || "");
      }
    }

    return "";
  }

  const jsonLdWebsite = extractJsonLdWebsite();

  return {
    ogSiteName: meta('meta[property="og:site_name"]'),
    applicationName: meta('meta[name="application-name"]'),
    jsonLdSiteName: jsonLdWebsite.name,
    ogTitle: meta('meta[property="og:title"]'),
    twitterTitle: meta('meta[name="twitter:title"]'),
    documentTitle: document.title || "",
    description: meta('meta[name="description"]'),
    ogDescription: meta('meta[property="og:description"]'),
    twitterDescription: meta('meta[name="twitter:description"]'),
    jsonLdDescription: jsonLdWebsite.description,
    mainDescription: extractMainDescription(),
  };
}
