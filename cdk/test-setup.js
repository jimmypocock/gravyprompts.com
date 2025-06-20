// Set up test environment variables
process.env.TEMPLATES_TABLE = "test-templates";
process.env.TEMPLATE_VIEWS_TABLE = "test-template-views";
process.env.USER_PROMPTS_TABLE = "test-user-prompts";
process.env.USER_PERMISSIONS_TABLE = "test-user-permissions";
process.env.APPROVAL_HISTORY_TABLE = "test-approval-history";
process.env.ENVIRONMENT = "test";
process.env.USER_POOL_ID = "test-user-pool";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_SAM_LOCAL = "true"; // Enable local development features
