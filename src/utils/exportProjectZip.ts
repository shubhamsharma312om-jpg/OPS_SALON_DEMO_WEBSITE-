import JSZip from 'jszip';
import { BookingRecord, Employee, ServiceItem } from '../types/salon';

export const exportVsCodeProjectZip = async (
  services: ServiceItem[],
  employees: Employee[],
  bookings: BookingRecord[]
): Promise<void> => {
  const zip = new JSZip();

  const packageJson = {
    name: 'ops-salon-hyderabad',
    private: true,
    version: '2.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --port 3000 --open',
      build: 'vite build',
      preview: 'vite preview --port 3000',
    },
    dependencies: {
      'lucide-react': '^0.546.0',
      jszip: '^3.10.2',
      react: '^19.0.1',
      'react-dom': '^19.0.1',
    },
    devDependencies: {
      '@tailwindcss/vite': '^4.3.3',
      '@types/react': '^19.3.0',
      '@types/react-dom': '^19.3.0',
      '@vitejs/plugin-react': '^6.1.1',
      tailwindcss: '^4.3.3',
      typescript: '^5.7.2',
      vite: '^6.2.0',
    },
  };

  zip.file('package.json', JSON.stringify(packageJson, null, 2));

  const readmeContent = `# OPS Salon — Hyderabad Hair & Grooming Web Application

A production-grade hair cutting & grooming salon booking platform and shop-owner admin portal exclusively tailored for **Hyderabad, Telangana, India**.

## How to Run Locally in VS Code

1. **Extract this ZIP folder** and open the folder in **Visual Studio Code**.
2. Open the integrated terminal in VS Code (\`Ctrl + \` \` or \`Cmd + J\`).
3. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
4. Start the local development server:
   \`\`\`bash
   npm run dev
   \`\`\`
5. Your browser will open at **http://localhost:3000**.

## Key Features Included
- **OPS Salon Architectural Luxury Design**: Playfair Display + DM Sans typography, warm cream (#FAF7F2) and travertine sand (#F3EDE2) surfaces, and muted bronze (#9A7950) accents.
- **Services & Custom Package Builder ("Create Your Own Package")**: Combine Hair Cutting, Royal Beard Ritual, Ayurvedic Head Massage, Neck & Back Massage, Keratin Spa, and Facials with automatic 10% bundle discount on 3+ services.
- **7-Step Multi-Member Appointment Booking**: Specify 1–6 members, each member's name, age, gender, services, and preferred stylist.
- **Strict Hyderabad Location & Map Coordinate System**: Covers 14 major Hyderabad localities with interactive map coordinates.
- **Employee Double-Booking Conflict Lock**: Prevents any stylist from being booked twice in overlapping schedules.
- **Owner / Admin Portal**: Manage bookings, sort/filter by Price, Location, and Timeline, add/edit/remove employees and schedules, and dispatch WhatsApp/Email/Portal messages.
`;

  zip.file('README.md', readmeContent);

  zip.file(
    'src/data/liveSalonSnapshot.json',
    JSON.stringify(
      {
        brand: 'OPS Salon',
        exportedAt: new Date().toISOString(),
        city: 'Hyderabad, Telangana, India',
        services,
        employees,
        bookings,
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ops-salon-hyderabad-vscode.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
