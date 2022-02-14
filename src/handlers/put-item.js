// Add PowerTools instrumentations

const { Tracer } = require('@aws-lambda-powertools/tracer');
const { Logger } = require('@aws-lambda-powertools/logger');
const { Metrics, MetricUnits } = require('@aws-lambda-powertools/metrics');

const tracer = new Tracer();
const logger = new Logger();
const metrics = new Metrics();

// Create clients and set shared const values outside of the handler.

// Create a DocumentClient that represents the query to add an item
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand} = require("@aws-sdk/lib-dynamodb");
const ddbClient = tracer.captureAWSv3Client(new DynamoDBClient());
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Get the DynamoDB table name from environment variables
const tableName = process.env.SAMPLE_TABLE;

/**
 * A simple example includes a HTTP post method to add one item to a DynamoDB table.
 */
exports.putItemHandler = async (event, context) => {
    const segment = tracer.getSegment(); // This is the facade segment (the one that is created by AWS Lambda)
    // Create subsegment for the function & set it as active
    const subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
    tracer.setSegment(subsegment);
  
    // Annotate the subsegment with the cold start & serviceName
    tracer.annotateColdStart();
    tracer.addServiceNameAnnotation();
  
  
    // inject the context into the logs
    logger.addContext(context);

    if (event.httpMethod !== 'POST') {
        throw new Error(`postMethod only accepts POST method, you tried: ${event.httpMethod} method.`);
    }
    // All log statements are written to CloudWatch
    logger.info('received:', event);

    // Get id and name from the body of the request
    const body = JSON.parse(event.body)
    const id = body.id;
    const name = body.name;

    // Creates a new item, or replaces an old item with a new item
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property
    var params = {
        TableName : tableName,
        Item: { id : id, name: name }
    };
    
    await docClient.send(new PutCommand(params));

    // ### Use AWS PowerTools metrics to create metrics into CloudWatch Metrics ###
    metrics.addMetric('PutItemCount', MetricUnits.Count, 1);
    metrics.publishStoredMetrics();
    subsegment.close();
    const response = {
        statusCode: 200,
        body: JSON.stringify(body)
    };

    // All log statements are written to CloudWatch
    logger.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
}
