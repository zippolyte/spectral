const { Spectral } = require('./dist/spectral');

const spectral = new Spectral();

spectral.registerFormat('oas3', () => true);
console.time('load')

spectral.loadRuleset('spectral:oas')
  .then(() => {
    console.timeEnd('load')

  })

