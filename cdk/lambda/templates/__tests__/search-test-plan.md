# Search Implementation Test Plan

## Critical: Enhanced Search Algorithm Testing

The `/cdk/lambda/templates/list.js` file contains a sophisticated search implementation with:

- Relevance scoring (100+ lines of logic)
- Fuzzy matching with Levenshtein distance
- Multi-term search
- Content search with position weighting
- Popularity boosting
- Tag matching

**Current Status: 0% test coverage** 🚨

## Test Cases Needed

### 1. Fuzzy Matching Tests

```javascript
describe("Fuzzy Matching", () => {
  test("should match words with 1 character difference", () => {
    // "prompt" should match "promt" (missing p)
    // "template" should match "tempalte" (transposed letters)
  });

  test("should not match words with >2 character differences", () => {
    // "prompt" should NOT match "xyz"
  });

  test("should handle case insensitivity", () => {
    // "PROMPT" should match "prompt"
  });
});
```

### 2. Relevance Scoring Tests

```javascript
describe("Relevance Scoring", () => {
  test("exact title match should score 100 points", () => {
    // Search: "email template"
    // Title: "Email Template" = 100 points
  });

  test("title contains term should score 50-75 points", () => {
    // Search: "email"
    // Title: "Professional Email Template" = 50 + 25 (word boundary)
  });

  test("fuzzy title match should score 30 points", () => {
    // Search: "emial" (typo)
    // Title: "Email Template" = 30 points
  });

  test("tag matches should score 20-40 points", () => {
    // Exact tag match = 40
    // Tag contains term = 20
  });

  test("content matches should score based on position", () => {
    // First 100 chars = 20 points
    // 100-300 chars = 15 points
    // After 300 chars = 10 points
  });

  test("popularity boost should add up to 7 points", () => {
    // useCount: 50 = 5 points
    // viewCount: 100 = 2 points
  });
});
```

### 3. Multi-term Search Tests

```javascript
describe("Multi-term Search", () => {
  test("should match all terms independently", () => {
    // Search: "email marketing"
    // Should find templates with "email" OR "marketing"
  });

  test("should accumulate scores for multiple matches", () => {
    // Template with both "email" and "marketing" scores higher
  });

  test("should handle empty search terms", () => {
    // Search: "  email   marketing  " (extra spaces)
    // Should parse as ["email", "marketing"]
  });
});
```

### 4. Edge Cases

```javascript
describe("Search Edge Cases", () => {
  test("should handle no search results", () => {
    // Search for non-existent term
  });

  test("should handle special characters", () => {
    // Search: "C++" or "node.js"
  });

  test("should handle very long search queries", () => {
    // 100+ character search string
  });

  test("should handle templates with missing fields", () => {
    // Templates without content, tags, or variables
  });
});
```

### 5. Integration Tests

```javascript
describe("Search Integration", () => {
  test("should filter by visibility and moderation status", () => {
    // Only return approved public templates
  });

  test("should respect user permissions", () => {
    // User can see their own templates regardless of status
  });

  test("should paginate results correctly", () => {
    // nextToken handling with search
  });

  test("should combine with tag filtering", () => {
    // Search + tag filter
  });
});
```

## Implementation Priority

1. **Fuzzy Matching Unit Tests** (Day 1)

   - Test levenshteinDistance function
   - Test isFuzzyMatch function
   - Edge cases (empty strings, special chars)

2. **Scoring Algorithm Tests** (Day 1-2)

   - Mock templates with known content
   - Verify exact score calculations
   - Test score accumulation

3. **Integration Tests** (Day 2-3)

   - Full handler tests with mocked DynamoDB
   - Test all filter types (public, mine, popular)
   - Pagination with search

4. **Performance Tests** (Day 3)
   - Large result sets (100+ templates)
   - Complex search queries
   - Memory usage profiling

## Test Data Requirements

```javascript
const testTemplates = [
  {
    templateId: "exact-match-1",
    title: "Email Marketing Campaign",
    content: "Create engaging email marketing campaigns...",
    tags: ["email", "marketing", "campaign"],
    useCount: 100,
    viewCount: 500,
  },
  {
    templateId: "fuzzy-match-1",
    title: "Professional Email Template",
    content: "Professional business email template...",
    tags: ["email", "business"],
    useCount: 50,
    viewCount: 200,
  },
  {
    templateId: "partial-match-1",
    title: "Marketing Strategy Guide",
    content: "Comprehensive marketing strategy including email...",
    tags: ["marketing", "strategy"],
    useCount: 25,
    viewCount: 100,
  },
  // ... more test cases
];
```

## Success Criteria

- [ ] All scoring calculations verified with exact point values
- [ ] Fuzzy matching works for common typos
- [ ] Multi-term search returns expected results
- [ ] Performance: <100ms for 100 templates
- [ ] No false positives in search results
- [ ] Pagination works correctly with filters

## Risk Without These Tests

1. **Search Quality**: Users can't find templates (core feature broken)
2. **Performance**: Slow searches with large datasets
3. **Relevance**: Wrong templates ranked higher
4. **Typo Tolerance**: Minor typos return no results
5. **Data Loss**: Pagination issues could hide templates
