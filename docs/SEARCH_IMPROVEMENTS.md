# Search Improvements for GravyPrompts

## Current Implementation (Enhanced)

I've just improved the search with:

1. **Relevance Scoring Algorithm**
   - Title matches: 50-100 points (exact match gets highest)
   - Tag matches: 20-40 points
   - Content matches: 10-20 points (with position bonus)
   - Variable name matches: 15 points
   - Popularity boost: up to 7 points based on usage/views
   - Fuzzy matching: 30 points for typos in titles

2. **Multi-term Search**
   - Searches are split into multiple terms
   - Each term is scored independently
   - Results are ranked by total relevance score

3. **Better Tag Handling**
   - Now handles both string and array tag formats
   - Prevents crashes from inconsistent data

## Future Improvements

### 1. AWS OpenSearch Integration (Recommended for Production)
```javascript
// Example implementation
const { Client } = require('@opensearch-project/opensearch');
const client = new Client({
  node: process.env.OPENSEARCH_ENDPOINT,
});

// Index templates with rich metadata
await client.index({
  index: 'templates',
  body: {
    title: template.title,
    content: template.content,
    tags: template.tags,
    variables: template.variables,
    popularity: template.useCount,
    suggest: { // For autocomplete
      input: [template.title, ...template.tags],
      weight: template.useCount
    }
  }
});

// Search with advanced features
const results = await client.search({
  index: 'templates',
  body: {
    query: {
      multi_match: {
        query: searchQuery,
        fields: ['title^3', 'tags^2', 'content', 'variables'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    },
    highlight: {
      fields: {
        content: { fragment_size: 150 }
      }
    }
  }
});
```

### 2. Client-Side Search with Fuse.js
For instant search without API calls:

```javascript
import Fuse from 'fuse.js';

const fuse = new Fuse(templates, {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'tags', weight: 0.3 },
    { name: 'content', weight: 0.2 },
    { name: 'variables', weight: 0.1 }
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
  findAllMatches: true,
  ignoreLocation: true
});

const results = fuse.search(query);
```

### 3. AI-Powered Semantic Search
Using embeddings for understanding intent:

```javascript
// Generate embeddings for templates
const embedding = await openai.createEmbedding({
  model: "text-embedding-ada-002",
  input: `${template.title} ${template.content}`
});

// Store in vector database
await pinecone.upsert({
  vectors: [{
    id: template.templateId,
    values: embedding.data[0].embedding,
    metadata: { title, tags, content }
  }]
});

// Search by similarity
const queryEmbedding = await openai.createEmbedding({
  model: "text-embedding-ada-002",
  input: searchQuery
});

const results = await pinecone.query({
  vector: queryEmbedding.data[0].embedding,
  topK: 20,
  includeMetadata: true
});
```

### 4. Search Analytics & Learning
Track what users search for and click on:

```javascript
// Track search events
await analytics.track('search', {
  query: searchQuery,
  resultsCount: results.length,
  clickedPosition: clickedIndex,
  templateId: clickedTemplate.id
});

// Use data to improve ranking
const clickThroughRate = clicks[templateId] / impressions[templateId];
const adjustedScore = baseScore * (1 + clickThroughRate * 0.2);
```

### 5. Search UI Improvements

1. **Autocomplete/Suggestions**
   ```jsx
   <SearchInput
     onType={async (query) => {
       const suggestions = await api.getSuggestions(query);
       return suggestions;
     }}
   />
   ```

2. **Search Filters UI**
   ```jsx
   <SearchFilters>
     <CategoryFilter />
     <VariableCountFilter />
     <PopularityFilter />
     <DateRangeFilter />
   </SearchFilters>
   ```

3. **Search Results Preview**
   ```jsx
   <SearchResult>
     <Highlight text={result.content} query={searchQuery} />
     <RelevanceScore score={result.score} />
   </SearchResult>
   ```

## Implementation Priority

1. **Immediate** (Already Done)
   - ✅ Relevance scoring
   - ✅ Multi-term search
   - ✅ Fuzzy matching for typos
   - ✅ Tag format fixes

2. **Short Term**
   - Add search analytics tracking
   - Implement client-side Fuse.js for instant search
   - Add search suggestions/autocomplete
   - Cache popular searches

3. **Medium Term**
   - Set up AWS OpenSearch
   - Migrate search to OpenSearch
   - Add search filters UI
   - Implement saved searches

4. **Long Term**
   - Implement semantic search with embeddings
   - Add personalized search results
   - Build recommendation engine
   - A/B test different ranking algorithms

## Quick Wins for Better Search

1. **Search Synonyms**
   ```javascript
   const synonyms = {
     'email': ['mail', 'message', 'letter'],
     'product': ['item', 'goods', 'merchandise'],
     'meeting': ['conference', 'call', 'discussion']
   };
   ```

2. **Stop Words Removal**
   ```javascript
   const stopWords = ['the', 'a', 'an', 'and', 'or', 'but'];
   const cleanedTerms = searchTerms.filter(term => 
     !stopWords.includes(term.toLowerCase())
   );
   ```

3. **Stemming**
   ```javascript
   // Simple stemming
   function stem(word) {
     return word.replace(/ing$|ed$|s$/, '');
   }
   ```

4. **Search History**
   ```javascript
   localStorage.setItem('recentSearches', JSON.stringify([
     ...recentSearches.slice(0, 9),
     searchQuery
   ]));
   ```

The current implementation is now much better than before, but for a production system with thousands of templates, I'd strongly recommend implementing AWS OpenSearch for the best search experience.