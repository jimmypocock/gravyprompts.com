# TODO

## Project Tasks

### Features

#### Template System

- [ ] Template versioning system - Track edit history for templates
- [ ] Template duplication/forking - Allow users to fork public templates
- [ ] Template import/export - Allow JSON/CSV export
- [ ] Template preview mode - Preview before creating
- [ ] Template collaboration - Real-time collaborative editing
- [ ] Template usage analytics - Track how often templates are used (partially done)
- [ ] Template recommendation engine - Suggest templates based on usage
- [ ] Template marketplace - Buy/sell premium templates
- [ ] Template scheduling - Schedule template availabilityTemplate scheduling - Schedule template availability

#### User Features

- [ ] User reputation system - Track quality contributions
- [ ] User favorites/bookmarks - Save favorite templates
- [ ] User follow system - Follow template creators
- [ ] User activity feed - See updates from followed users
- [ ] User profile customization - Themes, bio, links

#### Moderation & Trust

- [ ] Manual content review dashboard - Admin panel for reviewing flagged content
- [ ] Appeal process - Allow users to appeal moderation decisions
- [ ] Community reporting - Users can flag inappropriate content
- [ ] Trusted user fast-track - Skip moderation for established users
- [ ] Multi-language moderation - Support non-English content
- [ ] Custom moderation rules - Industry-specific filters

#### Platform Features

- [ ] Email notifications - Template shares, new followers, etc.
- [ ] API for third-party integrations - REST/GraphQL API
- [ ] Webhook support - Notify external services
- [ ] Mobile app - iOS/Android apps
- [ ] Browser extension - Quick template access
- [ ] Advanced search with filters - Search by tags, author, popularity
- [ ] Analytics dashboard - Usage statistics for users
- [ ] Set up a staging branch to work with a test environment for Amplify.

### Bugs

- [ ] **Fix Search Bug** - Popularity boost prevents empty results (found in search integration tests)

### Security Fixes (HIGH PRIORITY)

- [ ] **Fix Rate Limiting** - `checkRateLimit` function returns true without any implementation
- [ ] **Disable Anonymous View Tracking** - Every view creates DynamoDB records (cost risk!)
- [ ] **Add IP Rate Limiting** - Public endpoints have no protection against abuse
- [ ] **Reduce Response Sizes** - Don't return full content in list responses
- [ ] **Deploy WAF** - Run `npm run deploy:waf` if not already deployed

### Testing

- [ ] Performance tests - Load testing, optimization
- [ ] Security tests - Vulnerability scanning
- [ ] **Add Test Coverage Thresholds** - Enforce minimum coverage
- [ ] **Document Test Strategy** - Clear docs on which tests run where (CI vs local)
- [ ] **Add Pre-commit Hooks** - Run linting before commits
- [ ] **Add Retry Logic** - Handle flaky tests gracefully

**Test Coverage Achievement:**

- Lambda Functions: 18/18 tested (280 tests)
- Frontend Components: 18/18 tested (229 tests)
- Integration Tests: 32 tests
- **Total: 541+ tests** 🎉

### DevOps & Infrastructure

- [ ] CI/CD Pipeline - GitHub Actions for automated testing and deployment
  - [ ] Unit test runner on PR
  - [ ] Integration test runner on merge
  - [ ] Automated deployment to staging
  - [ ] Production deployment workflow
  - [ ] Code coverage reporting
  - [ ] Lint and format checks
- [ ] Infrastructure monitoring - CloudWatch dashboards and alerts
- [ ] Backup and disaster recovery - Automated DynamoDB backups
- [ ] Cost optimization - AWS cost monitoring and optimization
- [ ] Configure api.gravyprompts.com as custom domain for CloudFront distribution
  - [ ] Verify certificate includes api.gravyprompts.com or *.gravyprompts.com
  - [ ] Update cache-stack.ts to add custom domain alias
  - [ ] Add CNAME record in DNS pointing to CloudFront distribution
  - [ ] Update frontend to use api.gravyprompts.com URL

### Lambda Protection (Prevent Infinite Loops)

- [ ] Set reserved concurrency limits on experimental functions - Conservative limits to prevent runaway costs
- [ ] Implement dead letter queues (DLQ) - Catch and analyze failed invocations
- [ ] Set up AWS X-Ray tracing - Trace execution paths and identify loops ($5/million traces)
- [ ] Add circuit breaker patterns - Prevent cascading failures in Lambda code
- [ ] Configure maximum retry attempts - Limit automatic retries on failures
- [ ] Add timeout configurations - Ensure functions don't run indefinitely

### Enhanced Cost Management

- [ ] Configure AWS Budgets with Actions - Automatically stop services at thresholds (free for 2 budgets)
  - [ ] Set daily budget alerts at $5, $10, $25
  - [ ] Configure auto-stop actions for non-critical services
  - [ ] Create separate budgets for dev/staging/production
- [ ] Enable AWS Free Tier alerts - Proactive notifications before limits (free)
- [ ] Evaluate Vantage.sh integration - Advanced anomaly detection (free tier available)
- [ ] Set up CloudWatch billing alarms - Real-time metric monitoring (10 free/month)
  - [ ] Daily spend threshold alarm
  - [ ] Unusual activity detection
  - [ ] Service-specific cost alarms
- [ ] Implement cost allocation tags - Track spending by feature/service
- [ ] Create cost optimization dashboard - Visualize spending patterns

### Critical API Optimizations (HIGH PRIORITY)

#### 1. Optimize Search with OpenSearch

- [ ] Deploy Amazon OpenSearch cluster
- [ ] Set up DynamoDB Streams to OpenSearch pipeline
- [ ] Implement full-text search capabilities
- [ ] Add faceted search and filtering
- [ ] Migrate from table scan to OpenSearch queries
- **Impact**: Sub-100ms search responses, better scalability

#### 2. Implement Async View Tracking

- [ ] Set up SQS queue for view events
- [ ] Create Lambda function for batch processing views
- [ ] Remove synchronous view tracking from GET endpoint
- [ ] Implement dead letter queue for failed events
- [ ] Add CloudWatch metrics for queue monitoring
- **Impact**: 50-100ms reduction in template GET latency

### Documentation

- [ ] API documentation - Document all endpoints
- [ ] Template creation best practices - Guide for effective templates
- [ ] User guides and tutorials - How-to videos and guides
- [ ] Contributing guidelines - For open source contributors
- [ ] Test writing guide - Standards for test coverage

---

## Completed Tasks

### Infrastructure & Setup

- [x] Initial project setup
- [x] AWS CDK infrastructure
- [x] Google Analytics integration
- [x] Google AdSense integration
- [x] GravyJS editor integration
- [x] AWS Cognito authentication
- [x] Auth UI (login, signup, profile, forgot password)
- [x] Dark mode support
- [x] Content moderation planning
- [x] Rate limiting planning
- [x] DynamoDB template storage
- [x] API Gateway with Lambda functions
- [x] Tags/categories for templates
- [x] Local development environment setup
- [x] Docker containerization for local testing
- [x] Mock authentication for local development
- [x] API testing scripts
- [x] Port configuration (changed to 7429)
- [x] Frontend template pages (list, detail, editor)
- [x] GravyJS integration with template system
- [x] Local development documentation

### Template Features

- [x] Basic template CRUD operations - Create, Read, Update, Delete
- [x] Template sharing with secure links
- [x] Template population with variables
- [x] Variable extraction and management
- [x] Public/private visibility controls
- [x] Template sharing with emails and tokens
- [x] Template populate endpoint
- [x] AWS Comprehend content moderation

### Testing Achievements

- [x] Test coverage plan created - Comprehensive plan for full coverage
- [x] Navigation component tests - Admin access, authentication
- [x] Admin component tests - AdminGuard, ApprovalQueue, PermissionsManager
- [x] Permission Lambda tests - CRUD operations, /me endpoint
- [x] Create template Lambda test - Validation, moderation, auth
- [x] Update template Lambda tests - Authorization, validation
- [x] Delete template Lambda tests - Authorization, cascade deletion
- [x] Get template Lambda tests - Access control, view tracking
- [x] Populate template Lambda tests - Variable replacement
- [x] Share template Lambda tests - Email, token generation
- [x] User prompts Lambda tests - Save, list, delete operations
- [x] Moderation Lambda tests - Content filtering, spam detection
- [x] Templates list Lambda tests - Search, filtering, pagination
- [x] TemplateQuickview component test - Variables, save, share, copy
- [x] Frontend component tests - All remaining UI components ✅
  - [x] AuthGuard - 25 test cases
  - [x] ProtectedRoute - 16 test cases
  - [x] ApprovalHistory - 17 test cases
  - [x] GoogleAnalytics - 22 test cases
  - [x] GoogleCMP - 23 test cases
  - [x] GoogleConsentInit - 12 test cases
  - [x] AdSenseScript - 13 test cases
  - [x] AdUnit - 26 test cases
- [x] Integration tests - API integration flow ✅
  - [x] Templates API operations
  - [x] Search functionality
  - [x] User prompts API
  - [x] Error handling
  - [x] CORS and proxy behavior
- [x] E2E tests - Core user flows ✅
  - [x] Template management
  - [x] Search functionality
  - [x] Authentication flow

### CI/CD & Testing Infrastructure

- [x] **Fix Integration Tests** - Integration tests now run properly in CI ✅
  - [x] DynamoDB Local runs in CI via service containers
  - [x] Test tables are created before integration tests
  - [x] All integration tests (32) passing
  - [x] Proper environment variables configured
- [x] **Fix Lambda Test Configuration** - All tests properly configured ✅
  - [x] Unit tests properly mocked (280 tests passing)
  - [x] Integration tests use real AWS SDK with local DynamoDB
  - [x] Test file patterns properly configured
  - [x] Fixed cache invalidation tests (async mocks)
- [x] **CI Test Separation** - Tests properly separated by type ✅
  - [x] Unit tests run without external dependencies
  - [x] Integration tests run with DynamoDB Local in CI
  - [x] Proper Jest configs for unit vs integration
  - [x] CI workflow handles both test types appropriately

### Performance Optimizations

- [x] **Implement Caching Layer** - Hybrid caching system deployed ✅
  - [x] Redis caching for local development (persistent across restarts)
  - [x] In-memory caching for production Lambda (container reuse)
  - [x] Cache invalidation strategy implemented
  - [x] Cache key generators for templates, lists, and user data
  - [x] Automatic cache invalidation on create/update/delete
  - **Impact**: Significant reduction in DynamoDB reads, faster response times
- [x] **Implement CloudFront CDN** - API caching with CloudFront ✅
  - [x] Set up CloudFront distribution for API responses
  - [x] Add cache headers to all Lambda endpoints
  - [x] Configure cache behaviors based on content type
  - [x] Add cost protection with CloudWatch alarms
  - [x] Document cache invalidation strategy
  - **Impact**: Global edge caching, reduced latency, lower Lambda costs
