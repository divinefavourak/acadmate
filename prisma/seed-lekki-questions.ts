/**
 * Seed: The Lekki Headmaster — UTME Practice Questions (accurate, from full text)
 * Author: Kabir Alabi Garba | Publisher: Basmallah Communications Ltd / Winepress Publishing, 2023
 *
 * Run:
 *   npx ts-node --project tsconfig.json --skip-project prisma/seed-lekki-questions.ts
 *
 * Safe to re-run: deletes old questions linked to the prose text first, then re-creates.
 */

import { PrismaClient } from "@prisma/client";

// Seeds should use the direct (non-pooler) URL to avoid PgBouncer limitations
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

const questions = [
  // ─── Characters ──────────────────────────────────────────────────────────────
  {
    text: "What is the full name of the principal nicknamed 'The Lekki Headmaster'?",
    options: [
      { label: "A", text: "Bepo Fafore", isCorrect: false },
      { label: "B", text: "Adewale Adebepo", isCorrect: true },
      { label: "C", text: "Ope Wande", isCorrect: false },
      { label: "D", text: "Justus Anabel", isCorrect: false },
    ],
    explanation: "The principal's full name is Adewale Adebepo. 'Bepo' is a shortened form of 'Adebepo', which many at Stardom did not know until the farewell banner read 'Memorable Farewell for a Most Committed Principal, Adebepo Adewale'.",
    difficulty: "EASY",
  },
  {
    text: "What role does Bepo hold at Stardom Schools at the start of the novel?",
    options: [
      { label: "A", text: "Class teacher in SSS 2", isCorrect: false },
      { label: "B", text: "Vice Principal", isCorrect: false },
      { label: "C", text: "Principal", isCorrect: true },
      { label: "D", text: "Head of English Department", isCorrect: false },
    ],
    explanation: "Bepo is the Principal of Stardom Schools. He had earlier served as Headmaster at Stardom Kiddies — the nursery/primary arm — before becoming principal at the secondary school.",
    difficulty: "EASY",
  },
  {
    text: "How did Bepo earn the nickname 'The Lekki Headmaster'?",
    options: [
      { label: "A", text: "He was appointed headmaster of all Lekki schools by the government", isCorrect: false },
      { label: "B", text: "He used to imitate characters in the old TV drama Village Headmaster when he was Headmaster at Stardom Kiddies", isCorrect: true },
      { label: "C", text: "He wrote a book titled The Lekki Headmaster", isCorrect: false },
      { label: "D", text: "He was the founder of the first school in the Lekki area", isCorrect: false },
    ],
    explanation: "The nickname was coined by the humorous Fine Arts teacher, Mr. Audu. When Bepo was Headmaster at Stardom Kiddies he sometimes mimicked characters from the TV drama Village Headmaster. Audu joked that just as the series had a Village Headmaster, Stardom had its own 'Lekki Headmaster'. The label stuck even after Bepo became principal.",
    difficulty: "EASY",
  },
  {
    text: "Who is the Managing Director (MD) of Stardom Schools?",
    options: [
      { label: "A", text: "Mrs. Grace Apeh", isCorrect: false },
      { label: "B", text: "Mrs. Beke Egbin", isCorrect: false },
      { label: "C", text: "Mrs. Ibidun Gloss", isCorrect: true },
      { label: "D", text: "Mrs. Titi", isCorrect: false },
    ],
    explanation: "Mrs. Ibidun Gloss — popularly called 'MD' — is the Managing Director of Stardom Schools. She is the daughter of the school's late founder, Chief David Aje.",
    difficulty: "EASY",
  },
  {
    text: "Who founded Stardom Schools and first employed Bepo?",
    options: [
      { label: "A", text: "Mrs. Ibidun Gloss", isCorrect: false },
      { label: "B", text: "Chief Mrs. Solape Bayo", isCorrect: false },
      { label: "C", text: "Chief David Aje, the MD's late father", isCorrect: true },
      { label: "D", text: "Bepo himself, after leaving Beesway", isCorrect: false },
    ],
    explanation: "Mrs. Gloss stated at Bepo's farewell that it was her late father, Chief David Aje, who founded the school and who interviewed and hired Bepo 24 years earlier.",
    difficulty: "MEDIUM",
  },
  {
    text: "Why is Mr. Fafore significant in the novel?",
    options: [
      { label: "A", text: "He leads the staff in a strike against the MD's financial decisions", isCorrect: false },
      { label: "B", text: "He is the English teacher who is almost wrongly sacked for a sentence that is grammatically correct", isCorrect: true },
      { label: "C", text: "He replaces Bepo as principal after Bepo's departure", isCorrect: false },
      { label: "D", text: "He is the student who wins the Best Debater award at the farewell event", isCorrect: false },
    ],
    explanation: "Mr. Fafore is the English teacher who wrote 'Ade as well as Jide comes early' in a student's note. Parent Mr. Guta complained, the MD called for Fafore's dismissal — but Bepo defended the sentence as correct, and a phone search by all staff confirmed Bepo and Fafore were right.",
    difficulty: "MEDIUM",
  },
  {
    text: "What is the role of Mr. Audu at Stardom Schools?",
    options: [
      { label: "A", text: "Chemistry teacher and form master of SSS 3", isCorrect: false },
      { label: "B", text: "Fine Arts teacher, known for his biting humour", isCorrect: true },
      { label: "C", text: "Vice Principal and guidance counsellor", isCorrect: false },
      { label: "D", text: "CRK teacher who lives in Mowe, Ogun State", isCorrect: false },
    ],
    explanation: "Mr. Audu is the Fine Arts teacher. He is described as 'a bunch of biting humour' and his comic interventions — such as pronouncing Mr. Fafore 'pardoned, discharged and acquitted' — provide comic relief throughout the novel.",
    difficulty: "EASY",
  },

  // ─── Grammar Controversy ──────────────────────────────────────────────────────
  {
    text: "What grammatical sentence does parent Mr. Guta find in the note given by Mr. Fafore to students?",
    options: [
      { label: "A", text: "\"Neither Ade nor Jide are coming early\"", isCorrect: false },
      { label: "B", text: "\"Ade as well as Jide comes early\"", isCorrect: true },
      { label: "C", text: "\"Ade and Jide comes early\"", isCorrect: false },
      { label: "D", text: "\"Ade as well as Jide come early\"", isCorrect: false },
    ],
    explanation: "Mr. Guta saw the sentence 'Ade as well as Jide comes early' in a student's note and reported it to the school as a grammatical error. The MD nearly sacked Fafore over it.",
    difficulty: "MEDIUM",
  },
  {
    text: "Is the sentence 'Ade as well as Jide comes early' grammatically correct, according to Bepo's explanation?",
    options: [
      { label: "A", text: "No — 'as well as' always takes a plural verb like 'and'", isCorrect: false },
      { label: "B", text: "Yes — when 'as well as' is used (unlike 'and'), the singular verb form is correct because the clause is in the subjunctive mood", isCorrect: true },
      { label: "C", text: "No — the sentence should read 'Ade, as well as Jide, come early'", isCorrect: false },
      { label: "D", text: "Yes, but only in informal spoken English, not formal written English", isCorrect: false },
    ],
    explanation: "Bepo explained that when conjunctions like 'as well as', 'together with', or 'alongside' are used — unlike 'and' — the singular verb is correct because the clause is in the subjunctive mood. A phone search by the entire staff confirmed that Bepo and Fafore were correct, and the parent and MD were wrong.",
    difficulty: "HARD",
  },
  {
    text: "What is the outcome of the controversy over Mr. Fafore's grammatical sentence?",
    options: [
      { label: "A", text: "Fafore is dismissed and the school issues a public apology to the parent", isCorrect: false },
      { label: "B", text: "The sentence is confirmed correct; the MD is embarrassed; and Mr. Audu humorously pronounces the MD 'pardoned, discharged and acquitted'", isCorrect: true },
      { label: "C", text: "An external English examiner is brought in to give a final ruling", isCorrect: false },
      { label: "D", text: "Fafore resigns voluntarily to spare the school further embarrassment", isCorrect: false },
    ],
    explanation: "After Bepo's explanation, all staff searched online and confirmed the sentence was correct. A silence fell on the room. Mr. Audu, ever the comic, declared: 'Mr. Fafore, as well as the principal, is correct. And the MD, Mrs. Ibidun Gloss, is hereby pardoned, discharged and acquitted.' The room rocked with laughter.",
    difficulty: "MEDIUM",
  },

  // ─── The Cooperative and Cars ─────────────────────────────────────────────────
  {
    text: "What discovery does the MD make on a piece of Stardom-owned land near the school's back gate?",
    options: [
      { label: "A", text: "A rival school being secretly built by disgruntled staff", isCorrect: false },
      { label: "B", text: "Cars belonging to staff members who were hiding their vehicles from management", isCorrect: true },
      { label: "C", text: "A large cooperative building constructed without management approval", isCorrect: false },
      { label: "D", text: "A stash of embezzled school funds buried by the accountant", isCorrect: false },
    ],
    explanation: "During a lunchtime walk, the MD inspected a plot of land the school owned. She found about 17 cars, many with Stardom stickers, belonging to staff who were hiding them from management. She feared they had obtained the money through theft.",
    difficulty: "MEDIUM",
  },
  {
    text: "How much money did the Stardom Cooperative Society have in total at the time the MD investigated it?",
    options: [
      { label: "A", text: "N50 million in savings and N95 million loaned out", isCorrect: false },
      { label: "B", text: "N95 million in savings and over N50 million loaned out", isCorrect: true },
      { label: "C", text: "N250,000 per member, with no central fund", isCorrect: false },
      { label: "D", text: "N145 million collected entirely from parents' fees", isCorrect: false },
    ],
    explanation: "The accountant revealed that the cooperative society held N95 million, while over N50 million had already been loaned out to staff. This alarmed the MD and the board of directors.",
    difficulty: "MEDIUM",
  },
  {
    text: "What decision did the Stardom board of directors make after learning of the cooperative society's financial strength?",
    options: [
      { label: "A", text: "They dissolved the cooperative society entirely", isCorrect: false },
      { label: "B", text: "They capped individual staff loans at N250,000 and required the MD's approval for all loans", isCorrect: true },
      { label: "C", text: "They transferred management of the cooperative to an independent bank", isCorrect: false },
      { label: "D", text: "They offered staff a pay rise to reduce dependence on cooperative loans", isCorrect: false },
    ],
    explanation: "The board — the MD, her mother Chief Mrs. Solape Bayo (chairman), Martins Bayo and Oye Bayo — decided that no staff member could borrow more than N250,000, all loan requests must be approved by the MD, and management must be informed of cooperative elections.",
    difficulty: "MEDIUM",
  },
  {
    text: "What does the MD's mother, Chief Bayo, say about the cooperative society in the board meeting?",
    options: [
      { label: "A", text: "\"The cooperative is a sign that our staff trust us with their savings.\"", isCorrect: false },
      { label: "B", text: "\"It's like hanging a snake in the roof and going to bed — the staff could rebel and use the money to start a rival school.\"", isCorrect: true },
      { label: "C", text: "\"We must immediately sack every staff member who borrowed money without permission.\"", isCorrect: false },
      { label: "D", text: "\"The cooperative should be donated to charity to remove the temptation.\"", isCorrect: false },
    ],
    explanation: "Chief Mrs. Solape Bayo used the vivid simile of 'hanging a snake in the roof and going to bed' — warning that if staff collectively had access to N95 million, they might rebel and use it to establish a competing school, threatening Stardom's existence.",
    difficulty: "HARD",
  },

  // ─── Japa / Relocation ────────────────────────────────────────────────────────
  {
    text: "Why does the novel open with Bepo weeping uncontrollably at the school assembly?",
    options: [
      { label: "A", text: "A student had been critically injured during the inter-house sports competition", isCorrect: false },
      { label: "B", text: "He had just received news that his wife, Seri, was seriously ill in the UK", isCorrect: false },
      { label: "C", text: "He was overcome with grief at the prospect of leaving Nigeria and Stardom Schools to join his family in the UK", isCorrect: true },
      { label: "D", text: "A fire had destroyed the school's cooperative society records overnight", isCorrect: false },
    ],
    explanation: "After five days of resisting questions, Bepo revealed he was weeping because he was leaving Nigeria for the UK. He loved Stardom and his students deeply and found it agonising to leave them, even though family pressure — from his wife Seri and their children Nike and Kike — made the move inevitable.",
    difficulty: "EASY",
  },
  {
    text: "What profession does Bepo's wife, Seri, practise in the United Kingdom?",
    options: [
      { label: "A", text: "Barrister", isCorrect: false },
      { label: "B", text: "University lecturer", isCorrect: false },
      { label: "C", text: "Nurse", isCorrect: true },
      { label: "D", text: "Secondary school principal", isCorrect: false },
    ],
    explanation: "Seri is a nurse working in the UK. Rumour among Bepo's colleagues had it that she earned up to £10,000 per month. It was the economic pressure from her salary — contrasted with Bepo's N400,000 as principal — that made his colleagues think he was irrational to hesitate about relocating.",
    difficulty: "EASY",
  },
  {
    text: "What was Bepo's salary as principal at Stardom Schools before his departure?",
    options: [
      { label: "A", text: "N175,000 per month", isCorrect: false },
      { label: "B", text: "N400,000 per month", isCorrect: true },
      { label: "C", text: "N600,000 per month", isCorrect: false },
      { label: "D", text: "£3,600 per month", isCorrect: false },
    ],
    explanation: "Bepo earned N400,000 per month as principal. His colleagues contrasted this with the nearly £4,000 per month he was offered in the UK, converting it to roughly N6 million at N1,700 per pound — and regarded his reluctance to leave as inexplicable.",
    difficulty: "MEDIUM",
  },
  {
    text: "What does Bepo's experience at the Badagry Heritage Slave Museum make him reflect upon?",
    options: [
      { label: "A", text: "The importance of teaching Nigerian history to students", isCorrect: false },
      { label: "B", text: "A parallel between the historic trans-Atlantic slave trade and the modern Japa phenomenon — Nigerians voluntarily rushing to work for their former colonial masters", isCorrect: true },
      { label: "C", text: "The need for Nigeria to demand reparations from European nations", isCorrect: false },
      { label: "D", text: "The superiority of the British education system over Nigeria's", isCorrect: false },
    ],
    explanation: "At the Black Heritage Museum in Badagry, Bepo grew emotional and then reflective. He saw a bitter irony in modern Nigerians desperately selling their possessions to get visas and travel abroad to take any available job — comparing it to the trans-Atlantic slave trade, where Africans were also transported to work for Western masters, but now voluntarily.",
    difficulty: "HARD",
  },
  {
    text: "What problem did Bepo face when trying to renew his expired passport before travelling to the UK?",
    options: [
      { label: "A", text: "He was blacklisted by immigration authorities for unpaid taxes", isCorrect: false },
      { label: "B", text: "He had to bribe an agent and an immigration official and visit a NIN office, facing long delays and system glitches", isCorrect: true },
      { label: "C", text: "His passport renewal was blocked because his wife's visa was still pending", isCorrect: false },
      { label: "D", text: "He discovered he had dual citizenship, which complicated the process", isCorrect: false },
    ],
    explanation: "Bepo's passport had expired two years before. He travelled to Ibadan to use an agent (Tai), paying N100,000 instead of the official N70,000. He also encountered delays at the NIN office due to network glitches, nearly missing his travel date. The novel uses this to expose the systemic corruption in Nigeria's passport renewal process.",
    difficulty: "MEDIUM",
  },

  // ─── Beesway / Rituals ────────────────────────────────────────────────────────
  {
    text: "What ungodly act does Bepo witness at his previous school, Beesway Group of Schools?",
    options: [
      { label: "A", text: "The director is caught falsifying students' examination results for a fee", isCorrect: false },
      { label: "B", text: "The director and accomplices bury a live cow on the school premises at 2:51am as part of a ritual", isCorrect: true },
      { label: "C", text: "A group of teachers conduct a séance in the school chapel at midnight", isCorrect: false },
      { label: "D", text: "The director is found running an illegal betting ring in the school office", isCorrect: false },
    ],
    explanation: "Bepo, unable to sleep at 2:51am in the Beesway staff quarters, saw men — led by the director — burying a live cow in a pit on the school grounds. When he challenged them, one man struck his wrist with a club. The director later claimed it was a special prayer for his late father. Bepo left Beesway shortly after.",
    difficulty: "MEDIUM",
  },
  {
    text: "What grammatical error does Bepo notice in the name of his former school, Beesway Group of Schools?",
    options: [
      { label: "A", text: "The word 'Beesway' is misspelt — it should be 'Beesway'", isCorrect: false },
      { label: "B", text: "The name uses 'School' instead of 'Schools' — incorrect because 'group of' implies more than one school", isCorrect: true },
      { label: "C", text: "The name should read 'Schools Group' not 'Group of Schools'", isCorrect: false },
      { label: "D", text: "The use of 'of' is incorrect — the name should be 'Beesway Group Schools'", isCorrect: false },
    ],
    explanation: "As Senior English teacher, Bepo pointed out that the name should be 'Beesway Group of Schools' not 'Group of School', because 'group of' implies there is more than one school. The director refused to change it, claiming the name was 'divinely inspired'.",
    difficulty: "MEDIUM",
  },
  {
    text: "Why does Bepo leave Beesway Group of Schools?",
    options: [
      { label: "A", text: "He is headhunted and offered a better salary at Stardom Schools", isCorrect: false },
      { label: "B", text: "He is sacked for repeatedly embarrassing the director about the school's name", isCorrect: false },
      { label: "C", text: "He voluntarily leaves after witnessing the director's nocturnal ritual — an act he considered ungodly", isCorrect: true },
      { label: "D", text: "He leaves to start his own school, Fruitful Future", isCorrect: false },
    ],
    explanation: "Although the grammatical dispute contributed to tension, the real reason Bepo left Beesway was after witnessing the live burial of the cow — an act he found 'ungodly' and 'animalistic'. The novel notes he 'walked away voluntarily because of a matter he considered ungodly'. Before even seeing the director the next morning, he had already moved his belongings.",
    difficulty: "MEDIUM",
  },
  {
    text: "What is Fruitful Future School, and what happens to it?",
    options: [
      { label: "A", text: "It is the private school Bepo establishes in Lekki after leaving Stardom; it thrives and earns him great wealth", isCorrect: false },
      { label: "B", text: "It is a neighbourhood school Bepo co-founded after NYSC in a rented flat; it collapsed when access roads deteriorated and residents moved away", isCorrect: true },
      { label: "C", text: "It is Bepo's school in the UK, mentioned in his farewell speech", isCorrect: false },
      { label: "D", text: "It is a government school in Lekki where Bepo did his NYSC", isCorrect: false },
    ],
    explanation: "Shortly after his NYSC, Bepo and a colleague set up Fruitful Future School in a rented two-bedroom flat. Enrolment was growing by the third session. However, access roads in the area collapsed and residents began to move away. Unable to relocate, they had to shut down.",
    difficulty: "MEDIUM",
  },
  {
    text: "What ritual does parent Mr. Ogo offer to perform at Fruitful Future School to boost enrolment?",
    options: [
      { label: "A", text: "Sprinkling holy water blessed by a pastor at each corner of the school", isCorrect: false },
      { label: "B", text: "Burying a live cow under the main entrance of the school", isCorrect: false },
      { label: "C", text: "Sprinkling a few grains of corn at corners of the school, costing N35,000", isCorrect: true },
      { label: "D", text: "Burning incense and placing carved idols at the school gate", isCorrect: false },
    ],
    explanation: "Mr. Ogo offered to sprinkle grains of corn at the school's corners for N35,000, promising it would cause students to 'troop in from left and right'. Bepo and his colleague declined. Ironically, years later, Bepo saw on TV that Mr. Ogo had been arrested for murdering a woman who sought spiritual help for infertility.",
    difficulty: "EASY",
  },

  // ─── Farewell and Return ──────────────────────────────────────────────────────
  {
    text: "What gift does the MD present to Bepo at his farewell ceremony?",
    options: [
      { label: "A", text: "A new car and household electronics for his UK home", isCorrect: false },
      { label: "B", text: "A domiciliary cheque for $10,000 — the highest Stardom had ever given a departing staff member", isCorrect: true },
      { label: "C", text: "A gold watch and a letter of recommendation", isCorrect: false },
      { label: "D", text: "A one-year paid sabbatical to return and work as a visiting lecturer", isCorrect: false },
    ],
    explanation: "Mrs. Gloss gave Bepo a domiciliary cheque (not naira, not cash) for $10,000 — which she confirmed was the highest amount the school had ever presented to any departing staff. She joked that she could not declare the amount first because it would make others want to leave too.",
    difficulty: "MEDIUM",
  },
  {
    text: "How long had Bepo been at Stardom Schools before his planned departure?",
    options: [
      { label: "A", text: "10 years", isCorrect: false },
      { label: "B", text: "15 years", isCorrect: false },
      { label: "C", text: "24 years", isCorrect: true },
      { label: "D", text: "30 years", isCorrect: false },
    ],
    explanation: "The MD stated at Bepo's farewell that he had been at Stardom for 24 years. He was hired by her late father, Chief David Aje, and first arrived eight days late for his resumption date.",
    difficulty: "EASY",
  },
  {
    text: "What unusual detail about Bepo's first day at Stardom Schools does the MD reveal at the farewell?",
    options: [
      { label: "A", text: "He came to the school dressed in the wrong uniform and was sent home", isCorrect: false },
      { label: "B", text: "He arrived eight days late for his resumption date, yet the late founder insisted on waiting for him", isCorrect: true },
      { label: "C", text: "He was initially offered the post of Vice Principal but turned it down", isCorrect: false },
      { label: "D", text: "He failed the interview but was hired anyway after impressing with a spontaneous English lesson", isCorrect: false },
    ],
    explanation: "The MD revealed that after Bepo's informal interview with her late father Chief Aje, he was expected to resume on September 14. He never came — not that day, not the day after, nor that week. The founder insisted on waiting. Bepo finally arrived eight days late. The founder's faith in him proved well-placed over 24 years.",
    difficulty: "MEDIUM",
  },
  {
    text: "What is the significance of the ending of The Lekki Headmaster?",
    options: [
      { label: "A", text: "Bepo boards the plane and arrives in London, where he is reunited with Seri and his children", isCorrect: false },
      { label: "B", text: "Bepo goes through all departure processes at the airport but ultimately returns to Stardom the following Monday, declaring he cannot leave his students", isCorrect: true },
      { label: "C", text: "Bepo is deported from the UK and forced to return to Nigeria", isCorrect: false },
      { label: "D", text: "Bepo retires from teaching and starts a transport business in Lagos", isCorrect: false },
    ],
    explanation: "After his emotional farewell, Bepo goes to the airport, checks in, and is at the boarding gate when he falls asleep and dreams of the Badagry slave trade. He wakes up screaming 'Noooo!' The following Monday, the students find him at the school gate: 'I am back! I didn't go! I'm not going again! My heart is here! This is where my heart is!'",
    difficulty: "MEDIUM",
  },
  {
    text: "What dream does Bepo have at the airport boarding gate that symbolises his decision?",
    options: [
      { label: "A", text: "He dreams of his children Nike and Kike pleading with him not to travel", isCorrect: false },
      { label: "B", text: "He dreams of slaves at the Badagry Point of No Return being pushed into a ship, with a white man finally directing him to 'Enter!'", isCorrect: true },
      { label: "C", text: "He dreams of Stardom Schools in flames, with no one to put out the fire", isCorrect: false },
      { label: "D", text: "He dreams of his late father advising him to stay in Nigeria", isCorrect: false },
    ],
    explanation: "At the boarding gate, Bepo dozed off and dreamed he was at the Heritage Slave Museum in Badagry. He watched slaves being tortured and marched to the Point of No Return. As the last man was pushed into the ship, a white man pointed to Bepo and said 'Enter!' Bepo screamed 'Noooo!' and woke up — foreshadowing his decision not to board.",
    difficulty: "HARD",
  },

  // ─── Themes and Broader Issues ────────────────────────────────────────────────
  {
    text: "What is the central conflict in The Lekki Headmaster?",
    options: [
      { label: "A", text: "A power struggle between the MD and the school's board of directors", isCorrect: false },
      { label: "B", text: "Bepo's internal conflict between his love for his students and his duty to his family who have relocated to the UK", isCorrect: true },
      { label: "C", text: "A legal dispute between two student families over a prefect election", isCorrect: false },
      { label: "D", text: "The cooperative society's challenge to the school's financial authority", isCorrect: false },
    ],
    explanation: "The central conflict is Bepo's deeply personal dilemma: his passionate commitment to his students and Stardom versus the family pressure — from his wife Seri and children in the UK — to join them. The novel traces his agonising journey toward a decision, which ultimately sees him return to Stardom.",
    difficulty: "MEDIUM",
  },
  {
    text: "What broader social theme does the novel's treatment of 'Japa' primarily explore?",
    options: [
      { label: "A", text: "The superiority of the British education system over the Nigerian system", isCorrect: false },
      { label: "B", text: "The brain drain crisis and the tension between patriotism and the desire for economic survival abroad", isCorrect: true },
      { label: "C", text: "The exploitation of Nigerian workers by foreign multinational companies", isCorrect: false },
      { label: "D", text: "The failure of Nigerian universities to produce globally competitive graduates", isCorrect: false },
    ],
    explanation: "Japa — the popular term for emigrating abroad — is a central theme. Through Bepo, Sola, the Ignatius family, and many tales, the novel explores why Nigerians leave, the sacrifices they make, the varied outcomes, and the deep question of what patriotism means in a country that seems to fail its people.",
    difficulty: "HARD",
  },
  {
    text: "What does the novel suggest about private school education in Nigeria through the story of Chief Waliem?",
    options: [
      { label: "A", text: "That private schools are always financially stable and insulated from social crises", isCorrect: false },
      { label: "B", text: "That even wealthy parents can face sudden ruin, leaving their children unable to afford fees — highlighting the fragility of private school access", isCorrect: true },
      { label: "C", text: "That banks deliberately target private school parents for loan default recovery", isCorrect: false },
      { label: "D", text: "That the government should take over all private schools to prevent inequality", isCorrect: false },
    ],
    explanation: "Chief Waliem was a rich, popular patron who bankrolled social programmes at Stardom. When he slumped and died, banks immediately seized his assets to recover debts. His three children could not complete the following term because the family could not pay fees — a powerful illustration of how precarious access to private education can be.",
    difficulty: "HARD",
  },
  {
    text: "How does the novel portray Mr. Fafore's life outside school to develop the theme of teachers' welfare?",
    options: [
      { label: "A", text: "Fafore earns a comfortable living and recently bought a house in Lekki", isCorrect: false },
      { label: "B", text: "Despite being a 22-year graduate, Fafore earns N175,000, lives in an unplastered self-built house in Ifo and wakes at 4am to make Stardom by 7am", isCorrect: true },
      { label: "C", text: "Fafore supplements his income by running a private tutoring business", isCorrect: false },
      { label: "D", text: "Fafore's poor living conditions are caused by his personal financial mismanagement, not his salary", isCorrect: false },
    ],
    explanation: "The novel uses Fafore's story powerfully: with 22 years of experience, his salary of N175,000 cannot afford Lekki rent. He built an unplastered two-bedroom house in Ifo, wakes at 4am daily, and has twice won the Most Punctual Teacher Award. This contrasts sharply with the expectations placed on teachers at elite private schools.",
    difficulty: "MEDIUM",
  },
  {
    text: "What does Bepo's relationship with the landlord's grandson Jide reveal about his character?",
    options: [
      { label: "A", text: "Bepo's desire to earn extra income by offering private lessons", isCorrect: false },
      { label: "B", text: "Bepo's genuine passion for mentoring and education, which extended beyond the school even to his neighbourhood", isCorrect: true },
      { label: "C", text: "Bepo's attempt to win community support before his departure", isCorrect: false },
      { label: "D", text: "Bepo's regret at never having a son of his own", isCorrect: false },
    ],
    explanation: "For about a year before his departure, Bepo had been coaching his landlord's 7-year-old grandson Jide in elocution and African history at weekends — without pay. He felt guilty about leaving the boy. This small detail affirms that Bepo's commitment to nurturing young minds was not just professional but deeply personal.",
    difficulty: "MEDIUM",
  },
  {
    text: "What is the significance of the Invention Club's 'Breath Project' in the novel?",
    options: [
      { label: "A", text: "It is a fundraising project to buy new science equipment for the school", isCorrect: false },
      { label: "B", text: "It is a five-year phone-making initiative using recycled panels and chips, which Bepo fears will stall without his patronage", isCorrect: true },
      { label: "C", text: "It is a breathing exercise programme introduced to help students manage exam stress", isCorrect: false },
      { label: "D", text: "It is a collaboration with a UK school that Bepo hopes to supervise from London", isCorrect: false },
    ],
    explanation: "The Breath Project was a five-year initiative by the Stardom Invention Club to manufacture a phone using recycled panels and chips. It had attracted media and government interest, with funds committed by the school and an NGO called Life Grid. Bepo — though not a scientist — was its active patron, and he worried deeply that it would derail without him.",
    difficulty: "HARD",
  },

  // ─── Miscellaneous ────────────────────────────────────────────────────────────
  {
    text: "What does the student Ikenna Egbu's pep talk at the morning assembly reveal about the novel's setting and themes?",
    options: [
      { label: "A", text: "It introduces the school's policy of compulsory overseas excursions for all students", isCorrect: false },
      { label: "B", text: "It showcases Bepo's success in making learning adventurous, while setting an ironic contrast to his own impending departure from Nigeria", isCorrect: true },
      { label: "C", text: "It foreshadows Bepo's journey to Jos in the novel's later chapters", isCorrect: false },
      { label: "D", text: "It is used by the MD to announce new boarding fee policies", isCorrect: false },
    ],
    explanation: "Ikenna's enthusiastic speech about the excursion to Jos — 'I saw Nigeria in its acrobatic beauty' — was meant to be the kind of moment Bepo would celebrate, proof that students were growing through education. Instead, it is the backdrop against which Bepo weeps: a man who devoted 24 years to his students is about to leave the very country he taught them to love.",
    difficulty: "HARD",
  },
  {
    text: "What does the novel's treatment of the Banky–Tosh rivalry illustrate?",
    options: [
      { label: "A", text: "That student elections at Stardom are corrupt and should be abolished", isCorrect: false },
      { label: "B", text: "How adult conflicts — particularly parental rivalries and political affiliations — infect the school environment and affect children", isCorrect: true },
      { label: "C", text: "That Bepo's democratic prefect election system was fundamentally flawed", isCorrect: false },
      { label: "D", text: "That wealthy parents always use their influence to ensure their children win elections", isCorrect: false },
    ],
    explanation: "The Banky–Tosh rivalry began as a children's dance competition but escalated because their parents — whose rivalry predated it, rooted in PTA politics and opposing political parties — fuelled it. Banky's remark about Tosh's father being an 'ex-convict' (actually untrue) triggered a legal dispute that Bepo is unable to resolve before he leaves.",
    difficulty: "HARD",
  },
  {
    text: "What is the name of the teacher who is transferred to Stardom Hub after a student repeatedly had nightmares about him?",
    options: [
      { label: "A", text: "Mr. Fafore", isCorrect: false },
      { label: "B", text: "Mr. Ayesoro", isCorrect: true },
      { label: "C", text: "Mr. Audu", isCorrect: false },
      { label: "D", text: "Mr. Oyelana", isCorrect: false },
    ],
    explanation: "Mr. Ayesoro, the Government teacher, was nicknamed 'Mr. Owala' (a derogatory Yoruba term for someone with prominent facial marks). A young student named Bibi was so terrified of him that she repeatedly screamed his name in nightmares. Management transferred Ayesoro to Stardom Hub, the property wing of the Stardom Group of Companies.",
    difficulty: "MEDIUM",
  },
  {
    text: "What subject does Bepo have a degree in, and from which university?",
    options: [
      { label: "A", text: "English Language from the University of Lagos", isCorrect: false },
      { label: "B", text: "English/History Education from the University of Benin", isCorrect: true },
      { label: "C", text: "Literature in English from Obafemi Awolowo University", isCorrect: false },
      { label: "D", text: "Communication Arts from the University of Ibadan", isCorrect: false },
    ],
    explanation: "Bepo studied English/History Education at the University of Benin. He is a trained teacher by profession — a fact that reinforces his deep identification with the teaching vocation and explains why he finds it so difficult to abandon his students.",
    difficulty: "MEDIUM",
  },
  {
    text: "Who wrote The Lekki Headmaster?",
    options: [
      { label: "A", text: "Chinua Achebe", isCorrect: false },
      { label: "B", text: "Wole Soyinka", isCorrect: false },
      { label: "C", text: "Kabir Alabi Garba", isCorrect: true },
      { label: "D", text: "Chimamanda Ngozi Adichie", isCorrect: false },
    ],
    explanation: "The Lekki Headmaster was written by Kabir Alabi Garba and first published in Nigeria by Winepress Publishing in 2023, with a special edition by Basmallah Communications Limited.",
    difficulty: "EASY",
  },
];

async function main() {
  console.log("Looking up Lekki Headmaster prose text...");

  const prose = await prisma.proseText.findFirst({
    where: { title: { contains: "Lekki Headmaster" } },
  });
  if (!prose) {
    console.error("Prose text 'The Lekki Headmaster' not found. Run the main seed first:\n  npx prisma db seed");
    process.exit(1);
  }
  console.log("Found:", prose.title, "(id:", prose.id + ")");

  // Update the prose text with the correct author (seed.ts had a wrong author)
  await prisma.proseText.update({
    where: { id: prose.id },
    data: {
      author: "Kabir Alabi Garba",
      summary:
        "The Lekki Headmaster follows Bepo (Adewale Adebepo), the beloved principal of Stardom Schools in Lekki, Lagos. After 24 years of dedicated service, Bepo faces a wrenching choice: relocate to the UK to join his nurse wife Seri and their children, or stay with the students he loves. Through episodes of staff intrigue, a cooperative society controversy, a grammar scandal, a nocturnal ritual, and Bepo's own reflections on the Japa phenomenon, the novel explores passion, patriotism, and the true meaning of vocation.",
      themes:
        "Vocation and passion, The Japa phenomenon and brain drain, Education and teachers' welfare, Integrity and moral courage, Patriotism versus personal ambition",
    },
  });
  console.log("Updated prose text author and summary.");

  // Delete old questions linked to this prose text
  // Must delete exam session question rows first (FK constraint)
  const oldQuestions = await prisma.question.findMany({
    where: { proseTextId: prose.id },
    select: { id: true },
  });
  const oldIds = oldQuestions.map((q) => q.id);
  if (oldIds.length > 0) {
    await prisma.examSessionQuestion.deleteMany({ where: { questionId: { in: oldIds } } });
    await prisma.userAnswer.deleteMany({ where: { questionId: { in: oldIds } } });
    await prisma.questionOption.deleteMany({ where: { questionId: { in: oldIds } } });
    await prisma.explanation.deleteMany({ where: { questionId: { in: oldIds } } });
    const deleted = await prisma.question.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`Deleted ${deleted.count} old questions (and their options/explanations/session refs).`);
  } else {
    console.log("No old questions to delete.");
  }

  const subject = await prisma.subject.findFirst({ where: { code: "LIT" } });
  if (!subject) {
    console.error("Subject 'LIT' (Literature in English) not found. Run the main seed first.");
    process.exit(1);
  }

  const proseTopic = await prisma.topic.findFirst({
    where: { name: { contains: "Prose" }, subject: { code: "ENG" } },
  });

  let created = 0;
  for (const q of questions) {
    await prisma.question.create({
      data: {
        text: q.text,
        difficulty: q.difficulty as "EASY" | "MEDIUM" | "HARD",
        subjectId: subject.id,
        proseTextId: prose.id,
        topicId: proseTopic?.id ?? null,
        isPublished: true,
        sourceType: "MANUAL",
        options: {
          create: q.options.map((o, i) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.isCorrect,
            sortOrder: i,
          })),
        },
        ...(q.explanation
          ? { explanation: { create: { text: q.explanation, aiAssisted: false } } }
          : {}),
      },
    });
    created++;
    process.stdout.write(`\r  Created ${created}/${questions.length} questions...`);
  }

  console.log(`\nDone! ${created} accurate questions seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
