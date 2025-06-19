#!/usr/bin/env node

/**
 * Analyze AWS cost report and generate summary
 */

const fs = require('fs');

const costReportFile = process.argv[2];

if (!costReportFile) {
  console.error('Usage: npm run analyze:costs -- cost-report.json');
  process.exit(1);
}

try {
  const costData = JSON.parse(fs.readFileSync(costReportFile, 'utf8'));
  
  // Calculate weekly total
  let weeklyTotal = 0;
  const serviceBreakdown = {};
  
  if (costData.ResultsByTime) {
    costData.ResultsByTime.forEach(day => {
      if (day.Groups) {
        day.Groups.forEach(group => {
          const service = group.Keys[0];
          const amount = parseFloat(group.Metrics.UnblendedCost.Amount);
          
          weeklyTotal += amount;
          serviceBreakdown[service] = (serviceBreakdown[service] || 0) + amount;
        });
      }
    });
  }
  
  // Sort services by cost
  const sortedServices = Object.entries(serviceBreakdown)
    .sort(([,a], [,b]) => b - a)
    .map(([service, cost]) => `- ${service}: $${cost.toFixed(2)}`)
    .join('\n');
  
  // Generate recommendations
  const recommendations = [];
  if (serviceBreakdown['AmazonDynamoDB'] > 20) {
    recommendations.push('- Consider reviewing DynamoDB capacity settings');
  }
  if (serviceBreakdown['AWSLambda'] > 10) {
    recommendations.push('- Check Lambda function memory allocation and duration');
  }
  if (weeklyTotal > 100) {
    recommendations.push('- Review all services for optimization opportunities');
  }
  
  const report = {
    weeklyTotal: weeklyTotal.toFixed(2),
    breakdown: sortedServices || 'No service breakdown available',
    recommendations: recommendations.join('\n') || 'No specific recommendations at this time'
  };
  
  // Write report for GitHub Actions to read
  fs.writeFileSync('cost-analysis.json', JSON.stringify(report, null, 2));
  
  console.log('Cost Analysis Complete:');
  console.log(`Weekly Total: $${report.weeklyTotal}`);
  console.log('\nTop Services:');
  console.log(report.breakdown);
  
} catch (error) {
  console.error('Error analyzing costs:', error.message);
  
  // Write a default report so the workflow doesn't fail
  const defaultReport = {
    weeklyTotal: "0",
    breakdown: "Error analyzing cost data",
    recommendations: "Unable to generate recommendations"
  };
  fs.writeFileSync('cost-analysis.json', JSON.stringify(defaultReport, null, 2));
  
  process.exit(1);
}