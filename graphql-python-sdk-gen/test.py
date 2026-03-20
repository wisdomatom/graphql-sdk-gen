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
