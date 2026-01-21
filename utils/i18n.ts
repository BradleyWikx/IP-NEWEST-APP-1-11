
export type Language = 'nl' | 'en';

const TRANSLATIONS = {
  nl: {
    // Wizard Steps
    step_date: 'Datum',
    step_party: 'Aantal',
    step_package: 'Arrangement',
    step_extras: "Extra's",
    step_shop: 'Shop',
    step_details: 'Gegevens',
    step_wishes: 'Wensen',
    step_review: 'Overzicht',
    
    // Headers
    header_when: 'Wanneer wilt u komen?',
    header_how_many: 'Met hoeveel personen?',
    header_package: 'Kies uw Arrangement',
    header_extras: 'Maak uw avond compleet',
    header_details: 'Uw Gegevens',
    header_wishes: 'Wensen & Opmerkingen',
    header_review: 'Controleer uw Boeking',
    
    // Actions
    btn_next: 'Volgende',
    btn_prev: 'Vorige',
    btn_confirm: 'Bevestig Boeking',
    btn_waitlist: 'Inschrijven Wachtlijst',
    btn_change: 'Wijzig',
    btn_open_calendar: 'Open Kalender',
    
    // Labels
    lbl_firstname: 'Voornaam',
    lbl_lastname: 'Achternaam',
    lbl_email: 'E-mailadres',
    lbl_phone: 'Telefoonnummer',
    lbl_comments: 'Overige Opmerkingen',
    lbl_dietary: 'Dieetwensen & Allergieën',
    lbl_company: 'Bedrijfsnaam',
    lbl_billing_note: 'Opmerkingen Factuur',
    lbl_country: 'Land',
    lbl_street: 'Straat',
    lbl_house_nr: 'Nr',
    lbl_zip: 'Postcode',
    lbl_city: 'Woonplaats',
    lbl_code: 'Landcode',
    
    // Packages
    pkg_standard: 'Standard',
    pkg_premium: 'Premium',
    pkg_feat_ticket: 'Entree Ticket',
    pkg_feat_dinner3: '3-gangen Diner',
    pkg_feat_drinks_basic: 'Basis drankjes inbegrepen',
    pkg_feat_seats: 'Beste plaatsen in de zaal',
    pkg_feat_dinner4: '4-gangen Deluxe Diner',
    pkg_feat_bubbly: 'Glas bubbels bij ontvangst',
    pkg_feat_drinks_prem: 'Onbeperkt Premium dranken',
    
    // Wishes
    celebration_check: 'Iets te vieren?',
    celebration_placeholder: 'Wat vieren we? (bijv. Verjaardag Sarah)',
    dietary_comments_lbl: 'Toelichting Dieet (Optioneel)',
    dietary_placeholder: 'Bijv. Kruisbesmetting is fataal...',
    comments_placeholder: 'Speciale verzoeken die niets met eten te maken hebben (bijv. rolstoel)...',
    
    // Review
    terms_agree: 'Ik ga akkoord met de',
    terms_link: 'algemene voorwaarden',
    terms_suffix: 'en het privacybeleid van Inspiration Point.',
    
    // Validation Errors
    err_firstname: 'Voornaam is verplicht.',
    err_lastname: 'Achternaam is verplicht.',
    err_street: 'Straatnaam is verplicht.',
    err_city: 'Woonplaats is verplicht.',
    err_email_req: 'E-mailadres is verplicht.',
    err_email_inv: 'Ongeldig e-mailadres formaat.',
    err_phone_req: 'Telefoonnummer is verplicht.',
    err_phone_inv: 'Telefoonnummer moet minimaal 8 cijfers bevatten.',
    err_zip: 'Postcode is verplicht.',
    err_house_nr: 'Huisnummer is verplicht.',
    err_date_past: 'Deze datum ligt in het verleden.',
    err_capacity: 'Helaas, capaciteit overschreden. Probeer een andere datum.',
    
    // Alerts & Status
    alert_capacity: 'Let op: Deze aanvraag overschrijdt de standaard capaciteit.',
    alert_waitlist: 'U schrijft zich in voor de wachtlijst. U betaalt nu nog niets.',
    alert_success: 'Aanvraag Ontvangen!',
    alert_dupe: 'Let op: Er bestaat al een recente reservering met dit e-mailadres voor deze datum.',
    
    // Misc
    selected_date: 'Geselecteerde Datum',
    no_date: 'Er is geen datum geselecteerd.',
    is_business: 'Zakelijke boeking?',
    pp: 'p.p.',
    selected: 'Geselecteerd',
    add: 'Toevoegen',
    added: 'Toegevoegd',
    confirmation_title: 'Aanvraag Ontvangen!',
    confirmation_msg: 'Bedankt',
    confirmation_sub: 'We hebben je aanvraag goed ontvangen.',
    calendar_google: 'Google Calendar',
    calendar_ics: 'Outlook / Apple',
    back_home: 'Terug naar Home',
    portal_btn: 'Bekijk in Portaal'
  },
  en: {
    // Wizard Steps
    step_date: 'Date',
    step_party: 'Party Size',
    step_package: 'Package',
    step_extras: 'Add-ons',
    step_shop: 'Shop',
    step_details: 'Details',
    step_wishes: 'Wishes',
    step_review: 'Review',
    
    // Headers
    header_when: 'When would you like to visit?',
    header_how_many: 'How many guests?',
    header_package: 'Choose your Package',
    header_extras: 'Complete your evening',
    header_details: 'Your Details',
    header_wishes: 'Wishes & Remarks',
    header_review: 'Review your Booking',
    
    // Actions
    btn_next: 'Next',
    btn_prev: 'Previous',
    btn_confirm: 'Confirm Booking',
    btn_waitlist: 'Join Waitlist',
    btn_change: 'Change',
    btn_open_calendar: 'Open Calendar',
    
    // Labels
    lbl_firstname: 'First Name',
    lbl_lastname: 'Last Name',
    lbl_email: 'Email Address',
    lbl_phone: 'Phone Number',
    lbl_comments: 'Other Comments',
    lbl_dietary: 'Dietary Requirements',
    lbl_company: 'Company Name',
    lbl_billing_note: 'Billing Notes',
    lbl_country: 'Country',
    lbl_street: 'Street',
    lbl_house_nr: 'Nr',
    lbl_zip: 'Zip Code',
    lbl_city: 'City',
    lbl_code: 'Code',
    
    // Packages
    pkg_standard: 'Standard',
    pkg_premium: 'Premium',
    pkg_feat_ticket: 'Entrance Ticket',
    pkg_feat_dinner3: '3-course Dinner',
    pkg_feat_drinks_basic: 'Basic drinks included',
    pkg_feat_seats: 'Best seats in the house',
    pkg_feat_dinner4: '4-course Deluxe Dinner',
    pkg_feat_bubbly: 'Glass of bubbly on arrival',
    pkg_feat_drinks_prem: 'Unlimited Premium drinks',
    
    // Wishes
    celebration_check: 'Something to celebrate?',
    celebration_placeholder: 'What are we celebrating? (e.g. Sarah\'s Birthday)',
    dietary_comments_lbl: 'Dietary Details (Optional)',
    dietary_placeholder: 'E.g. Cross-contamination is fatal...',
    comments_placeholder: 'Special requests unrelated to food (e.g. wheelchair)...',
    
    // Review
    terms_agree: 'I agree to the',
    terms_link: 'terms and conditions',
    terms_suffix: 'and the privacy policy of Inspiration Point.',
    
    // Validation Errors
    err_firstname: 'First name is required.',
    err_lastname: 'Last name is required.',
    err_street: 'Street is required.',
    err_city: 'City is required.',
    err_email_req: 'Email address is required.',
    err_email_inv: 'Invalid email format.',
    err_phone_req: 'Phone number is required.',
    err_phone_inv: 'Phone number must have at least 8 digits.',
    err_zip: 'Zip code is required.',
    err_house_nr: 'House number is required.',
    err_date_past: 'This date is in the past.',
    err_capacity: 'Capacity exceeded. Please choose another date.',
    
    // Alerts & Status
    alert_capacity: 'Note: This request exceeds standard capacity.',
    alert_waitlist: 'You are joining the waitlist. No payment required yet.',
    alert_success: 'Request Received!',
    alert_dupe: 'Note: A recent reservation exists with this email for this date.',
    
    // Misc
    selected_date: 'Selected Date',
    no_date: 'No date selected.',
    is_business: 'Business booking?',
    pp: 'p.p.',
    selected: 'Selected',
    add: 'Add',
    added: 'Added',
    confirmation_title: 'Request Received!',
    confirmation_msg: 'Thanks',
    confirmation_sub: 'We have received your request.',
    calendar_google: 'Google Calendar',
    calendar_ics: 'Outlook / Apple',
    back_home: 'Back to Home',
    portal_btn: 'View in Portal'
  }
};

export const getTranslation = (lang: Language, key: string): string => {
  // @ts-ignore
  return TRANSLATIONS[lang]?.[key] || key;
};

export const useTranslation = () => {
  const storedLang = localStorage.getItem('grand_stage_lang') as Language || 'nl';
  const t = (key: string) => getTranslation(storedLang, key);
  
  const setLanguage = (lang: Language) => {
    localStorage.setItem('grand_stage_lang', lang);
    window.location.reload(); // Simple reload to apply
  };

  return { t, language: storedLang, setLanguage };
};
