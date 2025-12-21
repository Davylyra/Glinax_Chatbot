// Lightweight admission scraper (mock)
// Returns an array of admission events fetched from official sources or configured feeds.

export const fetchLatestAdmissions = async () => {
  // In production replace this with real HTTP fetch/scrape of official university pages or APIs.
  // For now return a curated mock feed for December 2025 with unique ids.
  const nowIso = new Date().toISOString();
  return [
    {
      id: `ug_lists_${Date.now()}`,
      university: 'University of Ghana',
      event: 'admission_lists_released',
      title: '🚨 UG Admission Lists Released (2025/2026)',
      message: 'University of Ghana has released 2025/2026 undergraduate admission lists. Check your status at apply.ug.edu.gh/admissions/admissionstatus',
      date: nowIso,
      actionUrl: 'https://apply.ug.edu.gh/admissions/admissionstatus'
    },
    {
      id: `knust_lists_${Date.now()}`,
      university: 'KNUST',
      event: 'admission_lists_released',
      title: '🎓 KNUST Admission Lists Released',
      message: 'KNUST has published the 2025/2026 admission lists. Visit knust.edu.gh for details.',
      date: nowIso,
      actionUrl: 'https://knust.edu.gh'
    },
    {
      id: `ug_health_deadline_${Date.now()}`,
      university: 'University of Ghana',
      event: 'deadline_passed_health_sciences',
      title: '⚠️ UG Health Sciences Deadline (Oct 31, 2025)',
      message: 'Health Sciences application deadline was Oct 31, 2025. If you applied, check admission status and help desks.',
      date: new Date('2025-11-01').toISOString(),
      actionUrl: 'https://apply.ug.edu.gh'
    }
  ];
};

export default { fetchLatestAdmissions };
