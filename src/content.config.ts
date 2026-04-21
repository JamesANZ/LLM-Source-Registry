import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { sourceSchema } from "./lib/schema";

const sources = defineCollection({
  loader: glob({
    pattern: ["**/*.yaml", "!_retired/**"],
    base: "./sources",
  }),
  schema: sourceSchema,
});

const retired = defineCollection({
  loader: glob({
    pattern: "_retired/**/*.yaml",
    base: "./sources",
  }),
  schema: sourceSchema,
});

export const collections = { sources, retired };
