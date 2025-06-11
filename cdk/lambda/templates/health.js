exports.handler = async (event) => {
  console.log('Health check handler called');
  
  // Test basic response without any dependencies
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    },
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        TEMPLATES_TABLE: process.env.TEMPLATES_TABLE,
        hasUtils: false,
        nodeVersion: process.version,
        memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      }
    })
  };
};