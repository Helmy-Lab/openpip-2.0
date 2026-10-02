/**
 * Display names for the tissue_expression annotation keys.
 *
 * Cosmetic only. *Which* tissues exist comes from the loaded data — see
 * tissuesWithData in features/search/filterInteractions — so a deployment
 * carrying tissues we have no label for still works; those keys just get
 * prettified instead. This map only makes the ones we do know read better.
 *
 * Transcribed from `annotation_type.fields` in the database, which has carried
 * them since legacy but stores them inverted ({label: key}) and is exposed by
 * no API. Worth serving from the backend if a deployment ever loads a tissue
 * set of its own; until something can import tissue annotations at all, that
 * would be a round trip to relabel constants.
 *
 * brain_0/1/2 are the reason this exists. They are YARN's PCoA clusters, not an
 * ordering anyone chose by hand, so underscore-prettifying them produced
 * "Brain 0 / 1 / 2" on screen — meaningless to a biologist. See
 * docs/project/DATA_PROVENANCE_QUESTIONS.md §5.
 */
export const TISSUE_LABELS: Record<string, string> = {
  adipose_subcutaneous: 'Adipose Subcutaneous',
  adipose_visceral_omentum: 'Adipose Visceral Omentum',
  adrenal_gland: 'Adrenal Gland',
  artery_aorta: 'Artery Aorta',
  artery_coronary: 'Artery Coronary',
  artery_tibial: 'Artery Tibial',
  brain_0: 'Brain basal ganglia',
  brain_1: 'Brain cerebellum',
  brain_2: 'Brain other',
  breast_mammary_tissue: 'Breast Mammary Tissue',
  colon_sigmoid: 'Colon Sigmoid',
  colon_transverse: 'Colon Transverse',
  esophagus_gastroesophageal_junction: 'Esophagus Gastroesophageal Junction',
  esophagus_mucosa: 'Esophagus Mucosa',
  esophagus_muscularis: 'Esophagus Muscularis',
  heart_atrial_appendage: 'Heart Atrial Appendage',
  heart_left_ventricle: 'Heart Left Ventricle',
  kidney_cortex: 'Kidney Cortex',
  liver: 'Liver',
  lung: 'Lung',
  minor_salivary_gland: 'Minor Salivary Gland',
  muscle_skeletal: 'Muscle Skeletal',
  nerve_tibial: 'Nerve Tibial',
  ovary: 'Ovary',
  pancreas: 'Pancreas',
  pituitary: 'Pituitary',
  prostate: 'Prostate',
  skin: 'Skin',
  small_intestine_terminal_ileum: 'Small Intestine Terminal Ileum',
  spleen: 'Spleen',
  stomach: 'Stomach',
  testis: 'Testis',
  thyroid: 'Thyroid',
  uterus: 'Uterus',
  vagina: 'Vagina',
  whole_blood: 'Whole Blood',
}

/**
 * A tissue key's display name. Falls back to prettifying the key, so a dataset
 * that arrives with tissues we have no label for still reads sensibly.
 */
export function tissueLabel(key: string): string {
  return (
    TISSUE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/**
 * Tissue labels matching a typed prefix, for suggesting in the search box.
 *
 * Typing "in liver" only works if you already know "liver" is a tissue openPIP
 * holds. Offering the list as you type is what makes the phrase search
 * discoverable rather than a syntax to memorise — and it keeps the user to
 * names that exist, so the parser will recognise whatever they pick.
 */
export function searchTissues(prefix: string, limit = 6): string[] {
  const needle = prefix.trim().toLowerCase()
  if (needle.length < 2) return []
  const labels = Object.keys(TISSUE_LABELS).map(tissueLabel)
  const starts = labels.filter((l) => l.toLowerCase().startsWith(needle))
  const contains = labels.filter(
    (l) => !l.toLowerCase().startsWith(needle) && l.toLowerCase().includes(needle)
  )
  return [...starts, ...contains].slice(0, limit)
}

// Legacy saves the tissue filter in interaction_network.tissue_expression_array.
const SAVED_TISSUES_MAX = 100

/** As many of the selected tissues as fit legacy's 100-character column. */
export function tissuesThatFit(tissues: string[]): string {
  const kept: string[] = []
  for (const tissue of tissues) {
    if ([...kept, tissue].join(',').length > SAVED_TISSUES_MAX) break
    kept.push(tissue)
  }
  return kept.join(',')
}
