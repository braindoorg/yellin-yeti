// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import * as _ from 'lodash';
import { CrawlInputWithId } from '../crawler/types';
import { CONTEXT_TABLE_READ_CAPACITY, CONTEXT_TABLE_WRITE_CAPACITY, PARALLEL_URLS_TO_SYNC } from '../config/constants';
import { dynamodbPaginatedRequest } from './pagination';

const ddb = new AWS.DynamoDB();
const ddbDoc = new AWS.DynamoDB.DocumentClient();
const AttributeDefinitions = [
  { AttributeName: "InitialUrl", AttributeType: "S" },
  { AttributeName: "Resolved", AttributeType: "S" }
];

enum VisitStatus {
  VISITED = 'true',
  NOT_VISITED = 'false',
}

/**
 * Creates the context table for the crawl. The context table holds our url "queue", in which all of the urls we've
 * observed are stored, with whether or not they have been visited. Returns once the table has finished creating.
 * @return the name of the context table
 */
export const createContextTable = async (): Promise<string> => {
  const TableName = "yelling-yeti-test"; // TODO - Update to proper table name
  await ddb.createTable({
    TableName,
    AttributeDefinitions,
    GlobalSecondaryIndexes: [{
      IndexName: "resolved-index",
      KeySchema: [{ AttributeName: 'Resolved', KeyType: 'HASH' }],
      Projection: { ProjectionType: "ALL" },
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      }
    }],
    KeySchema: [{ AttributeName: "InitialUrl", KeyType: "HASH" }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10,
    }
  }).promise();
  await ddb.waitFor("tableExists", { TableName }, (err) => {
    if (err) throw new Error("TableCreationFailed");
  }).promise();
  return TableName;
};

/**
 * Deletes the context table
 */
export const deleteContextTable = async (contextTableName: string) => {
  await ddb.deleteTable({
    TableName: contextTableName,
  }).promise();
};

/**
 * Add a path to the url queue. Skips paths that have already been visited
 */
export const queuePath = async (contextTableName: string, path: string) => {
  try {
    // Check if the url has already been visited
    const item = (await ddbDoc.get({
      TableName: contextTableName,
      Key: {
        visited: VisitStatus.VISITED,
        path,
      },
    }).promise()).Item;

    // If the url hasn't already been visited, add it to the queue
    if (!item) {
      await ddbDoc.put({
        TableName: contextTableName,
        Item: {
          path,
          visited: VisitStatus.NOT_VISITED,
        },
      }).promise();
    }
  } catch (e) {
    console.warn('Unable to queue', path, e);
  }
};

/**
 * Add a list of paths to the url queue. Skips paths that have already been visited.
 */
export const queuePaths = async (contextTableName: string, paths: string[]) => {
  // Split our newly discovered urls into groups to reduce the likelihood of throttling errors
  for (const pathGroup of _.chunk(paths, 20)) {
    // Write the new urls to our dynamodb context table.
    await Promise.all(pathGroup.map(async (newPath) => queuePath(contextTableName, newPath)));
  }
};

/**
 * Read a batch of urls to visit from the context table
 */
export const readBatchOfUrlsToVisit = async (contextTableName: string): Promise<string[]> => {
  // Get all paths that have not been visited, up to our limit of PARALLEL_URLS_TO_SYNC
  const unresolvedUrls = await dynamodbPaginatedRequest(ddbDoc.query.bind(ddbDoc), {
    TableName: contextTableName,
    IndexName: 'resolved-index',
    KeyConditionExpression: '#resolved = :resolved',
    ExpressionAttributeValues: {
      ':resolved': VisitStatus.NOT_VISITED,
    },
    ExpressionAttributeNames: {
      '#resolved': 'resolved',
    },
    Limit: 5,
  }, async () => { }, PARALLEL_URLS_TO_SYNC);


  console.log('toVisitEntries: ', unresolvedUrls);

  unresolvedUrls.map((entry) => {
    console.log('Entry Path', entry.Initial_url);
  });

  return unresolvedUrls.map((entry) => entry.Initial_url);
};

/**
 * Marks a path as visited in the context table by adding a visited=TRUE entry and deleting the visited=FALSE entry
 */
export const markPathAsVisited = async (contextTableName: string, Initial_url: string, status: number) => {
  // Write an entry saying the url has been visited
  await ddbDoc.put({
    TableName: contextTableName,
    Item: {
      resolved: VisitStatus.VISITED,
      Initial_url,
      Status: status
    },
  }).promise();
};

export const updatePathWithRedirect = async (contextTableName: string, Initial_url: string, status: number, redirectPath: string, count: number) => {
  // Write an entry saying the url has been visited
  var statusCount = count > 0 ? 'ResponseStatus_' + count : 'InitialStatus'
  var redirectPathCount = 'RedirectPath_' + count
  var expressionValues = count > 0 && redirectPath ? {
    ':newStatus': status,
    ':newRedirectPath': redirectPath,
    ':resolved': (status == 200 || status == 404 || count == 5) ? VisitStatus.VISITED : VisitStatus.NOT_VISITED
  } : {
      ':newStatus': status,
      ':resolved': (status == 200 || status == 404 || count == 5) ? VisitStatus.VISITED : VisitStatus.NOT_VISITED
  }


  var params = {
    TableName: contextTableName,
    Key: { Initial_url },
    UpdateExpression: count > 0 && redirectPath ? `set ${statusCount} = :newStatus, ${redirectPathCount} = :newRedirectPath, resolved = :resolved` : `set ${statusCount} = :newStatus, resolved = :resolved`,
    ExpressionAttributeValues: expressionValues,
  }
  await ddbDoc.update(params).promise()
};

interface LooseObject {
  [key: string]: any
}

export const csvJSON = (csv: string) => {
  var lines = csv.split('\r');
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i].replace(/\s/, '');//delete all blanks
  }
  var result = [];
  var headers = lines[0].split(",");

  for (var i = 1; i < lines.length; i++) {
    var obj: LooseObject = {};

    var currentline = lines[i].split(",");
    for (var j = 0; j < headers.length; j++) {
      if (currentline[j] !== '') {
        obj[headers[j].toString()] = currentline[j];
      }
    }
    result.push(obj);
  }
  return result;
}