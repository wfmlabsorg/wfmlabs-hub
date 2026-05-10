/**
 * Seed Topics collection from the taxonomy defined in Appendix B of seed doc v1.1.
 * Run: DATABASE_URI=... bun run scripts/seed-topics.ts
 */

const TAXONOMY = {
  forecasting: {
    description: 'Predicting future demand, volumes, and workload patterns',
    children: {
      'intraday-forecasting': 'Short-horizon demand prediction within a single day',
      'long-range-forecasting': 'Strategic demand forecasting over weeks, months, quarters',
      'generative-ai-forecasting': 'Using generative AI models for demand prediction',
      'demand-modeling': 'Statistical and ML approaches to modeling contact demand',
    },
  },
  scheduling: {
    description: 'Optimizing when and how agents work',
    children: {
      'shift-bidding': 'Agent preference-based shift assignment systems',
      'scheduling-fairness': 'Equitable distribution of shifts, overtime, and preferences',
      'real-time-adjustments': 'Intraday schedule modifications based on actual conditions',
      'schedule-optimization': 'Mathematical optimization of schedule generation',
    },
  },
  staffing: {
    description: 'Determining how many people are needed and planning headcount',
    children: {
      'capacity-planning': 'Long-range staffing capacity models',
      'headcount-planning': 'Budgetary headcount forecasting and justification',
      'attrition-modeling': 'Predicting and planning for employee turnover',
      'hybrid-workforce': 'Managing blended human and AI/automated workforces',
    },
  },
  'agent-experience': {
    description: 'The human side of workforce management',
    children: {
      burnout: 'Occupational burnout detection, prevention, and recovery',
      engagement: 'Employee engagement measurement and improvement',
      training: 'Agent training, onboarding, and skill development',
      'ai-augmentation': 'How AI tools enhance rather than replace agent capabilities',
    },
  },
  'queueing-theory': {
    description: 'Mathematical foundations of service operations',
    children: {
      'service-levels': 'Service level targets, measurement, and optimization',
      abandonment: 'Call abandonment modeling and mitigation',
      'multi-skill-routing': 'Routing contacts to agents with appropriate skills',
      'virtual-queues': 'Callback and virtual queue technologies',
      erlang: 'Erlang B, C, and A models for capacity calculation',
    },
  },
  'ai-in-operations': {
    description: 'AI applications in contact center and service operations',
    children: {
      'agent-assist': 'Real-time AI assistance for human agents',
      'conversational-ai': 'Chatbots, voicebots, and conversational interfaces',
      'voice-bots': 'Automated voice interaction systems',
      'sentiment-analysis': 'Real-time and post-call sentiment detection',
    },
  },
  'workforce-economics': {
    description: 'Economic forces shaping workforce management',
    children: {
      'labor-markets': 'Labor supply, demand, and market dynamics',
      'automation-substitution': 'When and how automation replaces human labor',
      'value-model': 'Value-based planning and the three-pool architecture',
      'gig-work': 'Gig economy workforce in contact centers',
    },
  },
  'service-quality': {
    description: 'Measuring and improving service delivery',
    children: {
      csat: 'Customer satisfaction measurement and drivers',
      nps: 'Net Promoter Score methodology and limitations',
      'first-call-resolution': 'FCR measurement, optimization, and trade-offs',
      'quality-management': 'QA programs, calibration, and scoring',
    },
  },
  regulatory: {
    description: 'Legal and compliance aspects of workforce management',
    children: {
      'ai-governance': 'Governance frameworks for AI in operations',
      'labor-law': 'Employment law affecting scheduling and staffing',
      compliance: 'Regulatory compliance in contact center operations',
      privacy: 'Data privacy in workforce analytics and monitoring',
    },
  },
  'adjacent-fields': {
    description: 'Related disciplines that inform WFM practice',
    children: {
      'behavioral-economics': 'How cognitive biases affect planning and decisions',
      'organizational-design': 'Structure and design of service organizations',
      'human-computer-interaction': 'HCI principles for agent tools and interfaces',
      'operations-research': 'OR methods applied to workforce problems',
    },
  },
}

async function seedTopics() {
  const apiUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  // Login first to get token
  console.log('This script seeds topics via the Payload API.')
  console.log('Run it after the app is running with: bun run dev')
  console.log('')
  console.log('Taxonomy to seed:')

  let totalTopics = 0
  for (const [parent, config] of Object.entries(TAXONOMY)) {
    console.log(`  ${parent} (${Object.keys(config.children).length} children)`)
    totalTopics += 1 + Object.keys(config.children).length
  }
  console.log(`\nTotal: ${totalTopics} topics`)
  console.log('\nTo seed, use the Payload admin UI or local API with authentication.')
}

seedTopics()
