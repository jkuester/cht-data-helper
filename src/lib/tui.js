const readline = require('readline/promises');
let rl;

const init = () => {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
};

module.exports = {
  close: () => rl.close(),
  init,
  log: console.log,
  question: questionStr => rl.question(questionStr)
};
