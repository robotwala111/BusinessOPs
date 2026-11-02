# Quotation PDF Template Guide

The quotation PDF system uses `jsPDF`, `jspdf-autotable`, and live quotation data. It does not hardcode client names, project names, amounts, or dates.

## Runtime Flow

1. The quotation detail page loads a quotation through `quotationService.getQuotationById`.
2. Clicking `Download PDF` lazy-loads `frontend/src/utils/pdf/generateQuotationPdf.ts`.
3. `buildQuotationPdfData` converts the quotation into a PDF view model.
4. `generateQuotationPdf` draws the A4 document, tables, page breaks, and footers in the browser.
5. The browser downloads `ATS-{quotation_number}.pdf`.

## Template Components

```text
frontend/src/components/quotations/pdf/
  QuotationTemplate.tsx
  QuotationHeader.tsx
  QuotationClientInfo.tsx
  QuotationItemsTable.tsx
  QuotationSummary.tsx
  QuotationMilestones.tsx
  QuotationTerms.tsx
  QuotationAcceptance.tsx
  QuotationFooter.tsx
```

The section components document the template structure and can be reused for future previews. The active PDF drawing flow lives in `frontend/src/utils/pdf/generateQuotationPdf.ts`. Shared formatting, derived data, date formatting, currency formatting, milestone parsing, and filename rules belong in `frontend/src/utils/pdf/quotationPdfHelpers.ts`.

## Branding

Brand colors:

```text
Primary:   #f4b000
Secondary: #111111
```

The logo is loaded from:

```text
frontend/public/assets/amiro-tech-logo.png
```

If the file is not present, the PDF still generates with an ATS fallback mark.

## Template References

Reference metadata lives in:

```text
data/templates/quotations/default-template.json
data/templates/quotations/quotation-theme.ts
```

These files document the supported sections, dynamic fields, and brand theme. Runtime PDF generation is handled by the browser-only jsPDF utility.

## Testing Checklist

- Existing auth works.
- Existing clients module works.
- Existing quotations module works.
- Structured sections render when provided: project overview, scope of work, tech stack, timeline, support, payment terms, and terms.
- Quotation detail page opens.
- Download PDF button shows `Generating quotation PDF...`.
- PDF filename uses `ATS-{quotation_number}.pdf`.
- PDF contains correct client details.
- PDF contains correct quotation items.
- Totals match the UI.
- Long terms flow onto additional pages.
- Logo renders when present.
- No quotation data is hardcoded.
