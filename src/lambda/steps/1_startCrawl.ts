// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import { CrawlContext, CrawlInputWithId } from '../crawler/types';
import { createContextTable, queuePaths } from '../utils/contextTable';
import { putHistoryEntry } from '../utils/historyTable';

const sfn = new AWS.StepFunctions();

/**
 * This is the first step in the webcrawler state machine. It's responsible for triggering state machine executions to
 * crawl data for every data source in the data source registry.
 */
export const startCrawl = async (target: CrawlInputWithId, contextTableNamePrefix: string, stateMachineArn: string) => {
  const startTimestamp = new Date().toISOString();
  const sanitisedTimestamp = startTimestamp.replace(/[:\.]/g, '-');

  const crawlContext: CrawlContext = {
    ...target,
    stateMachineArn,
    contextTableName: 'yelling-yeti'
  };

  console.log('Writing initial urls to context table');

  console.log('Starting step function execution');
  const response = await sfn.startExecution({
    name: `${target.crawlName}-${sanitisedTimestamp}`,
    stateMachineArn,
    input: JSON.stringify({
      Payload: { crawlContext },
    }),
  }).promise();

  console.log('Successfully started execution', response);

  return { stateMachineExecutionArn: response.executionArn };
};
