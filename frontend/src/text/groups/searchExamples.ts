import type { TextGroup } from '../types'

/**
 * The phrase examples under the home page search box.
 *
 * A group of its own, rather than entries in `home`, so the admin editor can
 * put them on the Search panel beside the gene examples they sit next to on the
 * page. Groups are the unit the editor exposes, and `search` itself is
 * deliberately unexposed — it is dense UI labelling nobody asked to retitle —
 * so a narrow group is the way to surface exactly these three.
 *
 * They teach the phrase search by example, so edit them to match what a
 * deployment's data can actually answer: a tissue name here that the loaded
 * datasets have no expression data for would demonstrate a filter that returns
 * nothing.
 */
export const searchExamplesGroup: TextGroup = {
  id: 'searchExamples',
  label: 'Phrase examples',
  route: '/',
  description:
    'Phrases shown under the home page search box, demonstrating what can be typed. Clicking one fills the box rather than searching.',
  entries: [
    {
      key: 'searchExamples.label',
      label: 'Heading above the phrases',
      section: 'Phrase examples',
      default: 'Or ask',
    },
    {
      key: 'searchExamples.phrase1',
      label: 'Phrase example 1',
      section: 'Phrase examples',
      default: 'BCL2 in liver',
      hint: 'Shows that a tissue can be named. Use a tissue this deployment holds expression data for.',
    },
    {
      key: 'searchExamples.phrase2',
      label: 'Phrase example 2',
      section: 'Phrase examples',
      default: 'TP53 and MDM2 with high confidence',
      hint: 'Shows several genes and a confidence threshold.',
    },
    {
      key: 'searchExamples.phrase3',
      label: 'Phrase example 3',
      section: 'Phrase examples',
      default: 'what binds CDK2 in testis',
      hint: 'Shows that an ordinary question works. Leave any example blank to hide it.',
      allowBlank: true,
    },
  ],
}
