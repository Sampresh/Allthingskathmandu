// English / Nepali UI text (Part 4 §1). Each message holds both languages so pages can render
// both into the cached HTML; data names use the nameEn / nameNe fields instead.

export const LANG_COOKIE = 'atk_lang'
export const LANGS = ['en', 'ne']

export const messages = {
  // Common
  'common.home': { en: 'Home', ne: 'गृहपृष्ठ' },
  'common.switchLanguage': { en: 'नेपाली', ne: 'English' },
  'common.switchLanguageLabel': { en: 'Switch to Nepali', ne: 'अङ्ग्रेजीमा हेर्नुहोस्' },
  'common.retry': { en: 'Try again', ne: 'फेरि प्रयास गर्नुहोस्' },
  'common.or': { en: 'or', ne: 'वा' },
  'common.loading': { en: 'Loading…', ne: 'लोड हुँदैछ…' },
  'site.name': { en: 'All Things Kathmandu', ne: 'अल थिङ्स काठमाडौं' },

  // Errors and empty pages
  'error.title': { en: 'Something went wrong', ne: 'केही गडबड भयो' },
  'error.body': {
    en: 'We could not load this page. Please try again.',
    ne: 'यो पृष्ठ लोड गर्न सकिएन। फेरि प्रयास गर्नुहोस्।',
  },
  'notFound.title': { en: 'Page not found', ne: 'पृष्ठ भेटिएन' },
  'notFound.body': {
    en: "The page you're looking for doesn't exist or has moved.",
    ne: 'तपाईंले खोजेको पृष्ठ छैन वा सारिएको छ।',
  },

  // Auth
  'auth.email': { en: 'Email', ne: 'इमेल' },
  'auth.password': { en: 'Password', ne: 'पासवर्ड' },
  'auth.name': { en: 'Full name', ne: 'पूरा नाम' },
  'auth.newPassword': { en: 'New password', ne: 'नयाँ पासवर्ड' },
  'auth.confirmPassword': { en: 'Confirm password', ne: 'पासवर्ड पुष्टि गर्नुहोस्' },
  'auth.passwordHint': { en: 'At least 8 characters', ne: 'कम्तीमा ८ अक्षर' },
  'auth.login.title': { en: 'Log in', ne: 'लग इन' },
  'auth.login.submit': { en: 'Log in', ne: 'लग इन गर्नुहोस्' },
  'auth.forgotLink': { en: 'Forgot password?', ne: 'पासवर्ड बिर्सनुभयो?' },
  'auth.noAccount': { en: "Don't have an account?", ne: 'खाता छैन?' },
  'auth.registerLink': { en: 'Create one', ne: 'खाता बनाउनुहोस्' },
  'auth.haveAccount': { en: 'Already have an account?', ne: 'पहिले नै खाता छ?' },
  'auth.loginLink': { en: 'Log in', ne: 'लग इन गर्नुहोस्' },
  'auth.backToLogin': { en: 'Back to log in', ne: 'लग इनमा फर्कनुहोस्' },
  'auth.register.title': { en: 'Create your account', ne: 'खाता बनाउनुहोस्' },
  'auth.register.submit': { en: 'Create account', ne: 'खाता बनाउनुहोस्' },
  'auth.register.done': {
    en: 'Check your email for a link to verify your account.',
    ne: 'खाता प्रमाणित गर्ने लिङ्कका लागि आफ्नो इमेल हेर्नुहोस्।',
  },
  'auth.verify.title': { en: 'Verify your email', ne: 'इमेल प्रमाणित गर्नुहोस्' },
  'auth.verify.intro': {
    en: 'Confirm this is your email address to finish creating your account.',
    ne: 'खाता बनाउने काम पूरा गर्न यो तपाईंकै इमेल हो भनी पुष्टि गर्नुहोस्।',
  },
  'auth.verify.submit': { en: 'Verify email', ne: 'इमेल प्रमाणित गर्नुहोस्' },
  'auth.verify.done': {
    en: 'Your email is verified. You can log in now.',
    ne: 'तपाईंको इमेल प्रमाणित भयो। अब लग इन गर्न सक्नुहुन्छ।',
  },
  'auth.linkMissing': {
    en: 'This link is incomplete. Open the link from your email again.',
    ne: 'यो लिङ्क अपूर्ण छ। इमेलबाट लिङ्क फेरि खोल्नुहोस्।',
  },
  'auth.resend.title': { en: 'Need a new link?', ne: 'नयाँ लिङ्क चाहियो?' },
  'auth.resend.submit': { en: 'Send a new link', ne: 'नयाँ लिङ्क पठाउनुहोस्' },
  'auth.resend.done': {
    en: 'If that account still needs verifying, we have sent a new link.',
    ne: 'खाता प्रमाणित गर्न बाँकी भए हामीले नयाँ लिङ्क पठाएका छौं।',
  },
  'auth.forgot.title': { en: 'Reset your password', ne: 'पासवर्ड रिसेट गर्नुहोस्' },
  'auth.forgot.intro': {
    en: "Enter your email and we'll send you a reset link.",
    ne: 'आफ्नो इमेल लेख्नुहोस्, हामी रिसेट लिङ्क पठाउँछौं।',
  },
  'auth.forgot.submit': { en: 'Send reset link', ne: 'रिसेट लिङ्क पठाउनुहोस्' },
  'auth.forgot.done': {
    en: 'If an account exists for that email, we have sent a reset link.',
    ne: 'त्यो इमेलको खाता भए हामीले रिसेट लिङ्क पठाएका छौं।',
  },
  'auth.reset.title': { en: 'Choose a new password', ne: 'नयाँ पासवर्ड राख्नुहोस्' },
  'auth.reset.submit': { en: 'Save new password', ne: 'नयाँ पासवर्ड सुरक्षित गर्नुहोस्' },
  'auth.reset.done': {
    en: 'Your password is updated. Log in with your new password.',
    ne: 'पासवर्ड परिवर्तन भयो। नयाँ पासवर्डले लग इन गर्नुहोस्।',
  },
  'auth.2fa.title': { en: 'Two-step verification', ne: 'दुई-चरण प्रमाणीकरण' },
  'auth.2fa.setupIntro': {
    en: 'Admin accounts need an authenticator app. Scan this QR code, then enter the 6-digit code it shows.',
    ne: 'एडमिन खाताका लागि अथेन्टिकेटर एप चाहिन्छ। यो QR कोड स्क्यान गर्नुहोस्, अनि देखिएको ६ अङ्कको कोड लेख्नुहोस्।',
  },
  'auth.2fa.verifyIntro': {
    en: 'Enter the 6-digit code from your authenticator app.',
    ne: 'अथेन्टिकेटर एपबाट ६ अङ्कको कोड लेख्नुहोस्।',
  },
  'auth.2fa.qrAlt': {
    en: 'QR code for your authenticator app',
    ne: 'अथेन्टिकेटर एपका लागि QR कोड',
  },
  'auth.2fa.manual': {
    en: "Can't scan? Enter this key:",
    ne: 'स्क्यान भएन? यो कुञ्जी लेख्नुहोस्:',
  },
  'auth.2fa.code': { en: '6-digit code', ne: '६ अङ्कको कोड' },
  'auth.2fa.submit': { en: 'Verify', ne: 'प्रमाणित गर्नुहोस्' },

  // Validation (keys used as Zod messages)
  'v.required': { en: 'This field is required', ne: 'यो आवश्यक छ' },
  'v.email': { en: 'Enter a valid email', ne: 'मान्य इमेल लेख्नुहोस्' },
  'v.passwordMin': { en: 'Use at least 8 characters', ne: 'कम्तीमा ८ अक्षर प्रयोग गर्नुहोस्' },
  'v.passwordMax': { en: 'Password is too long', ne: 'पासवर्ड धेरै लामो भयो' },
  'v.passwordMatch': { en: "Passwords don't match", ne: 'पासवर्ड मिलेन' },
  'v.code': { en: 'Enter the 6-digit code', ne: '६ अङ्कको कोड लेख्नुहोस्' },

  // API error codes
  'e.INVALID_CREDENTIALS': { en: 'Email or password is incorrect.', ne: 'इमेल वा पासवर्ड मिलेन।' },
  'e.EMAIL_NOT_VERIFIED': {
    en: 'Verify your email before logging in.',
    ne: 'लग इन गर्नुअघि इमेल प्रमाणित गर्नुहोस्।',
  },
  'e.ACCOUNT_SUSPENDED': { en: 'This account is suspended.', ne: 'यो खाता निलम्बित छ।' },
  'e.RATE_LIMITED': {
    en: 'Too many attempts. Please wait a while and try again.',
    ne: 'धेरै प्रयास भए। केही बेरपछि फेरि प्रयास गर्नुहोस्।',
  },
  'e.TOKEN_INVALID': {
    en: 'This link is invalid or has expired.',
    ne: 'यो लिङ्क अमान्य छ वा यसको म्याद सकिएको छ।',
  },
  'e.INVALID_CODE': { en: 'That code is not valid.', ne: 'कोड मिलेन।' },
  'e.CHALLENGE_INVALID': {
    en: 'This step expired. Please log in again.',
    ne: 'यो चरणको समय सकियो। फेरि लग इन गर्नुहोस्।',
  },
  'e.TURNSTILE_FAILED': {
    en: 'The bot check failed. Please try again.',
    ne: 'बोट जाँच असफल भयो। फेरि प्रयास गर्नुहोस्।',
  },
  'e.NETWORK': {
    en: "Can't reach the server. Check your connection.",
    ne: 'सर्भरसँग जोडिन सकिएन। इन्टरनेट जडान जाँच गर्नुहोस्।',
  },
  'e.default': {
    en: 'Something went wrong. Please try again.',
    ne: 'केही गडबड भयो। फेरि प्रयास गर्नुहोस्।',
  },
}

export function translate(key, lang = 'en') {
  const entry = messages[key]
  if (!entry) return key
  return entry[lang] ?? entry.en
}

/**
 * Message for an API error: a translated message for known codes, else the server's own
 * message (always English), else a generic one. Returns { en, ne }.
 */
export function errorText(error) {
  const known = error?.code && messages[`e.${error.code}`]
  if (known) return known
  if (error?.message) return { en: error.message, ne: error.message }
  return messages['e.default']
}
