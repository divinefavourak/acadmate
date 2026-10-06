// Study notes for Use of English, one entry per topic.
// Topic names match the app's seeded topics for the subject (code ENG).
// {{diagram:name|alt text}} is replaced by build.mjs with an embedded image.

const SUBJECT = "ENG";

export const notes = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Comprehension Passages",
    access: "FREE",
    sections: [
      {
        title: "What comprehension tests",
        body: `
A comprehension passage tests whether you can **understand what you read**, not what you already know about the subject.

Every question falls into one of four kinds:

- **Stated facts** — the answer is written in the passage, often in different words.
- **Implied meaning** — the passage suggests it without saying it directly. You must infer.
- **Word meaning** — what a word or phrase means *as used in the passage*.
- **The writer's view** — the main idea, the tone, or the purpose of the passage.

> The golden rule: the answer comes from the passage. If the passage does not support an option, it is wrong, even if it is true in real life.
`,
      },
      {
        title: "A four-step method",
        body: `
{{diagram:comprehension-steps|Four steps for a comprehension passage: skim, read the questions, read closely, answer from the text}}

1. **Skim** the passage once to get the general idea. Do not stop at hard words.
2. **Read the questions** so you know what to look for.
3. **Read closely**, and find the line or lines that answer each question.
4. **Answer from the text.** Go back and check; do not rely on memory.

Time yourself. In an exam, do not spend so long on one passage that you rush the rest of the paper.
`,
      },
      {
        title: "Working out a word from its context",
        body: `
You will meet words you do not know. Use the words around them:

- **Look for a definition or example nearby.** *"The village was arid; no rain had fallen for two years."* Arid must mean very dry.
- **Look for a contrast.** Words like *but*, *however*, *unlike* signal an opposite. *"Unlike his gregarious sister, Tunde kept to himself."* Gregarious must mean sociable.
- **Substitute each option.** Put each option in place of the word and read the sentence again. The right one keeps the meaning of the sentence unchanged.

A word can have several meanings. Choose the one that fits **this** passage, not the one you met first.
`,
      },
      {
        title: "Traps to avoid",
        body: `
- **Too wide or too narrow.** For "main idea" questions, reject options that cover only one paragraph, and options that go beyond the passage.
- **True but not stated.** An option may be a fact about the world and still be wrong because the passage never says it.
- **Extreme words.** Be careful with *always*, *never*, *all*, *only*. Passages rarely make such absolute claims.
- **Borrowed words.** An option that copies phrases from the passage is not automatically right. Check what it actually claims.
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Summary Writing",
    access: "FREE",
    sections: [
      {
        title: "What a summary is",
        body: `
A summary gives the **main points** of a passage in far fewer words. It leaves out examples, repetition, description and the writer's illustrations.

{{diagram:summary-steps|From passage to summary: pick out only the points asked for, then write one sentence per point in your own words}}

A good summary answer is:

- **Relevant** — it answers exactly what the question asks.
- **Brief** — one clear sentence for each point.
- **Complete** — a full sentence, not a phrase or a list of words.
- **In your own words** as far as possible.
`,
      },
      {
        title: "How to find the main points",
        body: `
1. Read the question first. It tells you which points to collect, for example *"State three causes of the flood."*
2. Read the passage and mark each sentence that gives one of those points.
3. Find the **topic sentence** of each paragraph. It usually carries the main idea; the rest of the paragraph explains it.
4. Cross out examples and repetition. *"Many fruits, such as mangoes, oranges and pawpaw, are rich in vitamins"* reduces to *"Many fruits are rich in vitamins."*
5. Write each point as its own sentence.
`,
      },
      {
        title: "Common mistakes",
        body: `
- **Copying whole sentences** from the passage. This is called lifting and it loses marks.
- **Adding your own opinion** or facts that are not in the passage.
- **Putting two points in one sentence**, or one point in two sentences. Keep to one point per sentence.
- **Including examples.** If you can remove it and the point still stands, it is not a main point.
- **Writing a preamble** such as *"The three causes of the flood are as follows."* Go straight to the points.
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Lexis and Structure",
    access: "FREE",
    sections: [
      {
        title: "The eight parts of speech",
        body: `
Every word in a sentence does a job. The job it does is its **part of speech**.

{{diagram:parts-of-speech|The eight parts of speech: noun, pronoun, verb, adjective, adverb, preposition, conjunction and interjection, each with its job and examples}}

The same word can be different parts of speech in different sentences. Decide by the job it is doing:

- *She gave a quick **answer**.* — noun
- *Please **answer** the question.* — verb
- *He works **fast**.* — adverb
- *He is a **fast** runner.* — adjective
`,
      },
      {
        title: "Concord: subject and verb agreement",
        body: `
A singular subject takes a singular verb; a plural subject takes a plural verb. Most exam questions test the tricky subjects below.

{{diagram:concord|Concord rules: which subjects take a singular verb, which take a plural verb, and which follow the nearer subject}}

Find the **real subject** before choosing the verb. Words between the subject and the verb do not change the number:

- *The **box** of oranges **is** heavy.* (The subject is *box*, not *oranges*.)
- *The **students** in that class **are** noisy.*
`,
      },
      {
        title: "Tenses you must not confuse",
        body: `
- **Simple past** for a finished action at a stated time: *I **saw** him yesterday.*
- **Present perfect** for a past action that matters now, with no stated time: *I **have seen** him.* Never write *I have seen him yesterday.*
- **Past perfect** for the earlier of two past actions: *The train **had left** before we arrived.*
- **Future perfect** for an action that will be complete by a future time: *By June, I **will have finished** the course.*

**Since** goes with a point in time; **for** goes with a length of time:

- *She has lived here **since** 2015.*
- *She has lived here **for** ten years.*

In an unreal condition, use **were** for all persons: *If I **were** you, I would accept.*
`,
      },
      {
        title: "Question tags, prepositions and pronouns",
        body: `
**Question tags.** A positive statement takes a negative tag, and a negative statement takes a positive tag. The tag repeats the auxiliary verb.

- *You will come, **won't you**?*
- *She isn't ready, **is she**?*
- *They finished the work, **didn't they**?*

**Fixed prepositions.** Some words always take the same preposition. Learn them as pairs:

- *prefer … **to*** (not *than*) · *different **from*** · *congratulate **on*** · *accuse **of*** · *charge **with*** · *look forward **to*** + *-ing*

**Relative pronouns.** *who* for the person doing the action, *whom* for the person receiving it, *whose* for possession, *which* for things.

- *The man **whose** car was stolen has reported to the police.*
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Sentence Construction",
    access: "FREE",
    sections: [
      {
        title: "The parts of a sentence",
        body: `
A sentence expresses a complete thought. It needs a **subject** and a **verb**; many sentences also have an object and an adverbial.

{{diagram:sentence-parts|The sentence "The diligent student passed the examination easily" divided into subject, verb, object and adverbial}}

- The **subject** is who or what the sentence is about.
- The **verb** tells what the subject does or is.
- The **object** receives the action. Ask "what?" or "whom?" after the verb.
- The **adverbial** tells how, when, where or why.

A group of words without a subject or a finite verb is a **fragment**, not a sentence: *"Walking to school every day."*
`,
      },
      {
        title: "Simple, compound and complex sentences",
        body: `
Sentences are classified by the clauses they contain. A **main clause** can stand alone. A **subordinate clause** cannot; it depends on a main clause.

{{diagram:sentence-types|Examples of simple, compound, complex and compound-complex sentences, showing their main and subordinate clauses}}

- Words like **and, but, or, so** join two main clauses to make a **compound** sentence.
- Words like **when, because, although, if, that, who** introduce a subordinate clause, giving a **complex** sentence.
`,
      },
      {
        title: "Active and passive voice",
        body: `
In the **active** voice the subject does the action. In the **passive** voice the subject receives it.

- Active: *The boy kicked the ball.*
- Passive: *The ball was kicked by the boy.*

To change active to passive:

1. Make the object the new subject.
2. Use the right form of **be** in the same tense, plus the past participle.
3. Put the old subject after **by**, or leave it out.

Keep the tense the same. *"She is writing a letter"* becomes *"A letter is being written by her."*
`,
      },
      {
        title: "Direct and reported speech",
        body: `
**Direct speech** gives the speaker's exact words in quotation marks. **Reported speech** gives the meaning without quoting.

- Direct: *She said, "I am tired."*
- Reported: *She said that she was tired.*

When the reporting verb is in the past (*said*, *told*), make three changes:

- **Tense moves back:** *am → was*, *will → would*, *have seen → had seen*.
- **Pronouns change** to fit the new speaker: *I → she*, *my → her*.
- **Time and place words change:** *now → then*, *today → that day*, *tomorrow → the next day*, *here → there*.

A reported question has no question mark and uses statement word order: *He asked where I lived.*
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Synonyms and Antonyms",
    access: "FREE",
    sections: [
      {
        title: "Nearest in meaning",
        body: `
A **synonym** is a word that means the same, or nearly the same, as another: *begin* and *commence*, *brave* and *courageous*.

Exam questions ask for the option **nearest in meaning** to a word *as it is used in the sentence*. Few words are exact synonyms, so:

1. Read the whole sentence, not just the word.
2. Decide what the word means **here**.
3. Replace it with each option. The right option leaves the meaning unchanged.

*"The lawyer gave a **lucid** explanation."* Lucid here means clear, so the nearest option is *clear*, not *long* or *clever*.
`,
      },
      {
        title: "Opposite in meaning",
        body: `
An **antonym** is a word opposite in meaning: *generous* and *stingy*, *vague* and *precise*.

Read the instruction carefully. Many marks are lost by choosing a synonym when the question asks for the **opposite**.

Antonyms can be formed with prefixes:

- **un-**: *happy → unhappy*
- **in-, im-, il-, ir-**: *visible → invisible*, *possible → impossible*, *legal → illegal*, *regular → irregular*
- **dis-**: *agree → disagree*
- **mis-**: *understand → misunderstand*

Not every opposite uses a prefix. The opposite of *generous* is *stingy*, not *ungenerous*.
`,
      },
      {
        title: "Words that are easily confused",
        body: `
Some pairs look or sound alike but differ in meaning. Learn them:

- **accept** (receive) / **except** (leaving out)
- **affect** (verb: to influence) / **effect** (noun: a result)
- **advice** (noun) / **advise** (verb)
- **principal** (head of a school; main) / **principle** (a rule or belief)
- **stationary** (not moving) / **stationery** (writing materials)
- **lose** (fail to keep) / **loose** (not tight)
- **quiet** (silent) / **quite** (fairly)
- **complement** (completes) / **compliment** (praise)

Build vocabulary by reading widely and noting each new word with a sentence of your own.
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Idioms and Proverbs",
    access: "FREE",
    sections: [
      {
        title: "What an idiom is",
        body: `
An **idiom** is a fixed expression whose meaning is different from the meanings of its individual words.

*"To let the cat out of the bag"* has nothing to do with cats. It means **to reveal a secret**.

Because the meaning is not literal, you cannot work an idiom out word by word. You have to learn it. In the exam, reject any option that explains the idiom literally.
`,
      },
      {
        title: "Idioms you should know",
        body: `
- **a storm in a teacup** — a great fuss about something unimportant
- **to bury the hatchet** — to end a quarrel and make peace
- **to turn over a new leaf** — to change one's behaviour for the better
- **the black sheep of the family** — a member who brings disgrace
- **to beat about the bush** — to avoid coming to the point
- **a white elephant** — a costly thing that is of little use
- **to sit on the fence** — to refuse to take sides
- **to burn the midnight oil** — to work or study late into the night
- **a bone of contention** — the cause of a disagreement
- **to rain cats and dogs** — to rain very heavily
- **once in a blue moon** — very rarely
- **to call a spade a spade** — to speak plainly and frankly
`,
      },
      {
        title: "Proverbs",
        body: `
A **proverb** is a short, well-known saying that states a general truth or gives advice.

- **A stitch in time saves nine.** — Dealing with a problem early prevents a bigger one.
- **Make hay while the sun shines.** — Use an opportunity while it lasts.
- **All that glitters is not gold.** — Appearances can deceive.
- **A bird in the hand is worth two in the bush.** — What you have is worth more than what you only hope to get.
- **Too many cooks spoil the broth.** — Too many people on one task ruin it.
- **Look before you leap.** — Think before you act.

Questions on proverbs ask what the saying **means** or which situation it **fits**.
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Figures of Speech",
    access: "FREE",
    sections: [
      {
        title: "Figures of comparison",
        body: `
A **figure of speech** uses words in a non-literal way to create an effect.

- **Simile** — compares two things using *like* or *as*: *He is as brave as a lion.*
- **Metaphor** — says one thing **is** another, without *like* or *as*: *The classroom was a zoo.*
- **Personification** — gives human qualities to something that is not human: *The wind whispered through the trees.*

To tell simile from metaphor, look for *like* or *as*. If the comparison is direct, it is a metaphor.
`,
      },
      {
        title: "Figures of exaggeration and contrast",
        body: `
- **Hyperbole** — deliberate exaggeration: *I have told you a million times.*
- **Euphemism** — a mild expression for something unpleasant: *He passed away* for *he died*.
- **Irony** — saying the opposite of what is meant: *"What lovely weather!"* said during a storm.
- **Oxymoron** — two opposite words placed side by side: *a deafening silence*, *bitter sweet*.
- **Paradox** — a statement that seems to contradict itself yet holds a truth: *The child is the father of the man.*
- **Antithesis** — opposite ideas balanced in one sentence: *To err is human; to forgive, divine.*

An oxymoron is two words; a paradox is a whole statement.
`,
      },
      {
        title: "Figures of sound",
        body: `
- **Alliteration** — repetition of the same **consonant sound** at the start of nearby words: *Peter Piper picked a peck of pickled peppers.*
- **Assonance** — repetition of the same **vowel sound** in nearby words: *The rain in Spain stays mainly in the plain.*
- **Onomatopoeia** — a word that imitates the sound it names: *buzz*, *hiss*, *bang*, *splash*.

These depend on **sound**, not spelling. *"Kind cats"* is alliteration because both words begin with the sound /k/, even though the letters differ.
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Register and Usage",
    access: "FREE",
    sections: [
      {
        title: "What register means",
        body: `
**Register** is the set of words that belongs to a particular field or occupation. Each field has its own vocabulary:

- **Law** — judge, accused, plaintiff, defendant, verdict, bail, prosecution
- **Medicine** — diagnosis, prescription, surgery, ward, patient, symptom
- **Banking and finance** — deposit, overdraft, interest, dividend, shares
- **Religion** — sermon, congregation, pulpit, pilgrimage
- **Journalism** — editor, headline, column, reporter, press
- **Agriculture** — harvest, irrigation, livestock, fertiliser

Exam questions give a sentence about a field and ask for the word that fits it, or give a list of words and ask which field they belong to.
`,
      },
      {
        title: "Formal and informal usage",
        body: `
Register also means choosing words to suit the **occasion** and the **person** you are addressing.

{{diagram:register-scale|The same ideas expressed in formal, neutral and informal language}}

- Use **formal** language in official letters, reports and speeches. Avoid slang and contractions.
- Use **informal** language with friends and family.

In a **formal letter**, match the greeting and the ending:

- *Dear Sir* or *Dear Madam* → *Yours faithfully*
- *Dear Mr Bello* (a name) → *Yours sincerely*
`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    subject: SUBJECT,
    topic: "Oral English",
    access: "FREE",
    sections: [
      {
        title: "Vowel sounds",
        body: `
English has **twelve pure vowels** (monophthongs) and **eight diphthongs** (vowels that glide from one sound to another).

{{diagram:vowel-chart|Chart of the twelve pure vowels of English with an example word for each}}

Oral English tests **sounds, not spelling**. The same letters can stand for different sounds, and different letters for the same sound:

- *seat*, *key*, *people* and *machine* all contain /iː/.
- *put* has /ʊ/ but *cup* has /ʌ/, although both are spelt with **u**.

The eight diphthongs are heard in: *day* /eɪ/, *my* /aɪ/, *boy* /ɔɪ/, *go* /əʊ/, *now* /aʊ/, *here* /ɪə/, *air* /eə/, *tour* /ʊə/.
`,
      },
      {
        title: "Consonant sounds",
        body: `
English has **24 consonant sounds**. The ones that cause most errors are:

- **/θ/ and /ð/** — *thin* /θ/, *then* /ð/. Do not replace them with /t/ and /d/.
- **/ʃ/ and /tʃ/** — *ship* /ʃ/, *chip* /tʃ/.
- **/k/ spelt "ch"** — *chemist*, *school*, *character*.
- **/ʃ/ spelt "ch"** — *chef*, *machine*.
- **/f/ spelt "gh" or "ph"** — *cough*, *phone*.

**Silent letters** are written but not pronounced: the **b** in *comb* and *debt*, the **k** in *knee*, the **t** in *listen*, the **p** in *receipt*, the **w** in *write*.
`,
      },
      {
        title: "Word stress",
        body: `
In a word of more than one syllable, one syllable is said with more force. That is the **stressed** syllable: **TA**ble, be**GIN**, **WA**ter, to**MOR**row.

Many two-syllable words are stressed on the **first** syllable as nouns and on the **second** as verbs:

{{diagram:word-stress|Record, present and import are stressed on the first syllable as nouns and on the second syllable as verbs}}

Useful patterns:

- Words ending in **-tion** or **-sion** are stressed on the syllable before the ending: edu**CA**tion, de**CI**sion.
- Words ending in **-ic** are stressed on the syllable before it: eco**NO**mic, fan**TAS**tic.
`,
      },
      {
        title: "Emphatic stress and rhyme",
        body: `
**Emphatic stress.** A speaker can stress one word in a sentence to contrast it with something else. The stressed word shows what the sentence is answering.

*"JOHN bought the car."* answers *"Did **Peter** buy the car?"* The stress on JOHN corrects the person.

*"John BOUGHT the car."* answers *"Did John **hire** the car?"*

To answer these questions, find the stressed word, then pick the question that differs from the statement **only in that word**.

**Rhyme.** Two words rhyme when they end with the same sound, whatever the spelling: *though* and *sew*, *blue* and *through*, *heart* and *part*. *Tough* and *though* do **not** rhyme.
`,
      },
    ],
  },
];
