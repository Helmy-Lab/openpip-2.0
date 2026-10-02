import type { TextGroup } from '../types'

/**
 * The About page body was previously hardcoded below the editable `about`
 * settings blob, so most of it could not be changed at all. Each section is now
 * its own key: the heading and the prose separately, so an admin can retitle,
 * rewrite, or blank a section without touching layout.
 *
 * Blanking BOTH the heading and body of a section removes it from the page.
 */
export const aboutGroup: TextGroup = {
  id: 'about',
  label: 'About page',
  route: '/about',
  description:
    'Section-by-section copy for the About page. The intro block above these sections is edited under About content above.',
  entries: [
    {
      key: 'about.title',
      section: 'Page header',
      label: 'Page title',
      default: 'About {title}',
      hint: 'Use {title} to insert the site title from Site Settings.',
    },
    {
      key: 'about.fallbackIntro',
      section: 'Page header',
      label: 'Intro fallback',
      kind: 'multiline',
      default: 'openPIP is an open-source protein interaction platform.',
      hint: 'Shown only when the About content in Site Settings is empty.',
    },

    // ── Proteome-scale efforts ──
    {
      key: 'about.proteomeScale.heading',
      section: 'Proteome-scale efforts',
      label: 'Proteome-scale: heading',
      default: 'CCSB Proteome-scale efforts',
    },
    {
      key: 'about.hi105.heading',
      section: 'Proteome-scale efforts',
      label: 'HI-I-05: heading',
      default: 'HI-I-05',
    },
    {
      key: 'about.hi105.body',
      section: 'Proteome-scale efforts',
      label: 'HI-I-05: body',
      kind: 'multiline',
      default:
        'Our first iteration at mapping the human protein interactome (Rual et al Nature 2005) screened a space (Space I) of ~8,000 ORFs corresponding to ~7,000 genes, and identified ~2,700 high-quality binary PPIs. This search space represents ~12% of the complete search space, assuming a total of ~20,000 protein-coding genes.',
    },
    {
      key: 'about.hi214.heading',
      section: 'Proteome-scale efforts',
      label: 'HI-II-14: heading',
      default: 'HI-II-14',
    },
    {
      key: 'about.hi214.body',
      section: 'Proteome-scale efforts',
      label: 'HI-II-14: body',
      kind: 'multiline',
      default:
        'The second phase of the human interactome mapping project (Rolland et al Cell 2014) generated a dataset of ~14,000 binary PPIs following two screens of a matrix of ~13,000 x 13,000 proteins (Space II). This search space covers ~42% of the complete search space, a more than 3 fold increase with respect to our first attempt.',
    },
    {
      key: 'about.huri.heading',
      section: 'Proteome-scale efforts',
      label: 'HuRI: heading',
      default: 'HuRI',
    },
    {
      key: 'about.huri.body',
      section: 'Proteome-scale efforts',
      label: 'HuRI: body',
      kind: 'multiline',
      default:
        'In the third phase of the project (Luck et al under review, BioRxiv) the human ORF collection being screened has been expanded to ~17,500 unique genes (Space III) and covers ~77% of the complete search space. ~53,000 PPIs identified from screening space III nine times with three variations of the Y2H assay are provided for search and download. This dataset is also referred to as HI-III-19.',
    },
    {
      key: 'about.hiUnion.heading',
      section: 'Proteome-scale efforts',
      label: 'HI-union: heading',
      default: 'HI-union',
    },
    {
      key: 'about.hiUnion.body',
      section: 'Proteome-scale efforts',
      label: 'HI-union: body',
      kind: 'multiline',
      default:
        'HI-union is an aggregate of all PPIs identified in HI-I-05, HI-II-14, HuRI, Venkatesan-09, Yu-11, Yang-16, and Test space screens-19 (see below) transcript and protein identifiers for each interaction.',
    },

    // ── Other efforts ──
    {
      key: 'about.otherEfforts.heading',
      section: 'Other efforts',
      label: 'Other efforts: heading',
      default: 'Other CCSB protein interaction mapping efforts',
    },
    {
      key: 'about.venkatesan09.heading',
      section: 'Other efforts',
      label: 'Venkatesan-09: heading',
      default: 'Venkatesan-09',
    },
    {
      key: 'about.venkatesan09.body',
      section: 'Other efforts',
      label: 'Venkatesan-09: body',
      kind: 'multiline',
      default:
        'To estimate the coverage and size of the human interactome (Venkatesan et al Nature Methods 2009), four Y2H screens were performed on a set of ~1,800 DB-X fusion proteins (or baits, representing ~1,700 unique genes) against ~1,800 AD-Y proteins (or preys, representing ~1,800 unique genes), corresponding to ~10% of the available genes and ~1% of the full search space. This dataset contains ~200 high-quality binary PPIs.',
    },
    {
      key: 'about.yu11.heading',
      section: 'Other efforts',
      label: 'Yu-11: heading',
      default: 'Yu-11',
    },
    {
      key: 'about.yu11.body',
      section: 'Other efforts',
      label: 'Yu-11: body',
      kind: 'multiline',
      default:
        'To develop a novel Stitch-seq interactome mapping protocol, a Y2H screen was carried out inside Space II (Yu et al Nature Methods 2011). Stitch-seq combines PCR stitching with next-generation sequencing, and increases the efficiency and cost effectiveness of Y2H screening. The resulting dataset contains ~1,200 PPIs among proteins encoded by ~1,100 human genes.',
    },
    {
      key: 'about.yang16.heading',
      section: 'Other efforts',
      label: 'Yang-16: heading',
      default: 'Yang-16',
    },
    {
      key: 'about.yang16.body',
      section: 'Other efforts',
      label: 'Yang-16: body',
      kind: 'multiline',
      default:
        'To assess the extent to which different protein isoforms generated by alternative splicing from the same gene perform different functions within the cell, we have successfully cloned multiple isoforms for 161 genes and screened those for PPIs against all human ORFs from space II (Yang et al Cell 2016). ~700 PPIs have been identified.',
    },
    {
      key: 'about.testSpace.heading',
      section: 'Other efforts',
      label: 'Test space screens-19: heading',
      default: 'Test space screens-19',
    },
    {
      key: 'about.testSpace.body',
      section: 'Other efforts',
      label: 'Test space screens-19: body',
      kind: 'multiline',
      default:
        'To develop, optimize, and benchmark improvements to the mapping pipeline and variations of the Y2H assay, independent, reciprocal screens on a search space of ~1,800 x ~1,800 genes were completed, constituting ~1% of the full search space. In total, 1,159 PPIs have been identified in these screens and those have been published as part of the paper describing HuRI.',
    },

    // ── Literature ──
    {
      key: 'about.literature.heading',
      section: 'Literature',
      label: 'Literature: heading',
      default: 'Literature',
    },
    {
      key: 'about.litbm.heading',
      section: 'Literature',
      label: 'Lit-BM: heading',
      default: 'Lit-BM',
    },
    {
      key: 'about.litbm.body',
      section: 'Literature',
      label: 'Lit-BM: body',
      kind: 'multiline',
      default:
        'Previously published work (Rolland et al Cell 2014) identified that a subset of the curated interactions from the scientific literature that have at least two pieces of experimental evidence (two different methods or two different papers) of which at least one stems from a binary protein interaction detection assay (Literature binary multiple = Lit-BM) retested at comparable rates in protein interaction detection assays compared to interactions identified in the CCSB screening efforts. Binary PPIs with only one piece of experimental evidence retested at significantly lower rate. Here, we provide an updated set of all PPIs in Lit-BM that we obtained from filtering and classifying PPIs from the Mentha resource. Details of the filtering and classification are described in the HuRI paper.',
    },

    // ── Dataset citations ──
    {
      key: 'about.datasetCitations.heading',
      section: 'Dataset citations',
      label: 'Dataset citations: heading',
      default: 'Data sources and citations',
      allowBlank: true,
      hint: 'The entries under this heading come from the datasets themselves. Edit a dataset under Admin → Data to change its paragraph or citation.',
    },
    {
      key: 'about.datasetCitations.intro',
      section: 'Dataset citations',
      label: 'Dataset citations: intro',
      kind: 'multiline',
      allowBlank: true,
      default:
        'Every dataset available through openPIP is listed below with its source publication. Please cite the original publication alongside openPIP when you use a dataset.',
    },

    // ── Screening pipeline ──
    {
      key: 'about.pipeline.heading',
      section: 'Screening pipeline',
      label: 'Screening pipeline: heading',
      default: 'Description of the Y2H screening pipeline',
    },
    {
      key: 'about.pipeline.body',
      section: 'Screening pipeline',
      label: 'Screening pipeline: body',
      kind: 'multiline',
      default:
        'Details on our screening, pairwise test, and validation protocols are available as part of the HuRI paper and previously published protocols (Choi et al Methods Mol Biol 2018, Dreze et al Methods Enzymol 2010). Briefly, ORFs from the hORFeome collection were transferred into DNA-binding (DB) and activation domain (AD) Y2H destination vectors (see below). The vectors were consequently used to transform yeast strains (see below). Strong DB autoactivators were removed prior to screening. Yeast strains with 1,000 different AD-ORFs were pooled and mated with a single DB-ORF yeast strain. Growing yeast colonies were picked and sequenced to identify likely interacting pairs (First Pass Pairs = FiPPs). FiPPs were consequently individually tested in quadruplicate in a Y2H pairwise test and sequence confirmed resulting in a dataset of verified PPIs. A random subset of these verified PPIs are selected and tested in orthogonal protein interaction detection assays along with sets of known PPIs (positive control) and random pairs of proteins (negative control) to test for the quality of the identified PPIs. If found to be of high biophysical quality, the dataset is considered as validated and as such meets our criteria for publication. Of note, validation controls for the biophysical quality of the identified interactions. Dissecting the functional relevance of a given PPI requires extensive experimental follow-up.',
    },

    // ── Tables ──
    {
      key: 'about.vectorTable.heading',
      section: 'Reference tables',
      label: 'Vector details: heading',
      default: 'Vector details',
    },
    {
      key: 'about.vectorTable.html',
      section: 'Reference tables',
      label: 'Vector details: table',
      kind: 'html',
      default: '',
      hint: 'Leave empty to use the built-in vector details table. Supply HTML (a <table>) to replace it.',
    },
    {
      key: 'about.assayTable.heading',
      section: 'Reference tables',
      label: 'Y2H assay versions: heading',
      default: 'Y2H assay versions',
    },
    {
      key: 'about.assayTable.intro',
      section: 'Reference tables',
      label: 'Y2H assay versions: intro',
      kind: 'multiline',
      default:
        'Combinations of different yeast strains and vectors result in different Y2H assay versions as described in the table below.',
    },
    {
      key: 'about.assayTable.note',
      section: 'Reference tables',
      label: 'Y2H assay versions: note',
      kind: 'multiline',
      default:
        'Assay version 0 was used to generate the datasets HI-I-05 and Venkatesan-09. Assay version 1 was used to generate HI-II-14, Yu-11, Yang-16, some of the test space screens, and the screens 1-3 of HuRI. Assay version 2 was used to generate screens 4-6 and some test space screens and assay version 3 for screens 7-9 of HuRI and some test space screens.',
    },
    {
      key: 'about.assayTable.html',
      section: 'Reference tables',
      label: 'Y2H assay versions: table',
      kind: 'html',
      default: '',
      hint: 'Leave empty to use the built-in assay versions table. Supply HTML (a <table>) to replace it.',
    },

    // ── Options ──
    {
      key: 'about.searchOptions.heading',
      section: 'Using openPIP',
      label: 'Search options: heading',
      default: 'Search options',
    },
    {
      key: 'about.searchOptions.body',
      section: 'Using openPIP',
      label: 'Search options: body',
      kind: 'multiline',
      default:
        'By default the search function of the web portal will return all query proteins with their interaction partners and all interactions between these proteins that have been identified in any of the PPI datasets described above. The results can be limited to interactions between query proteins and between query proteins and their interaction partners only. For larger queries and for cases when there is no need to display the results as network, the results can be directly retrieved as a data file.',
    },
    {
      key: 'about.filterOptions.heading',
      section: 'Using openPIP',
      label: 'Filter options: heading',
      default: 'Filter options',
    },
    {
      key: 'about.confidenceScore.heading',
      section: 'Using openPIP',
      label: 'Confidence score: heading',
      default: 'Confidence Score',
    },
    {
      key: 'about.confidenceScore.body',
      section: 'Using openPIP',
      label: 'Confidence score: body',
      kind: 'multiline',
      default:
        'This score is intended to rank human binary protein-protein interactions (PPIs) identified in systematic screens at CCSB based on their biophysical quality. A random subset of PPIs (~5%) from all Y2H screens are tested in orthogonal binary PPI detection assays, such as MAPPIT and GPCA, to demonstrate the high overall quality of each screen prior to release. The confidence score can be used to further prioritize interactions for experimental follow-up wherever needed. The score is based on information from the Y2H experiments and retest rates of specific subsets of PPIs in MAPPIT and GPCA. The score is the output of a statistical model of the MAPPIT and GPCA tests, which corrects for lower retest rates as a result of differences in the experimental detectability of PPIs rather than differences in their biophysical quality (see HuRI paper on detectability of PPIs).',
    },
    {
      key: 'about.confidenceScore.body2',
      section: 'Using openPIP',
      label: 'Confidence score: body (continued)',
      kind: 'multiline',
      default:
        'Specifically, the probability of a PPI testing positive in GPCA/MAPPIT data is modeled as being composed of two components, formulated as the regularized product of two logistic functions, both with the same input features. The first component represents the probability of a pair to be a false positive, the second represents the probability to test positive for a real interaction. This second component is constrained by data from testing PPIs found in Y2H which have additional independent literature evidence. The confidence score is calculated as the first component, scaled to an estimate of the overall precision of the dataset, obtained using the procedure described in Venkatesan et al Nature Methods 2009. The six features of a PPI used are: the number of screens in which it was detected; the number of different versions of the Y2H assay in which it was detected; the strength of growth of the yeast; whether the interaction between proteins X and Y was detected with both combinations of DNA-binding domain (DB) and activation domain (AD) fusions, i.e. DB-X with AD-Y and DB-Y with AD-X; the number of interaction partners of the two proteins; and the length of the ORF.',
    },
    {
      key: 'about.interactionStatus.heading',
      section: 'Using openPIP',
      label: 'Interaction status: heading',
      default: 'Interaction status',
    },
    {
      key: 'about.interactionStatus.body',
      section: 'Using openPIP',
      label: 'Interaction status: body',
      kind: 'multiline',
      default:
        'The results can also be restricted by interaction category, for example to show only screening data or only literature-curated interactions. The user can choose to display tissue expression levels and levels of tissue specific expression of nodes in the network in combination with the selection of a tissue (see below).',
    },
    {
      key: 'about.tissueExpression.heading',
      section: 'Using openPIP',
      label: 'Tissue expression: heading',
      default: 'Tissue expression',
    },
    {
      key: 'about.tissueExpression.body',
      section: 'Using openPIP',
      label: 'Tissue expression: body',
      kind: 'multiline',
      default:
        'One or multiple tissues can be selected to filter the protein interaction data for proteins that are expressed in all of the selected tissues. Only interactions between the expressed proteins will be displayed. Optionally, expression abundance levels can be represented on the network by increasing the node size. Specificity of expression is indicated by varying the intensity of the color of the nodes (only applicable to cases where a single tissue has been selected). The tissue gene expression data has been extracted from the GTEx portal and has been processed and normalized as described in Paulson et al BMC Bioinformatics 2017. The preferential expression of a given gene in a given tissue was calculated as described in Sonawane et al Cell Reports 2017. More details are also provided in the HuRI paper.',
    },
    {
      key: 'about.exportOptions.heading',
      section: 'Using openPIP',
      label: 'Export options: heading',
      default: 'Export options',
    },
    {
      key: 'about.exportOptions.body',
      section: 'Using openPIP',
      label: 'Export options: body',
      kind: 'multiline',
      default:
        'The network can be exported to Cytoscape by clicking the little orange network icon in the bottom right corner of the network browser, if Cytoscape is installed and running. The proteins displayed in the network can directly be exported as list into a variety of external resources to calculate functional enrichments and perform other network-related searches.',
    },
    {
      key: 'about.saveOptions.heading',
      section: 'Using openPIP',
      label: 'Save options: heading',
      default: 'Save options',
    },
    {
      key: 'about.saveOptions.body',
      section: 'Using openPIP',
      label: 'Save options: body',
      kind: 'multiline',
      default:
        'The search results can be saved as image (if a network was displayed) or in various text file formats as lists of proteins and interactions. Furthermore, the web portal offers to users the possibility to create an account. If the user is logged in, an extra Save button will appear on the results page allowing the user to save the search result and the exact network representation or session that the user generated. Later, the user can select a saved network/session and reload it into the network browser for further manipulation. Of note, users need to login first prior to performing a search or the search results will be lost.',
    },
    {
      key: 'about.requirements.heading',
      section: 'Using openPIP',
      label: 'Requirements: heading',
      default: 'Requirements to run the portal',
    },
    {
      key: 'about.requirements.body',
      section: 'Using openPIP',
      label: 'Requirements: body',
      kind: 'multiline',
      default:
        'The web browser must be configured to accept cookies and JavaScript must be enabled.',
    },

    // ── Programmatic access ──
    {
      key: 'about.programmatic.heading',
      section: 'Programmatic access',
      label: 'Programmatic access: heading',
      default: 'Programmatic Access',
    },
    {
      key: 'about.programmatic.body',
      section: 'Programmatic access',
      label: 'Programmatic access: body',
      kind: 'multiline',
      default:
        'openPIP provides several ways to access its data programmatically. All read endpoints are public and require no API key.',
    },
    {
      key: 'about.restApi.heading',
      section: 'Programmatic access',
      label: 'REST API: heading',
      default: 'REST API & interactive docs',
    },
    {
      key: 'about.restApi.body',
      section: 'Programmatic access',
      label: 'REST API: body',
      kind: 'html',
      default:
        'A full REST API is available at <a href="{base}/api/docs/">{base}/api/docs/</a>. Endpoints cover protein search, protein detail, interaction data, dataset listings, and file downloads. All responses are JSON and CORS-enabled for use from any browser or server.',
    },
    {
      key: 'about.deepLinks.heading',
      section: 'Programmatic access',
      label: 'Deep links: heading',
      default: 'Deep links',
    },
    {
      key: 'about.deepLinks.body',
      section: 'Programmatic access',
      label: 'Deep links: body',
      kind: 'multiline',
      default: 'Other websites can link directly to a search or protein page using stable URLs:',
    },
    {
      key: 'about.deepLinks.examples',
      section: 'Programmatic access',
      label: 'Deep links: example URLs',
      kind: 'multiline',
      default: '{base}/search/BRCA1\n{base}/search/BRCA1,TP53\n{base}/protein/BRCA1\n{base}/protein/P38398',
      hint: 'One URL per line. Rendered as a monospaced block.',
    },
    {
      key: 'about.sdk.heading',
      section: 'Programmatic access',
      label: 'Python SDK: heading',
      default: 'Python SDK & CLI',
    },
    {
      key: 'about.sdk.body',
      section: 'Programmatic access',
      label: 'Python SDK: body',
      kind: 'html',
      default:
        'For scripts and notebooks, call the REST API or PSICQUIC service directly from any language. A Python client package is not currently published.',
    },
    {
      key: 'about.psicquic.heading',
      section: 'Programmatic access',
      label: 'PSICQUIC: heading',
      default: 'PSICQUIC',
    },
    {
      key: 'about.psicquic.body',
      section: 'Programmatic access',
      label: 'PSICQUIC: body',
      kind: 'html',
      default:
        'openPIP implements the <a href="https://psicquic.github.io/">PSICQUIC standard</a>, the same protocol used by BioGRID and IntAct. Tools and scripts written for those databases can query openPIP at <a href="{base}/psicquic/rest/query?q=BRCA1&amp;format=tab25">{base}/psicquic/rest/query</a> with the same MIQL syntax, for the fields openPIP supports.',
    },
    {
      key: 'about.programmatic.footer',
      section: 'Programmatic access',
      label: 'Programmatic access: closing line',
      kind: 'html',
      default:
        'Full documentation with copy-paste code examples is on the <a href="/developer">API &amp; External Access</a> page.',
    },

    // ── Useful links ──
    {
      key: 'about.usefulLinks.heading',
      section: 'Useful links',
      label: 'Useful links: heading',
      default: 'Useful Links',
    },
    {
      key: 'about.links.search.label',
      section: 'Useful links',
      label: 'Link: Search',
      default: 'Search',
    },
    {
      key: 'about.links.search.desc',
      section: 'Useful links',
      label: 'Link: Search description',
      default: 'Search proteins and interactions',
    },
    {
      key: 'about.links.downloads.label',
      section: 'Useful links',
      label: 'Link: Downloads',
      default: 'Downloads',
    },
    {
      key: 'about.links.downloads.desc',
      section: 'Useful links',
      label: 'Link: Downloads description',
      default: 'Download full interaction datasets',
    },
    {
      key: 'about.links.docs.label',
      section: 'Useful links',
      label: 'Link: Documentation',
      default: 'Documentation',
    },
    {
      key: 'about.links.docs.desc',
      section: 'Useful links',
      label: 'Link: Documentation description',
      default: 'How to use the web interface',
    },
    {
      key: 'about.links.developer.label',
      section: 'Useful links',
      label: 'Link: API access',
      default: 'API & External Access',
    },
    {
      key: 'about.links.developer.desc',
      section: 'Useful links',
      label: 'Link: API access description',
      default: 'REST API, SDK, PSICQUIC, code examples',
    },
    {
      key: 'about.links.swagger.label',
      section: 'Useful links',
      label: 'Link: Interactive docs',
      default: 'Interactive API Docs',
    },
    {
      key: 'about.links.swagger.desc',
      section: 'Useful links',
      label: 'Link: Interactive docs description',
      default: 'Swagger UI - try every endpoint live',
    },
    {
      key: 'about.links.schema.label',
      section: 'Useful links',
      label: 'Link: OpenAPI schema',
      default: 'OpenAPI Schema',
    },
    {
      key: 'about.links.schema.desc',
      section: 'Useful links',
      label: 'Link: OpenAPI schema description',
      default: 'Machine-readable schema (JSON/YAML)',
    },
    {
      key: 'about.links.psicquic.label',
      section: 'Useful links',
      label: 'Link: PSICQUIC endpoint',
      default: 'PSICQUIC Endpoint',
    },
    {
      key: 'about.links.psicquic.desc',
      section: 'Useful links',
      label: 'Link: PSICQUIC description',
      default: 'Standard PPI query interface',
    },
    {
      key: 'about.links.faq.label',
      section: 'Useful links',
      label: 'Link: FAQ',
      default: 'FAQ',
    },
    {
      key: 'about.links.faq.desc',
      section: 'Useful links',
      label: 'Link: FAQ description',
      default: 'Frequently asked questions',
    },
    {
      key: 'about.links.contact.label',
      section: 'Useful links',
      label: 'Link: Contact',
      default: 'Contact',
    },
    {
      key: 'about.links.contact.desc',
      section: 'Useful links',
      label: 'Link: Contact description',
      default: 'Get in touch with the team',
    },

    // ── Acknowledgments ──
    {
      key: 'about.acknowledgments.heading',
      section: 'Acknowledgments',
      label: 'Acknowledgments: heading',
      default: 'Acknowledgments',
    },
    {
      key: 'about.acknowledgments.body',
      section: 'Acknowledgments',
      label: 'Acknowledgments: body',
      kind: 'multiline',
      default:
        'CCSB interactome mapping and ORFeome cloning efforts are supported by federal grants from the National Human Genome Research Institute of NIH, the Ellison Foundation, the Dana-Farber Cancer Institute Strategic Initiative, the Canada Excellence Research Chairs program, and the Canadian Institutes of Health Research.',
    },
    {
      key: 'about.versionPrefix',
      label: 'Version line prefix',
      default: 'Version',
    },
  ],
}
