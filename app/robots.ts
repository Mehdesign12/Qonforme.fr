import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/invoices",
          "/quotes",
          "/clients",
          "/products",
          "/settings",
          "/purchase-orders",
          "/credit-notes",
          "/api",
          "/signup/company",
        ],
      },
    ],
    sitemap: "https://qonforme.fr/sitemap.xml",
  };
}
