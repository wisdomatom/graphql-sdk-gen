import * as fs from 'fs';
import * as path from 'path';
import ejs from 'ejs';
import { program } from 'commander';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(__dirname, '..', 'output');

interface GraphQLType {
    kind: string;
    name?: string;
    ofType?: GraphQLType;
    enumValues?: { name: string }[];
    inputFields?: any[];
    fields?: any[];
    interfaces?: { name: string }[];
}

function loadIntrospection(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

function buildTypeMaps(introspection: any) {
    const types = introspection.data.__schema.types as GraphQLType[];
    const typeMap = new Map<string, GraphQLType>();
    types.forEach(t => {
        if (t.name) typeMap.set(t.name, t);
    });
    const objectNames = types
        .filter(t => t.kind === 'OBJECT' && !t.name?.startsWith('__'))
        .map(t => t.name!);
    return { types, typeMap, objectNames };
}

function isSelectorType(tp: GraphQLType): boolean {
    if (tp.name === 'Mutation' && tp.kind === 'OBJECT') return false;
    if (tp.name === 'Query' && tp.kind === 'OBJECT') return false;
    if (tp.kind === 'INPUT_OBJECT') return false;
    if (tp.kind === 'ENUM') return false;
    if (tp.kind === 'SCALAR') return false;
    if (tp.name?.startsWith('__')) return false;
    return true;
}

function extractGraphqlType(t: GraphQLType): [string | null, boolean, boolean, boolean] {
    let kind = t.kind;
    if (kind === 'NON_NULL') {
        const [name, isList, , isScalar] = extractGraphqlType(t.ofType!);
        return [name, isList, true, isScalar];
    }
    if (kind === 'LIST') {
        const [name, , notNull, isScalar] = extractGraphqlType(t.ofType!);
        return [name, true, notNull, isScalar];
    }
    const isScalar = t.kind === 'SCALAR';
    return [t.name || null, false, false, isScalar];
}

const DEFAULT_SCALAR_MAP: Record<string, string> = {
    'String': 'string',
    'ID': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean'
};

function loadScalarMap(): Record<string, string> {
    const scalarPath = path.join(__dirname, 'scalar.json');
    if (fs.existsSync(scalarPath)) {
        const custom = JSON.parse(fs.readFileSync(scalarPath, 'utf-8'));
        return { ...DEFAULT_SCALAR_MAP, ...custom };
    }
    return { ...DEFAULT_SCALAR_MAP };
}

function gqlTypeToTypeScript(t: GraphQLType, scalarMap: Record<string, string>): string {
    function walk(node: GraphQLType | undefined): [string, boolean] {
        if (!node) return ['any', false];
        const k = node.kind;
        if (k === 'NON_NULL') {
            return walk(node.ofType);
        }
        if (k === 'LIST') {
            const [inner] = walk(node.ofType);
            return [`${inner}[]`, true];
        }
        const name = node.name || 'any';
        if (scalarMap[name]) return [scalarMap[name], false];
        return [name, false];
    }
    const [res] = walk(t);
    return res;
}

function toPascalCase(s: string): string {
    const words = s.split(/[_-]|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    return words
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
}

function prepareTemplateContext(types: GraphQLType[], typeMap: Map<string, GraphQLType>, objectNames: string[]) {
    const scalarMap = loadScalarMap();
    const models: any[] = [];
    const selectors: any[] = [];
    const enums: any[] = [];
    const inputs: any[] = [];
    const interfaces: any[] = [];
    const fieldClasses: any[] = [];

    const objectTypeNames = new Set(types.filter(t => ['OBJECT', 'INTERFACE', 'INPUT_OBJECT'].includes(t.kind)).map(t => t.name!));

    for (const t of types) {
        const name = t.name;
        if (!name || name.startsWith('__')) continue;

        if (['OBJECT', 'INTERFACE'].includes(t.kind)) {
            const fields = (t.fields || [])
                .filter((f: any) => {
                    const [, , , isScalar] = extractGraphqlType(f.type);
                    return isScalar;
                })
                .map((f: any) => ({ name: f.name }))
                .sort((a: any, b: any) => a.name.localeCompare(b.name));
            
            if (fields.length > 0) {
                fieldClasses.push({ name, fields });
            }
        }

        if (isSelectorType(t)) {
            const fields = (t.fields || []).map((f: any) => {
                const [gType, , , isScalar] = extractGraphqlType(f.type);
                const tsType = gqlTypeToTypeScript(f.type, scalarMap);
                const fieldArgs = (f.args || []).map((arg: any) => {
                    const [argGType] = extractGraphqlType(arg.type);
                    return {
                        name: arg.name,
                        type: gqlTypeToTypeScript(arg.type, scalarMap),
                        gql_type: argGType
                    };
                }).sort((a: any, b: any) => a.name.localeCompare(b.name));

                return {
                    name: f.name,
                    type: tsType,
                    gql_type: gType,
                    is_object: !isScalar,
                    args: fieldArgs
                };
            }).sort((a: any, b: any) => a.name.localeCompare(b.name));

            selectors.push({
                name,
                fields,
                interfaces: t.interfaces?.map(i => i.name) || []
            });
        }

        const kind = t.kind;
        if (kind === 'ENUM') {
            const values = (t.enumValues || []).map(ev => ev.name).sort();
            enums.push({ name, values });
        } else if (kind === 'INPUT_OBJECT') {
            const fields = (t.inputFields || []).map((f: any) => ({
                name: f.name,
                type: gqlTypeToTypeScript(f.type, scalarMap)
            })).sort((a: any, b: any) => a.name.localeCompare(b.name));
            inputs.push({ name, fields });
        } else if (kind === 'OBJECT') {
            if (name === 'Query' || name === 'Mutation') continue;
            const fields = (t.fields || []).map((f: any) => {
                const [gType] = extractGraphqlType(f.type);
                return {
                    name: f.name,
                    type: gqlTypeToTypeScript(f.type, scalarMap),
                    gql_type: gType,
                    is_object: gType ? objectTypeNames.has(gType) : false
                };
            }).sort((a: any, b: any) => a.name.localeCompare(b.name));
            models.push({ name, fields, interfaces: t.interfaces?.map(i => i.name) || [] });
        } else if (kind === 'INTERFACE') {
            const fields = (t.fields || []).map((f: any) => {
                const [gType] = extractGraphqlType(f.type);
                return {
                    name: f.name,
                    type: gqlTypeToTypeScript(f.type, scalarMap),
                    gql_type: gType,
                    is_object: gType ? objectTypeNames.has(gType) : false
                };
            }).sort((a: any, b: any) => a.name.localeCompare(b.name));
            interfaces.push({ name, fields });
        }
    }

    const ops: any[] = [];
    const queryRoot = typeMap.get('Query');
    const mutationRoot = typeMap.get('Mutation');

    [ { root: queryRoot, kind: 'query' }, { root: mutationRoot, kind: 'mutation' } ].forEach(({ root, kind }) => {
        if (!root) return;
        (root.fields || []).forEach((f: any) => {
            const args = (f.args || []).map((a: any) => {
                const [gqlType] = extractGraphqlType(a.type);
                return { name: a.name, type: gqlTypeToTypeScript(a.type, scalarMap), gql_type: gqlType };
            }).sort((a: any, b: any) => a.name.localeCompare(b.name));

            const [retName, isList, , isScalar] = extractGraphqlType(f.type);
            ops.push({
                name: f.name,
                name_pascal: toPascalCase(f.name),
                kind,
                args,
                return_name: retName,
                return_type: gqlTypeToTypeScript(f.type, scalarMap),
                return_is_list: isList,
                return_is_scalar: isScalar
            });
        });
    });

    models.sort((a, b) => a.name.localeCompare(b.name));
    selectors.sort((a, b) => a.name.localeCompare(b.name));
    inputs.sort((a, b) => a.name.localeCompare(b.name));
    enums.sort((a, b) => a.name.localeCompare(b.name));
    interfaces.sort((a, b) => a.name.localeCompare(b.name));
    ops.sort((a, b) => a.name.localeCompare(b.name));
    fieldClasses.sort((a, b) => a.name.localeCompare(b.name));

    return {
        models,
        selectors,
        inputs,
        enums,
        interfaces,
        ops,
        scalarMap,
        objectNames,
        fieldClasses
    };
}

async function renderAll(introspectionPath: string, outDir: string = OUT_DIR) {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const intros = loadIntrospection(introspectionPath);
    const { types, typeMap, objectNames } = buildTypeMaps(intros);
    const ctx = prepareTemplateContext(types, typeMap, objectNames);

    const templates = ['model.ejs', 'selector.ejs', 'client.ejs', 'operations.ejs', 'field.ejs'];
    for (const tpl of templates) {
        const tplPath = path.join(TEMPLATES_DIR, tpl);
        const template = fs.readFileSync(tplPath, 'utf-8');
        const out = ejs.render(template, ctx, { filename: tplPath });
        const outPath = path.join(outDir, tpl.replace('.ejs', '.ts'));
        fs.writeFileSync(outPath, out);
        console.log('Wrote', outPath);
    }
}

program
    .argument('<introspection>', 'Path to introspection JSON file')
    .option('--out <dir>', 'Output directory', OUT_DIR)
    .action((introspection, options) => {
        renderAll(introspection, options.out).catch(err => {
            console.error(err);
            process.exit(1);
        });
    });

program.parse();
