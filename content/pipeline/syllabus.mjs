// Subject codes (prisma/seed.ts) and the topic list Claude must choose from for each subject.
// Names that already exist in the seed are kept verbatim so imported questions attach to existing topics
// (and their study notes); the rest follow the JAMB syllabus and are created on import.

export const SUBJECTS = {
  ENG: 'Use of English',
  MTH: 'Mathematics',
  BIO: 'Biology',
  CHM: 'Chemistry',
  PHY: 'Physics',
  GOV: 'Government',
  ECO: 'Economics',
  LIT: 'Literature in English',
  GEO: 'Geography',
  AGR: 'Agricultural Science',
  COM: 'Commerce',
  ACC: 'Accounts',
  CRK: 'Christian Religious Knowledge',
  GEN: 'General Knowledge',
};

export const TOPICS = {
  ENG: [
    'Comprehension Passages', 'Lexis and Structure', 'Oral English', 'Register and Usage', 'Summary Writing',
    'Figures of Speech', 'Sentence Construction', 'Synonyms and Antonyms', 'Idioms and Proverbs', 'Prose Fiction',
  ],
  MTH: [
    'Number and Numeration', 'Algebraic Processes', 'Geometry and Mensuration', 'Trigonometry',
    'Statistics and Probability', 'Calculus', 'Sets', 'Surds and Indices', 'Logarithms', 'Sequences and Series',
    'Matrices and Determinants', 'Variation', 'Coordinate Geometry', 'Inequalities',
  ],
  BIO: [
    'Cell Biology', 'Genetics and Evolution', 'Ecology and Environment', 'Plant Biology', 'Animal Biology',
    'Human Biology and Physiology', 'Reproduction', 'Classification of Living Things', 'Nutrition', 'Excretion',
  ],
  CHM: [
    'Atomic Structure', 'Chemical Bonding', 'Stoichiometry', 'Acids, Bases and Salts', 'Redox Reactions',
    'Electrochemistry', 'Organic Chemistry', 'Chemical Kinetics', 'Equilibrium', 'Periodic Table',
    'Gas Laws', 'Water, Solutions and Solubility', 'Metals and Non-metals', 'Energy Changes', 'Separation Techniques',
  ],
  PHY: [
    'Mechanics', 'Heat and Temperature', 'Waves and Sound', 'Light and Optics', 'Electricity and Magnetism',
    'Nuclear Physics', 'Properties of Matter', 'Measurement and Units', 'Motion and Forces', 'Energy',
  ],
  GOV: [
    'Principles of Government', 'Nigerian Constitution', 'Political Parties', 'Electoral System', 'Local Government',
    'International Relations', 'Public Administration', 'Citizenship and Human Rights', 'Arms of Government',
    'African Politics',
  ],
  ECO: [
    'Demand and Supply', 'National Income', 'Money and Banking', 'International Trade', 'Agricultural Economics',
    'Public Finance', 'Population and Economic Development', 'Economic Systems', 'Price Determination',
    'Labour and Employment',
  ],
  LIT: [
    'Drama', 'Prose', 'Poetry', 'Literary Terms and Devices', 'African Literature', 'Non-African Literature',
    'Literary Appreciation', 'Prescribed Texts',
  ],
  GEO: [
    'Map Reading and Interpretation', 'The Earth and Solar System', 'Physical Geography', 'Climate and Weather',
    'Vegetation and Soils', 'Population and Settlement', 'Economic Geography', 'Geography of Nigeria',
    'Geography of Africa', 'Environmental Resources and Hazards',
  ],
  AGR: [
    'General Agriculture', 'Agronomy', 'Animal Production', 'Soil Science', 'Agricultural Economics and Extension',
    'Agricultural Engineering and Mechanisation', 'Forestry and Wildlife', 'Fisheries', 'Crop Protection',
  ],
  COM: [
    'Occupation and Production', 'Trade (Home and Foreign)', 'Business Organisations', 'Money and Banking',
    'Insurance', 'Transport and Communication', 'Marketing and Advertising', 'Stock Exchange and Capital Market',
    'Business Finance and Credit', 'Consumer Protection and Government in Business', 'Office Practice and Documents',
  ],
  ACC: [
    'Nature and Scope of Accounting', 'Books of Original Entry', 'Ledger and Trial Balance', 'Bank Reconciliation',
    'Final Accounts of Sole Traders', 'Control Accounts and Self-Balancing Ledgers', 'Partnership Accounts',
    'Company Accounts', 'Manufacturing Accounts', 'Non-Profit Organisations', 'Depreciation and Provisions',
    'Public Sector Accounting', 'Incomplete Records',
  ],
  CRK: [
    'Creation and the Patriarchs', 'Moses and the Exodus', 'Leadership in Israel (Judges and Kings)',
    'Prophets of Israel', 'Life and Ministry of Jesus', 'Parables and Miracles of Jesus',
    'Death and Resurrection of Jesus', 'The Early Church (Acts)', 'Pauline Epistles', 'General Epistles',
    'Christian Living and Ethics',
  ],
  GEN: [
    'Nigerian History and Government', 'Current Affairs', 'International Organisations', 'Geography and Environment',
    'Science and Technology', 'Arts, Culture and Sports', 'Logical and Quantitative Reasoning', 'World History',
    'Economy and Business',
  ],
};

// Free-text subject names found in the source files → code. Post-UTME general-paper style subjects fold into GEN.
const ALIASES = {
  eng: 'ENG', english: 'ENG', 'english language': 'ENG', 'use of english': 'ENG',
  mth: 'MTH', maths: 'MTH', math: 'MTH', mathematics: 'MTH',
  bio: 'BIO', biology: 'BIO', chm: 'CHM', chemistry: 'CHM', phy: 'PHY', physics: 'PHY',
  gov: 'GOV', government: 'GOV', eco: 'ECO', economics: 'ECO',
  lit: 'LIT', literature: 'LIT', 'literature in english': 'LIT',
  geo: 'GEO', geography: 'GEO', agr: 'AGR', agriculture: 'AGR', 'agricultural science': 'AGR',
  com: 'COM', commerce: 'COM', acc: 'ACC', accounts: 'ACC', accounting: 'ACC', 'principles of accounts': 'ACC',
  crk: 'CRK', crs: 'CRK', 'christian religious knowledge': 'CRK', 'christian religious studies': 'CRK',
  gen: 'GEN', 'general knowledge': 'GEN', 'general paper': 'GEN', 'current affairs': 'GEN',
};

/** Map a source file's subject name to a code. Unknown Post-UTME subjects (History, Sports, …) become GEN. */
export function subjectCode(name, examType) {
  const key = String(name ?? '').trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  return examType === 'POST_UTME' ? 'GEN' : null;
}
