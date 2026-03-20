# GraphQL SDK Generator

A multi-language GraphQL SDK generator that produces type-safe, fluent API clients for Go, Python, and Node.js.

## Overview

This project provides tools to generate strongly-typed SDKs from a GraphQL introspection JSON file. Each generator produces a set of models, selectors, and operation builders that allow you to interact with your GraphQL API using a natural, chainable DSL.

### Features

- **Type-Safe Query Building**: Use "Selectors" to specify fields with full IDE autocompletion and type checking.
- **Fluent API**: Chainable methods for building complex queries and mutations.
- **Strongly-Typed Models**: Automatic generation of language-native structures (Go structs, Python dataclasses, TypeScript interfaces).
- **Custom Scalar Mapping**: Map GraphQL scalars to specific native types.
- **Shared Schema**: Use a single `introspection.json` to generate SDKs across different languages.

---

## Monorepo Structure

- `graphql-go-sdk-gen/`: Go-based generator and templates.
- `graphql-python-sdk-gen/`: Python-based generator using Jinja2 templates.
- `graphql-node-sdk-gen/`: Node.js (TypeScript) generator using EJS templates.
- `introspection.json`: The source-of-truth GraphQL schema definition used for demos and tests.

---

## Quick Start

### 1. Node.js (TypeScript)

```bash
cd graphql-node-sdk-gen
npm install
npm run generate ../introspection.json
npm run test
```

**Show DSL to GraphQL Translation:**
```typescript
import * as field from './output/field.js';
import * as operation from './output/operations.js';
import * as selector from './output/selector.js';

const queryArticles = new operation.QueryArticles()
    .where({ 
        journal_IN: ['Science', 'Nature'], 
        publishedAt_GE: '2026-01-01', 
        AND: [{
            abstractVec_SIMILAR: { vector: [0.1, 0.2, 0.3], topK: 10 }
        }] 
    })
    .option({ limit: 10 }) // Pagination
    .select(
        new selector.ArticleSelector()
            .select(
                field.FieldArticle.id, 
                field.FieldArticle.title, 
                field.FieldArticle.journal,
                field.FieldArticle.citationCount,
                field.FieldArticle.publishedAt,
                field.FieldArticle.abstractVec_SCORE,
                field.FieldArticle.abstractVec_DISTANCE,
            )
            .authors({}, {}, 
                new selector.AuthorSelector().select(
                    field.FieldAuthor.id, 
                    field.FieldAuthor.name
                )
            )
            .references({}, {}, 
                new selector.ArticleSelector().select(
                    field.FieldArticle.id, 
                    field.FieldArticle.title
                )
            )
    );

// Core Logic: Build the GraphQL Query and Variables
const [query, variables] = queryArticles.build();

console.log("Generated GraphQL:\n", query);
console.log("Variables:\n", JSON.stringify(variables, null, 2));
```

### 2. Python

```bash
cd graphql-python-sdk-gen
pip install -r requirements.txt
python generator/codegen.py ../introspection.json
python test.py
```

**Show DSL to GraphQL Translation:**
```python
from output.operations import QueryArticles
from output.selector import ArticleSelector, AuthorSelector
from output.field import FieldArticle, FieldAuthor
from output.model import ArticleWhere, VectorSearchInput

query = QueryArticles().where(
    ArticleWhere(
        journal_IN=['Science', 'Nature'],
        publishedAt_GE='2026-01-01',
        AND=[ArticleWhere(abstractVec_SIMILAR=VectorSearchInput(vector=[0.1, 0.2, 0.3], topK=10))]
    )
).option(limit=10).select(
    ArticleSelector()
    .select(
        FieldArticle.id, 
        FieldArticle.title,
        FieldArticle.journal,
        FieldArticle.abstractVec_SCORE,
        FieldArticle.abstractVec_DISTANCE
    )
    .authors({}, {}, 
        AuthorSelector().select(FieldAuthor.id, FieldAuthor.name)
    )
    .references({}, {}, 
        ArticleSelector().select(FieldArticle.id, FieldArticle.title)
    )
)

# Core Logic: Build the GraphQL Query and Variables
gql_string, variables = query.build()

print("Generated GraphQL:\n", gql_string)
print("Variables:\n", variables)
```

### 3. Go

```bash
cd graphql-go-sdk-gen
go run main.go --schema ../introspection.json --out ./sdk --pkg sdk
```

**Show DSL to GraphQL Translation:**
```go
import "your-project/sdk"

query := sdk.NewQueryArticles()

query.Where(sdk.ArticleWhere{
    Journal_IN: []string{"Science", "Nature"},
    PublishedAt_GE: "2026-01-01",
    AND: []sdk.ArticleWhere{
        {
            AbstractVec_SIMILAR: &sdk.VectorSearchInput{
                Vector: []float64{0.1, 0.2, 0.3},
                TopK:   10,
            },
        },
    },
}).Option(sdk.ArticleOption{
    Limit: 10,
})

query.Select(func(s *sdk.SelectorArticle) {
    s.Select(
        sdk.ArticleFieldId, 
        sdk.ArticleFieldTitle,
        sdk.ArticleFieldJournal,
        sdk.ArticleFieldAbstractVec_SCORE,
        sdk.ArticleFieldAbstractVec_DISTANCE,
    )
    // Nested Graph Query: Authors
    s.SelectAuthors(func(a *sdk.SelectorAuthor) {
        a.Select(sdk.AuthorFieldId, sdk.AuthorFieldName)
    })
    // Recursive Graph Query: References
    s.SelectReferences(func(r *sdk.SelectorArticle) {
        r.Select(sdk.ArticleFieldId, sdk.ArticleFieldTitle)
    })
})

// Core Logic: Build the GraphQL Query and Variables
gqlString, variables := query.Build()

fmt.Println("Generated GraphQL:\n", gqlString)
fmt.Printf("Variables:\n %+v\n", variables)
```

---

## Development

Each subdirectory contains its own generator logic and templates. To add a new language or modify existing behavior, look into the `generator/` directory of the respective project.

- **Templates**: 
  - Go: Embedded in `.go` source.
  - Python: `.j2` (Jinja2) files in `generator/templates/`.
  - Node: `.ejs` files in `generator/templates/`.

## License

MIT
