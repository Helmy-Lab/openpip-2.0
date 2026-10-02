import { settingsHandlers } from './settings'
import { siteTextHandlers } from './siteText'
import { announcementsHandlers } from './announcements'
import { countsHandlers } from './counts'
import { authHandlers } from './auth'
import { searchHandlers } from './search'
import { downloadHandlers } from './downloads'
import { datasetHandlers } from './datasets'
import { proteinHandlers } from './proteins'
import { networksHandlers } from './networks'
import { filesHandlers } from './files'
import { rcsbHandlers } from './rcsb'
import { interactionCategoryHandlers } from './interactionCategories'
import { sharingHandlers } from './sharing'

export const handlers = [
  ...settingsHandlers,
  ...siteTextHandlers,
  ...announcementsHandlers,
  ...countsHandlers,
  ...authHandlers,
  ...searchHandlers,
  ...downloadHandlers,
  ...datasetHandlers,
  ...proteinHandlers,
  ...networksHandlers,
  ...filesHandlers,
  ...rcsbHandlers,
  ...interactionCategoryHandlers,
  ...sharingHandlers,
]
