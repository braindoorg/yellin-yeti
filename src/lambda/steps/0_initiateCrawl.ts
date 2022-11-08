// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import { paginatedRequest } from '../utils/pagination';
import { CrawlInput, S3PutEvent } from '../crawler/types';
import {csvJSON} from '../utils/contextTable';

const dynamo = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });
const cfn = new AWS.CloudFormation();
const lambda = new AWS.Lambda();
const S3 = new AWS.S3({
  maxRetries: 0,
  region: 'us-east-1',
});

export const initiateCrawl = async (event: S3PutEvent) => {
  var srcBucket = event.Records[0].s3.bucket.name;
  var srcKey = event.Records[0].s3.object.key;

  try {
    S3.getObject({
      Bucket: srcBucket,
      Key: srcKey,
    }, function (err, data) {
      if (err !== null) {
        return err;
      }

      var fileData = data.Body!.toString('utf-8');
      var obj = csvJSON(fileData);

      var string = JSON.stringify(obj);

      for (var i = 0; i < obj.length; i++) {
        var params = {
          Item: {
            ...obj[i],
            "resolved": false
          },
          TableName: "yelling-yeti"
        };
        dynamo.put(params).promise();
      }

      return data;
    });
  } catch(err) {
    console.log('CATCH: ', err);
    return err
  } finally {

    // List all cloudformation exports
    const cfnExports = await paginatedRequest<AWS.CloudFormation.Types.ListExportsInput>(cfn.listExports.bind(cfn), {}, 'Exports', 'NextToken',);

    // Find the arn of the lambda function to start a crawl
    const startCrawlFunctionArnExport = cfnExports.find((exp) => exp.Name === 'StartCrawlFunctionArn');

    console.log('startCrawlFunctionArnExport: ', startCrawlFunctionArnExport)

    if (startCrawlFunctionArnExport) {
      const crawlInput: CrawlInput = {
        crawlName: 'yelling-yeti-crawl',
        tableName: 'yelling-yeti'
      };

      await lambda.invoke({
        FunctionName: startCrawlFunctionArnExport.Value,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(crawlInput),
      }).promise();
    } else {
      console.error("Couldn't find export with name StartCrawlFunctionArn. Have you deployed yet?");
    }
  }
};
