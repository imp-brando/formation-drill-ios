// Sound-alike + drill-sergeant slur table. Positive: phrase -> command id. Negative: talk that must be ignored (null).
module.exports.positive = {
  // the user's two real examples
  "call him left march":"colL", "palm left march":"colL",
  // column
  "calm left march":"colL","column left much":"colL","colon left march":"colL","call um left march":"colL","clem left march":"colL",
  "kolam left march":"colL","come left march":"colL","collar left march":"colL","collum left mars":"colL","palm right march":"colR",
  "call him right march":"colR","calm right much":"colR","colon write march":"colR","come right marsh":"colR","column rite march":"colR",
  "column ride march":"colR","call him lift march":"colL","column laugh march":"colL","column lef march":"colL","column left mar":"colL",
  "column left match":"colL","column left harsh":"colL","column left ma":"colL","column right marsh":"colR",
  // drill-sergeant slurs
  "colm lef harch":"colL","cumm ri hut":"colR","colm right hup":"colR","colm lef hah":"colL","calm lef ho":"colL",
  "fowahd harch":"forward","fowardharch":"forward","forward harch":"forward","for harch":"forward","foward hut":"forward","fowahd hup":"forward",
  "for word march":"forward","foreword march":"forward","four march":"forward","forward much":"forward",
  "reah harch":"rear","rear harch":"rear","rare march":"rear","rear much":"rear","here march":"rear","rea hup":"rear",
  "platoon haaalt":"halt","platoon h'lt":"halt","platoon hold":"halt","platoon hall":"halt","platoon salt":"halt","platoon fault":"halt","toon halt":"halt","squad haaalt":"halt","plato halt":"halt",
  "tensh hut":"attn","platoon tenshun":"attn","platoon attention":"attn",
  "right plank march":"rflank","right flanked march":"rflank","write frank march":"rflank","ri flank harch":"rflank","left plank much":"lflank","lef flank hut":"lflank",
  "column half left march":"colHL","calm have left march":"colHL","half lef harch":"colHL","column calf right march":"colHR","have right march":"colHR","haf ri hut":"colHR",
  "counter column march":"counter","encounter column march":"counter","county column march":"counter","counta colm harch":"counter","counter calm much":"counter",
  "mark time march":"mark","mahk time harch":"mark","mark tie hut":"mark","half step march":"halfstep","have step march":"halfstep",
  "change step march":"change","chain step harch":"change","double time march":"double","dub time harch":"double","quick time march":"quick",
  "right face":"rface","ri fay":"rface","left face":"lface","lef fay":"lface","about face":"aface","bout fay":"aface","parade rest":"parade","prade res":"parade",
  "dress right dress":"dress","eyes right":"eyes","ready front":"front","reddy fron":"front","fall in":"fallin","stand at ease":"standease",
};
module.exports.negative = [
  "hey what's up","move over","left it there","march is cold","thank you so much","i'm going to the market","come here","call him",
  "write that down","right on","for real","four","what time is it","see you tomorrow","hold on a second","hold that thought","i left my phone",
  "turn right at the light","that's right","all right","okay","hello","the march for babies","march madness","i was born in march",
  "call him later","call me","calm down","palm tree","column a","left","right","forward this email","go forward","step on it","half time show",
  "counter top","fall asleep","mark my words","quick question","double check","open the door","close the window","stand up","eyes on me",
  "ready to go","about time","parade on sunday","dress code","rear view mirror","face time","rest up","ease up","front door","halt and catch fire",
  "who's there","huh","ha ha ha","uh huh","oh no","hmm","much better","harsh","match","marsh","mars","so much","how much","that much",
  "right here","come on","let's go","what's for dinner","i'm hungry","give me a minute","whatever","check this out","look at that",
  "the column is on the left","march on","forward it","my left foot","right foot","left foot right foot","it's cold out here","nice work",
];

// held-out batch (written after tuning; scored before being added here)
Object.assign(module.exports.positive, {"colin left march":"colL","collin lef harch":"colL","culm right hut":"colR","comm left hup":"colL","calm write mars":"colR","column lefft harch":"colL","colum riiight march":"colR","colmleft harch":"colL","columnleft march":"colL","platoon column left march":"colL","squad call him right march":"colR",
"forwaaard harch":"forward","fwd harch":"forward","foward march":"forward","forward marsh":"forward","for ward hut":"forward","forwardmarch":"forward",
"rear marsh":"rear","rare harch":"rear","reeah hut":"rear","right flaaank harch":"rflank","write flank hup":"rflank","left flang march":"lflank","lift flank much":"lflank",
"platoon haalt":"halt","squad hault":"halt","flight halt":"halt","platun halt":"halt","platoon holt":"halt","counter calum march":"counter","counter colm hut":"counter","counta column harch":"counter",
"column haf left harch":"colHL","colm half ri harch":"colHR","half write march":"colHR","mark tom march":"mark","marc time harch":"mark","change stip march":"change","quick tie march":"quick","double tom march":"double",
"halfstep march":"halfstep","right step harch":"rstep","backwards march":"back","open rinks march":"openranks","about fase":"aface","parade wrest":"parade","ready frunt":"front","eyes rite":"eyes","dress ride dress":"dress"});
module.exports.negative.push(...["comment left","come left","column left","right left","the left march","my column marks","it's a mars bar","much love","hut hut hike","hold it","stop","get out","march","right now","go left","turn left","left turn","forward slash","harsh words","rare steak","rear end","ear ache","counter strike","face it","rest in peace","ease off","front row","ready set go","come left at the corner","call him later tonight","palm springs","calm before the storm","that was a long march","i'll hold the door","left right left","for what it's worth","mark it down","half price","change the channel","double tap","quick fix","open season","close call","stand by","dress up","eyes closed","about to leave","fall back","well done","not bad","you know what","seriously","alright alright","hit it","here we go","what happened","there you go"]);
module.exports.positive["calm left mark"]="colL";   // "mark" was already a known mishearing of "march"
