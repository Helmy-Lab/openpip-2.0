import type { TextGroup } from '../types'

export const navGroup: TextGroup = {
  id: 'nav',
  label: 'Navigation & chrome',
  description: 'Main nav links, account actions, and the site footer shell.',
  entries: [
    {
      key: 'nav.home',
      label: 'Home link',
      section: 'Main navigation',
      default: 'Home',
    },
    {
      key: 'nav.search',
      label: 'Search link',
      section: 'Main navigation',
      default: 'Search',
    },
    {
      key: 'nav.proteins',
      label: 'Proteins link',
      section: 'Main navigation',
      default: 'Proteins',
    },
    {
      key: 'nav.downloads',
      label: 'Downloads link',
      section: 'Main navigation',
      default: 'Downloads',
    },
    {
      key: 'nav.api',
      label: 'API link',
      section: 'Main navigation',
      default: 'API',
    },
    {
      key: 'nav.about',
      label: 'About link',
      section: 'Main navigation',
      default: 'About',
    },
    {
      key: 'nav.faq',
      label: 'FAQ link',
      section: 'Main navigation',
      default: 'FAQ',
    },
    {
      key: 'nav.contact',
      label: 'Contact link',
      section: 'Main navigation',
      default: 'Contact',
    },

    {
      key: 'nav.admin',
      label: 'Admin link',
      section: 'Account menu',
      default: 'Admin',
    },
    {
      key: 'nav.profile',
      label: 'Profile link',
      section: 'Account menu',
      default: 'Profile',
    },
    {
      key: 'nav.logout',
      label: 'Logout button',
      section: 'Account menu',
      default: 'Logout',
    },
    {
      key: 'nav.login',
      label: 'Login link',
      section: 'Account menu',
      default: 'Login',
    },
    {
      key: 'nav.register',
      label: 'Register button',
      section: 'Account menu',
      default: 'Register',
    },

    {
      key: 'nav.ariaLabel',
      label: 'Nav landmark label',
      default: 'Main navigation',
      hint: 'Read aloud by screen readers to identify the navigation region.',
    },
    {
      key: 'nav.menu',
      label: 'Menu button (small screens)',
      default: 'Menu',
    },
    {
      key: 'nav.themeToLight',
      label: 'Theme toggle: to light',
      default: 'Switch to light mode',
    },
    {
      key: 'nav.themeToDark',
      label: 'Theme toggle: to dark',
      default: 'Switch to dark mode',
    },
  ],
}
