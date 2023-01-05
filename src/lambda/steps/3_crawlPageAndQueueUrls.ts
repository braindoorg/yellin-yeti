// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import chrome from 'chrome-aws-lambda';
import { extractPageContentAndUrls } from '../crawler/core';
import { CrawlContext } from '../crawler/types';
import { markPathAsVisited, updatePathWithRedirect } from '../utils/contextTable';
import { Browser, HTTPResponse } from "puppeteer-core";

export const crawlPageAndQueueUrls = async (
  path: string,
  crawlContext: CrawlContext,
  dataSourceBucketName?: string,
) => {
  let browser: any = null
  let redirectUrl:string
  let count: number = 0

  browser = await chrome.puppeteer.launch({
    args: chrome.args,
    defaultViewport: chrome.defaultViewport,
    executablePath: await chrome.executablePath,
    headless: chrome.headless,
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  setInterval(async () => {
    console.log('testing')
    try {
      const { contextTableName } = crawlContext;
      await page.setRequestInterception(true);
      page.on('request', async (request: any) => {
        const req = await request
        if (req.url().includes(path) || req.url() === redirectUrl) { req.continue() } else { req.abort() }
      })


      page.on('response', async (response: any) => {
        const res = await response


        if ((res.url().includes(path) || res.url() == redirectUrl) && count < 5) {
          if (res.status() != 200) {
            redirectUrl = res.headers()['location']
            await updatePathWithRedirect(contextTableName, path, res.status(), redirectUrl, count)
            console.log('Redirect from', res.url(), 'to', res.headers()['location'])
          }
          if (res.status() == 200) {
            console.log('Marked path', path, 'as visited.');
            await updatePathWithRedirect(contextTableName, path, res.status(), redirectUrl, count)
            redirectUrl = ''
            // await browser.close();
          }
          count++
        }
      });

      await page.goto(path, {
        waitUntil: ['networkidle0'],
      })

    } catch (e) {
      // Failure to crawl a url should not fail the entire process, we skip it and move on.
      console.error('Failed to resolve path', path, e);
    } finally {
      console.log('FINALLY: ');
      browser && await browser.close();
    }
  }, 200)
  return {};
};
