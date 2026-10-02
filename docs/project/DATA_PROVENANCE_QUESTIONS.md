# Data provenance — tissue expression and the other network-view tabs

**Status:** closed — kept as the record of where the tab data comes from
**Raised:** 2026-08-04 · **Updated:** 2026-08-16
**Context:** mentor feedback item *"Cite data sources on network-view tabs
(e.g. Tissue Expression) and all dependent resources"*

While implementing that item we had to establish where each network-view tab's
data actually comes from. Most of it resolved from the code and the legacy dump.
Tissue expression took longer: the data is GTEx-derived but is not a raw GTEx
download, and the record of what was done to it turned out to live somewhere
nobody would grep — see §1.

We traced it. **The short version: it is GTEx v6.0, processed with YARN
(Paulson et al., BMC Bioinformatics 2017), inherited from HuRI.** The evidence
is in §2.

This attribution is **live on the Tissue Expression tab** as of 2026-08-08. The
processing chain is stated in openPIP's own About text and matches HuRI's, so
that part is documented rather than inferred; the v6.0 release number is
inferred, and §3 says exactly how far.

**This is no longer a list of questions for Dr. Helmy** — it was closed on
2026-08-16 without going to him. It stays in the docs because it is the only
place the provenance is written down, and because the next person to wonder
where "brain_0" came from should find this instead of repeating the search.

---

## Summary

| Tab | Source | Status |
|---|---|---|
| Interactions | openPIP database (`dataset`, `interaction_category`) | ✅ resolved |
| Subcellular Location | Human Protein Atlas Cell Atlas | ✅ resolved |
| GO:MF / BP / CC | Gene Ontology, computed by g:Profiler | ✅ resolved |
| Reactome / CORUM / KEGG | those resources, computed by g:Profiler | ✅ resolved |
| Tissue Expression | GTEx v6.0 → YARN, via HuRI | ✅ traced (§3) |
| Tissue Specificity | same, preferential expression per Sonawane et al. 2017 | ✅ traced (§3) |

One bug was found and fixed along the way (§4).

---

## 1. Why this was hard to answer

**The data is inherited and frozen — and it was already frozen in legacy.**
Legacy does not fetch tissue expression: it ships pre-baked inside the 143 MB
`dev10.0_huri.sql` dump, loaded once at container init by `populate_db.sh`. The
upload paths that do exist never touch it — `DataController.php` creates only
`litbm_interaction` and `experiment` annotations, and `data-upload/uploader.py`
is a browser driver for that same form. **There is no code path in legacy —
admin UI, CLI, or script — that can create or refresh a tissue expression
annotation.** openPIP 2.0 inherits the same rows via a bulk table copy in
`migration/migrate_legacy.py`.

So the answer was never going to be in either repository. The preparation
happened upstream, in HuRI.

**The one piece of attribution that exists is data, not code.** The claim of
origin lives in `annotation_type.description`:

> "only display proteins known to be expressed in the selected tissues
> **(based on GTEx data)**. See the About section for more details."

The tooltip in `web/assets/js/search_results.js:2710` just renders that column.
That is the *only* place either project names a source — which is part of why
the miscitation in §4 was easy to miss. It was never visible in code review.

**The "About section" it points to does exist — in the database.** This is the
part that cost us the most time, and it is worth recording so nobody repeats it.
Legacy `app/Resources/views/about.html.twig` contains zero mentions of GTEx,
Reactome, or Gene Ontology, which reads like the promised detail was never
written. It was: legacy stores About content in `admin_settings.about`, a
`longtext` column, and that column says:

> "The tissue gene expression data has been extracted from the GTEx portal and
> has been processed and normalized as described in **Paulson et al BMC
> Bioinformatics 2017**. The preferential expression of a given gene in a given
> tissue was calculated as described in **Sonawane et al Cell Reports 2017**.
> More details are also provided in the HuRI paper."

openPIP 2.0 already carries this text — `frontend/src/text/groups/about.ts:334`.

So the provenance was documented all along. The failure was never a missing
record; it was that **the record lived only in prose on a page nobody reads,
while the tabs that display the data cited nothing** — and, in 2.0, eventually
cited the wrong thing entirely (§4). That is exactly the gap the feedback item
is asking us to close, and why it says "*and all dependent resources*."

---

## 2. What the data actually is

openPIP was built to host HuRI, and the tissue data came with it. Our own About
text (§1) names the processing; the
[HuRI portal's About page](https://interactome-atlas.org/about/) carries the
same two sentences, confirming where ours was inherited from:

> "The tissue gene expression data has been extracted from the GTEx portal and
> has been processed and normalized as described in Paulson et al BMC
> Bioinformatics 2017."
>
> "The preferential expression of a given gene in a given tissue was calculated
> as described in Sonawane et al Cell Reports 2017."

Paulson et al. 2017 is **YARN** (*Tissue-aware RNA-Seq processing and
normalization for heterogeneous and sparse data*), which processed **GTEx
v6.0**, reducing 53 sampling sites to **38 tissues**.

### The evidence that this is our data

Three independent checks, none of which we had to assume:

**1. The brain labels are verbatim.** YARN merged brain subregions by PCoA and
named the result:

> "We merged the cerebellum and cerebellar hemisphere subregions (**brain
> cerebellum**) and removed these from the remaining brain subregions… We found
> that basal ganglia (**brain basal ganglia**) clustered separately from the
> remaining subregions that did not further separate into other groups (**brain
> other**; largely cortex)."

Our `annotation_type.fields` map contains exactly those three strings:

```
brain_0  →  Brain basal ganglia
brain_1  →  Brain cerebellum
brain_2  →  Brain other
```

This also explains the otherwise baffling `_0/_1/_2` suffixes: they are
**cluster indices from a PCoA**, not an ordering anyone chose by hand.

**2. The tissue count reconciles exactly.** YARN yields 38 tissues, of which two
are cell lines (cultured fibroblasts and EBV-transformed lymphocytes) that YARN
explicitly keeps "as independent tissues". openPIP has **36** — the same set
with the two cell lines dropped, which is the sensible choice for a portal about
human tissues.

**3. Skin is unsplit.** GTEx separates sun-exposed from not-sun-exposed skin;
YARN merged them, having "found no distinguishable difference in the PCoA
plots"; openPIP has a single `skin`.

### What this means for the three original questions

| Question | Answer |
|---|---|
| Which GTEx release? | **v6.0**, via YARN — not v8. |
| What are `brain_0/1/2`? | PCoA clusters: **basal ganglia / cerebellum / other (largely cortex)**. |
| What normalization? | **qsmooth** (smooth quantile normalization), per YARN. |

**Our earlier guess about the units was wrong** and is worth flagging. From the
value distribution alone (range 0.04–17.8, median 9.9) we had inferred
log2(TPM+1), and nearly published "5.0 ≈ TPM 31" on that basis. The values are
qsmooth-normalized, so that conversion does not hold. This is the one thing we
still cannot pin down: whether a log2 step was applied after qsmooth, and
therefore what **≥ 5.0 means in interpretable terms**.

### Where the 5.0 threshold comes from

An earlier draft of this document said the threshold "is configuration, not a
constant", because `annotation_type.filter` holds the string `'5.0 >'`. That was
wrong, and the correction is worth recording because it looks like config from
every angle except the one that matters.

**Nothing reads that column.** In legacy, `Annotation_Type::getFilter()` has no
callers anywhere in `src`, `app` or `web`. The controller does ship the value to
the browser, where `search_results.js` assigns it three times — lines 1291, 1440
and 1467 — and never uses the variable:

```js
var fields = AnnotationTypesArray['tissue_expression']['fields'];
var filter = AnnotationTypesArray['tissue_expression']['filter'];   // never read
```

The effective threshold is a literal, written twice with two spellings:

- `search_results.js:1296` — `if(5 > proteinTissueArray[annotation_name] || …)`
- `search_results.js:1336` — `if( 5.0 > tissueExpressionArray[tissue] || …)`

The stored `'5.0 >'` is the source expression pasted into a config column as
documentation. It was never a knob; it is a comment that happens to live in the
database.

Note the `fields` line above: legacy loads the display-name map and drops it the
same way, which is why it shows "Brain 0 / 1 / 2" — see §5.

openPIP 2.0 therefore hardcodes the threshold too, which is parity rather than
an oversight (`TISSUE_THRESHOLD` in `features/search/filterInteractions.ts`,
mirrored in `enrichment/TissueExpressionTable.tsx`). Making it admin-editable
would be a new feature, not a restoration of one.

---

## 3. How far the inference goes

These were the three items we had drafted to ask Dr. Helmy. We closed them
ourselves on 2026-08-16 rather than spend mentor time on them — the citation
that shipped is defensible without his sign-off, and the one genuinely unknown
item is unknown to him too, since it predates openPIP. Recorded here so nobody
mistakes an inference for a record.

1. **The release number — inferred, well corroborated.** That the chain is
   GTEx → YARN → HuRI → openPIP is documented in our own About text. That the
   release is specifically **v6.0** comes from the YARN paper plus the
   three-way tissue-set match in §2, not from anything openPIP records. The
   citation names v6.0 on that basis.
2. **What `≥ 5.0` means — genuinely unknown.** The values are
   qsmooth-normalized, so we cannot say whether a log2 step followed or what
   the threshold corresponds to in interpretable units. Nothing in either
   repository records it; the answer, if it exists, is upstream in HuRI. The
   tab therefore states the threshold without interpreting it, which is the
   honest position and needs no revisiting unless someone finds the original
   preparation script.
3. **The wording that shipped.** The Tissue Expression tab reads:

   > Data source: GTEx v6.0 (GTEx Consortium), normalized with YARN (Paulson et
   > al., *BMC Bioinformatics* 2017) as distributed with HuRI (Luck et al.,
   > *Nature* 2020). Covers 36 tissues, with brain regions grouped into three
   > clusters. Proteins are listed for a tissue at a qsmooth-normalized
   > expression level ≥ 5.0.

**Sonawane et al., *Cell Reports* 2017** covers the preferential-expression
calculation behind the `tissue_specificity` annotations (28,179 rows). It is
already cited in the About text and needs no change. openPIP 2.0 does not
surface tissue specificity in the UI, so there is no tab that needs it either.

If the original data-preparation script ever turns up it would settle (1) and
(2) at once, but it is likely upstream in HuRI rather than anything openPIP
ever held.

---

## 4. Bug found and fixed

**The Tissue Expression tab was citing the wrong database.**

openPIP 2.0 credited the tab to "Human Protein Atlas (Uhlén et al., Science
2015)". The data is GTEx. The tell is the tissue vocabulary — the keys are
verbatim GTEx names that HPA does not use:

```
adipose_visceral_omentum     artery_tibial
esophagus_gastroesophageal_junction
heart_atrial_appendage       kidney_cortex
```

HPA would say "adipose tissue" and "cerebral cortex". Fixed, with a regression
test that fails if the HPA attribution reappears on that tab.

To be clear about scope: **this was a 2.0 bug, not inherited from legacy.**
Legacy never attributed the tab at all.

Two smaller corrections shipped alongside it:

- **Subcellular location reliability was being discarded.** The stored value is
  the HPA reliability score (`approved` / `supported` / `validated`), but the
  code was using it only as a yes/no flag and dropping the grade. It is now
  shown per protein. No new data was needed — it was already there.
- **Enrichment attribution was misleading.** It read as though g:Profiler were
  the data source. It now separates the resource (Gene Ontology, Reactome,
  CORUM, KEGG) from the tool that computes enrichment over it (g:Profiler).

---

## 5. A separate, fixable UI problem — fixed 2026-08-15

Both the legacy site and openPIP 2.0 displayed the brain tissues to biologists
as **"Brain 0 / 1 / 2"** — not because the labels were lost, but because neither
front end used the column that holds them. Legacy is the sharper case: it *reads*
`fields` into a variable and never touches it again (§2). `annotation_type.fields` has carried
the display-name map all along. openPIP 2.0 hardcoded the tissue key list in
`SearchSidebar.tsx` and prettified by replacing underscores, which is where the
meaningless labels came from.

**Fixed.** Three places invented labels independently — the sidebar filter
dropdown, the protein detail panel and the enrichment tissue table — so the map
now lives once in `frontend/src/lib/tissues.ts` and all three read
`tissueLabel()`. The brain clusters read "Brain basal ganglia", "Brain
cerebellum" and "Brain other"; a test fails if any tissue label renders a bare
cluster index again.

*Which* tissues exist is no longer hardcoded either. The filter dropdown used to
offer a fixed list of these 36 regardless of what a deployment had loaded, which
sat badly against openPIP being a portal anyone can put their own data in. It now
reads the tissues off the loaded results (`tissuesWithData`, sharing the filter's
own threshold check, so the menu cannot offer a tissue that returns nothing).

That leaves the label map cosmetic: a deployment carrying tissues we have no
label for still works, those keys just get prettified. Worth serving the map from
`annotation_type.fields` if that day comes — but nothing in openPIP can import a
tissue annotation yet (§1), so today it would be a round trip to relabel
constants.

This is a small improvement over legacy rather than a parity change.

---

## References

- Luck K. *et al.* A reference map of the human binary protein interactome.
  *Nature* 580, 402–408 (2020). https://www.nature.com/articles/s41586-020-2188-x
- Paulson J.N. *et al.* Tissue-aware RNA-Seq processing and normalization for
  heterogeneous and sparse data. *BMC Bioinformatics* 18, 437 (2017).
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5627434/
- HuRI portal, About page. https://interactome-atlas.org/about/
- GTEx Portal. https://gtexportal.org
