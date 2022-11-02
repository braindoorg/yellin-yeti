// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';


/**
 * Base configuration required for crawling
 */
export interface CrawlConfig {
  baseUrl: string;
  pathKeywords?: string[];
}

/**
 * Input required to start a web crawl
 */
export interface CrawlInput {
  crawlName: string;
  tableName: string;
}

/**
 * Input required to start a web crawl and track its history
 */
export interface CrawlInputWithId extends CrawlInput {
  crawlId: string;
}

/**
 * Passed between steps in our state machine
 */
export interface CrawlContext extends CrawlInputWithId {
  contextTableName: string;
  stateMachineArn: string;
}

/**
 * Input required to crawl an individual page
 */
export interface CrawlPageInput extends CrawlConfig {
  path: string;
}

/**
 * Destination parameters for storing crawled content
 */
export interface CrawlDestination {
  s3: AWS.S3,
  s3BucketName: string;
  s3KeyPrefix: string;
}

/**
 * Represents the content of a web page
 */
export interface PageContent {
  title: string;
  htmlContent: string;
}


export interface S3PutEvent {
  "Records": [
    {
      "eventVersion": "2.0",
      "eventSource": "aws:s3",
      "awsRegion": "us-east-1",
      "eventTime": "1970-01-01T00:00:00.000Z",
      "eventName": "ObjectCreated:Put",
      "userIdentity": {
        "principalId": "EXAMPLE"
      },
      "requestParameters": {
        "sourceIPAddress": "127.0.0.1"
      },
      "responseElements": {
        "x-amz-request-id": "EXAMPLE123456789",
        "x-amz-id-2": "EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH"
      },
      "s3": {
        "s3SchemaVersion": "1.0",
        "configurationId": "testConfigRule",
        "bucket": {
          "name": "example-bucket",
          "ownerIdentity": {
            "principalId": "EXAMPLE"
          },
          "arn": "arn:aws:s3:::example-bucket"
        },
        "object": {
          "key": "test/key",
          "size": 1024,
          "eTag": "0123456789abcdef0123456789abcdef",
          "sequencer": "0A1B2C3D4E5F678901"
        }
      }
    }
  ]
}
