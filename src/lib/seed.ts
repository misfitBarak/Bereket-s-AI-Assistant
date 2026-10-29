import { db } from "./db";

export async function seedDatabaseIfEmpty() {
  const memberCount = await db.teamMember.count();
  if (memberCount > 0) {
    return { seeded: false, message: "Database already populated" };
  }

  // 1. Seed Team Members
  const teamMembers = [
    {
      name: "Dani",
      role: "Senior Motion Designer & 3D Artist",
      skills: "After Effects, 3D/Blender, Promo Packages, Media Packs, Visual FX",
      currentCapacityHours: 12.0,
      status: "busy",
      notes: "Expert at complex promo packages and 3D broadcast packages. High quality, needs focused blocks.",
    },
    {
      name: "Sura",
      role: "Motion Designer & Video Editor",
      skills: "DaVinci Resolve, Premiere Pro, Fast Show Promos, Adverts, Color Grading",
      currentCapacityHours: 18.0,
      status: "available",
      notes: "Fast turnaround on editorial promos, commercial cutdowns, and DaVinci color grading.",
    },
    {
      name: "Simon",
      role: "Broadcast Graphics Specialist",
      skills: "Lower Thirds, L-Shapes, News Graphics, Live Tickers, Channel Ident",
      currentCapacityHours: 14.0,
      status: "busy",
      notes: "Master of broadcast standards, live graphics templates, safe margins, and channel idents.",
    },
    {
      name: "Kiru",
      role: "Lead Graphic Designer",
      skills: "Photoshop, Illustrator, Posters, YouTube Thumbnails, Media Kits",
      currentCapacityHours: 24.0,
      status: "available",
      notes: "Exceptional visual styling for digital posters, high-CTR thumbnails, and social branding.",
    },
    {
      name: "Bereket",
      role: "Graphics Department Lead & Senior Motion Pro",
      skills: "Art Direction, DaVinci Resolve, Motion Graphics, Broadcast Packaging, Team Leadership",
      currentCapacityHours: 40.0,
      status: "available",
      notes: "Department Head overseeing all broadcast aesthetics, freelance clients, and personal projects.",
    },
  ];

  for (const member of teamMembers) {
    await db.teamMember.upsert({
      where: { name: member.name },
      update: member,
      create: member,
    });
  }

  // 2. Seed Projects
  const abbayShowProject = await db.project.create({
    data: {
      workspace: "abbay_tv",
      title: "MMA Prime-Time Show Rebrand & Media Pack",
      description: "Full graphics overhaul for Abbay TV's flagship sports show: open title, lower thirds, L-shapes, and sponsor tags.",
      status: "active",
      category: "TV Show Package",
      targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      progress: 65,
      milestones: JSON.stringify([
        { title: "Concept 3D Styleframes", completed: true },
        { title: "Opening Promo & Logo Animation", completed: true },
        { title: "Broadcast Lower Thirds & L-Shapes", completed: false },
        { title: "Sponsor Media Pack & Final Delivery", completed: false },
      ]),
      nextAction: "Review Dani's final render of the MMA sponsor media pack by Thursday",
    },
  });

  const clientProject1 = await db.project.create({
    data: {
      workspace: "client_work",
      title: "EthioTelecom Commercial - Brand Campaign Video",
      description: "High-energy 60s promotional video with DaVinci Resolve color grade and kinetic typography.",
      status: "in_review",
      category: "Commercial Video Campaign",
      clientName: "EthioTelecom (Agency Partner)",
      clientContact: "Abebe - Lead Marketing Manager (abebe@agency.et)",
      clientNotes: "Prefers punchy sound effects, strict brand color codes (#005BA6 blue and #78BE20 green), DaVinci ProRes 422 delivery.",
      quotedAmount: 85000,
      paidAmount: 42500,
      currency: "ETB",
      invoiceStatus: "partial",
      targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      progress: 80,
      milestones: JSON.stringify([
        { title: "Rough Cut Approval", completed: true },
        { title: "Motion Graphics & Kinetic Text", completed: true },
        { title: "Color Grade & Sound Sync", completed: true },
        { title: "Final Client Revision 2 Review", completed: false },
      ]),
      nextAction: "Deliver revision with beat sync adjustments between sec 15-22",
    },
  });

  const clientProject2 = await db.project.create({
    data: {
      workspace: "client_work",
      title: "FinTech App Animated Launch Reel",
      description: "90s UI motion graphics explainer showcasing mobile payment and micro-loans.",
      status: "active",
      category: "App Explainer",
      clientName: "ShebaPay Technologies",
      clientContact: "Hanna - Product Director",
      clientNotes: "Clean minimalist tech look, dark UI with glowing accents, smooth 60fps vector animations.",
      quotedAmount: 60000,
      paidAmount: 0,
      currency: "ETB",
      invoiceStatus: "sent",
      targetDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      progress: 25,
      milestones: JSON.stringify([
        { title: "Figma UI Asset Extraction", completed: true },
        { title: "Storyboard & Animatic", completed: false },
        { title: "Voiceover Sync & Animation", completed: false },
      ]),
      nextAction: "Send animatic draft for Hanna's sign-off",
    },
  });

  const personalProject1 = await db.project.create({
    data: {
      workspace: "personal_projects",
      title: "Motion Design & DaVinci Resolve Masterclass",
      description: "Comprehensive online tutorial series and presets for Ethiopian and African editors wanting to master broadcast motion graphics.",
      status: "active",
      category: "Content & Education",
      targetDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      progress: 35,
      milestones: JSON.stringify([
        { title: "Curriculum outline & episode scripts", completed: true },
        { title: "Record Episode 1: DaVinci Color Management for Broadcast", completed: true },
        { title: "Record Episode 2: Dynamic Lower Thirds in Fusion", completed: false },
        { title: "Package downloadable project files & LUTs", completed: false },
        { title: "Launch YouTube playlist & Telegram community", completed: false },
      ]),
      nextAction: "Record screen capture for Episode 2 (Fusion lower thirds)",
    },
  });

  const personalProject2 = await db.project.create({
    data: {
      workspace: "personal_projects",
      title: "AI Video Automation Pipeline",
      description: "Custom workflow using AI script enhancement, automatic speech-to-text cutdowns, and DaVinci Resolve marker exports.",
      status: "active",
      category: "Tech & R&D",
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      progress: 40,
      milestones: JSON.stringify([
        { title: "Test Whisper API subtitle accuracy in Amharic & English", completed: true },
        { title: "Automate social clip highlight reel detection", completed: false },
      ]),
      nextAction: "Benchmark cutdown processing time on 30min TV talk shows",
    },
  });

  // 3. Seed Tasks
  const tasks = [
    // Abbay TV Tasks
    {
      workspace: "abbay_tv",
      title: "MMA Media Pack Final Deliverables",
      description: "Deliver final exported media pack including 16:9 show promo, Instagram 9:16 reel promo, lower thirds, and sponsor bug.",
      status: "in_progress",
      priority: "urgent",
      deliverableType: "Media Pack",
      assignedTo: "Dani",
      estimatedHours: 8.0,
      actualHours: 4.5,
      projectId: abbayShowProject.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // In 2 days (Thursday)
      startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      recurringSchedule: null,
      tags: "Broadcast,MMA,3D,Sponsor",
    },
    {
      workspace: "abbay_tv",
      title: "Prime-Time News Lower Thirds Refresh",
      description: "Update typography and Ethiopian calendar date strap for 8:00 PM nightly news broadcast.",
      status: "in_progress",
      priority: "high",
      deliverableType: "Lower Third",
      assignedTo: "Simon",
      estimatedHours: 6.0,
      actualHours: 3.0,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      recurringSchedule: "Weekly Refresh",
      tags: "News,Broadcast,On-Air",
    },
    {
      workspace: "abbay_tv",
      title: "Weekend Drama Special - Teaser Promo (45s)",
      description: "Cut and grade the 45-second teaser for Sunday night drama. High dramatic pacing, DaVinci Resolve color grade.",
      status: "todo",
      priority: "urgent",
      deliverableType: "Promo",
      assignedTo: "Sura",
      estimatedHours: 5.0,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: "Weekly Promo",
      tags: "Drama,Promo,DaVinci",
    },
    {
      workspace: "abbay_tv",
      title: "YouTube Thumbnails Batch for 5 Weekly Shows",
      description: "High-contrast YouTube thumbnails with bold Amharic typography for political debate, morning show, and music countdown.",
      status: "in_progress",
      priority: "medium",
      deliverableType: "Thumbnail",
      assignedTo: "Kiru",
      estimatedHours: 4.0,
      actualHours: 2.0,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: "Weekly Batch",
      tags: "YouTube,Photoshop,Social",
    },
    {
      workspace: "abbay_tv",
      title: "Special Election Coverage L-Shape Graphic Template",
      description: "Clean L-shape graphic frame with live ticker, countdown clock, and sponsor logo integration.",
      status: "todo",
      priority: "high",
      deliverableType: "L-Shape",
      assignedTo: "Simon",
      estimatedHours: 7.0,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "LiveBroadcast,L-Shape,Election",
    },
    {
      workspace: "abbay_tv",
      title: "Morning Show Promo Cutdowns (9:16 for TikTok/Reels)",
      description: "Extract 3 punchy moments from today's morning interview and format with animated subtitles.",
      status: "completed",
      priority: "medium",
      deliverableType: "Promo",
      assignedTo: "Bereket",
      estimatedHours: 3.0,
      actualHours: 2.5,
      completedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      dueDate: new Date(),
      startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      recurringSchedule: "Daily Prime-Time",
      tags: "Reels,Social,Cutdown",
    },
    {
      workspace: "abbay_tv",
      title: "Commercial Advert - Regional Bank Sponsorship Promo",
      description: "30s commercial bumper with 3D gold coin particle animation and sound effects.",
      status: "todo",
      priority: "urgent",
      deliverableType: "Advert",
      assignedTo: "Dani",
      estimatedHours: 6.0,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "Commercial,Advert,Sponsor",
    },
    {
      workspace: "abbay_tv",
      title: "Station ID Winter Refresh Audio/Visual Sync",
      description: "Quarterly station ident refresh with Abbay TV sonic branding.",
      status: "backlog",
      priority: "low",
      deliverableType: "Broadcast Graphic",
      assignedTo: "Abbay",
      estimatedHours: 10.0,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      startDate: null,
      recurringSchedule: null,
      tags: "Branding,StationID",
    },

    // Client Work Tasks
    {
      workspace: "client_work",
      title: "EthioTelecom Beat-Sync Audio Adjustment (Sec 15-22)",
      description: "Address client feedback from Abebe: adjust typography entry sync to hit the percussion drop at 0:17.",
      status: "in_progress",
      priority: "urgent",
      deliverableType: "Freelance Video",
      assignedTo: "Abbay",
      estimatedHours: 3.0,
      actualHours: 1.5,
      projectId: clientProject1.id,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "EthioTelecom,Revision,AudioSync",
    },
    {
      workspace: "client_work",
      title: "ShebaPay Animatic & Storyboard Delivery",
      description: "Generate illustrated storyboard frames showcasing fintech dashboard and transaction flow.",
      status: "todo",
      priority: "high",
      deliverableType: "Freelance Video",
      assignedTo: "Abbay",
      estimatedHours: 5.0,
      projectId: clientProject2.id,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "Fintech,Storyboard,ShebaPay",
    },
    {
      workspace: "client_work",
      title: "Invoice 50% Milestone Remittance for EthioTelecom",
      description: "Send formal receipt for initial 42,500 ETB deposit and prepare final completion invoice.",
      status: "completed",
      priority: "medium",
      deliverableType: "Freelance Video",
      assignedTo: "Abbay",
      estimatedHours: 0.5,
      actualHours: 0.5,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      projectId: clientProject1.id,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      recurringSchedule: null,
      tags: "Billing,Deposit,Finance",
    },

    // Personal Projects Tasks
    {
      workspace: "personal_projects",
      title: "Record DaVinci Resolve Fusion Lower Thirds Tutorial",
      description: "Screen record step-by-step tutorial on building responsive broadcast lower thirds using Fusion expressions and modifiers.",
      status: "todo",
      priority: "high",
      deliverableType: "YouTube",
      assignedTo: "Abbay",
      estimatedHours: 4.0,
      projectId: personalProject1.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "YouTube,DaVinci,Fusion,Tutorial",
    },
    {
      workspace: "personal_projects",
      title: "Design Custom Motion Graphics Preset Pack (Gumroad)",
      description: "Export 15 reusable Fusion title templates and DaVinci .drfx macro bundles for Ethiopian video editors.",
      status: "in_progress",
      priority: "medium",
      deliverableType: "Broadcast Graphic",
      assignedTo: "Abbay",
      estimatedHours: 8.0,
      actualHours: 3.0,
      projectId: personalProject1.id,
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      recurringSchedule: null,
      tags: "Presets,PassiveIncome,Gumroad",
    },
    {
      workspace: "personal_projects",
      title: "Test Amharic Audio Subtitle Workflow with Whisper",
      description: "Benchmark open-source Whisper models on Abbay TV news audio to evaluate automated subtitle cutdown accuracy.",
      status: "todo",
      priority: "medium",
      deliverableType: "Reel",
      assignedTo: "Abbay",
      estimatedHours: 3.0,
      projectId: personalProject2.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      startDate: new Date(),
      recurringSchedule: null,
      tags: "AI,Whisper,Automation",
    },
  ];

  for (const t of tasks) {
    const createdTask = await db.task.create({ data: t });
    await db.activityLog.create({
      data: {
        taskId: createdTask.id,
        action: "created",
        details: `Task created in ${t.workspace} with priority ${t.priority}`,
      },
    });
  }

  // 4. Seed Memories
  const memories = [
    {
      category: "role_responsibilities",
      title: "Abbay TV Graphics Department Leadership",
      content: "I have 6+ years of experience in video editing, motion graphics, DaVinci Resolve, and TV broadcast packaging. I lead the Graphics Department at Abbay TV, coordinating team workload, broadcast standards, promos, and management deliverables.",
      importance: 5,
      tags: "AbbayTV,Leadership,Role",
    },
    {
      category: "team_profiles",
      title: "Graphics Department Team Strengths & Workload Rules",
      content: "Dani: 3D, Blender, complex promos, media packs (high quality, needs uninterrupted focus blocks).\nSura: fast promo edits, DaVinci Resolve color, quick-turnaround commercials.\nSimon: Broadcast standards, lower thirds, live L-shapes, channel idents, news graphics.\nKiru: High-CTR YouTube thumbnails, promotional posters, print, 2D branding.\nBereket: Cutdowns, social formats (9:16), asset prep, assists senior designers.",
      importance: 5,
      tags: "Team,Strengths,Roster",
    },
    {
      category: "workflows",
      title: "Abbay TV Broadcast Export & Quality Standards",
      content: "1. All promos must adhere to broadcast-safe colors (16-235 IRE).\n2. Lower thirds must remain within 10% action safe / 20% title safe broadcast margins.\n3. Master broadcast exports use DaVinci Resolve ProRes 422 HQ or high-bitrate MXF OP1a / H.264 profiles.\n4. Audio normalization standard is -24 LKFS (+/- 1 LUFS) with true peak -2 dBTP.",
      importance: 4,
      tags: "Broadcast,DaVinci,Standards",
    },
    {
      category: "client_preferences",
      title: "EthioTelecom Client Notes & Revision Policies",
      content: "Client Abebe is strict on brand hex colors (#005BA6 and #78BE20). Prefers rhythmic music cut to beat. Always keep revision history. Maximum 3 included revision rounds; subsequent rounds incur a 20% scope revision fee.",
      importance: 4,
      tags: "Client,EthioTelecom,Revisions",
    },
    {
      category: "decisions",
      title: "MMA Show Media Pack Delivery Schedule",
      content: "Decided with station programming manager to deliver the MMA Media Pack by Thursday 5:00 PM for weekend broadcast promotion. Dani is primary artist, Sura is backup for promo cutdowns.",
      importance: 5,
      tags: "Decisions,MMA,Schedule",
    },
    {
      category: "long_term_goals",
      title: "Personal Career & Income Growth Priorities",
      content: "1. Solidify Abbay TV Graphics Department as the most visually sophisticated broadcast unit in Ethiopia.\n2. Scale high-value freelance clients to generate reliable supplementary income.\n3. Build an educational brand and digital product library (DaVinci Resolve tutorials, motion presets) for online revenue.",
      importance: 5,
      tags: "Goals,Vision,Mastery",
    },
  ];

  for (const m of memories) {
    await db.memory.create({
      data: {
        category: m.category,
        title: m.title,
        content: m.content,
        importance: m.importance,
        tags: m.tags,
        source: "system_seed",
      },
    });
  }

  // 5. Seed Welcome Chat Message
  await db.chatMessage.create({
    data: {
      conversationId: "default",
      role: "assistant",
      content: "Welcome, Abbay! I am your Personal AI Command Center, synchronized with your Abbay TV Graphics Department, freelance client deliverables, and personal projects.\n\nI have loaded your active team workload (Dani, Sura, Simon, Kiru, Bereket), your upcoming deadlines, and client projects. How would you like to direct your focus today?",
    },
  });

  return { seeded: true, message: "Successfully seeded initial command center data!" };
}
