// Default email templates for the sequence builder
export interface DefaultTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'intro' | 'followup' | 'reminder' | 'thankyou';
  description: string;
}

export const defaultTemplates: DefaultTemplate[] = [
  {
    id: 'template-intro',
    name: 'Intro Email',
    subject: 'Hey {{firstName}}, quick introduction 👋',
    body: 'Hey {{firstName}}, just wanted to introduce myself and share something valuable that might help your team.',
    type: 'intro',
    description: 'First email to introduce yourself'
  },
  {
    id: 'template-followup',
    name: 'Follow-Up Email',
    subject: 'Just checking in on my previous email',
    body: 'Hey {{firstName}}, hope you\'re doing well! Wanted to follow up and see if you had a chance to look at my earlier message.',
    type: 'followup',
    description: 'Follow-up if they opened the first email'
  },
  {
    id: 'template-reminder',
    name: 'Reminder Email',
    subject: 'Friendly reminder 🙂',
    body: 'Hey {{firstName}}, just reaching out again — totally understand you might be busy, but I didn\'t want this to slip through the cracks.',
    type: 'reminder',
    description: 'Reminder if they didn\'t open for 3 days'
  },
  {
    id: 'template-thankyou',
    name: 'Thank-You Email',
    subject: 'Thanks for your reply 🙏',
    body: 'Hey {{firstName}}, really appreciate your response! Great connecting with you — let\'s stay in touch for future opportunities.',
    type: 'thankyou',
    description: 'Thank you email if they reply'
  }
];

export const getTemplateByType = (type: 'intro' | 'followup' | 'reminder' | 'thankyou'): DefaultTemplate | undefined => {
  return defaultTemplates.find(template => template.type === type);
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};
