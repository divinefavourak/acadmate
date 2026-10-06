// Practice questions for Use of English, in the format /admin/imports accepts.
// These are original questions written in the style of UTME items, not past
// questions, so they carry no year. `diagram` names an image from diagrams.mjs,
// which build.mjs embeds as `imageUrl`.

const q = (topic, difficulty, text, [optionA, optionB, optionC, optionD], correctOption, explanation, diagram) => ({
  subject: "ENG",
  topic,
  text,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  difficulty,
  explanation,
  ...(diagram && { diagram }),
});

const PASSAGE = `Read the passage and answer the question that follows.

"For years the people of Oke-Ado fetched water from a stream three kilometres away. Children missed school to carry it, and many fell ill after drinking it. When the borehole was finally sunk in the market square, attendance at the village school rose within a term, and the clinic recorded far fewer cases of typhoid. The elders, who had once doubted the project, now guard the borehole jealously."

`;

export const questions = [
  // ── Lexis and Structure ────────────────────────────────────────────────────
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nNeither the teacher nor the students ___ in the hall.", ["is", "are", "was", "has been"], "B",
    "With neither…nor, the verb agrees with the nearer subject. The nearer subject is \"students\", which is plural, so the verb is \"are\"."),
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nThe principal, as well as the teachers, ___ attending the meeting.", ["are", "were", "have been", "is"], "D",
    "\"As well as the teachers\" is only additional information. The real subject is \"the principal\", which is singular, so the verb is \"is\"."),
  q("Lexis and Structure", "EASY", "Choose the option that best completes the sentence.\n\nShe has been living in Ibadan ___ 2015.", ["since", "for", "from", "by"], "A",
    "\"Since\" is used with a point in time (2015). \"For\" is used with a length of time, as in \"for ten years\"."),
  q("Lexis and Structure", "EASY", "Choose the option that best completes the sentence.\n\nYou will come tomorrow, ___?", ["will you", "don't you", "won't you", "isn't it"], "C",
    "A positive statement takes a negative tag, and the tag repeats the auxiliary verb. \"You will\" gives \"won't you\"."),
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nIf I ___ you, I would accept the offer.", ["am", "was", "had been", "were"], "D",
    "In an unreal or imagined condition, \"were\" is used for all persons: \"If I were you\"."),
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nHe prefers reading ___ watching television.", ["than", "to", "from", "over"], "B",
    "\"Prefer\" is followed by \"to\", not \"than\": prefer one thing to another."),
  q("Lexis and Structure", "EASY", "Choose the option that best completes the sentence.\n\nThe man ___ car was stolen has reported to the police.", ["who", "whom", "whose", "which"], "C",
    "\"Whose\" shows possession: the car belongs to the man."),
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nOne of the boys ___ absent yesterday.", ["was", "were", "are", "have been"], "A",
    "The subject is \"one\", not \"boys\", so the verb is singular. \"Yesterday\" requires the past tense: \"was\"."),
  q("Lexis and Structure", "MEDIUM", "Choose the option that best completes the sentence.\n\nI look forward to ___ from you.", ["hear", "hearing", "heard", "be hearing"], "B",
    "In \"look forward to\", \"to\" is a preposition, so it is followed by the -ing form: \"hearing\"."),
  q("Lexis and Structure", "HARD", "Choose the option that best completes the sentence.\n\nBy this time next year, I ___ my degree.", ["will complete", "have completed", "had completed", "will have completed"], "D",
    "The future perfect (\"will have completed\") is used for an action that will be finished before a stated time in the future."),

  // ── Synonyms and Antonyms ──────────────────────────────────────────────────
  q("Synonyms and Antonyms", "MEDIUM", "Choose the option nearest in meaning to the word in capitals.\n\nThe manager was RELUCTANT to approve the request.", ["eager", "quick", "unwilling", "happy"], "C",
    "\"Reluctant\" means not willing to do something. \"Unwilling\" is nearest in meaning."),
  q("Synonyms and Antonyms", "MEDIUM", "Choose the option nearest in meaning to the word in capitals.\n\nThe lawyer gave a LUCID explanation of the case.", ["clear", "confusing", "lengthy", "brief"], "A",
    "\"Lucid\" means easy to understand. \"Clear\" is nearest in meaning."),
  q("Synonyms and Antonyms", "HARD", "Choose the option nearest in meaning to the word in capitals.\n\nIt was an ARDUOUS journey across the desert.", ["short", "pleasant", "sudden", "difficult"], "D",
    "\"Arduous\" means needing great effort; very hard. \"Difficult\" is nearest in meaning."),
  q("Synonyms and Antonyms", "MEDIUM", "Choose the option nearest in meaning to the word in capitals.\n\nThe new policy will ALLEVIATE the suffering of the poor.", ["worsen", "ease", "ignore", "prolong"], "B",
    "To alleviate is to make something less severe. \"Ease\" is nearest in meaning."),
  q("Synonyms and Antonyms", "MEDIUM", "Choose the option opposite in meaning to the word in capitals.\n\nThe chief was known for his GENEROSITY.", ["kindness", "wealth", "stinginess", "honesty"], "C",
    "Generosity is willingness to give freely. Its opposite is stinginess, an unwillingness to give or spend."),
  q("Synonyms and Antonyms", "MEDIUM", "Choose the option opposite in meaning to the word in capitals.\n\nThe witness gave a VAGUE account of the accident.", ["precise", "unclear", "long", "false"], "A",
    "\"Vague\" means not clear or definite. Its opposite is \"precise\". Note that \"unclear\" is a synonym, not the opposite."),
  q("Synonyms and Antonyms", "EASY", "Choose the option opposite in meaning to the word in capitals.\n\nThe secretary is always PUNCTUAL.", ["timely", "early", "neat", "late"], "D",
    "\"Punctual\" means arriving at the right time. Its opposite is \"late\"."),

  // ── Idioms and Proverbs ────────────────────────────────────────────────────
  q("Idioms and Proverbs", "EASY", "Choose the option that best explains the expression.\n\nBola let the cat out of the bag.", ["She freed a pet.", "She revealed a secret.", "She caused trouble.", "She told a lie."], "B",
    "\"To let the cat out of the bag\" is an idiom meaning to reveal a secret, usually by mistake."),
  q("Idioms and Proverbs", "MEDIUM", "Choose the option that best explains the expression.\n\nThe quarrel between the two neighbours was a storm in a teacup.", ["It was a serious quarrel.", "It happened during a storm.", "It was a great fuss about a small matter.", "It ended in a fight."], "C",
    "\"A storm in a teacup\" means a lot of fuss or anger about something unimportant."),
  q("Idioms and Proverbs", "MEDIUM", "Choose the option that best explains the expression.\n\nAfter years of rivalry, the two families decided to bury the hatchet.", ["to make peace", "to hide their weapons", "to start a fight", "to dig a grave"], "A",
    "\"To bury the hatchet\" means to end a quarrel and become friendly again."),
  q("Idioms and Proverbs", "MEDIUM", "Choose the option that best explains the expression.\n\nEmeka is the black sheep of the family.", ["He is the darkest in complexion.", "He is the youngest child.", "He rears sheep.", "He brings disgrace to the family."], "D",
    "\"The black sheep of the family\" is a member who is regarded as a disgrace or an embarrassment to the rest."),
  q("Idioms and Proverbs", "EASY", "Choose the option that best explains the expression.\n\nAfter his suspension, Tunde promised to turn over a new leaf.", ["to read a new book", "to change his behaviour for the better", "to leave the school", "to plant a tree"], "B",
    "\"To turn over a new leaf\" means to start behaving in a better way."),
  q("Idioms and Proverbs", "MEDIUM", "Which of the following best expresses the meaning of the proverb \"A stitch in time saves nine\"?", ["Tailors should work quickly.", "Nine people work better than one.", "Dealing with a problem early prevents a bigger one.", "Time should never be wasted on small things."], "C",
    "The proverb teaches that acting on a small problem at once saves much more work later."),

  // ── Register and Usage ─────────────────────────────────────────────────────
  q("Register and Usage", "EASY", "Choose the option that best completes the sentence.\n\nThe judge granted bail to the ___.", ["patient", "customer", "passenger", "accused"], "D",
    "In the register of law, a person charged with an offence in court is \"the accused\"."),
  q("Register and Usage", "EASY", "Which of the following words belongs to the register of medicine?", ["diagnosis", "verdict", "dividend", "sermon"], "A",
    "A diagnosis is a doctor's identification of an illness. \"Verdict\" belongs to law, \"dividend\" to finance and \"sermon\" to religion."),
  q("Register and Usage", "MEDIUM", "The words \"shares\", \"dividend\" and \"broker\" belong to the register of", ["agriculture", "the stock exchange", "religion", "sports"], "B",
    "Shares are bought and sold through brokers on the stock exchange, and a dividend is the profit paid to shareholders."),
  q("Register and Usage", "MEDIUM", "A formal letter that begins with \"Dear Sir\" should end with", ["Yours sincerely", "Yours lovingly", "Yours faithfully", "Best wishes"], "C",
    "When a formal letter opens with \"Dear Sir\" or \"Dear Madam\", it closes with \"Yours faithfully\". \"Yours sincerely\" is used when the person is addressed by name."),
  q("Register and Usage", "MEDIUM", "Choose the most appropriate option for a formal notice.\n\nThe meeting has been ___ till next week.", ["postponed", "put off", "pushed", "shifted"], "A",
    "\"Postponed\" is the formal word. \"Put off\" has the same meaning but is informal, and \"pushed\" and \"shifted\" are not standard in this sense."),

  // ── Figures of Speech ──────────────────────────────────────────────────────
  q("Figures of Speech", "EASY", "Identify the figure of speech in the sentence.\n\nThe wind whispered through the trees.", ["simile", "personification", "hyperbole", "irony"], "B",
    "Whispering is a human action. Giving a human quality to the wind is personification."),
  q("Figures of Speech", "EASY", "Identify the figure of speech in the sentence.\n\nHe is as brave as a lion.", ["metaphor", "personification", "euphemism", "simile"], "D",
    "A comparison made with \"as\" or \"like\" is a simile."),
  q("Figures of Speech", "MEDIUM", "Identify the figure of speech in the sentence.\n\nThe classroom was a zoo.", ["metaphor", "simile", "paradox", "alliteration"], "A",
    "The classroom is said to be a zoo directly, without \"like\" or \"as\". That is a metaphor."),
  q("Figures of Speech", "EASY", "Identify the figure of speech in the sentence.\n\nI have told you a million times to close the door.", ["irony", "euphemism", "hyperbole", "oxymoron"], "C",
    "\"A million times\" is a deliberate exaggeration for emphasis, which is hyperbole."),
  q("Figures of Speech", "MEDIUM", "Identify the figure of speech in the sentence.\n\nPeter Piper picked a peck of pickled peppers.", ["assonance", "alliteration", "onomatopoeia", "antithesis"], "B",
    "The consonant sound /p/ is repeated at the beginning of nearby words. That is alliteration."),
  q("Figures of Speech", "HARD", "Identify the figure of speech in the sentence.\n\nThe child is the father of the man.", ["simile", "euphemism", "hyperbole", "paradox"], "D",
    "The statement seems to contradict itself, yet it contains a truth: the character formed in childhood shapes the adult. That is a paradox."),
  q("Figures of Speech", "MEDIUM", "\"The old man passed away last night.\" The expression \"passed away\" is an example of", ["euphemism", "irony", "metaphor", "pun"], "A",
    "\"Passed away\" is a mild way of saying \"died\". A mild expression used in place of a harsh one is a euphemism."),

  // ── Sentence Construction ──────────────────────────────────────────────────
  q("Sentence Construction", "MEDIUM", "\"Although it rained heavily, the match continued.\" This is a", ["simple sentence", "compound sentence", "complex sentence", "compound-complex sentence"], "C",
    "It has one main clause (\"the match continued\") and one subordinate clause (\"Although it rained heavily\"), which makes it a complex sentence."),
  q("Sentence Construction", "MEDIUM", "Choose the passive form of the sentence.\n\nThe boy kicked the ball.", ["The ball is kicked by the boy.", "The ball was kicked by the boy.", "The ball has been kicked by the boy.", "The boy was kicked by the ball."], "B",
    "The object \"the ball\" becomes the subject, and the tense stays the same. \"Kicked\" is simple past, so the passive is \"was kicked\"."),
  q("Sentence Construction", "MEDIUM", "Choose the correct reported form of the sentence.\n\nShe said, \"I am tired.\"", ["She said that I am tired.", "She said that she is tired.", "She said that I was tired.", "She said that she was tired."], "D",
    "After a reporting verb in the past, the tense moves back (am → was) and the pronoun changes to fit the speaker (I → she)."),
  q("Sentence Construction", "HARD", "Which of the following sentences is correctly constructed?", ["Walking down the road, I saw a tree fall.", "Walking down the road, a tree fell.", "Walking down the road, the tree was seen.", "Walking down the road, there was a tree."], "A",
    "The phrase \"Walking down the road\" must describe the subject that follows it. Only in the first sentence is the subject (\"I\") the one doing the walking. The others have a dangling modifier."),
  q("Sentence Construction", "MEDIUM", "In the sentence shown in the diagram, which numbered part is the object?", ["1", "2", "3", "4"], "C",
    "The object receives the action of the verb. Ask \"passed what?\" The answer is \"the examination\", which is part 3.", "sentence-parts-numbered"),

  // ── Oral English ───────────────────────────────────────────────────────────
  q("Oral English", "MEDIUM", "Choose the word that has the same vowel sound as the letters in brackets.\n\nb(ea)t", ["bit", "key", "bet", "bait"], "B",
    "\"Beat\" has the long vowel /iː/. \"Key\" is pronounced /kiː/, with the same vowel. \"Bit\" has /ɪ/, \"bet\" has /e/ and \"bait\" has the diphthong /eɪ/."),
  q("Oral English", "MEDIUM", "Choose the word that has the same vowel sound as the letter in brackets.\n\nc(u)p", ["put", "cot", "cart", "son"], "D",
    "\"Cup\" has the vowel /ʌ/. \"Son\" is pronounced /sʌn/. \"Put\" has /ʊ/, \"cot\" has /ɒ/ and \"cart\" has /ɑː/."),
  q("Oral English", "MEDIUM", "Choose the word that has the same consonant sound as the letters in brackets.\n\n(ch)emist", ["school", "church", "chef", "machine"], "A",
    "In \"chemist\" the letters \"ch\" are pronounced /k/, as in \"school\". In \"church\" they are /tʃ/, and in \"chef\" and \"machine\" they are /ʃ/."),
  q("Oral English", "HARD", "Choose the word that rhymes with \"though\".", ["tough", "cough", "sew", "through"], "C",
    "\"Though\" is pronounced /ðəʊ/ and \"sew\" is /səʊ/, so they rhyme. \"Tough\" ends in /ʌf/, \"cough\" in /ɒf/ and \"through\" in /uː/."),
  q("Oral English", "MEDIUM", "Which of the following words is stressed on the second syllable?", ["table", "begin", "happy", "water"], "B",
    "\"Begin\" is stressed on the second syllable: be-GIN. The others are stressed on the first: TA-ble, HAP-py, WA-ter."),
  q("Oral English", "HARD", "The word in capitals carries the emphatic stress. Choose the question to which the sentence is the answer.\n\nJOHN bought the car.", ["Did John hire the car?", "Did John buy the bus?", "Did John sell the car?", "Did Peter buy the car?"], "D",
    "The stress on JOHN shows that the person is being corrected. The matching question names a different person: \"Did Peter buy the car?\""),
  q("Oral English", "MEDIUM", "The diagram shows the stress pattern of a two-syllable word. Which of the following words has this pattern?", ["student", "remain", "about", "below"], "A",
    "The big dot comes first, so the first syllable is stressed. \"Student\" is STU-dent. \"Remain\", \"about\" and \"below\" are all stressed on the second syllable.", "stress-pattern-question"),

  // ── Comprehension Passages ─────────────────────────────────────────────────
  q("Comprehension Passages", "MEDIUM", PASSAGE + "According to the passage, one effect of the borehole was that", ["the stream dried up", "more children attended school", "the market became larger", "the elders opposed the project"], "B",
    "The passage states that \"attendance at the village school rose within a term\" after the borehole was sunk. The other options are not supported by the passage."),
  q("Comprehension Passages", "HARD", PASSAGE + "The word \"jealously\", as used in the passage, means", ["with envy", "with anger", "carelessly", "very protectively"], "D",
    "To guard something jealously is to protect it very carefully. In this context the word has nothing to do with envy."),

  // ── Summary Writing ────────────────────────────────────────────────────────
  q("Summary Writing", "HARD", PASSAGE + "Which of the following best summarises the passage in one sentence?", ["The borehole improved school attendance and health in Oke-Ado and won over the elders.", "The people of Oke-Ado used to fetch water from a stream three kilometres away.", "Typhoid is caused by drinking dirty water from streams.", "The elders of Oke-Ado guard the borehole in the market square."], "A",
    "A summary gives the main points without detail: the borehole's benefits and the elders' change of mind. The second and fourth options cover only one detail each, and the third states something the passage does not say."),
];
