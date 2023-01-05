// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import { updateHistoryEntry } from '../utils/historyTable';
import { CrawlContext } from '../crawler/types';
import { deleteContextTable } from '../utils/contextTable';

const kendra = new AWS.Kendra();

export interface KendraDataSourceDetails {
  indexId: string;
  dataSourceId: string;
}

/**
 * This step is run at the end of our step function state machine, once all discovered urls have been visited.
 * Clear the context database and sync the kendra data source.
 */
export const completeCrawl = async (
  crawlContext: CrawlContext,
  kendraDataSourceDetails?: KendraDataSourceDetails,
) => {

  console.log('Crawl complete!');

  return {};
};
