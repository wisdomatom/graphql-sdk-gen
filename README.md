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

## What is introspection.json?

The `introspection.json` is the result of a **GraphQL Introspection Query**. It contains the complete metadata of your GraphQL schema, including all types, fields, arguments, and directives. Our generators use this metadata to create the type-safe SDK.

### How to get your own introspection file?

You can obtain the introspection JSON from your GraphQL server using various tools:

1. **Using [get-graphql-schema](https://www.npmjs.com/package/get-graphql-schema)** (Recommended):
   ```bash
   npx get-graphql-schema http://localhost:8080/graphql --json > introspection.json
   ```

2. **Using a CURL request**:
   You can send a standard introspection query to your endpoint and save the response as a JSON file.

---

## Quick Start

### 1. Node.js (TypeScript)

```bash
cd graphql-node-sdk-gen
npm install
npm run generate -- --schema ../introspection.json --out sdk
npm run test
```


**Show DSL to GraphQL Translation:**
```typescript
import { Client } from './sdk/client.js';
import * as field from './sdk/field.js';
import * as operation from './sdk/operations.js';
import * as selector from './sdk/selector.js';
import * as model from './sdk/model.js';
import 'dotenv/config';

async function main() {
    const client = new Client("http://127.0.0.1:8001/api/v1/graphql");
    client.setHeaders({ authorization: process.env.token || '' });

    try {
        const queryArticles = new operation.QueryArticles()
            .where({ 
                journal_IN: ['Science', 'Nature'], 
                publishedAt_GE: '2025-01-01T00:00:00Z', 
                AND: [
                    {
                        abstractVec_SIMILAR: {
                            vector: [0.1, 0.2, 0.3],
                            topK: 10,
                        }
                    }
                ] })
            .option({ limit: 10 })
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
                    ).authors({}, {}, 
                        new selector.AuthorSelector().select(
                            field.FieldAuthor.id, 
                            field.FieldAuthor.name,
                        )
                    ).references({}, {}, 
                        new selector.ArticleSelector().select(
                            field.FieldArticle.id, 
                            field.FieldArticle.title,
                        )
                    )
            );

        const [query, vars] = queryArticles.build();
        console.log("Generated Query:", query);
        console.log("Variables:", JSON.stringify(vars, null, 2));

        // const res = await queryArticles.do(client);
        // res?.forEach(u => {
        //     console.log(u.id);
        //     console.log(u.title);
        //     console.log(u.publishedAt);
        //     console.log(u.abstractVec_SCORE);
        // });
        // console.log("Results:", res);

    } catch (e) {
        console.error(e);
    }
}

main();
```

### 2. Python

```bash
cd graphql-python-sdk-gen
pip install -r requirements.txt
python generator/codegen.py ../introspection.json --out sdk
python test.py
```

**Show DSL to GraphQL Translation:**
```python
from sdk.operations import QueryArticles
from sdk.selector import ArticleSelector, AuthorSelector
from sdk.field import FieldArticle, FieldAuthor
from sdk.model import ArticleWhere, ArticleAbstractVecSimilarInput, ArticleOption, ArticleSort, SortDirection
import json
from sdk.client import Client, class_to_dict
import os

client = Client("http://127.0.0.1:8001/api/v1/graphql")
client.headers = { "Authorization": "Bearer " + os.environ.get("token") }

query = QueryArticles().where(
    ArticleWhere(
        journal_IN=['Science', 'Nature'],
        publishedAt_GE='2025-01-01T00:00:00Z',
        AND=[ArticleWhere(abstractVec_SIMILAR=ArticleAbstractVecSimilarInput(vector=[0.1, 0.2, 0.3], topK=10))]
    )
).option(ArticleOption(limit=10, sort=ArticleSort(publishedAt=SortDirection.DESC))).select(
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
print("Variables:\n", json.dumps(class_to_dict(variables), indent=2))
```

### 3. Go

```bash
cd graphql-go-sdk-gen
go run main.go --schema ../introspection.json --out ./sdk --pkg sdk
```

**Show DSL to GraphQL Translation:**
```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/wisdomatom/graphql-sdk-gen/graphql-go-sdk-gen/sdk"
)

type authTransport struct {
	wrappedTransport http.RoundTripper
	token            string
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	transport := t.wrappedTransport
	if transport == nil {
		transport = http.DefaultTransport
	}
	newReq := req.Clone(req.Context())
	newReq.Header.Set("Authorization", "Bearer "+t.token)
	return transport.RoundTrip(newReq)
}

var (
	client = sdk.NewClient("http://127.0.0.1:8001/api/v1/graphql", &http.Client{
		Transport: &authTransport{
			token: os.Getenv("token"),
		}})
)

func TestSDK(t *testing.T) {
	query := sdk.NewQueryQueryArticles()
	query.Where(sdk.ArticleWhere{
		JournalIN: []string{"Science", "Nature"},
		PublishedAtGE: sdk.Ptr(time.Now()),
		AND: []sdk.ArticleWhere{
			{
				AbstractVecSIMILAR: &sdk.ArticleAbstractVecSimilarInput{
					Vector: []float64{0.1, 0.2, 0.3},
					TopK:   sdk.Ptr(10),
				},
			},
		},
	}).Option(sdk.ArticleOption{
		Limit: sdk.Ptr(int64(10)),
	})

	query.Select(func(s *sdk.SelectorArticle) {
		s.Select(
			sdk.ArticleFieldId, 
			sdk.ArticleFieldTitle,
			sdk.ArticleFieldJournal,
			sdk.ArticleFieldAbstractVecSCORE,
			sdk.ArticleFieldAbstractVecDISTANCE,
		)
		// Nested Graph Query: Authors
		s.SelectAuthors(sdk.AuthorWhere{}, sdk.AuthorOption{}, func(a *sdk.SelectorAuthor) {
			a.Select(sdk.AuthorFieldId, sdk.AuthorFieldName)
		})
		// Recursive Graph Query: References
		s.SelectReferences(sdk.ArticleWhere{}, sdk.ArticleOption{}, func(r *sdk.SelectorArticle) {
			r.Select(sdk.ArticleFieldId, sdk.ArticleFieldTitle)
		})
	})

	// Core Logic: Build the GraphQL Query and Variables
	gqlString, variables := query.Build()

	fmt.Println("Generated GraphQL:\n", gqlString)
	bts, _ := json.MarshalIndent(variables, "", "  ")
	fmt.Printf("Variables:\n %+v\n", string(bts))
	// res, err := query.Do(context.Background(), client)
	// if err != nil {
	// 	t.Fatalf("Do failed: %v", err)
	// }
	// fmt.Printf("Results:\n %+v\n", res)
}
```

---

## Development

Each subdirectory contains its own generator logic and templates. To add a new language or modify existing behavior, look into the `generator/` directory of the respective project.

- **Templates**: 
  - Go: Embedded in `.go` source.
  - Python: `.j2` (Jinja2) files in `generator/templates/`.
  - Node: `.ejs` files in `generator/templates/`.

## License

Apache License 2.0
