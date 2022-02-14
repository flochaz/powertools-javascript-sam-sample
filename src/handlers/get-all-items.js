// Add PowerTools instrumentations

const { Tracer } = require('@aws-lambda-powertools/tracer');
const { Logger } = require('@aws-lambda-powertools/logger');
const { Metrics, MetricUnits } = require('@aws-lambda-powertools/metrics');

const tracer = new Tracer();
const logger = new Logger();
const metrics = new Metrics();

// Create clients and set shared const values outside of the handler.

// Get the DynamoDB table name from environment variables
const tableName = process.env.SAMPLE_TABLE;

// Create a DocumentClient that represents the query to add an item
const dynamodb = require('aws-sdk/clients/dynamodb');
const docClient = tracer.captureAWSClient(new dynamodb.DocumentClient());
console.warn('docClient Properties:', JSON.stringify(docClient));

/**
 * A simple example includes a HTTP get method to get all items from a DynamoDB table.
 */
exports.getAllItemsHandler = async (event, context) => {

    const segment = tracer.getSegment(); // This is the facade segment (the one that is created by AWS Lambda)
    // Create subsegment for the function & set it as active
    const subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
    tracer.setSegment(subsegment);

    // Annotate the subsegment with the cold start & serviceName
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();


    // inject the context into the logs
    logger.addContext(context);

    if (event.httpMethod !== 'GET') {
        throw new Error(`getAllItems only accept GET method, you tried: ${event.httpMethod}`);
    }
    // All log statements are written to CloudWatch
    logger.info('received:', event);

    // get all items from the table (only first 1MB data, you can use `LastEvaluatedKey` to get the rest of data)
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property
    // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
    var params = {
        TableName : tableName
    };
    const data = await docClient.scan(params).promise();
    logger.info(JSON.stringify(data));
    const items = data.Items;


    // ### Use AWS PowerTools metrics to create metrics into CloudWatch Metrics ###
    metrics.addMetric('ItemsRetrievedCount', MetricUnits.Count, items.length);
    metrics.publishStoredMetrics();

    const response = {
        statusCode: 200,
        body: JSON.stringify(items)
    };

    // All log statements are written to CloudWatch
    logger.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
}
