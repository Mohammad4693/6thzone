// 6thzone — central editable content structure.
// All repeatable site copy lives here so additional languages can be added later
// as sibling keys of window.SITE_CONTENT.
window.SITE_CONTENT = {
  en: {
    nav: [
      { label: 'Home', href: '#top' },
      { label: 'The sixth zone', href: '#sixth-zone' },
      { label: 'Services', href: '#services' },
      { label: 'Applications', href: '#applications' },
      { label: 'Approach', href: '#approach' },
    ],
    hero: {
      pill: 'Applied AI & digital systems',
      lede: 'We design websites, automate workflows and build AI agents that connect to the way your business works.',
      cta: 'Explore your AI opportunity',
      secondary: 'See what we build',
      caption: 'Five zones.\nConnected by intelligence.',
      facts: [
        { num: '05', label: 'Business zones' },
        { num: '01', label: 'Intelligent layer' },
        { num: '06', label: 'The sixth zone' },
      ],
    },
    statement: {
      dark: 'Your business already has\nthe building blocks.',
      grey: 'We connect them with\nAI that works in practice.',
    },
    zonesIntro: {
      title: 'Why the sixth zone?',
      body: 'Strategy. People. Operations. Customers. Knowledge.\nAI becomes valuable when it connects to all five.',
    },
    zones: [
      { num: '01', name: 'Strategy', application: 'Bring business information together to support planning and decisions.' },
      { num: '02', name: 'People', application: 'Help teams find answers and reduce repetitive work.' },
      { num: '03', name: 'Operations', application: 'Connect systems and automate routine handoffs.' },
      { num: '04', name: 'Customers', application: 'Build better websites and more responsive customer journeys.' },
      { num: '05', name: 'Knowledge', application: 'Make internal documents and information easier to retrieve and use.' },
    ],
    zoneSixth: {
      num: '06 — Intelligence',
      body: 'AI and technology, integrated into the business.',
      button: 'Connect the sixth zone',
      buttonReset: 'Reset the connection',
    },
    services: [
      {
        id: '01',
        name: 'Digital experiences',
        titleHTML: 'Digital<br>experiences',
        summary: 'Fast, clear websites designed around your business and your customers.',
        details: 'Business websites, landing pages, CMS setup and relevant integrations.',
        dark: false,
      },
      {
        id: '02',
        name: 'Workflow automation',
        titleHTML: 'Workflow<br>automation',
        summary: 'Connect your tools and reduce repetitive handoffs.',
        details: 'Lead routing, document flows, CRM updates and reporting workflows.',
        dark: true,
      },
      {
        id: '03',
        name: 'AI agents & assistants',
        titleHTML: 'AI agents<br>& assistants',
        summary: 'Give teams and customers useful assistance connected to relevant information.',
        details: 'Knowledge assistants, support workflows and tool-connected agents with defined boundaries and human review.',
        dark: false,
      },
      {
        id: '04',
        name: 'AI strategy & implementation',
        titleHTML: 'AI strategy<br>& implementation',
        summary: 'Find the right starting point, build a practical pilot and integrate what works.',
        details: 'Opportunity discovery, workflow mapping, scoped pilots and implementation support.',
        dark: false,
      },
    ],
    servicesVisualLabel: 'Select a service to see where it fits',
    servicesVisualSelected: 'Selected',
    why: {
      title: 'Why\n6thzone?',
      sub: 'From business need to working system.',
      principles: [
        'Start with the business problem.',
        'Connect to existing workflows.',
        'Keep people in control.',
        'Build, evaluate and improve.',
      ],
    },
    applications: [
      {
        id: 'website',
        illus: 'website',
        title: 'A website that starts the next step.',
        body: 'A website enquiry enters the right workflow, reaches the right team and stays trackable.',
      },
      {
        id: 'assistant',
        illus: 'assistant',
        title: 'An assistant that knows where to look.',
        body: 'An internal assistant retrieves relevant company information and points users to its sources.',
      },
      {
        id: 'workflow',
        illus: 'workflow',
        title: 'A workflow that keeps moving.',
        body: 'Routine tasks pass between tools with validation, clear exceptions and human approval where needed.',
      },
    ],
    applicationsNote: 'These are illustrative applications, not completed client projects.',
    approach: {
      title: 'From opportunity\nto implementation.',
      steps: [
        { num: '01', name: 'Discover', body: 'Understand the business, tools and bottlenecks.' },
        { num: '02', name: 'Design', body: 'Define the workflow, scope and success criteria.' },
        { num: '03', name: 'Build', body: 'Create and evaluate the website, automation or agent.' },
        { num: '04', name: 'Integrate', body: 'Connect it to daily work, document it and improve it.' },
      ],
    },
    contact: {
      title: 'Let’s connect\nyour next move.',
      sub: 'Tell us where work slows down—or what you want to build.',
      servicesPlaceholder: 'Service of interest',
      notSure: 'Not sure yet',
      success: 'Thank you — your enquiry has been received. We will reply to your work email.',
      loading: 'Sending…',
    },
    footer: {
      tagline: 'The sixth zone of your business.',
      copyright: '© 2026 6thzone. All rights reserved.',
      privacy: 'Privacy',
    },
  },
};
