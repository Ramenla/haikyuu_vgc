const fs = require('fs');
const path = './src/data/cardDatabase.ts';

const dbContent = fs.readFileSync(path, 'utf8');

const newCards = `  {
    id: "HVD-05-001",
    name: "Tetsurō Kuroo",
    type: "Character",
    school: "Nekoma",
    year: "Third Year",
    position: "MB",
    stats: { serve: 1, receive: 0, toss: 0, attack: 3, block: 3 },
    effect: 'When this character enters the block area, if the action area says "Get it! I have to stop it, get it!", add 1 to the block point of this character and draw a card from the deck.',
    image: "/assets/Fukurodani_Deck/HVD-05-001.png",
    effectTrigger: "onPlayBlock",
    effectType: "kurooHVD05"
  },
  {
    id: "HVD-05-002",
    name: "Kenma Kozume",
    type: "Character",
    school: "Nekoma",
    year: "Second Year",
    position: "S",
    stats: { serve: 1, receive: 3, toss: 1, attack: 1, block: 2 },
    effect: "If this character is a Toss character and your Attack character has 3 or more Attack points written on it, you may choose a character card from that character's guts and put it into the Attack area.",
    image: "/assets/Fukurodani_Deck/HVD-05-002.png",
    // This is a passive effect handled in App.tsx handleZoneClick
    effectTrigger: "",
    effectType: ""
  },
  {
    id: "HVD-05-003",
    name: "Lev Haiba",
    type: "Character",
    school: "Nekoma",
    year: "First Year",
    position: "MB",
    stats: { serve: 1, receive: 0, toss: 0, attack: 3, block: 2 },
    effect: "When this character enters the Attack area from your hand, if you have 3 guts or more, add 1 to the Attack point of this character. You may put 1 card in your drop area. If you do, add 1 to the Attack points of this character.",
    image: "/assets/Fukurodani_Deck/HVD-05-003.png",
    effectTrigger: "onPlayAttack",
    effectType: "levHVD05"
  },
  {
    id: "HVD-05-004",
    name: "Morisuke Yaku",
    type: "Character",
    school: "Nekoma",
    year: "Third Year",
    position: "Li",
    stats: { serve: 0, receive: 5, toss: 0, attack: 0, block: 0 },
    effect: "Tidak ada efek",
    image: "/assets/Fukurodani_Deck/HVD-05-004.png",
    effectTrigger: "",
    effectType: ""
  },
  {
    id: "HVD-05-005",
    name: "Get it! I have to stop it, get it!",
    type: "Action",
    school: "",
    year: "",
    position: "",
    stats: { serve: 2, receive: 1, toss: 0, attack: 3, block: 0 },
    effect: '[Recieve Phase] [Block Phase] Add +2 to the Receive point or Block point of one character from Nekoma. If that character is the Block character "Tetsurō Kuroo", draw a card from the deck.',
    image: "/assets/Fukurodani_Deck/HVD-05-005.png",
    effectTrigger: "onPlayEvent",
    effectType: "actionGetIt",
    phaseRestriction: "Receive,Block"
  },
  {
    id: "HVD-05-006",
    name: "Kōtarō Bokuto",
    type: "Character",
    school: "Fukurōdani",
    year: "Third Year",
    position: "WS",
    stats: { serve: 2, receive: 1, toss: 0, attack: 3, block: 0 },
    effect: 'When this character comes into play, if there are 3 or more guts, add 2 to the Attack points of this character and put 3 cards from the top of your deck into the drop area. If there is an Action Card in it, you cannot put "Kōtarō Bokuto" into play during this set.',
    image: "/assets/Fukurodani_Deck/HVD-05-006.png",
    effectTrigger: "onPlayAny",
    effectType: "bokutoHVD05"
  },
  {
    id: "HVD-05-007",
    name: "Keiji Akaashi",
    type: "Character",
    school: "Fukurōdani",
    year: "Second Year",
    position: "S",
    stats: { serve: 2, receive: 2, toss: 1, attack: 1, block: 2 },
    effect: 'When this character enters your Toss area from your hand, if you have 3 guts or more, show up to one "Kōtarō Bokuto" from the deck to your opponent, add it to your hand, and shuffle your deck.',
    image: "/assets/Fukurodani_Deck/HVD-05-007.png",
    effectTrigger: "onPlayToss",
    effectType: "akaashiHVD05"
  },
  {
    id: "HVD-05-008",
    name: "Yamato Sarukui",
    type: "Character",
    school: "Fukurōdani",
    year: "Third Year",
    position: "WS",
    stats: { serve: 2, receive: 2, toss: 0, attack: 3, block: 4 },
    effect: "Tidak ada efek",
    image: "/assets/Fukurodani_Deck/HVD-05-008.png",
    effectTrigger: "",
    effectType: ""
  },
  {
    id: "HVD-05-009",
    name: "Akinori Konoha",
    type: "Character",
    school: "Fukurōdani",
    year: "Third Year",
    position: "WS",
    stats: { serve: 2, receive: 4, toss: 0, attack: 3, block: 2 },
    effect: "Tidak ada efek",
    image: "/assets/Fukurodani_Deck/HVD-05-009.png",
    effectTrigger: "",
    effectType: ""
  },
  {
    id: "HVD-05-010",
    name: "After all, I'm the strongest",
    type: "Action",
    school: "",
    year: "",
    position: "",
    stats: { serve: 0, receive: 0, toss: 0, attack: 0, block: 0 },
    effect: '[Attack Phase] Add +1 to the Attack point of your own Attack character in Fukurōdani. If your toss character is "Keiji Akaashi" and the attack character is "Kōtarō Bokuto", you will gain an additional +1 Attack point. After that, you can\\'t use "After all I\\'m the strongest" during this turn.',
    image: "/assets/Fukurodani_Deck/HVD-05-010.png",
    effectTrigger: "onPlayEvent",
    effectType: "actionAfterAll",
    phaseRestriction: "Attack"
  }
];`;

const insertionPoint = dbContent.lastIndexOf('];');
const updatedContent = dbContent.slice(0, insertionPoint) + ',\n' + newCards + '\n];';
fs.writeFileSync(path, updatedContent);
console.log('Fukurodani deck added');
