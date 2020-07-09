'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var astring = _interopDefault(require('astring'));
var fnv1a = _interopDefault(require('@sindresorhus/fnv1a'));

/* eslint-disable sort-keys */

// since our usage is fairly narrow, we don't really need to install extra deps such ast-types or @babel/types.
// the set of builders I've prepared here should be sufficient for our needs

function program(body) {
  return {
    type: 'Program',
    body,
  };
}

function literal(value) {
  return {
    type: 'Literal',
    value,
  };
}

function identifier(name) {
  return {
    type: 'Identifier',
    name,
  };
}

function memberExpression(object, property, computed = false) {
  return {
    type: 'MemberExpression',
    object,
    property,
    computed,
  };
}

function assignmentExpression(operator, left, right) {
  return {
    type: 'AssignmentExpression',
    operator,
    left,
    right,
  };
}

function callExpression(callee, _arguments) {
  return {
    type: 'CallExpression',
    callee,
    arguments: _arguments,
  };
}

function returnStatement(argument) {
  return {
    type: 'ReturnStatement',
    argument,
  };
}

function objectExpression(properties) {
  return {
    type: 'ObjectExpression',
    properties,
  };
}

function arrayExpression(elements) {
  return {
    type: 'ArrayExpression',
    elements,
  };
}

function property(kind, key, value) {
  return {
    type: 'Property',
    key,
    value,
    kind,
  };
}

function functionExpression(id, params, body, generator, async) {
  return {
    type: 'FunctionExpression',
    id,
    params,
    body,
    generator,
    async,
  };
}

function exportNamedDeclaration(declaration, specifiers, source) {
  return {
    type: 'ExportNamedDeclaration',
    declaration,
    specifiers,
    source,
  };
}

function exportSpecifier(local, exported) {
  return {
    type: 'ExportSpecifier',
    local,
    exported,
  };
}

function variableDeclaration(kind, declarations) {
  return {
    type: 'VariableDeclaration',
    kind,
    declarations,
  };
}

function variableDeclarator(id, init) {
  return {
    type: 'VariableDeclarator',
    id,
    init,
  };
}

function blockStatement(body) {
  return {
    type: 'BlockStatement',
    body,
  };
}

function throwStatement(argument) {
  return {
    type: 'ThrowStatement',
    argument,
  };
}

function newExpression(callee, _arguments) {
  return {
    type: 'NewExpression',
    arguments: _arguments,
    callee,
  };
}

function importDeclaration(specifiers, source) {
  return {
    type: 'ImportDeclaration',
    specifiers,
    source,
  };
}

function importDefaultSpecifier(local) {
  return {
    type: 'ImportDefaultSpecifier',
    local,
  };
}

function safeIdentifier (name) {
  return identifier(`_${name}`);
}

const MODULE_ROOT_IDENTIFIER = identifier('$');

const CREATE_ARRAY_ID = 'createArray';
const CREATE_ARRAY = safeIdentifier(CREATE_ARRAY_ID);

function isPrimitive (value) {
  if (value === null) {
    return true;
  }

  const type = typeof value;

  return (
    type === 'string' ||
    type === 'number' ||
    type === 'bigint' ||
    type === 'boolean' ||
    type === 'symbol' ||
    type === 'undefined'
  );
}

function isGetter (obj, key) {
  const desc = Reflect.getOwnPropertyDescriptor(obj, key);
  return desc !== void 0 && 'get' in desc;
}

function traverse (obj, path = []) {
  path.length = 0;
  return traverse$1(obj, path, {});
}

function* traverse$1(obj, path, opts) {
  for (const key of Object.keys(obj)) {
    if (opts.skipGetters && isGetter(obj, key)) {
      continue;
    }

    // const l = path.push(key);
    const value = obj[key];

    if (isPrimitive(value) || typeof value === 'object') {
      // todo: symbols?
      yield key;
    }

    // path.length = l;
  }
}

const getExtensionForModule = module => `.${module === 'esm' ? 'm' : 'c'}js`;

class DefaultModule {
  constructor(source) {
    this.source = source;
    this.id = String(fnv1a.bigInt(source));

    this.retainers = new Set();
  }

  getPath(module) {
    return `./${this.id}${getExtensionForModule(module)}`;
  }

  static getFromRegistry(source, context) {
    const existingModule = context.moduleRegistry.get(source);
    if (existingModule !== void 0) {
      return existingModule;
    }

    const module = new DefaultModule(source);
    context.moduleRegistry.set(source, module);
    return module;
  }
}

class RuntimeModule {
  constructor(member, id) {
    this.source = `json-ref-escodegen/runtime/${member}`;
    this.id = id;
  }

  getPath(module) {
    return `${this.source}${getExtensionForModule(module)}`;
  }
}

const SLASH = /~1/g;
const TILDE = /~0/g;

function decodePointer (pointer) {
  return pointer.replace(SLASH, '/').replace(TILDE, '~');
}

function pointerToPath (pointer) {
  if (pointer.length < 2) {
    return null;
  }

  return pointer.slice(2).split('/').map(decodePointer);
}

const result = {
  pointer: '#',
  source: '',
};

function parsePointer ($ref) {
  if ($ref.length === 0) {
    throw new SyntaxError('Pointer cannot be empty');
  }

  const index = $ref.indexOf('#');
  if (index === -1) {
    result.source = $ref;
    result.pointer = '#';
  } else if (index === 0) {
    result.source = '';
    result.pointer = $ref;
  } else {
    result.source = $ref.slice(0, index);
    result.pointer = $ref.slice(index);
  }

  if (result.pointer.length > 1 && result.pointer[1] !== '/') {
    throw new SyntaxError(
      'Pointer pointing at other property than root needs to start with #/',
    );
  }

  return result;
}

function generateError (constructor, message) {
  return blockStatement([
    throwStatement(newExpression(identifier(constructor), [literal(message)])),
  ]);
}

function generatePropertyPath (root, path) {
  let expression = root;

  // todo: !(xyz in foo)? throw
  for (const segment of path) {
    expression = memberExpression(expression, literal(segment), true);
  }

  return expression;
}

function generateReference (obj, context) {
  if (typeof obj.$ref !== 'string') {
    return generateError('SyntaxError', 'JSON Pointer should be a string');
  } else {
    const { path } = context;
    try {
      const { pointer, source } = parsePointer(obj.$ref);

      let actualIdentifier = MODULE_ROOT_IDENTIFIER;

      if (source !== '') {
        const module = DefaultModule.getFromRegistry(
          path.isAbsolute(source)
            ? path.normalize(source)
            : path.join(
                path.dirname(context.dependencies.parentModule.source),
                source,
              ),
          context,
        );

        context.dependencies.addModule(module);

        if (module !== context.dependencies.parentModule) {
          context.dependencies.addModule(module);
          actualIdentifier = safeIdentifier(module.id);
        }

        // todo: include parentModule
        module.retainers.add(pointer);
      }

      const propertyPath = pointerToPath(pointer);

      return blockStatement([
        returnStatement(
          propertyPath === null
            ? actualIdentifier
            : generatePropertyPath(actualIdentifier, propertyPath),
        ),
      ]);
    } catch (ex) {
      return generateError(ex.constructor.name, ex.message);
    }
  }
}

function generateElements(arr, context) {
  const elements = [];
  const $refs = [];
  let i = -1;

  for (const item of arr) {
    i++;

    /// skip getters?
    if (isPrimitive(item)) {
      elements.push(literal(item));
      // todo: what about symbols?
    } else if (typeof value === 'function') ; else if (Array.isArray(item)) {
      elements.push(generateElements(item, context));
    } else {
      elements.push(generateProperties(item, context));
      if ('$ref' in item) {
        $refs.push(i);
      }
    }
  }

  if ($refs.length > 0) {
    context.dependencies.addRuntimeModule(
      new RuntimeModule('create-array', CREATE_ARRAY_ID),
    );

    return callExpression(CREATE_ARRAY, [
      arrayExpression(elements),
      arrayExpression(
        $refs.map(i =>
          arrayExpression([
            literal(i),
            functionExpression(null, [], generateReference(arr[i], context)),
          ]),
        ),
      ),
    ]);
  }

  return arrayExpression(elements);
}

function generateGetter (id, body) {
  return property('get', id, functionExpression(null, [], body));
}

function generateProperties(obj, context) {
  const properties = [];

  for (const key of traverse(obj)) {
    const value = obj[key];
    const id = literal(key);

    if (isPrimitive(value)) {
      properties.push(property('init', id, literal(value)));
    } else if (Array.isArray(value)) {
      properties.push(
        property('init', id, generateElements(value, context)),
      );
    } else if (!('$ref' in value)) {
      properties.push(
        property('init', id, generateProperties(value, context)),
      );
    } else {
      properties.push(generateGetter(id, generateReference(value, context)));
    }
  }

  return objectExpression(properties);
}

function generateExport (type, member) {
  switch (type) {
    case 'esm':
      return exportNamedDeclaration(
        null,
        [exportSpecifier(member, identifier('default'))],
        null,
      );
    case 'cjs':
      return assignmentExpression(
        '=',
        memberExpression(identifier('module'), identifier('exports')),
        member,
      );
    default:
      throw new Error('Unsupported type');
  }
}

function generateImport (type, specifier, source) {
  switch (type) {
    case 'esm':
      return importDeclaration([importDefaultSpecifier(specifier)], source);
    case 'cjs':
      return variableDeclaration('const', [
        variableDeclarator(
          specifier,
          callExpression(identifier('require'), [source]),
        ),
      ]);
    default:
      throw new Error('Unsupported type');
  }
}

class Dependencies {
  #childModules;
  #newModules;

  constructor(parent = null, parentModule = null) {
    this.root = parent === null ? this : parent.root;
    this.parentModule = parentModule;
    this.#childModules = new Set();
    this.#newModules = new WeakSet();
  }

  // todo: waiting for v8 8.4 to be included in Node.js
  get rootModules() {
    return this.root.getModules();
  }

  getModules() {
    return this.#childModules;
  }

  isNew(module) {
    return this.#newModules.has(module);
  }

  has(module) {
    return this.#childModules.has(module);
  }

  addModule(module) {
    if (this.#childModules.has(module)) return;

    if (!this.rootModules.has(module)) {
      this.#newModules.add(module);
    }

    this.#childModules.add(module);

    if (this.root !== this) {
      this.root.addModule(module);
    }
  }

  addRuntimeModule(module) {
    for (const childModule of this.#childModules) {
      if (childModule.id === module.id) {
        return;
      }
    }

    this.#childModules.add(module);
  }

  *[Symbol.iterator]() {
    yield* this.#childModules;
  }
}

async function processDocument(source, context) {
  const { fs } = context;

  const parentModule = DefaultModule.getFromRegistry(source, context);
  const dependencies = new Dependencies(context.dependencies, parentModule);
  dependencies.addModule(parentModule);
  context.dependencies = dependencies;

  const data = await fs.read(parentModule.source); // todo: on error export some deep proxy or what?

  if (
    context.shouldResolve !== void 0 &&
    !context.shouldResolve(parentModule.source)
  ) {
    await fs.write(
      parentModule.getPath(context.module),

      astring.generate(
        program([
          variableDeclaration('const', [
            variableDeclarator(
              MODULE_ROOT_IDENTIFIER,
              callExpression(
                callExpression(identifier('Function'), [
                  literal(`return (${data})`),
                ]),
                [],
              ),
            ),
          ]),

          generateExport(context.module, MODULE_ROOT_IDENTIFIER),
        ]),
      ),
    );

    return parentModule;
  }

  const imports = [];
  const promises = [];

  const generatedTree = Array.isArray(data)
    ? generateElements(data, context)
    : generateProperties(data, context);

  for (const childModule of dependencies) {
    if (childModule === parentModule) continue;

    imports.push(
      generateImport(
        context.module,
        safeIdentifier(childModule.id),
        literal(childModule.getPath(context.module)),
      ),
    );

    if (dependencies.isNew(childModule)) {
      promises.push(processDocument(childModule.source, { ...context }));
    }
  }

  promises.push(
    fs.write(
      parentModule.getPath(context.module),

      astring.generate(
        program([
          ...imports,

          variableDeclaration('const', [
            variableDeclarator(MODULE_ROOT_IDENTIFIER, generatedTree),
          ]),

          generateExport(context.module, MODULE_ROOT_IDENTIFIER),
        ]),
      ),
    ),
  );

  await Promise.allSettled(promises);

  return parentModule;
}

var Map$1 = Map;

async function index (schema, context) {
  return await processDocument(schema, context);
}

exports.Dependencies = Dependencies;
exports.ModuleRegistry = Map$1;
exports.default = index;
