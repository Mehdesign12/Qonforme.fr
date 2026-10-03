import { describe, expect, it } from "vitest"
import { isMissingSchemaError } from "@/lib/supabase/schema-guard"

describe("isMissingSchemaError", () => {
  it("reconnaît une table, une colonne ou une fonction absente", () => {
    expect(isMissingSchemaError({ code: "42P01", message: 'relation "x" does not exist' })).toBe(true)
    expect(isMissingSchemaError({ code: "PGRST204", message: "Could not find the 'x' column of 'invoices' in the schema cache" })).toBe(true)
    expect(isMissingSchemaError({ code: "PGRST205", message: "Could not find the table 'public.x' in the schema cache" })).toBe(true)
    expect(isMissingSchemaError({ code: "PGRST202", message: "Could not find the function public.f" })).toBe(true)
  })
  it("laisse passer les autres erreurs", () => {
    expect(isMissingSchemaError(null)).toBe(false)
    expect(isMissingSchemaError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false)
    expect(isMissingSchemaError({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })).toBe(false)
  })
})
