import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

async function main() {
  console.log("Seeding database...");

  // ─── Admin user ───────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@acadmate.ng" },
    update: {},
    create: {
      name: "Acadmate Admin",
      email: "admin@acadmate.ng",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Admin user:", admin.email);

  // ─── Subjects ─────────────────────────────────────────────────────────────
  const subjectData = [
    { name: "Use of English", code: "ENG", description: "English Language for UTME", sortOrder: 1 },
    { name: "Mathematics", code: "MTH", description: "General Mathematics", sortOrder: 2 },
    { name: "Biology", code: "BIO", description: "Biological Sciences", sortOrder: 3 },
    { name: "Chemistry", code: "CHM", description: "Chemical Sciences", sortOrder: 4 },
    { name: "Physics", code: "PHY", description: "Physical Sciences", sortOrder: 5 },
    { name: "Government", code: "GOV", description: "Government and Civics", sortOrder: 6 },
    { name: "Economics", code: "ECO", description: "Economics", sortOrder: 7 },
    { name: "Literature in English", code: "LIT", description: "Literature in English", sortOrder: 8 },
    { name: "Geography", code: "GEO", description: "Geography", sortOrder: 9 },
    { name: "Agricultural Science", code: "AGR", description: "Agricultural Science", sortOrder: 10 },
    { name: "Commerce", code: "COM", description: "Commerce", sortOrder: 11 },
    { name: "Accounts", code: "ACC", description: "Financial Accounting", sortOrder: 12 },
  ];

  const subjects: Record<string, string> = {};
  for (const s of subjectData) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, isActive: true },
    });
    subjects[s.code] = subject.id;
    console.log("Subject:", subject.name);
  }

  // ─── Topics ───────────────────────────────────────────────────────────────

  const topicsBySubject: Record<string, string[]> = {
    ENG: [
      "Comprehension Passages",
      "Lexis and Structure",
      "Oral English",
      "Register and Usage",
      "Summary Writing",
      "Figures of Speech",
      "Sentence Construction",
      "Synonyms and Antonyms",
      "Idioms and Proverbs",
      "Prose Fiction",
    ],
    MTH: [
      "Number and Numeration",
      "Algebraic Processes",
      "Geometry and Mensuration",
      "Trigonometry",
      "Statistics and Probability",
      "Calculus",
      "Sets",
      "Surds and Indices",
      "Logarithms",
      "Sequences and Series",
    ],
    BIO: [
      "Cell Biology",
      "Genetics and Evolution",
      "Ecology and Environment",
      "Plant Biology",
      "Animal Biology",
      "Human Biology and Physiology",
      "Reproduction",
      "Classification of Living Things",
      "Nutrition",
      "Excretion",
    ],
    CHM: [
      "Atomic Structure",
      "Chemical Bonding",
      "Stoichiometry",
      "Acids, Bases and Salts",
      "Redox Reactions",
      "Electrochemistry",
      "Organic Chemistry",
      "Chemical Kinetics",
      "Equilibrium",
      "Periodic Table",
    ],
    PHY: [
      "Mechanics",
      "Heat and Temperature",
      "Waves and Sound",
      "Light and Optics",
      "Electricity and Magnetism",
      "Nuclear Physics",
      "Properties of Matter",
      "Measurement and Units",
      "Motion and Forces",
      "Energy",
    ],
    GOV: [
      "Principles of Government",
      "Nigerian Constitution",
      "Political Parties",
      "Electoral System",
      "Local Government",
      "International Relations",
      "Public Administration",
      "Citizenship and Human Rights",
      "Arms of Government",
      "African Politics",
    ],
    ECO: [
      "Demand and Supply",
      "National Income",
      "Money and Banking",
      "International Trade",
      "Agricultural Economics",
      "Public Finance",
      "Population and Economic Development",
      "Economic Systems",
      "Price Determination",
      "Labour and Employment",
    ],
  };

  for (const [code, topicNames] of Object.entries(topicsBySubject)) {
    const subjectId = subjects[code];
    if (!subjectId) continue;
    for (let i = 0; i < topicNames.length; i++) {
      await prisma.topic.upsert({
        where: { subjectId_name: { subjectId, name: topicNames[i] } },
        update: {},
        create: { subjectId, name: topicNames[i], sortOrder: i, isActive: true },
      });
    }
    console.log(`Topics for ${code}: ${topicNames.length} created`);
  }

  // ─── Default Exam Template ────────────────────────────────────────────────
  const template = await prisma.examTemplate.upsert({
    where: { id: "default-utme-template" },
    update: {},
    create: {
      id: "default-utme-template",
      name: "UTME Mock Exam",
      description: "Standard UTME format: Use of English + 3 subject choices",
      durationMinutes: 120,
      totalQuestions: 40,
      isActive: true,
    },
  });
  console.log("Exam template:", template.name);

  // Add English to the template
  await prisma.examTemplateSubject.upsert({
    where: {
      examTemplateId_subjectId: {
        examTemplateId: template.id,
        subjectId: subjects["ENG"],
      },
    },
    update: {},
    create: {
      examTemplateId: template.id,
      subjectId: subjects["ENG"],
      questionCount: 10,
    },
  });

  // ─── Prose: The Lekki Headmaster ─────────────────────────────────────────
  const proseText = await prisma.proseText.upsert({
    where: { title: "The Lekki Headmaster" },
    update: {},
    create: {
      title: "The Lekki Headmaster",
      author: "Oladele Taiwo",
      summary:
        "The Lekki Headmaster is a Nigerian prose fiction text that explores themes of education, community, morality, and conflict within a school setting in Lagos. The story follows the headmaster's struggles with discipline, corrupt officials, and community expectations.",
      themes:
        "Education and community development, Corruption and moral integrity, Tradition vs modernity, Leadership and responsibility, Conflict and resolution",
      isPublished: true,
    },
  });
  console.log("Prose text:", proseText.title);

  // Starter sections
  const proseSections = [
    {
      title: "Characters",
      content: `Key characters in The Lekki Headmaster:

**The Headmaster** - The central figure. A principled educator who navigates corruption and community pressures to uphold the integrity of his school.

**The Inspector** - A government official whose interference threatens the school's independence.

**The Community Leaders** - Represent traditional values and expectations placed on the school.

**The Students** - Young Nigerians caught between tradition and modernity, shaped by the conflicts around them.`,
      sortOrder: 0,
    },
    {
      title: "Themes",
      content: `**Education and Community Development**
The school is positioned as a pillar of the community. The headmaster's role goes beyond academics — he shapes the moral and intellectual character of the next generation.

**Corruption and Integrity**
The text examines how corruption infiltrates institutions and the personal cost of resisting it. The headmaster's principled stands put him at odds with those who benefit from the status quo.

**Tradition vs Modernity**
Conflict arises between traditional community expectations and the demands of a modern, formal education system.

**Leadership and Responsibility**
The headmaster must balance competing loyalties: to his students, his community, and his own moral compass.`,
      sortOrder: 1,
    },
    {
      title: "Summary",
      content: `The Lekki Headmaster is set in a school on the Lekki peninsula of Lagos. The headmaster, a dedicated educator, faces mounting pressure from a corrupt school inspector, community leaders with personal agendas, and the daily realities of running an underfunded school.

The story unfolds through a series of confrontations that test the headmaster's principles. He must decide whether to compromise his values for personal survival or maintain his integrity at great personal cost.

The novel ultimately affirms the importance of education and honest leadership as foundations for community progress, even in the face of systemic corruption.`,
      sortOrder: 2,
    },
  ];

  for (const section of proseSections) {
    await prisma.proseSection.upsert({
      where: {
        id: `lekki-section-${section.sortOrder}`,
      },
      update: {},
      create: {
        id: `lekki-section-${section.sortOrder}`,
        proseTextId: proseText.id,
        ...section,
      },
    });
  }
  console.log("Prose sections created:", proseSections.length);

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
