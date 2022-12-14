// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as AWS from 'aws-sdk';
import chrome from 'chrome-aws-lambda';
import { extractPageContentAndUrls } from '../crawler/core';
import { CrawlContext } from '../crawler/types';
import { markPathAsVisited, updatePathWithRedirect } from '../utils/contextTable';
import { Browser, HTTPResponse } from "puppeteer-core";

(async ( path ) => {
  let browser = null
  try {

    browser = await chrome.puppeteer.launch({
      args: chrome.args,
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
      ignoreHTTPSErrors: true,
    });

    console.log('PATH: ', path);

    const page = await browser.newPage();

    page.on('response', async (response: any) => {
      const res = await response
      if (res.url().includes(path)) {
        console.log('RESPONSE: ', res.url(), res.status());
        if (res.status() != 200) {
          // await updatePathWithRedirect(contextTableName, path, res.status(), res.headers()[ 'location' ])
          console.log(res.headers()['location'], res.status());
        }
        if (res.status() == 200) {
          // await markPathAsVisited(contextTableName, path, res.status());
          console.log('Marked path', path, 'as visited.');
        }
      }
    });

    await page.goto(path, {
      waitUntil: ['domcontentloaded'],
    })

  } catch (e) {
    // Failure to crawl a url should not fail the entire process, we skip it and move on.
    console.error('Failed to resolve path', path, e);
  } finally {
    console.log('FINALLY: ');
    browser && await browser.close();
  }
  return {};
})('http://brain.do')
