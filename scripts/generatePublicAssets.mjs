import fs from 'fs';
import path from 'path';

const dirs = [
  'public/images/hero',
  'public/images/services',
  'public/images/employees',
];

for (const d of dirs) {
  fs.mkdirSync(path.resolve(process.cwd(), d), { recursive: true });
}

function createHeroSvg(variantIndex) {
  const bgTop = variantIndex === 0 ? '#FFFFFF' : variantIndex === 1 ? '#FAF7F2' : '#F5EFE6';
  const bgBottom = variantIndex === 0 ? '#F5EFE6' : variantIndex === 1 ? '#EFE6D8' : '#E8DEC9';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs>
    <linearGradient id="wall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#wall)"/>
  <rect x="40" y="40" width="1120" height="720" fill="none" stroke="#9A7950" stroke-width="2" stroke-opacity="0.35"/>
</svg>`;
}

function createServiceSvg(slug, theme, angleIndex, stepTitles) {
  const stepTitle = stepTitles[angleIndex] || `Ritual Step 0${angleIndex + 1}`;
  const palettes = [
    { bg1: '#FFFFFF', bg2: '#F7F2E9', accent: '#9A7950', badgeBg: '#292720', ink: '#292720' },
    { bg1: '#FFFFFF', bg2: '#EFE8DC', accent: '#7C5234', badgeBg: '#9A7950', ink: '#292720' },
    { bg1: '#FFFFFF', bg2: '#F3ECE1', accent: '#4C6545', badgeBg: '#4A392B', ink: '#292720' },
  ];
  const p = palettes[angleIndex % 3];

  let illustration = '';
  if (angleIndex === 0) {
    illustration = `
      <!-- Step 01 Visual: Botanical Vessels & Consultation -->
      <rect x="210" y="105" width="380" height="210" rx="14" fill="#FAF7F2" stroke="#D9CEBD" stroke-width="2"/>
      <circle cx="320" cy="210" r="56" fill="#EDE4D7" stroke="#9A7950" stroke-width="2.5"/>
      <path d="M300,210 C300,185 340,185 340,210 C340,235 300,235 300,210 Z" fill="#9A7950" fill-opacity="0.25"/>
      <rect x="415" y="148" width="56" height="118" rx="10" fill="#7C5234"/>
      <rect x="431" y="126" width="24" height="22" rx="4" fill="#B89058"/>
      <rect x="488" y="172" width="64" height="94" rx="12" fill="#EDE4D7" stroke="#9A7950" stroke-width="2"/>
    `;
  } else if (angleIndex === 1) {
    illustration = `
      <!-- Step 02 Visual: Active Treatment & Thermal Compress -->
      <rect x="190" y="105" width="420" height="210" rx="14" fill="#FAF7F2" stroke="#D9CEBD" stroke-width="2"/>
      <ellipse cx="400" cy="225" rx="145" ry="44" fill="#EDE4D7" stroke="#9A7950" stroke-width="2"/>
      <rect x="295" y="155" width="210" height="58" rx="29" fill="#FFFFFF" stroke="#CBBBA4" stroke-width="2.5"/>
      <circle cx="345" cy="184" r="14" fill="#9A7950" fill-opacity="0.3"/>
      <circle cx="400" cy="184" r="14" fill="#9A7950" fill-opacity="0.5"/>
      <circle cx="455" cy="184" r="14" fill="#9A7950" fill-opacity="0.3"/>
    `;
  } else {
    illustration = `
      <!-- Step 03 Visual: Finishing Elixir & Sanctuary Recovery -->
      <rect x="200" y="105" width="400" height="210" rx="14" fill="#FAF7F2" stroke="#D9CEBD" stroke-width="2"/>
      <polygon points="400,128 465,248 335,248" fill="#EDE4D7" stroke="#9A7950" stroke-width="2.5"/>
      <circle cx="400" cy="208" r="28" fill="#9A7950" fill-opacity="0.25"/>
      <line x1="270" y1="272" x2="530" y2="272" stroke="#9A7950" stroke-width="3" stroke-linecap="round"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="#FFFFFF"/>
  <rect x="16" y="16" width="768" height="488" rx="6" fill="url(#bg)" stroke="#E7DED1" stroke-width="2"/>
  
  <!-- Top Plate Number Pill -->
  <rect x="44" y="40" width="136" height="34" rx="4" fill="${p.badgeBg}"/>
  <text x="112" y="62" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#FFFFFF">PLATE 0${angleIndex + 1} / 03</text>

  <rect x="520" y="40" width="236" height="34" rx="4" fill="#FAF7F2" stroke="#9A7950" stroke-width="1.5"/>
  <text x="638" y="61" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#9A7950">PHOTO SLOT READY TO UPLOAD</text>

  ${illustration}

  <!-- Step Title & Clear Prompt Notice -->
  <text x="400" y="368" text-anchor="middle" font-family="Georgia, serif" font-size="25" font-weight="bold" fill="${p.ink}">${stepTitle.replace(/&/g, '&amp;')}</text>
  <text x="400" y="402" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#79756C">Dedicated service photo slot — provide image in next prompt or upload in Owner Portal</text>
  <rect x="250" y="426" width="300" height="36" rx="4" fill="#FAF7F2" stroke="#D9CEBD" stroke-width="1.5"/>
  <text x="400" y="449" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#292720">OPS SALON · STEP 0${angleIndex + 1} PREVIEW</text>
</svg>`;
}

function createEmployeePortraitSvg(empId, name, role, initials, gender, accentTone) {
  const isFemale = gender === 'F';
  const skin = isFemale ? '#D9B391' : '#C99E7A';
  const hair = '#231F1D';
  const coat = accentTone || '#292720';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 680" width="600" height="680">
  <rect width="600" height="680" fill="#FFFFFF"/>
  <!-- Clean Studio Frame -->
  <rect x="24" y="24" width="552" height="632" rx="8" fill="#FAF7F2" stroke="#E7DED1" stroke-width="2"/>
  <path d="M130,656 L130,240 A170,170 0 0,1 470,240 L470,656 Z" fill="#FFFFFF" stroke="#D9CEBD" stroke-width="2"/>

  <!-- Top Initials Badge -->
  <rect x="48" y="48" width="64" height="36" rx="4" fill="${coat}"/>
  <text x="80" y="71" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="#FFFFFF">${initials}</text>

  <rect x="340" y="48" width="212" height="36" rx="4" fill="#FFFFFF" stroke="#9A7950" stroke-width="1.5"/>
  <text x="446" y="70" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#9A7950">UPLOAD PHOTO IN ADMIN</text>

  <!-- Shoulders & Tailored Atelier Jacket -->
  <path d="M145,656 C155,500 220,455 300,455 C380,455 445,500 455,656 Z" fill="${coat}"/>
  <polygon points="258,455 300,530 342,455" fill="#FAF7F2"/>
  <rect x="270" y="380" width="60" height="86" rx="22" fill="${skin}"/>
  <ellipse cx="300" cy="292" rx="76" ry="94" fill="${skin}"/>
  ${
    isFemale
      ? `<path d="M218,305 C210,182 390,182 382,305 C392,375 400,435 378,468 C366,408 368,325 364,268 C332,235 268,235 236,268 C232,325 234,408 222,468 C200,435 208,375 218,305 Z" fill="${hair}"/>`
      : `<path d="M222,282 C218,186 382,186 378,282 C362,232 238,232 222,282 Z" fill="${hair}"/>
         <path d="M230,320 C236,385 270,402 300,402 C330,402 364,385 370,320 C358,360 332,374 300,374 C268,374 242,360 230,320 Z" fill="${hair}" opacity="0.85"/>`
  }
  <path d="M260,280 Q275,272 286,280" stroke="${hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M314,280 Q325,272 340,280" stroke="${hair}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <circle cx="273" cy="294" r="4.2" fill="#292720"/>
  <circle cx="327" cy="294" r="4.2" fill="#292720"/>
  <path d="M300,293 L296,322 L305,324" stroke="#9E7656" stroke-width="2.3" fill="none" stroke-linecap="round"/>
  <path d="M280,346 Q300,357 320,346" stroke="#8F5B44" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <circle cx="354" cy="535" r="6.5" fill="#9A7950"/>
</svg>`;
}

fs.writeFileSync('public/images/hero/ops-salon-hero.svg', createHeroSvg(0));
fs.writeFileSync('public/images/hero/ops-salon-hero-2.svg', createHeroSvg(1));
fs.writeFileSync('public/images/hero/ops-salon-hero-3.svg', createHeroSvg(2));

const serviceConfigs = [
  {
    file: 'signature-haircut',
    theme: 'scissors',
    steps: [
      '01 · Architectural Shear Consultation',
      '02 · Precision Taper & Crown Sectioning',
      '03 · Matte Clay & Blow-Dry Finish',
    ],
  },
  {
    file: 'hot-towel-beard',
    theme: 'beard',
    steps: [
      '01 · Triple Hot-Towel Steam Infusion',
      '02 · Straight-Razor Cheek & Jawline Sculpt',
      '03 · Cold Alum Seal & Sandalwood Balm',
    ],
  },
  {
    file: 'head-massage',
    theme: 'champi',
    steps: [
      '01 · Warm Bhringraj Brass Katori Infusion',
      '02 · Marma-Point Crown & Temple Release',
      '03 · Bronze Kansa Wand & Herbal Steam Wrap',
    ],
  },
  {
    file: 'neck-shoulder-massage',
    theme: 'neck_massage',
    steps: [
      '01 · Cervical & Scapula Tension Mapping',
      '02 · Deep Tissue Trapezius & Deltoid Release',
      '03 · Heated Basalt Stone & Camphor Compress',
    ],
  },
  {
    file: 'argan-hair-spa',
    theme: 'keratin',
    steps: [
      '01 · Hard-Water Mineral Chelating Wash',
      '02 · Moroccan Argan & Keratin Mist Dome',
      '03 · Cuticle-Sealing Silk Gloss Blowout',
    ],
  },
  {
    file: 'saffron-facial',
    theme: 'facial',
    steps: [
      '01 · Enzymatic Cleanse & Pore Steam Detox',
      '02 · Activated Bamboo Charcoal De-Tan Mask',
      '03 · Kumkumadi Saffron & Jade Roller Lift',
    ],
  },
  {
    file: 'royal-grooming',
    theme: 'groom',
    steps: [
      '01 · Private Ceremonial Suite Haircut',
      '02 · Nizami Hot-Towel Beard & Razor Ritual',
      '03 · Kashmiri Saffron Facial & Champi Revival',
    ],
  },
  {
    file: 'express-trim',
    theme: 'trim',
    steps: [
      '01 · Gentle Scissor & Taper Maintenance',
      '02 · Ear & Neckline Contour Detailing',
      '03 · Cooling Peppermint & Rosemary Tonic',
    ],
  },
];

for (const cfg of serviceConfigs) {
  fs.writeFileSync(
    `public/images/services/${cfg.file}.svg`,
    createServiceSvg(cfg.file, cfg.theme, 0, cfg.steps)
  );
  fs.writeFileSync(
    `public/images/services/${cfg.file}-2.svg`,
    createServiceSvg(cfg.file, cfg.theme, 1, cfg.steps)
  );
  fs.writeFileSync(
    `public/images/services/${cfg.file}-3.svg`,
    createServiceSvg(cfg.file, cfg.theme, 2, cfg.steps)
  );
}

const empConfigs = [
  { id: 'emp-aarav', name: 'Aarav Reddy', role: 'Creative Director', initials: 'AR', gender: 'M', coat: '#292720' },
  { id: 'emp-zoya', name: 'Zoya Mirza', role: 'Senior Hair Designer', initials: 'ZM', gender: 'F', coat: '#5E4633' },
  { id: 'emp-vikram', name: 'Vikramaditya Rao', role: 'Ayurvedic Therapist', initials: 'VR', gender: 'M', coat: '#3E4A3B' },
  { id: 'emp-kabir', name: 'Kabir Pasha', role: 'Master Razor Artisan', initials: 'KP', gender: 'M', coat: '#4A392B' },
  { id: 'emp-meenakshi', name: 'Meenakshi Nair', role: 'Aesthetician', initials: 'MN', gender: 'F', coat: '#6B513A' },
  { id: 'emp-rohan', name: 'Rohan Deshmukh', role: 'Texture Specialist', initials: 'RD', gender: 'M', coat: '#3A352E' },
];

for (const emp of empConfigs) {
  fs.writeFileSync(
    `public/images/employees/${emp.id}.svg`,
    createEmployeePortraitSvg(emp.id, emp.name, emp.role, emp.initials, emp.gender, emp.coat)
  );
}

console.log('Generated all distinct step SVGs and employee avatar SVGs!');
