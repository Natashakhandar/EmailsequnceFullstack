// Default email templates for the sequence builder
export interface DefaultTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'intro' | 'followup' | 'extro' | 'reminder' | 'random';
  description: string;
}

export const defaultTemplates: DefaultTemplate[] = [
  {
    id: 'template-intro',
    name: 'Intro Email',
    subject: 'Transform Your Business with Custom IT Solutions - {{firstName}}',
    body: 'Hi {{firstName}},\n\nI hope this email finds you well. My name is {{firstName}} from {{companyName}}, and we specialize in delivering cutting-edge IT solutions that drive business growth.\n\nWe help companies like yours streamline operations through:\n• Custom ERP Systems - Tailored to your business processes\n• SaaS Development - Scalable cloud-based solutions\n• Mobile & Web Applications - User-friendly, responsive designs\n• Digital Transformation - Modernizing legacy systems\n\nI\'d love to discuss how we can help {{companyName}} achieve its technology goals. Would you be available for a brief 15-minute call this week?',
    type: 'intro',
    description: 'Professional introduction highlighting IT services (ERP, SaaS, App Development)'
  },
  {
    id: 'template-followup',
    name: 'Follow-Up Email',
    subject: 'Following up on IT solutions for {{companyName}}',
    body: 'Hi {{firstName}},\n\nI wanted to follow up on my previous email regarding IT solutions for {{companyName}}. I understand you\'re likely busy managing your business operations.\n\nMany of our clients initially hesitated before discovering how our solutions could:\n• Reduce operational costs by 30-40%\n• Improve team productivity and collaboration\n• Provide real-time business insights and analytics\n• Ensure scalable growth without technical limitations\n\nI\'d be happy to share a brief case study of how we helped a similar company in your industry. Would you be interested in a quick 10-minute conversation?\n\nNo pressure at all - just want to ensure you have all the information you need.',
    type: 'followup',
    description: 'Polite follow-up emphasizing value proposition and social proof'
  },
  {
    id: 'template-extro',
    name: 'Extro Email',
    subject: 'Thank you for your time, {{firstName}}',
    body: 'Hi {{firstName}},\n\nI wanted to reach out one final time to thank you for considering our IT services for {{companyName}}.\n\nI completely understand that timing and priorities can shift, and that\'s perfectly okay. Business decisions, especially regarding technology investments, require careful consideration.\n\nIf your needs change in the future or if you\'d like to discuss how custom ERP systems, SaaS solutions, or mobile applications could benefit your organization, please don\'t hesitate to reach out.\n\nI\'ll be removing you from this sequence, but our door is always open for future conversations.\n\nWishing you and {{companyName}} continued success!',
    type: 'extro',
    description: 'Professional closing note thanking the client and leaving the door open'
  },
  {
    id: 'template-reminder',
    name: 'Reminder Email',
    subject: 'Quick reminder about our IT consultation offer - {{firstName}}',
    body: 'Hi {{firstName}},\n\nI hope you\'re having a productive week! I wanted to send a gentle reminder about our conversation regarding IT solutions for {{companyName}}.\n\nI know how busy things can get, so I thought I\'d make this even easier for you:\n\n• Free 30-minute consultation (no strings attached)\n• Custom technology assessment for your business\n• Detailed proposal with timeline and investment options\n• Case studies from similar companies in your industry\n\nWould next Tuesday or Wednesday work better for a brief call? I\'m flexible with timing and can work around your schedule.\n\nIf now isn\'t the right time, just let me know when might be better, and I\'ll follow up accordingly.',
    type: 'reminder',
    description: 'Gentle reminder with clear value proposition and flexible scheduling'
  },
  {
    id: 'template-random',
    name: 'Random Email',
    subject: 'Helping {{companyName}} stay ahead with modern technology',
    body: 'Hi {{firstName}},\n\nI came across {{companyName}} and was impressed by your commitment to [specific industry/service]. In today\'s competitive landscape, having the right technology infrastructure can make all the difference.\n\nWe\'ve been helping businesses like yours leverage technology to:\n• Automate repetitive processes and reduce manual work\n• Improve customer experience through digital solutions\n• Scale operations without proportional increases in overhead\n• Make data-driven decisions with real-time analytics\n\nOur expertise spans:\n✓ Enterprise Resource Planning (ERP) Systems\n✓ Custom SaaS Platform Development\n✓ Mobile & Web Application Development\n✓ System Integration & API Development\n✓ Cloud Migration & Infrastructure Setup\n\nI\'d love to learn more about your current technology challenges and see if there\'s a way we can help {{companyName}} achieve its goals more efficiently.\n\nWould you be open to a brief conversation this week?',
    type: 'random',
    description: 'Generic professional outreach template for IT service companies'
  }
];

export const getTemplateByType = (type: 'intro' | 'followup' | 'extro' | 'reminder' | 'random'): DefaultTemplate | undefined => {
  return defaultTemplates.find(template => template.type === type);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};
