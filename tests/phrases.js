// Realistic Chrome (desktop + Android) transcripts of drill commands -> expected command id.
// null = must be rejected. Run with tests/run-phrases.js (puppeteer) against index.html.
module.exports = {
  // Column right / left
  "column right march":"colR", "Column right. March.":"colR", "column, right, march":"colR", "Column right March":"colR",
  "colum right harch":"colR", "colin right march":"colR", "colonel right march":"colR", "call him right march":"colR",
  "call em right march":"colR", "columbus right march":"colR", "column write march":"colR", "column ride march":"colR",
  "column right much":"colR", "column right marsh":"colR", "column right mark":"colR", "platoon column right march":"colR",
  "right column march":"colR", "column right hut":"colR", "column rite ho":"colR", "collum right match":"colR",
  "column left march":"colL", "Column left. March!":"colL", "column, left, march":"colL", "colonel left march":"colL",
  "cold um left march":"colL", "call him left march":"colL", "columbus left march":"colL", "colin left march":"colL",
  "column lift march":"colL", "column laughed march":"colL", "column left much":"colL", "column left marsh":"colL",
  "column left mark":"colL", "squad column left march":"colL", "left column march":"colL", "column uh left march":"colL",
  "collin left march":"colL", "column left hut":"colL", "calm left march":"colL", "column lefts march":"colL",
  "kolam left march":"colL", "column left marching":"colL", "Column left march.":"colL", "column left martch":"colL",
  // Column half right / left
  "column half right march":"colHR", "column have right march":"colHR", "column half write march":"colHR", "half right march":"colHR",
  "colin half right march":"colHR", "call him half right march":"colHR", "column half right much":"colHR", "column half rite marsh":"colHR",
  "column half left march":"colHL", "column have left march":"colHL", "column half lift march":"colHL", "half left march":"colHL",
  "colonel half left march":"colHL", "call him half left march":"colHL", "column half left much":"colHL", "column haf left march":"colHL",
  // Counter column
  "counter column march":"counter", "counter colum march":"counter", "counter call him march":"counter", "counter colin march":"counter",
  "encounter column march":"counter", "count her column march":"counter", "counter column much":"counter", "counter column marsh":"counter",
  "counter columns march":"counter", "platoon counter column march":"counter", "counter colonel march":"counter", "counter march":"counter",
  "counter, column, march":"counter", "contra column march":"counter", "counter column hut":"counter", "Counter column. March.":"counter",
  // Rear march
  "rear march":"rear", "rare march":"rear", "real march":"rear", "rear much":"rear", "rear marsh":"rear", "Rear, march!":"rear",
  "rear match":"rear", "re march":"rear", "remark":"rear", "here march":"rear", "year march":"rear", "rhea march":"rear",
  "platoon rear march":"rear", "rear hut":"rear", "rare much":"rear", "real marsh":"rear", "Rear. March.":"rear", "wear march":"rear",
  // Flanks (either word order)
  "right flank march":"rflank", "right flake march":"rflank", "right frank march":"rflank", "write flank march":"rflank",
  "right flank much":"rflank", "flank right march":"rflank", "frank right march":"rflank", "right plank march":"rflank",
  "right flanks march":"rflank", "ride flank march":"rflank", "right thank march":"rflank", "Right flank. March.":"rflank",
  "left flank march":"lflank", "left flake march":"lflank", "left frank march":"lflank", "lift flank march":"lflank",
  "left flank much":"lflank", "flank left march":"lflank", "frank left march":"lflank", "left plank march":"lflank",
  "left flanks march":"lflank", "laughed flank march":"lflank", "left thank march":"lflank", "Left, flank, march":"lflank",
  // Mark time / half step / change step
  "mark time march":"mark", "march time march":"mark", "marked time march":"mark", "market time march":"mark", "mark tim march":"mark",
  "mark time much":"mark", "marc time march":"mark", "mark thyme march":"mark", "mark time marsh":"mark",
  "half step march":"halfstep", "have step march":"halfstep", "half stop march":"halfstep", "half steps march":"halfstep",
  "change step march":"change", "chain step march":"change", "changed step march":"change", "change stop march":"change",
  // Tempo
  "double time march":"double", "dubble time march":"double", "double tim march":"double", "bubble time march":"double",
  "quick time march":"quick", "quik time march":"quick", "quit time march":"quick", "quick times march":"quick",
  // Forward / steps / backward
  "forward march":"forward", "Forward. March!":"forward", "for word march":"forward", "four word march":"forward",
  "foreword march":"forward", "forwards march":"forward", "forward much":"forward", "forward marsh":"forward",
  "forward ho":"forward", "forward hut":"forward", "platoon forward march":"forward", "forward harch":"forward",
  "4 word march":"forward", "for ward march":"forward", "forword march":"forward", "forward mars":"forward",
  "right step march":"rstep", "write step march":"rstep", "right stop march":"rstep",
  "left step march":"lstep", "lift step march":"lstep", "left stop march":"lstep",
  "backward march":"back", "backwards march":"back", "back ward march":"back", "back words march":"back",
  // Ranks / interval
  "open ranks march":"openranks", "open rank march":"openranks", "open rings march":"openranks",
  "close ranks march":"closeranks", "clothes ranks march":"closeranks", "close rank march":"closeranks",
  "extend march":"extend", "extent march":"extend", "extended march":"extend", "x ten march":"extend",
  "close march":"close", "clothes march":"close", "closed march":"close",
  // Halt / attention / facings / rests
  "platoon halt":"halt", "squad hold":"halt", "flight halt":"halt", "plato halt":"halt", "platoon hault":"halt", "platoon holt":"halt",
  "squad halt":"halt", "halt":"halt", "Platoon, halt!":"halt",
  "platoon attention":"attn", "platoon ten hut":"attn", "squad attention":"attn", "platoon 10 hut":"attn", "atten hut":"attn", "attention":"attn",
  "right face":"rface", "write face":"rface", "right faith":"rface", "right phase":"rface",
  "left face":"lface", "lift face":"lface", "left faith":"lface", "left phase":"lface",
  "about face":"aface", "a bout face":"aface", "about faith":"aface", "about phase":"aface",
  "parade rest":"parade", "parade wrest":"parade", "per raid rest":"parade", "parade arrest":"parade",
  "stand at ease":"standease", "stand and ease":"standease", "stand at easy":"standease",
  "at ease":"atease", "add ease":"atease",
  "dress right dress":"dress", "dress right dres":"dress", "dress write dress":"dress",
  "eyes right":"eyes", "eye right":"eyes", "ice right":"eyes",
  "ready front":"front", "reddy front":"front", "ready frunt":"front",
  "platoon fall in":"fallin", "fall in":"fallin", "falling":"fallin", "fall inn":"fallin",
  // Must be rejected (chatter, partial commands, near misses)
  "they need to be in closer for formation":null, "column right":null, "column left":null, "hello march":null,
  "what time is it":null, "march":null, "left":null, "right":null, "i need to go to the store":null,
  "it's hot":null, "the march was long":null, "right now":null, "left it at home":null, "march madness":null,
  "can you hear me":null, "okay":null, "mark":null, "time":null, "counter":null, "they marched":null,
  "good job everybody":null, "rear":null, "flank":null, "half":null, "ready":null, "he left march early":null,
};
