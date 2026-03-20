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