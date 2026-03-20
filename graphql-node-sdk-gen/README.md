# GraphQL Node SDK Generator

A GraphQL SDK generator for Node.js (TypeScript) that generates a fluent API client.

## Features

- Fluent API for building queries
- TypeScript type safety
- Automatic type conversion for scalars
- Supports Query and Mutation operations

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate the SDK from an introspection JSON file:
   ```bash
   npm run generate
   ```

3. Use the generated SDK:
   ```typescript
   import { Client } from './output/client.js';
   import { QueryUsers } from './output/operations.js';
   import { UserSelector } from './output/selector.js';

   const client = new Client("YOUR_GRAPHQL_ENDPOINT");

   const res = await new QueryUsers()
       .where({ name_REGEX: "tom" })
       .select(new UserSelector().select("id", "name"))
       .do(client);
   ```

## Development

- Templates are located in `generator/templates/`.
- Core logic is in `generator/codegen.ts`.
- Custom scalar mapping can be configured in `generator/scalar.json`.
