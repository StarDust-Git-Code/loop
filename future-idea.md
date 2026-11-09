# Future ideas

Ideas that are agreed but not built yet. Each one says what it is, why it is worth building, and a first sketch of how it would fit into Loopmates.

## Research harness: deep technical research (datasheets, patents, claims)

**What.** A harness for long, careful research jobs on technical sources, the way the coding harness supervises Claude Code, Codex or OpenCode. It works through primary documents instead of web summaries:

- **Datasheets and application notes**: electrical ratings, pinouts, timing, thermal limits, package options, errata.
- **Patents**: claims (independent and dependent), priority dates, assignees, families, citations, legal status.
- **Claims in general**: what a vendor, paper or patent actually claims, versus what the evidence supports.
- Standards, papers and regulatory filings where they matter.

**Why.** Research (the Mate) is good at quick, sourced answers. Engineering and IP questions need more: reading a 120-page datasheet, comparing five parts on the same parameters, or mapping a product against patent claims. That takes hours, many documents and strict citation down to the page and table, which is the same kind of supervised, multi-round job the coding harness already handles.

**Sketch.**

1. **Brief.** The Research Mate (or Data, for comparisons) writes a research brief: the question, what counts as an answer, which source types are allowed, and the comparison parameters.
2. **Collect.** Find the primary documents (manufacturer PDFs, patent office records such as Google Patents, Espacenet, USPTO or WIPO, and standards bodies). Download them into the run's workspace, record where each one came from, and dedupe revisions.
3. **Extract.** Parse the PDFs into text and tables page by page. Pull parameters into a structured table with the page and table number for every value. For patents, split the claims into their elements and keep the claim tree.
4. **Analyse.**
   - Datasheets: a parameter comparison table, with conditions kept (for example "at 25 °C, VDD = 3.3 V"), plus gaps and contradictions.
   - Patents: a claim chart (element by element against a product or a prior-art document), priority timeline and family map.
   - Claims: every claim marked supported, partly supported, unsupported or contradicted, each with a citation.
5. **Review.** A second pass, by another model or the Halo Mate, checks every number and quote against its page. Anything without a citation is dropped or flagged. Up to three rounds, like the coding harness.
6. **Report.** Writer produces the final report: the answer first, then the tables, the claim chart, the open questions, and a source list with page references. Files go to Drive or Obsidian.

**Guardrails.**

- It is not legal advice. Patent reports carry a plain note that infringement and validity need a patent attorney.
- Quote exactly and keep units and test conditions. Never round or convert a value without saying so.
- Respect site terms and rate limits. Prefer official APIs (patent offices, manufacturer APIs) over scraping.

**Open questions.** Which PDF and table extractor to use (local and free), how to store large document sets (Drive or a local folder on the server), whether to let the owner upload a starting set of documents, and how to show claim charts in the dashboard.

## Mascot descriptions in role cards

Each role card could carry one line describing the Mate's mascot, so a Mate can refer to itself in character. It needs a short description of each mascot image in `dashboard/public/dots/`.
