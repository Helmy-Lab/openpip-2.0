import type { TextGroup } from '../types'

/**
 * The copy on the account pages that is actually worth rewording: the promise
 * under each form title, the quote beside the login form, and the four things
 * registration says it unlocks.
 *
 * The forms themselves — "Sign in", "Password", "Forgot?", "Send reset link" —
 * live in `authLabelsGroup` below and ship fixed. They are the words every site
 * uses for those controls, and an admin who renames them mostly succeeds in
 * confusing visitors.
 */
export const authGroup: TextGroup = {
  id: 'auth',
  label: 'Sign in & registration',
  route: '/login',
  description: 'The prose on the login and registration pages. Field and button labels ship fixed.',
  entries: [
    {
      key: 'auth.login.subtitle',
      label: 'Subtitle',
      section: 'Login page',
      kind: 'multiline',
      default: 'Save, share and discuss your networks.',
    },

    {
      key: 'auth.login.panelEyebrow',
      label: 'Eyebrow',
      section: 'Login side panel',
      default: 'Every interaction, one query away',
    },
    {
      key: 'auth.login.panelQuote',
      label: 'Quote',
      section: 'Login side panel',
      kind: 'multiline',
      default: '"openPIP is the fastest way to walk a neighborhood of the human interactome."',
    },
    {
      key: 'auth.login.panelAttribution',
      label: 'Attribution',
      section: 'Login side panel',
      default: '- Helmy Lab, VIDO',
    },

    {
      key: 'auth.register.subtitle',
      label: 'Subtitle',
      section: 'Registration page',
      kind: 'multiline',
      default: 'Searching and downloading need no account.',
    },

    {
      key: 'auth.register.benefitsEyebrow',
      label: 'Eyebrow',
      section: 'Registration side panel',
      default: 'What you unlock',
    },
    {
      key: 'auth.register.benefitsHeading',
      label: 'Heading',
      section: 'Registration side panel',
      default: 'One account to keep and share your work.',
    },
    {
      key: 'auth.register.benefit1.title',
      label: 'Benefit 1: title',
      section: 'Registration side panel',
      default: 'Saved views',
    },
    {
      key: 'auth.register.benefit1.desc',
      label: 'Benefit 1: description',
      section: 'Registration side panel',
      kind: 'multiline',
      default: 'Keep a search with its filters and layout, and reopen it on the current data.',
    },
    {
      key: 'auth.register.benefit2.title',
      label: 'Benefit 2: title',
      section: 'Registration side panel',
      default: 'Sharing',
    },
    {
      key: 'auth.register.benefit2.desc',
      label: 'Benefit 2: description',
      section: 'Registration side panel',
      kind: 'multiline',
      default: 'Send a view to colleagues with a note, and discuss it together.',
    },
    {
      key: 'auth.register.benefit3.title',
      label: 'Benefit 3: title',
      section: 'Registration side panel',
      default: 'Public links',
    },
    {
      key: 'auth.register.benefit3.desc',
      label: 'Benefit 3: description',
      section: 'Registration side panel',
      kind: 'multiline',
      default: 'Publish a view as a link anyone can open, no login needed.',
    },
    {
      key: 'auth.register.benefit4.title',
      label: 'Benefit 4: title',
      section: 'Registration side panel',
      default: 'Notifications',
    },
    {
      key: 'auth.register.benefit4.desc',
      label: 'Benefit 4: description',
      section: 'Registration side panel',
      kind: 'multiline',
      default: 'See when someone shares a view with you or replies.',
    },

    {
      key: 'auth.register.success.title',
      label: 'Heading',
      section: 'After registering',
      default: 'Account created',
    },
    {
      key: 'auth.register.success.body',
      label: 'Body',
      section: 'After registering',
      kind: 'multiline',
      default: 'Your account is ready. Sign in to save and share networks.',
    },
  ],
}

/**
 * Field labels, button captions, links, validation messages and the profile
 * page's role and sign-out wording.
 *
 * Registered so the pages keep resolving these keys through `t()`, but not
 * wired to a settings tab — there is no editor for them. Any override already
 * stored against one of these keys still applies.
 */
export const authLabelsGroup: TextGroup = {
  id: 'authLabels',
  label: 'Sign in & registration: fixed labels',
  route: '/login',
  description: 'Form and button wording. Not editable from the admin panel.',
  entries: [
    { key: 'auth.login.title', label: 'Login: title', default: 'Sign in' },
    { key: 'auth.login.username', label: 'Login: username label', default: 'Username' },
    { key: 'auth.login.password', label: 'Login: password label', default: 'Password' },
    { key: 'auth.login.forgot', label: 'Login: forgot password link', default: 'Forgot?' },
    { key: 'auth.login.submit', label: 'Login: submit button', default: 'Sign in' },
    { key: 'auth.login.newPrompt', label: 'Login: sign-up prompt', default: 'New to openPIP?' },
    { key: 'auth.login.newLink', label: 'Login: sign-up link', default: 'Create an account' },
    {
      key: 'auth.login.error',
      label: 'Login: error message',
      default: 'Invalid username or password.',
    },
    { key: 'auth.login.submitting', label: 'Login: submitting button', default: 'Signing in…' },

    { key: 'auth.register.title', label: 'Register: title', default: 'Create your account' },
    { key: 'auth.register.username', label: 'Register: username label', default: 'Username' },
    { key: 'auth.register.email', label: 'Register: email label', default: 'Email' },
    { key: 'auth.register.password', label: 'Register: password label', default: 'Password' },
    {
      key: 'auth.register.confirm',
      label: 'Register: confirm password label',
      default: 'Confirm password',
    },
    { key: 'auth.register.submit', label: 'Register: submit button', default: 'Create account' },
    {
      key: 'auth.register.existingPrompt',
      label: 'Register: sign-in prompt',
      default: 'Already have an account?',
    },
    { key: 'auth.register.existingLink', label: 'Register: sign-in link', default: 'Sign in' },
    {
      key: 'auth.register.emailPlaceholder',
      label: 'Register: email placeholder',
      default: 'you@university.edu',
    },
    {
      key: 'auth.register.mismatch',
      label: 'Register: password mismatch',
      default: 'Passwords do not match.',
    },
    {
      key: 'auth.register.error',
      label: 'Register: failure message',
      default: 'Registration failed. Please try again.',
    },
    {
      key: 'auth.register.submitting',
      label: 'Register: submitting button',
      default: 'Creating account…',
    },
    {
      key: 'auth.register.success.cta',
      label: 'Register: confirmation button',
      default: 'Sign in now',
    },

    { key: 'auth.forgot.submit', label: 'Forgot password: submit', default: 'Send reset link' },
    {
      key: 'auth.forgot.emailPlaceholder',
      label: 'Forgot password: email placeholder',
      default: 'you@example.com',
    },
    { key: 'auth.forgot.submitting', label: 'Forgot password: submitting', default: 'Sending…' },

    { key: 'auth.reset.submit', label: 'Reset password: submit', default: 'Set new password' },
    {
      key: 'auth.reset.tooShort',
      label: 'Reset password: too short',
      default: 'Password must be at least 8 characters.',
    },
    {
      key: 'auth.reset.mismatch',
      label: 'Reset password: mismatch',
      default: 'Passwords do not match.',
    },
    {
      key: 'auth.reset.placeholder',
      label: 'Reset password: placeholder',
      default: 'At least 8 characters',
    },
    { key: 'auth.reset.submitting', label: 'Reset password: submitting', default: 'Saving…' },

    { key: 'auth.profile.role', label: 'Profile: role label', default: 'Role' },
    { key: 'auth.profile.roleAdmin', label: 'Profile: admin role', default: 'Administrator' },
    { key: 'auth.profile.roleUser', label: 'Profile: user role', default: 'Registered user' },
    { key: 'auth.profile.signOut', label: 'Profile: sign out button', default: 'Sign out' },
    { key: 'auth.profile.loading', label: 'Profile: loading', default: 'Loading…' },
    {
      key: 'auth.profile.noNetworks',
      label: 'Profile: no saved networks',
      default: 'No saved networks yet.',
    },
    { key: 'auth.profile.signingOut', label: 'Profile: signing out', default: 'Signing out…' },
  ],
}
