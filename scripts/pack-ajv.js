'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const pack = require('ajv-pack');

const ruleSchema = require('../src/meta/rule.schema.json');
const rulesetSchema = require('../src/meta/ruleset.schema.json');

const ajv = new Ajv({
  schemaId: 'auto',
  unknownFormats: 'ignore',
  allErrors: true,
  sourceCode: true,
});

const validate = ajv.addSchema(ruleSchema).compile(rulesetSchema);
const moduleCode = pack(ajv, validate);

const TARGET_DIR = path.join(__dirname, '../rulesets');

fs.writeFileSync(path.join(TARGET_DIR, 'validate.js'), moduleCode);
