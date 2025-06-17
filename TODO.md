# TODO

## Project Tasks

### Features

#### Template System

- [x] Basic template CRUD operations - Create, Read, Update, Delete
- [x] Template sharing with secure links
- [x] Template population with variables
- [x] Variable extraction and management
- [x] Public/private visibility controls
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

<!-- Add bug fixes here -->

### Testing

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
- [ ] Performance tests - Load testing, optimization
- [ ] Security tests - Vulnerability scanning

**Test Coverage Achievement:**

- Lambda Functions: 11/11 tested (133 tests)
- Frontend Components: 13/13 tested (154 tests)
- Integration Tests: 14 tests
- E2E Tests: 3 test suites
- **Total: 301+ tests** 🎉

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

### Critical API Optimizations (HIGH PRIORITY)

#### 1. Implement Caching Layer

- [ ] Deploy ElastiCache Redis cluster
- [ ] Add caching layer to Lambda functions
- [ ] Implement cache invalidation strategy
- [ ] Set up CloudFront distribution for API responses
- [ ] Add cache headers to API responses
- **Impact**: 70% reduction in DynamoDB reads, 40-60% faster response times

#### 2. Optimize Search with OpenSearch

- [ ] Deploy Amazon OpenSearch cluster
- [ ] Set up DynamoDB Streams to OpenSearch pipeline
- [ ] Implement full-text search capabilities
- [ ] Add faceted search and filtering
- [ ] Migrate from table scan to OpenSearch queries
- **Impact**: Sub-100ms search responses, better scalability

#### 3. Implement Async View Tracking

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
- [x] Template CRUD operations
- [x] Template sharing with emails and tokens
- [x] Template populate endpoint
- [x] AWS Comprehend content moderation
- [x] Tags/categories for templates
- [x] Local development environment setup
- [x] Docker containerization for local testing
- [x] Mock authentication for local development
- [x] API testing scripts
- [x] Port configuration (changed to 7429)
- [x] Frontend template pages (list, detail, editor)
- [x] GravyJS integration with template system
- [x] Local development documentation
