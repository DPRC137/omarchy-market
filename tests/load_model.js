const fs = require('node:fs');
const path = require('node:path');
module.exports = function load(name) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'models', name + '.js'), 'utf8').replace('.pragma library', '');
  const names = [...code.matchAll(/^(?:function|var) ([A-Za-z_][\w]*)/gm)].map(m => m[1]);
  return new Function(code + '\nreturn {' + names.join(',') + '};')();
};
