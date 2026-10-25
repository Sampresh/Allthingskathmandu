import { authMessages } from './auth'

// UI text used only in the member area (/account) and the review form (loaded on demand).
export const accountMessages = {
  'account.title': { en: 'Your account', ne: 'तपाईंको खाता' },
  'account.nav.profile': { en: 'Profile', ne: 'प्रोफाइल' },
  'account.nav.saved': { en: 'Saved', ne: 'सुरक्षित' },
  'account.nav.reviews': { en: 'My reviews', ne: 'मेरा समीक्षाहरू' },
  'account.cancel': { en: 'Cancel', ne: 'रद्द गर्नुहोस्' },

  'account.profile.title': { en: 'Profile', ne: 'प्रोफाइल' },
  'account.name': { en: 'Name', ne: 'नाम' },
  'account.email': { en: 'Email', ne: 'इमेल' },
  'account.emailHint': {
    en: 'Your login email. It is never shown on the site.',
    ne: 'लग इन गर्ने इमेल। यो साइटमा कहिल्यै देखाइँदैन।',
  },
  'account.phone': { en: 'Phone (optional)', ne: 'फोन (वैकल्पिक)' },
  'account.save': { en: 'Save changes', ne: 'परिवर्तन सुरक्षित गर्नुहोस्' },
  'account.savedChanges': { en: 'Changes saved.', ne: 'परिवर्तन सुरक्षित भयो।' },

  'account.password.title': { en: 'Password', ne: 'पासवर्ड' },
  'account.password.current': { en: 'Current password', ne: 'हालको पासवर्ड' },
  'account.password.new': { en: 'New password', ne: 'नयाँ पासवर्ड' },
  'account.password.confirm': { en: 'Confirm new password', ne: 'नयाँ पासवर्ड पुष्टि गर्नुहोस्' },
  'account.password.submit': { en: 'Change password', ne: 'पासवर्ड परिवर्तन गर्नुहोस्' },
  'account.password.set': { en: 'Set password', ne: 'पासवर्ड राख्नुहोस्' },
  'account.password.googleOnly': {
    en: 'You sign in with Google. Set a password to also log in with your email.',
    ne: 'तपाईं Google बाट लग इन गर्नुहुन्छ। इमेलबाट पनि लग इन गर्न पासवर्ड राख्नुहोस्।',
  },
  'account.password.done': {
    en: 'Password changed. Your other devices have been signed out.',
    ne: 'पासवर्ड परिवर्तन भयो। अरू उपकरणहरूबाट लग आउट गरियो।',
  },

  'account.sessions.title': { en: 'Devices', ne: 'उपकरणहरू' },
  'account.sessions.intro': {
    en: 'Where you are logged in. Sign out any device you do not recognise.',
    ne: 'तपाईं लग इन भएका ठाउँहरू। चिनेको नभए त्यो उपकरणबाट लग आउट गर्नुहोस्।',
  },
  'account.sessions.current': { en: 'This device', ne: 'यो उपकरण' },
  'account.sessions.signOut': { en: 'Sign out', ne: 'लग आउट' },
  'account.sessions.signOutAll': { en: 'Sign out everywhere', ne: 'सबै उपकरणबाट लग आउट' },
  'account.sessions.since': { en: 'Signed in', ne: 'लग इन' },
  'account.sessions.unknown': { en: 'Unknown device', ne: 'अज्ञात उपकरण' },

  'account.delete.title': { en: 'Delete account', ne: 'खाता मेटाउनुहोस्' },
  'account.delete.intro': {
    en: 'This removes your name, email, phone and saved listings, and signs you out everywhere. Your reviews stay, shown as "Former member". Listings you manage become unclaimed. This cannot be undone.',
    ne: 'यसले तपाईंको नाम, इमेल, फोन र सुरक्षित सूचीहरू हटाउँछ र सबै उपकरणबाट लग आउट गर्छ। तपाईंका समीक्षाहरू "पूर्व सदस्य" नाममा रहन्छन्। तपाईंले चलाएका सूचीहरू दाबी नगरिएको अवस्थामा फर्कन्छन्। यो फिर्ता गर्न सकिँदैन।',
  },
  'account.delete.password': { en: 'Password', ne: 'पासवर्ड' },
  'account.delete.confirm': { en: 'Type DELETE to confirm', ne: 'पुष्टि गर्न DELETE लेख्नुहोस्' },
  'account.delete.submit': { en: 'Delete my account', ne: 'मेरो खाता मेटाउनुहोस्' },

  'account.saved.title': { en: 'Saved listings', ne: 'सुरक्षित सूचीहरू' },
  'account.saved.empty': {
    en: 'Nothing saved yet. Tap Save on a listing to keep it here.',
    ne: 'अहिलेसम्म केही सुरक्षित छैन। सूचीमा "सुरक्षित गर्नुहोस्" थिचेर यहाँ राख्नुहोस्।',
  },
  'account.saved.remove': { en: 'Remove', ne: 'हटाउनुहोस्' },

  'account.reviews.title': { en: 'My reviews', ne: 'मेरा समीक्षाहरू' },
  'account.reviews.empty': {
    en: 'You have not reviewed anything yet.',
    ne: 'तपाईंले अहिलेसम्म कुनै समीक्षा लेख्नुभएको छैन।',
  },
  'account.reviews.PENDING': { en: 'Waiting for a check', ne: 'जाँच हुँदै' },
  'account.reviews.APPROVED': { en: 'Published', ne: 'प्रकाशित' },
  'account.reviews.REJECTED': { en: 'Not published', ne: 'प्रकाशित भएन' },
  'account.reviews.edit': { en: 'Edit', ne: 'सम्पादन' },
  'account.reviews.delete': { en: 'Delete', ne: 'मेटाउनुहोस्' },
  'account.reviews.deleteTitle': { en: 'Delete this review?', ne: 'यो समीक्षा मेटाउने?' },
  'account.reviews.deleteBody': {
    en: 'It will be removed from the listing straight away.',
    ne: 'यो सूचीबाट तुरुन्तै हटाइनेछ।',
  },
  'account.reviews.unavailable': { en: 'No longer listed', ne: 'अब सूचीमा छैन' },

  'review.title': { en: 'Write a review', ne: 'समीक्षा लेख्नुहोस्' },
  'review.editTitle': { en: 'Edit your review', ne: 'आफ्नो समीक्षा सम्पादन गर्नुहोस्' },
  'review.rating': { en: 'Your rating', ne: 'तपाईंको मूल्याङ्कन' },
  'review.body': { en: 'Your review (optional)', ne: 'तपाईंको समीक्षा (वैकल्पिक)' },
  'review.bodyHint': {
    en: 'What was good or bad? Up to 1000 characters.',
    ne: 'के राम्रो वा नराम्रो लाग्यो? १००० अक्षरसम्म।',
  },
  'review.submit': { en: 'Post review', ne: 'समीक्षा पठाउनुहोस्' },
  'review.update': { en: 'Save review', ne: 'समीक्षा सुरक्षित गर्नुहोस्' },
  'review.pending': {
    en: 'Thanks! Your review will appear after a quick check.',
    ne: 'धन्यवाद! छोटो जाँचपछि तपाईंको समीक्षा देखिनेछ।',
  },
  'review.editNote': {
    en: 'Edited reviews are checked again before they appear.',
    ne: 'सम्पादित समीक्षा फेरि जाँच भएपछि मात्र देखिन्छ।',
  },
  'review.myReviews': { en: 'Go to my reviews', ne: 'मेरा समीक्षाहरूमा जानुहोस्' },

  'auth.passwordHint': authMessages['auth.passwordHint'],
  'v.required': authMessages['v.required'],
  'v.passwordMin': authMessages['v.passwordMin'],
  'v.passwordMax': authMessages['v.passwordMax'],
  'v.passwordMatch': authMessages['v.passwordMatch'],
  'v.name': { en: 'Enter your name', ne: 'आफ्नो नाम लेख्नुहोस्' },
  'v.phone': { en: 'Enter a valid phone number', ne: 'मान्य फोन नम्बर लेख्नुहोस्' },
  'v.confirmDelete': { en: 'Type DELETE in capitals', ne: 'ठूला अक्षरमा DELETE लेख्नुहोस्' },
  'v.rating': { en: 'Pick a rating', ne: 'मूल्याङ्कन छान्नुहोस्' },
  'v.reviewMax': { en: 'Keep it under 1000 characters', ne: '१००० अक्षरभित्र लेख्नुहोस्' },

  'e.INVALID_PASSWORD': { en: 'Your current password is incorrect.', ne: 'पासवर्ड मिलेन।' },
  'e.ALREADY_REVIEWED': {
    en: 'You have already reviewed this listing. You can edit that review instead.',
    ne: 'तपाईंले यो सूचीको समीक्षा पहिले नै गर्नुभएको छ। त्यही समीक्षा सम्पादन गर्न सक्नुहुन्छ।',
  },
  'e.STAFF_ACCOUNT': {
    en: 'Staff accounts cannot be deleted here. Ask a super admin to remove your staff role first.',
    ne: 'स्टाफ खाता यहाँबाट मेटाउन मिल्दैन। पहिले सुपर एडमिनलाई स्टाफ भूमिका हटाउन भन्नुहोस्।',
  },
}
