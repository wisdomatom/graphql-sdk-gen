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
