// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import { paginatedRequest } from '../utils/pagination';
import { CrawlInput, S3PutEvent } from '../crawler/types';
import {csvJSON} from '../utils/contextTable';

const dynamo = new AWS.DynamoDB.DocumentClient();
const cfn = new AWS.CloudFormation();
const lambda = new AWS.Lambda();
const S3 = new AWS.S3();

export const initiateCrawl = async (event: S3PutEvent) => {
  var srcBucket = event.Records[0].s3.bucket.name;
  var srcKey = event.Records[0].s3.object.key;

  S3.getObject({
    Bucket: srcBucket,
    Key: srcKey,
  }, function (err, data) {
    if (err !== null) {
      console.log('Error', err)
      return err;
    }

    var fileData = data.Body!.toString('utf-8');
    var obj = csvJSON(fileData);

    var string = JSON.stringify(obj);
    console.log(string);

    for (var i = 0; i < obj.length; i++) {
      var params = {
        Item: {
          ...obj[i],
          "resolved": false
        },
        TableName: "yelling-yeti"
      };
      dynamo.put(params);
    }

    return data;
  });

  // List all cloudformation exports
  const cfnExports = await paginatedRequest<AWS.CloudFormation.Types.ListExportsInput>(
    cfn.listExports.bind(cfn), {}, 'Exports', 'NextToken',
  );

  // Find the arn of the lambda function to start a crawl
  const startCrawlFunctionArnExport = cfnExports.find((exp) => exp.Name === 'StartCrawlFunctionArn');

  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

  console.log('bucket: ', bucket, 'key: ', key, 'startCrawlFunctionArnExport: ', startCrawlFunctionArnExport.value)

  if (startCrawlFunctionArnExport) {
    const crawlInput: CrawlInput = {
      crawlName: 'yelling-yeti-crawl',
      tableName: 'yelling-yeti'
    };

    const response = await lambda.invoke({
      FunctionName: startCrawlFunctionArnExport.Value,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(crawlInput),
    }).promise();

    if (response.Payload) {
      console.log('response: ', response, 'state machine arn: ', response.Payload);
      const stateMachineExecutionArn = 'arn:aws:states:us-east-1:850417417408:stateMachine:webcrawler-state-machine';

      const region = stateMachineExecutionArn.split(':')[3];
      const stateMachineConsoleUrl = `https://${region}.console.aws.amazon.com/states/home?region=${region}#/executions/details/${stateMachineExecutionArn}`;
      console.log('---');
      console.log('Started web crawl execution. Track its progress in the console here:');
      console.log(stateMachineConsoleUrl);
    } else {
      console.error("Failed to start the crawl", response);
    }
  } else {
    console.error("Couldn't find export with name StartCrawlFunctionArn. Have you deployed yet?");
  }
};
